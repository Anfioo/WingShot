# Automatic QR recognition validation

## Automated coverage

Use the Debug preset and run only the relevant tests:

```powershell
ctest --preset test-windows-msvc-debug -R '^snow-shot-(qr-controller|qr-recognition-service|move-region-toolbar|recognition-session-controller)-tests$' --output-on-failure
```

The decoder tests use a fixed QR fixture and verify corner coordinates before/after downsampling,
rotated duplicate payloads, QR-only behavior, existing EAN decoding, cancellation, and Unicode model paths.
The offscreen controller tests cover source masking, disjoint regions and holes, source-to-canvas
scaling, camera transforms, separate display canvases, stale callbacks, empty/error results, marker
visibility, recapture suspension/reset, unchanged exported pixels, hover handoff, keyboard/copy/URL
actions, and literal Unicode/HTML-like text. Move toolbar tests cover order and disabled/checked states.

The existing recognition-session tests and pinned recognition shortcut/context-menu tests also pass.
Pinned recognition uses the unchanged manual workflow. Both the pinned-window and MCP-document test
targets compile with the new optional recognition mode. Six distinct targeted CTest groups passed.

## Visual checks

Generate popover and marker previews with `snow-shot-qr-controller-tests --preview-dir <directory>`.
Set `QT_QPA_PLATFORM=offscreen` and run once each with `QT_SCALE_FACTOR=1`, `1.5`, and `2`.
The fixture covers both light/dark themes and text/URL payloads, and checks available-screen containment.
On Windows it registers Segoe UI and Microsoft YaHei for meaningful offscreen font rendering.

The generated previews were inspected at all three scales. Native macOS and physical mixed-DPI
multi-monitor capture/recapture remain manual platform checks; offscreen tests simulate separate
canvas transforms, but cannot verify native window stacking or the OS capture compositor.

## Release performance

Build only `snow-shot-qr-performance-benchmark` with `windows-msvc-performance` and run it with
`QT_QPA_PLATFORM=offscreen`. If OpenCV DLLs are not already staged beside the executable, prepend
`.tools/vcpkg/installed/dynamic/x64-windows/bin` to PATH. It prints JSON and fails on missing/failed QR results.

Sample Windows Release run, 2026-09-28; one QR per image, one first request and three repeated requests:

| Input | First request (ms) | Repeated median (ms) | Maximum UI dispatch (ms) | Process peak (MiB) |
| --- | ---: | ---: | ---: | ---: |
| 1920 × 1080 | 75.2 | 47.3 | 0.105 | 49.3 |
| 3840 × 2160 | 60.8 | 53.8 | 0.106 | 87.5 |
| 7680 × 4320 | 57.2 | 55.5 | 0.104 | 182.6 |

Times include worker composition/masking and decoding. The service retains its existing short-lived
worker policy, so repeated requests benefit from filesystem/OS caches rather than persistent DNN
sessions. Peak working set is cumulative for the benchmark process and includes the full-resolution
fixture images; it is not incremental feature memory. Temporary scan images are bounded to about
2 megapixels before composition. The benchmark also records maximum event-loop heartbeat gaps.

No full test suite was run. No dependency or persistent-settings changes are required.
