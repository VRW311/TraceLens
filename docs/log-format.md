# TraceLens TSV v1

UTF-8 text, one event per line. The first line is this exact, tab-separated header:

```text
timestamp	level	service	event	trace_id	duration_ms	status	message
```

| Field | Contract |
|---|---|
| timestamp | UTC only, exactly `YYYY-MM-DDTHH:mm:ss.SSSZ`, years 1970–9999; valid Gregorian date; leap seconds unsupported |
| level | `DEBUG`, `INFO`, `WARN`, or `ERROR` |
| service / event | 1–64 ASCII letters, digits, `.`, `_`, or `-` |
| trace_id | Same identifier rules; `-` means no trace |
| duration_ms | Nonnegative whole milliseconds up to 86,400,000, or `-` |
| status | HTTP status 100–599, or `-` |
| message | UTF-8 text; `\\t`, `\\n`, `\\r`, and `\\\\` escapes supported; other escapes rejected |

Actual tabs delimit exactly eight fields. LF and CRLF are accepted, as is a UTF-8 BOM at the start. Empty lines are ignored. A missing/wrong header or input over 10 MiB is a fatal error. Invalid event rows are skipped with line-numbered diagnostics; valid rows remain investigable. Lines over 16 KiB are rejected. Files above 50,000 valid events are rejected entirely. Invalid UTF-8 and embedded NUL bytes are rejected entirely.

Events are stably sorted by timestamp, then original source line. Source lines are durable event IDs within the loaded file. Equal timestamps preserve file order. Duplicate records are retained.

## Query and analysis contract

Filters combine with AND: exact service, exact level, exact trace ID, inclusive UTC time bounds, and case-insensitive ASCII substring search across service, event, trace ID, and message. Non-ASCII characters are matched byte-for-byte. Filters execute in C++. Browser code presents the result.

Summaries count all matching events, `ERROR` / `WARN` events, distinct nonempty traces, and failed requests (`request.completed` with status >= 500). Latency p95 uses nearest rank over matching `request.completed` events with a duration: sorted value at `ceil(0.95 * n) - 1`. No request latency means `null`, never zero. This is a statistic for the loaded sample, not a production SLA.

Timeline buckets have a minimum width of one second and at most 40 buckets over the full file's time extent. Filtered events use those same boundaries so comparisons remain meaningful. Returned event pages contain at most 100 events. Summary/timeline counts use every matching event, not just the page.

Findings cite original source lines. A configuration change followed by pool exhaustion is evidence of an association; causal proof requires additional operational evidence. The bundled synthetic incident has known ground truth in `sample-incident.md`.
