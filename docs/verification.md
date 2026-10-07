# Verification record

Local verification on 2026-09-28 used GCC 13.3, Emscripten 4.0.15, Node 24, TypeScript 7.0.2, Vite 8.3.1, and Playwright 1.56.1 / Chromium 141 on Linux.

- `engine_tests`: 20 semantic cases. These exercise epoch/date validity, leap years, BOM/CRLF, stable ties, duplicate retention, malformed rows, numeric limits, escaping/UTF-8, identifiers, combined filters, inclusive bounds, nearest-rank p95, paging, fixed timeline boundaries, diagnostic limits, line/file/event bounds, reload state, and the fixture ground truth.
- `tests/wasm-parity.mjs`: 35 comparisons over five input variants and seven filter combinations; three binding checks. Compares parsed JSON from the actual native executable and actual WebAssembly module.
- Browser suite: nine tests, using the built site with its real worker and Wasm module. No engine mock. Includes desktop and a 390-pixel mobile viewport.
- TypeScript strict check and Vite production build passed.

The earlier engine build also passed AddressSanitizer and UndefinedBehaviorSanitizer with leak detection disabled because the execution environment did not permit LeakSanitizer's process inspection. This is not a claim that leak detection passed.

No production load benchmark, independent security audit, or cross-browser certification is claimed. The screenshot is captured from the real running app. GitHub Actions is the source of truth for the current commit's remote checks.

## Remote verification

GitHub Actions run [36476490348](https://github.com/VRW311/TraceLens/actions/runs/36476490348) passed the native build/tests, WebAssembly build/parity checks, TypeScript/build step, and all nine browser tests. Its deploy job failed while trying to create the Pages site: `Resource not accessible by integration`. The repository owner subsequently enabled Pages with GitHub Actions as its source. The final fixture correction gives a healthy request its own trace ID; all local checks passed again, including five distinct failed traces.

## Deployment failures and recovery — 2026-10-07

Two separate infrastructure failures occurred before successful publication:

| Stage | Observed failure | Resolution and evidence |
|---|---|---|
| Pages configuration | `Create Pages site failed: Resource not accessible by integration` | The repository owner enabled **Settings → Pages → Source: GitHub Actions**. The workflow could then configure and publish the existing Pages site. |
| Emscripten installation | `xz: (stdin): Unexpected end of input` and `tar: Unexpected EOF in archive` while unpacking the 4.0.15 SDK | The downloaded archive was incomplete. A workflow retry downloaded and installed it successfully. The underlying reason for the truncated download was not established; no application-code change was required for recovery. |

Run [36477015078](https://github.com/VRW311/TraceLens/actions/runs/36477015078) subsequently completed both **verify** and **deploy** successfully. The SDK failure had stopped verification and skipped deployment; it was separate from the earlier Pages permission failure. Node.js deprecation and missing test-artifact warnings were not the fatal errors shown in those attempts.

A later independent push run, [37657249972](https://github.com/VRW311/TraceLens/actions/runs/37657249972), also passed native tests, real WebAssembly build/parity checks, TypeScript/build, browser investigation tests, Pages packaging, and deployment.

## Published demo smoke test — 2026-10-07

The deployed [GitHub Pages demo](https://vrw311.github.io/TraceLens/) was exercised directly in Chrome:

- Engine reached **Engine ready** and automatically loaded 36 sample events.
- Initial summary matched the walkthrough: 6 failed request attempts, 12 error events, and 5.09 s p95.
- Line 8 opened the configuration change from a pool limit of 20 to 2.
- Line 12 opened the first pool exhaustion at 14:02:21 UTC.
- **Follow this trace** selected `chk-104`: 5 events and 2 failed request attempts.
- **Reset filters** restored the complete sample.
- Line 31 showed successful post-rollback completion: HTTP 200, 112 ms.
- Filtering to `payments` returned 3 request completions with 0 failed attempts and 0 error events.

These checks confirm the documented employer walkthrough works on the published Chromium-based demo. They do not establish Firefox/Safari coverage, production performance, or a security audit. No application source was changed during this final check.
