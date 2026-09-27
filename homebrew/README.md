# Snow Shot Homebrew tap

Apple Silicon and macOS 15 or later are required. After the first stable cask is published:

```sh
brew install --cask mg-chao/tap/snow-shot
brew upgrade --cask snow-shot
brew uninstall --cask snow-shot
```

Homebrew manages the app; installation reuses Snow Shot's local signing identity.
The first installation may request Keychain access and macOS privacy permissions.
Keep `~/Library/Application Support/Snow Shot/Installer` and the original Keychain
identity across upgrades and reinstalls. Uninstall retains these and your user data.
Local signing is not Apple notarization; macOS may request permission again.

For an existing manual installation, quit Snow Shot and move `Snow Shot.app` (or
legacy `snow_shot.app`) out of Applications to a backup folder before installing.
Keep its signing state and Keychain identity. Do not use `--force` to overwrite it.
Delete the backup only after confirming the Homebrew installation works.

Use `brew install --cask --appdir="$HOME/Applications" mg-chao/tap/snow-shot` for
another application directory (create it first). Use the same desktop account for
upgrades. Quit Snow Shot and finish recordings before upgrading or uninstalling.

Release and recovery details: [Snow Shot macOS documentation](https://github.com/mg-chao/snow-apps/blob/main/docs-macos-build.md).
