import "./style.css";
import type { Event as LogEvent, Report, Result, Query } from "./types";

document.querySelector("#app")!.innerHTML = `
<a class="skip" href="#workspace">Skip to investigation</a>
<aside class="sidebar"><a class="brand" href="${import.meta.env.BASE_URL}"><span class="brand-icon">⌁</span>TraceLens<sup>01</sup></a><p class="nav-label">WORKSPACE</p><a class="nav active" href="#workspace"><span>▤</span> Investigation <i></i></a><a class="nav" href="https://github.com/VRW311/TraceLens/blob/main/docs/log-format.md" target="_blank" rel="noreferrer"><span>≡</span> Log format ↗</a><div class="side-story"><span class="eyebrow">FOLLOW THE EVIDENCE</span><h2>Small signals.<br>Clearer answers.</h2><p>Move from a wall of logs to an investigation you can explain.</p><div class="signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="side-bottom"><strong><i></i> Local by design</strong><p>Logs stay in this browser.<br>No account. No upload server.</p><a href="https://github.com/VRW311/TraceLens" target="_blank" rel="noreferrer">View source on GitHub ↗</a><small>v0.1 · C++ / WebAssembly</small></div></aside>
<main id="workspace" tabindex="-1"><header class="topbar"><div><span>WORKSPACE</span><b>/</b> Log investigation</div><span id="engine" class="engine" role="status">Starting engine…</span></header><div class="content">
<section class="heading"><div><div class="eyebrow"><i></i> INVESTIGATION 001</div><h1 id="title">Checkout slowdown</h1><p id="subtitle">Trace a failed checkout from the first warning to recovery.</p></div><div class="actions"><button id="sample" class="button secondary">↻ Load sample</button><button id="upload" class="button primary">↑ Open log file</button><input id="file" type="file" accept=".tsv,.txt,.log,text/plain,text/tab-separated-values" hidden/></div></section>
<div id="error" class="alert hidden" role="alert"></div>
<div class="dataset"><div><span id="kind" class="tag">SYNTHETIC INCIDENT</span><span id="filename">checkout-outage.tsv</span></div><span id="meta">Loading the sample…</span></div>
<details id="diagnostics" class="diagnostics hidden"><summary id="diagnostic-title"></summary><ul id="diagnostic-list"></ul></details>
<section class="metrics" aria-label="Investigation summary"><article><span>Matching events</span><strong id="events">—</strong><small id="traces">Across the loaded file</small></article><article><span>Failed requests <b class="red">↗</b></span><strong id="failed">—</strong><small>Request attempts with a 5xx status</small></article><article><span>Error events <b class="amber">!</b></span><strong id="errors">—</strong><small id="warnings">Warnings and errors</small></article><article><span>Request latency · p95</span><strong id="p95">—</strong><small>Nearest rank · matching requests</small></article></section>
<section class="panel"><div class="panel-heading"><div><h2>Event timeline</h2><p>Select a bar to narrow the time range.</p></div><div class="legend"><span><i></i> Other events</span><span><i></i> Errors</span></div></div><div id="timeline" class="timeline" aria-label="Event timeline"></div><div class="time-labels"><span id="time-start">—</span><span>All times in UTC</span><span id="time-end">—</span></div></section>
<section class="evidence"><div class="section-heading"><h2>Evidence notes</h2><span>All loaded events · observations, not a proven cause</span></div><div id="findings" class="findings"></div></section>
<section class="panel"><div class="panel-heading"><div><h2>Explore events <span id="count" class="count">0</span></h2><p>Filter the noise. Open an event to inspect the details.</p></div><button id="reset" class="text-button">Reset filters</button></div>
<form id="filters" class="filters"><label class="search"><span class="sr-only">Search events</span><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search messages, events, traces…"/></label><label><span class="sr-only">Service</span><select id="service" aria-label="Service"><option value="">All services</option></select></label><label><span class="sr-only">Level</span><select id="level" aria-label="Level"><option value="">All levels</option><option>ERROR</option><option>WARN</option><option>INFO</option><option>DEBUG</option></select></label><label class="trace"><span class="sr-only">Trace ID</span><input id="trace" placeholder="Trace ID"/></label><button id="time-toggle" type="button" class="button secondary" aria-expanded="false" aria-controls="time-form">Time range</button></form>
<form id="time-form" class="time-form hidden"><label>From (UTC)<input id="from" type="datetime-local" step="0.001"/></label><label>To (UTC)<input id="to" type="datetime-local" step="0.001"/></label><button class="button secondary">Apply range</button><button id="clear-time" type="button" class="text-button">Clear range</button></form><div id="chips" class="chips hidden"></div>
<div class="table-scroll"><table><thead><tr><th>TIME <span>UTC ↓</span></th><th>LEVEL</th><th>SERVICE</th><th>EVENT</th><th>TRACE</th><th class="numeric">DURATION</th><th><span class="sr-only">Inspect</span></th></tr></thead><tbody id="rows"></tbody></table></div>
<div id="empty" class="empty hidden"><span>⌕</span><h3>No events match</h3><p>Try a broader search or reset the filters.</p><button id="empty-reset" class="button secondary">Reset filters</button></div><footer class="table-footer"><span id="page-status" role="status">Waiting for engine…</span><div><button id="previous" aria-label="Previous page" disabled>←</button><button id="next" aria-label="Next page" disabled>→</button></div></footer></section>
<footer class="page-footer"><span>Make the evidence explainable.</span><span>Processed locally with C++ + WebAssembly <i>●</i></span></footer></div></main>
<dialog id="detail"><div class="detail-top"><span class="eyebrow">EVENT DETAIL</span><button id="close" aria-label="Close event details">×</button></div><div id="detail-body"></div></dialog>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const field = (id: string) => $<HTMLInputElement>(id);
const btn = (id: string) => $<HTMLButtonElement>(id);
const set = (id: string, value: string) => {
  $(id).textContent = value;
};
const show = (id: string, visible: boolean) =>
  $(id).classList.toggle("hidden", !visible);
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 23);
const duration = (ms: number | null) =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function error(message: string) {
  set("error", message);
  show("error", true);
}
let report: Report | null = null,
  result: Result | null = null,
  name = "checkout-outage.tsv",
  offset = 0,
  from = "",
  to = "",
  revision = 0,
  sequence = 0,
  loading = false;
let failedEngine = false;
const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
  type: "module",
});
const pending = new Map<
  number,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
function rpc<T>(op: string, args: unknown = {}): Promise<T> {
  if (failedEngine)
    return Promise.reject(
      new Error(
        "The analysis engine is unavailable. Reload the page to retry.",
      ),
    );
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          "The analysis engine did not respond. Reload the page to retry.",
        ),
      );
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, op, args });
  });
}
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(data.id);
  data.error ? p.reject(new Error(data.error)) : p.resolve(data.value);
};
worker.onerror = () => {
  failedEngine = true;
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error("The WebAssembly engine failed. Reload to retry."));
  }
  pending.clear();
  error("The WebAssembly engine failed. Reload to retry.");
  set("engine", "Engine unavailable");
};
function query(): Query {
  return {
    service: field("service").value,
    level: field("level").value,
    search: field("search").value,
    trace: field("trace").value.trim(),
    from,
    to,
    offset,
    limit: 50,
  };
}
async function refresh() {
  if (!report?.ok || loading) return;
  const v = ++revision;
  try {
    const data = await rpc<Result & { error?: string }>("query", query());
    if (v !== revision) return;
    if (data.error) throw new Error(data.error);
    result = data;
    render();
  } catch (e) {
    if (v === revision) error(String(e));
  }
}
function resetFields() {
  for (const id of ["service", "level", "search", "trace", "from", "to"])
    field(id).value = "";
  from = "";
  to = "";
  offset = 0;
}
function reset() {
  resetFields();
  show("error", false);
  void refresh();
}
function busy(value: boolean) {
  loading = value;
  for (const id of ["sample", "upload"]) btn(id).disabled = value;
  for (const e of $("filters").querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >("input,select"))
    e.disabled = value;
  btn("reset").disabled = value;
  $("workspace").setAttribute("aria-busy", String(value));
}
function clearResult() {
  result = null;
  for (const id of [
    "events",
    "failed",
    "errors",
    "p95",
    "time-start",
    "time-end",
  ])
    set(id, "—");
  set("traces", "No file loaded");
  set("warnings", "No file loaded");
  set("count", "0");
  set("page-status", "No file loaded");
  for (const id of ["rows", "timeline", "findings", "chips"])
    $(id).replaceChildren();
  for (const id of ["empty", "diagnostics", "chips"]) show(id, false);
  btn("previous").disabled = true;
  btn("next").disabled = true;
}
function render() {
  if (!result) return;
  const s = result.summary;
  set("events", s.events.toLocaleString());
  set("failed", String(s.failed));
  set("errors", String(s.errors));
  set("p95", duration(s.p95));
  set("traces", `${s.traces} distinct traces · ${s.requests} requests`);
  set("warnings", `${s.warnings} warning events`);
  set("count", String(s.events));
  const timeline = $("timeline");
  timeline.replaceChildren();
  const peak = Math.max(1, ...result.buckets.map((b) => b.count));
  for (const b of result.buckets) {
    const button = node("button", "bucket");
    button.type = "button";
    button.disabled = !b.count;
    button.setAttribute(
      "aria-label",
      `${clock(b.start)} UTC: ${b.count} events, ${b.errors} errors. Filter interval.`,
    );
    button.title = button.getAttribute("aria-label")!;
    const bar = node("span", "bar");
    bar.style.height = `${(b.count / peak) * 100}%`;
    const red = node("span", "bar-error");
    red.style.height = `${b.count ? (b.errors / b.count) * 100 : 0}%`;
    bar.append(red);
    button.append(bar);
    button.onclick = () => {
      from = new Date(b.start).toISOString();
      to = new Date(b.start + result!.bucketWidth - 1).toISOString();
      field("from").value = from.slice(0, -1);
      field("to").value = to.slice(0, -1);
      offset = 0;
      void refresh();
    };
    timeline.append(button);
  }
  set(
    "time-start",
    report?.start == null ? "—" : clock(report.start).slice(0, 8),
  );
  set("time-end", report?.end == null ? "—" : clock(report.end).slice(0, 8));
  const rows = $("rows");
  rows.replaceChildren();
  for (const e of result.rows) {
    const tr = node("tr", "event-row");
    tr.append(node("td", "mono time", clock(e.time)));
    const level = node("td", "");
    level.append(node("span", `level ${e.level.toLowerCase()}`, e.level));
    tr.append(level, node("td", "service", e.service));
    const td = node("td", ""),
      open = node("button", "event-link", e.event);
    open.setAttribute(
      "aria-label",
      `Inspect ${e.event} at ${clock(e.time)}, line ${e.line}`,
    );
    open.onclick = () => openEvent(e);
    td.append(open);
    tr.append(
      td,
      node("td", "mono muted", e.trace || "—"),
      node("td", "numeric mono", duration(e.duration)),
      node("td", "row-arrow", "↗"),
    );
    tr.onclick = (ev) => {
      if (!(ev.target as HTMLElement).closest("button")) open.click();
    };
    rows.append(tr);
  }
  show("empty", s.events === 0);
  set(
    "page-status",
    s.events
      ? `Showing ${offset + 1}–${offset + result.rows.length} of ${s.events} matching events`
      : "0 matching events",
  );
  btn("previous").disabled = offset === 0;
  btn("next").disabled = offset + 50 >= s.events;
  const q = query(),
    chips = $("chips");
  chips.replaceChildren();
  const values = [
    q.service && `Service: ${q.service}`,
    q.level && `Level: ${q.level}`,
    q.search && `Search: ${q.search}`,
    q.trace && `Trace: ${q.trace}`,
    (from || to) && `UTC: ${from || "start"} – ${to || "end"}`,
  ].filter(Boolean) as string[];
  for (const v of values) chips.append(node("span", "chip", v));
  if (from || to) {
    const clear = node("button", "text-button", "Clear time range ×");
    clear.onclick = clearTime;
    chips.append(clear);
  }
  show("chips", values.length > 0);
}
function findings() {
  const area = $("findings");
  area.replaceChildren();
  if (!report) return;
  if (!report.findings.length) {
    const card = node("article", "finding");
    card.append(
      node("h3", "", "No supported incident pattern found"),
      node(
        "p",
        "",
        "Explore the timeline and filters. Current evidence rules look for pool exhaustion, preceding configuration changes, and rollback recovery.",
      ),
    );
    area.append(card);
    return;
  }
  report.findings.forEach((f, i) => {
    const card = node("article", "finding");
    card.append(
      node("span", "finding-number", `0${i + 1}`),
      node("h3", "", f.title),
      node("p", "", f.detail),
    );
    const links = node("div", "evidence-links");
    for (const line of f.lines) {
      const b = node("button", "evidence-link", `Line ${line} ↗`);
      b.onclick = () => {
        void rpc<LogEvent | null>("event", line)
          .then((e) => {
            if (e) openEvent(e);
          })
          .catch((e) => error(String(e)));
      };
      links.append(b);
    }
    card.append(links);
    area.append(card);
  });
}
function openEvent(e: LogEvent) {
  const body = $("detail-body");
  body.replaceChildren();
  body.append(
    node("span", `level ${e.level.toLowerCase()}`, e.level),
    node("h2", "", e.event),
    node("p", "muted source", `Source line ${e.line} · ${name}`),
  );
  const dl = node("dl", "");
  for (const [k, v] of [
    ["Timestamp (UTC)", e.timestamp],
    ["Service", e.service],
    ["Trace ID", e.trace || "None"],
    ["Duration", duration(e.duration)],
    ["HTTP status", e.status === null ? "None" : String(e.status)],
  ])
    dl.append(node("dt", "", k), node("dd", "mono", v));
  body.append(
    dl,
    node("h3", "", "Message"),
    node("pre", "message", e.message || "(empty message)"),
  );
  if (e.trace) {
    const follow = node("button", "button primary full", "Follow this trace →");
    follow.onclick = () => {
      resetFields();
      field("trace").value = e.trace;
      void refresh();
      $<HTMLDialogElement>("detail").close();
      $("filters").scrollIntoView({ block: "center", behavior: "smooth" });
    };
    body.append(follow);
  }
  const raw = node("details", "raw");
  raw.append(
    node("summary", "", "Event JSON"),
    node("pre", "message", JSON.stringify(e, null, 2)),
  );
  body.append(
    raw,
    node(
      "p",
      "note",
      "Evidence links can show events outside the current filters. Source lines refer to the original loaded file.",
    ),
  );
  const dialog = $<HTMLDialogElement>("detail");
  if (!dialog.open) dialog.showModal();
}
async function load(contents: string, filename: string, sample: boolean) {
  busy(true);
  ++revision;
  report = null;
  clearResult();
  show("error", false);
  try {
    const parsed = await rpc<Report>("load", contents);
    if (!parsed.ok) throw new Error(parsed.error);
    report = parsed;
    name = filename;
    resetFields();
    $<HTMLSelectElement>("service").replaceChildren(
      new Option("All services", ""),
      ...parsed.services.map((s) => new Option(s, s)),
    );
    set("title", sample ? "Checkout slowdown" : "Your log investigation");
    set(
      "subtitle",
      sample
        ? "Trace a failed checkout from the first warning to recovery."
        : "Connect related events and follow the evidence in your file.",
    );
    set("filename", name);
    set("kind", sample ? "SYNTHETIC INCIDENT" : "LOCAL FILE");
    set(
      "meta",
      `${parsed.accepted} events · ${parsed.start === null ? "no timestamps" : new Date(parsed.start).toISOString().slice(0, 10) + " · UTC"}`,
    );
    show("diagnostics", parsed.rejected > 0);
    set(
      "diagnostic-title",
      `${parsed.rejected} rows skipped — view parse diagnostics`,
    );
    const list = $("diagnostic-list");
    list.replaceChildren();
    for (const d of parsed.diagnostics)
      list.append(node("li", "", `Line ${d.line}: ${d.reason}`));
    if (parsed.rejected > 100)
      list.append(node("li", "", "Showing the first 100 diagnostics."));
    findings();
    set("engine", "● Engine ready");
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    set("meta", "File could not be loaded");
  } finally {
    busy(false);
    if (report) await refresh();
  }
}
async function sample() {
  busy(true);
  show("error", false);
  try {
    const r = await fetch(
      `${import.meta.env.BASE_URL}samples/checkout-outage.tsv`,
    );
    if (!r.ok)
      throw new Error("The sample could not be loaded. Please try again.");
    await load(await r.text(), "checkout-outage.tsv", true);
  } catch (e) {
    error(String(e));
    busy(false);
  }
}
function clearTime() {
  from = "";
  to = "";
  field("from").value = "";
  field("to").value = "";
  offset = 0;
  show("error", false);
  void refresh();
}
$("sample").onclick = () => {
  void sample();
};
$("upload").onclick = () => field("file").click();
field("file").onchange = async () => {
  const f = field("file").files?.[0];
  field("file").value = "";
  if (!f || loading) return;
  if (f.size > 10 * 1024 * 1024) {
    error(
      "File exceeds the 10 MiB limit. The current investigation is unchanged.",
    );
    return;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await f.arrayBuffer(),
    );
    await load(text, f.name, false);
  } catch {
    error(
      "File must contain valid UTF-8. The current investigation is unchanged.",
    );
  }
};
let timer: ReturnType<typeof setTimeout>;
for (const id of ["search", "trace"])
  field(id).oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      offset = 0;
      void refresh();
    }, 160);
  };
for (const id of ["service", "level"])
  field(id).onchange = () => {
    offset = 0;
    void refresh();
  };
$("filters").onsubmit = (e) => e.preventDefault();
$("reset").onclick = reset;
$("empty-reset").onclick = reset;
$("previous").onclick = () => {
  offset = Math.max(0, offset - 50);
  void refresh();
};
$("next").onclick = () => {
  offset += 50;
  void refresh();
};
$("close").onclick = () => $<HTMLDialogElement>("detail").close();
$("time-toggle").onclick = () => {
  const visible = $("time-form").classList.contains("hidden");
  show("time-form", visible);
  btn("time-toggle").setAttribute("aria-expanded", String(visible));
};
$("clear-time").onclick = clearTime;
$("time-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const a = field("from").value,
      b = field("to").value;
    const start = a ? new Date(a + "Z").toISOString() : "",
      end = b ? new Date(b + "Z").toISOString() : "";
    if (start && end && start > end) throw new Error("Start must precede end.");
    from = start;
    to = end;
    offset = 0;
    show("error", false);
    void refresh();
  } catch (e) {
    error(String(e));
  }
};
busy(true);
void rpc("init")
  .then(() => sample())
  .catch((e) => {
    error(String(e));
    set("engine", "Engine unavailable");
    busy(false);
  });
