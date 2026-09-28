import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import createModule from "../web/public/wasm/tracelens.js";

const wasm = await createModule({
  wasmBinary: readFileSync(
    new URL("../web/public/wasm/tracelens.wasm", import.meta.url),
  ),
});
const sample = readFileSync("samples/checkout-outage.tsv", "utf8");
const header = sample.split("\n")[0] + "\n";
const variants = [
  sample,
  header,
  sample + "bad row\n",
  header + "2026-02-30T00:00:00.000Z\tINFO\tx\tx\t-\t-\t-\tbad date\n",
  "wrong header\n",
];
const filters = [
  [],
  ["--service", "checkout"],
  ["--level", "ERROR"],
  ["--trace", "chk-104"],
  ["--search", "DATABASE"],
  ["--from", "2026-09-28T14:03:15.000Z"],
  ["--service", "payments", "--level", "ERROR"],
];
const temp = mkdtempSync(join(tmpdir(), "tracelens-"));
let checks = 0;
try {
  for (let i = 0; i < variants.length; i++) {
    const path = join(temp, `fixture-${i}.tsv`);
    writeFileSync(path, variants[i]);
    const parsed = JSON.parse(wasm.loadLogs(variants[i]));
    for (const args of filters) {
      let stdout;
      try {
        stdout = execFileSync("build/native/tracelens", [path, ...args], {
          encoding: "utf8",
        });
      } catch (e) {
        if (e.status !== 1) throw e;
        stdout = e.stdout;
      }
      const native = JSON.parse(stdout);
      const map = Object.fromEntries(
        Array.from({ length: args.length / 2 }, (_, n) => [
          args[n * 2],
          args[n * 2 + 1],
        ]),
      );
      const actual = JSON.parse(
        wasm.queryLogs(
          map["--service"] ?? "",
          map["--level"] ?? "",
          map["--search"] ?? "",
          map["--trace"] ?? "",
          map["--from"] ?? "",
          map["--to"] ?? "",
          0,
          50,
        ),
      );
      assert.deepEqual(parsed, native.parse);
      assert.deepEqual(actual, native.result);
      checks++;
    }
  }
  wasm.loadLogs(sample);
  assert.equal(JSON.parse(wasm.eventByLine(12)).event, "pool.exhausted");
  assert.equal(JSON.parse(wasm.eventByLine(9999)), null);
  assert.ok(
    JSON.parse(wasm.queryLogs("", "", "", "", "invalid", "", 0, 50)).error,
  );
  console.log(
    `${checks} native/Wasm parity comparisons and 3 binding checks passed.`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
