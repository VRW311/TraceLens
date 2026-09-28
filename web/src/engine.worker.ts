import type { Query } from "./types";
interface Engine {
  loadLogs(text: string): string;
  queryLogs(
    service: string,
    level: string,
    search: string,
    trace: string,
    from: string,
    to: string,
    offset: number,
    limit: number,
  ): string;
  eventByLine(line: number): string;
}
const url = new URL(
  `${import.meta.env.BASE_URL}wasm/tracelens.js`,
  self.location.origin,
).href;
const engine: Promise<Engine> = import(/* @vite-ignore */ url).then((m) =>
  m.default({ locateFile: (file: string) => new URL(file, url).href }),
);
self.onmessage = async ({ data }) => {
  try {
    const api = await engine;
    let value: unknown;
    if (data.op === "init") value = true;
    else if (data.op === "load") value = JSON.parse(api.loadLogs(data.args));
    else if (data.op === "event")
      value = JSON.parse(api.eventByLine(data.args));
    else if (data.op === "query") {
      const q = data.args as Query;
      value = JSON.parse(
        api.queryLogs(
          q.service,
          q.level,
          q.search,
          q.trace,
          q.from,
          q.to,
          q.offset,
          q.limit,
        ),
      );
    } else throw new Error("Unknown engine operation");
    self.postMessage({ id: data.id, value });
  } catch (e) {
    self.postMessage({
      id: data.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
