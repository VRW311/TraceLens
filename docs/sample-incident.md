# Incident 001: The checkout slowdown

**Synthetic data.** No customer, employer, or production records are included.

At 14:02 UTC, checkout starts returning 503s. Payments and inventory remain healthy. Investigate the first failure, the affected service, the preceding change, and the recovery.

## Ground truth

At 14:02:10 a checkout configuration release lowers the database pool limit from 20 to 2. Under concurrent traffic, checkout workers cannot acquire database connections. Acquisition warnings precede `pool.exhausted` errors and failed checkout requests. A rollback at 14:03:15 restores the limit to 20; `pool.ready` confirms capacity at 14:03:16. The next checkout requests succeed.

This compact fixture deliberately contains out-of-order delivery, equal timestamps, a retry with the same trace ID, and healthy activity from other services. It demonstrates investigation rather than production throughput.

## Expected investigation answers

1. **What changed?** `config.changed` in checkout at 14:02:10: pool maximum 20 → 2.
2. **When did failure begin?** First `pool.exhausted` at 14:02:21, followed by a checkout 503 for trace `chk-104`.
3. **What was affected?** Checkout. The sample records six failed checkout request attempts across five traces; two attempts belong to `chk-104`. This is not a count of unique customers.
4. **What supports the explanation?** Configuration log, acquisition warnings, exhaustion errors, and slow 503 request completions sharing trace IDs.
5. **What restored service?** Rollback at 14:03:15; pool ready at 14:03:16; successful checkout requests afterwards.
6. **What remains uncertain from these logs alone?** Whether the configuration change was the sole cause, actual user impact, concurrency levels, and whether recovery was sustained beyond this sample.

The application should expose these observations without forcing a visitor to read source code. Its findings must link to the evidence and identify temporal association rather than assert an automatically proven root cause.
