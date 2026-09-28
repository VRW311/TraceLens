# Verification record

Local verification on 2026-09-28 used GCC 13.3, Emscripten 4.0.15, Node 24, TypeScript 7.0.2, Vite 8.3.1, and Playwright 1.56.1 / Chromium 141 on Linux.

- `engine_tests`: 20 semantic cases. These exercise epoch/date validity, leap years, BOM/CRLF, stable ties, duplicate retention, malformed rows, numeric limits, escaping/UTF-8, identifiers, combined filters, inclusive bounds, nearest-rank p95, paging, fixed timeline boundaries, diagnostic limits, line/file/event bounds, reload state, and the fixture ground truth.
- `tests/wasm-parity.mjs`: 35 comparisons over five input variants and seven filter combinations; three binding checks. Compares parsed JSON from the actual native executable and actual WebAssembly module.
- Browser suite: nine tests, using the built site with its real worker and Wasm module. No engine mock. Includes desktop and a 390-pixel mobile viewport.
- TypeScript strict check and Vite production build passed.

The earlier engine build also passed AddressSanitizer and UndefinedBehaviorSanitizer with leak detection disabled because the execution environment did not permit LeakSanitizer's process inspection. This is not a claim that leak detection passed.

No production load benchmark, independent security audit, or cross-browser certification is claimed. The screenshot is captured from the real running app. GitHub Actions is the source of truth for the current commit's remote checks.

## Remote verification

GitHub Actions run [36476490348](https://github.com/VRW311/TraceLens/actions/runs/36476490348) passed the native build/tests, WebAssembly build/parity checks, TypeScript/build step, and all nine browser tests. Its deploy job failed while trying to create the Pages site: `Resource not accessible by integration`. The repository owner must enable Pages with GitHub Actions as its source once. The final fixture correction gives a healthy request its own trace ID; all local checks passed again, including five distinct failed traces.
