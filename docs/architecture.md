# Architecture and first-release scope

`TSV → C++ parser → sorted Event collection → C++ queries/summary/findings → JSON → TypeScript UI`

The same C++17 engine builds into a native CLI and an Emscripten WebAssembly module. Parsing, validation, filtering, ordering, pagination, latency statistics, timeline aggregation, and findings belong to C++. TypeScript owns interaction, rendering, and file selection. A dedicated Web Worker owns the WebAssembly instance so analysis does not block the interface.

## Data model

- `Event`: UTC epoch milliseconds, original timestamp, severity, service, event kind, optional trace ID/duration/status, message, source line.
- `Diagnostic`: rejected source line and human-readable reason. Total count retained; first 100 details displayed.
- `Dataset`: sorted events, parse diagnostics, ordered service names, and global time bounds.
- `Query`: service, severity, text, trace ID, inclusive time bounds, offset, limit.
- `QueryResult`: total matches, one page of events, complete filtered summary, fixed-boundary timeline.
- `Finding`: title, calibrated explanation, and evidence source lines.

## Milestones

1. Contract + synthetic incident and expected findings.
2. Native engine/CLI tests; actual WebAssembly build and native/Wasm parity test.
3. TypeScript investigation UI; full sample flow, uploads, diagnostics, empty/error states, keyboard use.
4. GitHub Actions checks and Pages deployment; README, screenshot, walkthrough, measured limitations.

## Decisions

- One tab-separated format makes validation and edge cases tractable; adapters can follow later.
- No backend or external analysis service. User-selected logs are processed in browser memory, not uploaded by TraceLens.
- No persisted logs, login, database, AI-generated diagnosis, distributed trace ingestion, or Kubernetes dependency for v1.
- Escape all displayed log text via DOM text nodes. Loaded log content is data, including content that resembles HTML.
- Reproducible toolchain and dependency versions; build products remain generated artifacts.
- Native tests cover parser boundaries and analysis independently; WebAssembly tests check shared behavior; browser tests check the actual user flow.
