#!/usr/bin/env python3
"""Build and publish the Snow Shot tap from immutable stable GitHub release assets."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

REPOSITORY = 'mg-chao/snow-apps'
STABLE = r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def release_version(release):
    tag = release.get('tag_name', '')
    match = re.fullmatch('v(' + STABLE + ')_snow-shot', tag)
    if not match or release.get('draft') is not False or release.get('prerelease') is not False:
        raise ValueError('Homebrew requires a published stable v<version>_snow-shot release.')
    return match[1]


def check_current(current, version, generated=None):
    if not current.exists():
        return
    text = current.read_text(encoding='utf-8')
    match = re.search(r'^  version "(' + STABLE + r')"$', text, re.MULTILINE)
    if not match:
        raise ValueError('The existing tap cask has no recognized stable version.')
    previous = match[1]
    if tuple(map(int, previous.split('.'))) > tuple(map(int, version.split('.'))):
        raise ValueError('Refusing to downgrade the Homebrew tap.')
    if previous == version and generated is not None and text != generated:
        raise ValueError('Refusing to change the contents of an already published cask version.')


def required_assets(release, version):
    dmg = f'snow-shot-{version}-macos-arm64.dmg'
    names = [asset['name'] for asset in release.get('assets', [])]
    for name in (dmg, dmg + '.sha256'):
        if names.count(name) != 1:
            raise ValueError(f'Missing or duplicate {name}. Upload the macOS DMG/checksum pair and retry the workflow.')
    return dmg


def cask(version, sha256):
    return f'''cask "snow-shot" do
  version "{version}"
  sha256 "{sha256}"

  url "https://github.com/{REPOSITORY}/releases/download/v#{{version}}_snow-shot/snow-shot-#{{version}}-macos-arm64-homebrew.tar.gz",
      verified: "github.com/{REPOSITORY}/"
  name "Snow Shot"
  desc "Screenshot and screen recording application"
  homepage "https://snowshot.top/"

  depends_on arch: :arm64
  depends_on macos: :sequoia

  app "Snow Shot.app"

  preflight_steps do
    run "/bin/bash",
        args:           ["{{{{staged_path}}}}/prepare-snow-shot-homebrew.sh",
                         "{{{{staged_path}}}}/snow-shot-{{{{version}}}}-macos-arm64.dmg",
                         "{{{{staged_path}}}}/Snow Shot.app"],
        print_stdout:   true,
        writable_paths: ["~/Library/Application Support/Snow Shot",
                         "~/Library/Keychains",
                         "~/Library/Security"]
  end

  caveats <<~EOS
    Snow Shot reuses a signing identity in your login Keychain. The first install
    may request Keychain access. Grant Screen Recording and Accessibility when
    macOS requests them. Local signing does not provide Apple notarization.
    Keep ~/Library/Application Support/Snow Shot/Installer and its Keychain
    identity across upgrades and reinstalls. Use the same installing account.
  EOS
end
'''


def package(release, source, assets, output, current):
    version = release_version(release)
    check_current(current, version)
    name = required_assets(release, version)
    cmake = (source / 'CMakeLists.txt').read_text(encoding='utf-8')
    if f'set(SNOW_SHOT_VERSION "{version}")' not in cmake:
        raise ValueError('The checked-out release source version does not match its tag.')
    installer = (source / 'scripts/install-snow-shot-macos.sh').read_bytes()
    if b'--prepare-app)' not in installer or b'\r' in installer:
        raise ValueError('The release installer must support --prepare-app and use LF line endings.')
    preflight = (source / 'scripts/prepare-snow-shot-homebrew.sh').read_bytes()
    if b'\r' in preflight:
        raise ValueError('The Homebrew preflight must use LF line endings.')
    dmg = assets / name
    checksum = assets / (name + '.sha256')
    lines = [line.strip() for line in checksum.read_text(encoding='utf-8').splitlines() if line.strip()]
    if len(lines) != 1 or not re.fullmatch(r'[0-9a-fA-F]{64}(?:\s+.*)?', lines[0]):
        raise ValueError('Invalid DMG checksum sidecar.')
    if digest(dmg) != lines[0][:64].lower():
        raise ValueError('DMG checksum mismatch.')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'snow-shot-{version}-macos-arm64-homebrew.tar.gz'
    # Fixed metadata and gzip header make retries byte-identical across hosts.
    with archive.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.USTAR_FORMAT) as tar:
            for filename, path, content in (
                (name, dmg, None),
                (name + '.sha256', None, (digest(dmg) + '  ' + name + '\n').encode()),
                ('install-snow-shot-macos.sh', None, installer),
                ('prepare-snow-shot-homebrew.sh', None, preflight),
            ):
                info = tarfile.TarInfo(filename)
                info.mode = 0o644
                info.size = path.stat().st_size if path else len(content)
                with path.open('rb') if path else io.BytesIO(content) as stream:
                    tar.addfile(info, stream)
    generated = cask(version, digest(archive))
    check_current(current, version, generated)
    casks = output / 'Casks'
    casks.mkdir(exist_ok=True)
    (casks / 'snow-shot.rb').write_text(generated, encoding='utf-8')
    return archive, generated


def run(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, text=True, stdout=subprocess.PIPE).stdout


def ensure_asset(release, archive):
    matches = [asset for asset in release['assets'] if asset['name'] == archive.name]
    if len(matches) > 1:
        raise ValueError('Duplicate Homebrew release assets.')
    if matches:
        with tempfile.TemporaryDirectory(prefix='snow-homebrew-existing-') as directory:
            run('gh', 'release', 'download', release['tag_name'], '--repo', REPOSITORY,
                '--pattern', archive.name, '--dir', directory)
            if digest(Path(directory) / archive.name) != digest(archive):
                raise ValueError('Existing Homebrew archive differs; never replace a published asset.')
    else:
        run('gh', 'release', 'upload', release['tag_name'], str(archive), '--repo', REPOSITORY)


def publish(tag, source, tap, output):
    if not re.fullmatch('v' + STABLE + '_snow-shot', tag):
        raise ValueError('Expected a stable v<version>_snow-shot tag.')
    release = json.loads(run('gh', 'api', f'repos/{REPOSITORY}/releases/tags/{tag}'))
    if release['tag_name'] != tag:
        raise ValueError('Unexpected release tag returned by GitHub.')
    version = release_version(release)
    current = tap / 'Casks/snow-shot.rb'
    check_current(current, version)
    name = required_assets(release, version)
    with tempfile.TemporaryDirectory(prefix='snow-homebrew-assets-') as directory:
        run('gh', 'release', 'download', tag, '--repo', REPOSITORY,
            '--pattern', name, '--pattern', name + '.sha256', '--dir', directory)
        archive, generated = package(release, source, Path(directory), output, current)
    # Complete every validation before either public destination is changed.
    ensure_asset(release, archive)
    current.parent.mkdir(parents=True, exist_ok=True)
    current.write_text(generated, encoding='utf-8')
    readme = tap / 'README.md'
    if not readme.exists():
        readme.write_text((Path(__file__).resolve().parent.parent / 'homebrew/README.md').read_text(encoding='utf-8'), encoding='utf-8')
    run('git', 'add', 'Casks/snow-shot.rb', 'README.md', cwd=tap)
    if run('git', 'diff', '--cached', '--name-only', cwd=tap).strip():
        run('git', '-c', 'user.name=github-actions[bot]', '-c',
            'user.email=41898282+github-actions[bot]@users.noreply.github.com',
            'commit', '-m', f'feat(snow-shot): update to {version}', cwd=tap)
        # No force push: concurrent tap edits cause a retry, never lost history.
        run('git', 'push', 'origin', 'HEAD:main', cwd=tap)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    local = commands.add_parser('package', help='Generate an archive and initial Casks/snow-shot.rb without publishing')
    local.add_argument('--release-json', type=Path, required=True)
    local.add_argument('--assets', type=Path, required=True)
    local.add_argument('--current-cask', type=Path, required=True)
    remote = commands.add_parser('publish', help='Publish verified assets and update the checked-out tap')
    remote.add_argument('--tag', required=True)
    remote.add_argument('--tap', type=Path, required=True)
    for command in (local, remote):
        command.add_argument('--source', type=Path, required=True)
        command.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'package':
            package(json.loads(args.release_json.read_text(encoding='utf-8')), args.source,
                    args.assets, args.output, args.current_cask)
        else:
            publish(args.tag, args.source, args.tap, args.output)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Homebrew release failed: {error}\n')


if __name__ == '__main__':
    main()
