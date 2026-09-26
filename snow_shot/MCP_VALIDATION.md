# MCP validation

Snow Shot's MCP surface targets protocol version `2026-07-28`. The public tool
catalog and Qt dispatch use `snow_shot_<domain>_<verb>` names. The private
`snow-shot-mcp/1` connection includes resource events and request cancellation
on every authenticated connection.

## Focused automated checks

Run only the affected targets after changing MCP code:

- `cargo test --manifest-path snow_shot/rust/snow-shot-mcp/Cargo.toml`
- `cargo clippy --manifest-path snow_shot/rust/snow-shot-mcp/Cargo.toml --all-targets -- -D warnings`
- `python snow_shot/tests/check_mcp_capabilities.py`
- `python snow_shot/tests/mcp_stdio_tests.py <bridge>`
- `ctest --preset test-windows-msvc-debug -R '^snow-shot-mcp-(tests|document-tests|application-tests|fixture-tests)$' --output-on-failure`

On macOS, use the matching Debug preset and build `snow_shot` plus the MCP test
executables before running the focused `snow-shot-mcp-*` CTest names. The
`mcp_application_fixture_tests.py` harness accepts `--platform cocoa --native-capture`
for screenshot capture, render and save without changing the clipboard, and
`--platform cocoa --recording` for a native region recording with both audio inputs disabled. Its
default offscreen mode exercises the production application router without
desktop capture. The macOS bridge keeps its descriptor in Application Support
and places its socket in a short, private directory under `/tmp`.

The capability check compares 101 Rust tools with Qt dispatch, the checked
catalog, and 28 screenshot input fixtures. The stdio check verifies discovery,
schemas, bounded transport, clean shutdown, and rejection of the previous
initialize protocol. The offscreen fixture uses the real bridge and Qt server to
exercise document workflows, modern resource subscriptions, Tasks, and all
28 screenshot tool contracts. Synthetic capture, provider, clipboard, and pin
ports make these checks deterministic; they do not establish native desktop
behavior.

For an interactive Windows check, run `snow_shot/tests/mcp_live_tests.py`
with an isolated test build. It captures the desktop and restores the clipboard.
The optional application fixture's `--recording` check also requires
`--platform windows` on Windows or `--platform cocoa` on macOS; it records a
native desktop region and cannot run with the offscreen Qt platform.
The performance target `snow-shot-mcp-performance-benchmark` must be built
and run with `windows-msvc-performance`.

## macOS arm64 verification

On an Apple Silicon macOS 27.0 device, the arm64 Debug build passed all 11
focused `snow-shot-mcp-*` CTest cases, the app permission test, and the Rust
bridge's 23 unit tests and Clippy check. With Screen Recording granted, the
isolated Cocoa application fixture passed native screenshot begin, render, save,
and direct capture without changing the clipboard. It also passed a short
region recording, pause/resume/stop, and artifact hash and retention checks
with microphone and system audio disabled. The fixture used temporary storage
and a local translation provider.
The static arm64 Release build staged successfully with the SnowShot CMake
component. The staged app passed strict bundle signature verification and its
bundled arm64 `snow-shot-mcp` passed the stdio protocol check. The bridge links
only system libraries.

## Socket lifecycle and permission admission regression checks

The subsequent macOS arm64 Debug refactor passed the 12 focused MCP and app
permission CTest cases and all 24 Rust bridge unit tests. The new regressions
first failed against the previous implementation for stale first-action permission
admission and socket-directory cleanup. Coverage now includes fresh grant and
revocation checks, queued refresh consumption, permission request and settings
routing, socket directory privacy, independent endpoints, restart and destruction,
and cleanup after descriptor publication failure. Bridge tests reject mismatched
owners, permissions, generations, paths, regular files, and directory symlinks.
The application and affected test targets built successfully; Rust Clippy with
warnings denied and formatting checks passed.

## Remaining release validation

Native capture across monitors and scale factors, provider accounts, recording
hardware, packaged executable launch, and permissions and media paths still
need validation on the supported macOS versions and architectures before release.
