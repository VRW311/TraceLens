#include "engine.hpp"
#include <fstream>
#include <functional>
#include <iostream>
#include <iterator>
#include <stdexcept>

using namespace tracelens;
const std::string H = "timestamp\tlevel\tservice\tevent\ttrace_id\tduration_ms\tstatus\tmessage\n";
std::string row(std::string t = "2026-09-28T14:00:00.000Z", std::string level = "INFO",
                std::string service = "checkout", std::string trace = "a",
                std::string duration = "10", std::string status = "200",
                std::string message = "ok") {
  return t + "\t" + level + "\t" + service + "\trequest.completed\t" + trace + "\t" + duration +
         "\t" + status + "\t" + message + "\n";
}
void check(bool b, const std::string &why) {
  if (!b)
    throw std::runtime_error(why);
}
int main() {
  int passed = 0, failed = 0;
  auto test = [&](const char *name, const std::function<void()> &fn) {
    try {
      fn();
      ++passed;
      std::cout << "PASS " << name << '\n';
    } catch (const std::exception &e) {
      ++failed;
      std::cerr << "FAIL " << name << ": " << e.what() << '\n';
    }
  };
  test("epoch and leap calendar", [] {
    check(parseTime("1970-01-01T00:00:00.000Z") == 0, "epoch");
    check(parseTime("2000-02-29T00:00:00.000Z").has_value(), "leap 2000");
    check(!parseTime("2100-02-29T00:00:00.000Z"), "century");
    check(!parseTime("2026-04-31T00:00:00.000Z"), "April");
    check(!parseTime("2026-01-01T24:00:00.000Z"), "hour");
    check(!parseTime("2026-01-01T00:00:60.000Z"), "leap second");
    check(!parseTime("2026-01-01T00:00:00Z"), "precision");
    check(parseTime("2026-09-28T14:00:00.000Z") == 1790604000000LL, "known epoch");
  });
  test("empty and missing header", [] {
    Engine e;
    check(!e.load(""), "empty");
    check(!e.load(row()), "no header");
    check(e.events().empty(), "clear");
  });
  test("header-only is empty dataset", [] {
    Engine e;
    check(e.load(H), "load");
    check(e.query().summary.events == 0 && !e.query().summary.p95, "empty summary");
  });
  test("BOM CRLF and blank lines", [] {
    Engine e;
    std::string s = "\xef\xbb\xbf" + H + "\n" + row();
    std::string cr;
    for (char c : s) {
      if (c == '\n')
        cr += '\r';
      cr += c;
    }
    check(e.load(cr) && e.events().size() == 1, "CRLF");
    check(e.events()[0].line == 3, "line tracking");
  });
  test("stable sorting and duplicates", [] {
    Engine e;
    e.load(H + row("2026-09-28T14:00:02.000Z") + row() + row());
    check(e.events().size() == 3, "duplicates retained");
    check(e.events()[0].line == 3 && e.events()[1].line == 4 && e.events()[2].line == 2,
          "stable order");
  });
  test("invalid rows skipped with source lines", [] {
    Engine e;
    e.load(H + row() + "bad\n" + row("not-a-time") + row("2026-09-28T14:00:00.000Z", "FATAL"));
    check(e.events().size() == 1 && e.rejected() == 3, "counts");
    check(e.diagnostics()[0].line == 3, "line");
  });
  test("numeric validation and missing values", [] {
    Engine e;
    e.load(H + row("2026-09-28T14:00:00.000Z", "INFO", "x", "-", "-", "-") +
           row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "-1") +
           row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "999999999999") +
           row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "2", "600"));
    check(e.events().size() == 1 && e.rejected() == 3, "numbers");
    check(!e.events()[0].duration && !e.events()[0].status && e.events()[0].trace.empty(), "nulls");
  });
  test("message escapes and JSON escaping", [] {
    Engine e;
    e.load(H + row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "0", "200",
                   "caf\xc3\xa9 \\t \\n \\\\ \"<script>\""));
    check(e.events().size() == 1, "unicode");
    check(e.events()[0].message.find('\t') != std::string::npos, "tab");
    check(quote("a\n\"b") == "\"a\\n\\\"b\"", "JSON");
    e.load(H + row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "0", "200", "bad\\q"));
    check(e.rejected() == 1, "unknown escape");
  });
  test("UTF8 and NUL rejected", [] {
    Engine e;
    check(!e.load(H + std::string("\xc0\xaf", 2)), "overlong");
    check(!e.load(H + std::string("\xed\xa0\x80", 3)), "surrogate");
    check(!e.load(H + std::string(1, '\0')), "NUL");
    check(!e.load(H + std::string("\xf4\x90\x80\x80", 4)), "range");
  });
  test("identifier contract", [] {
    Engine e;
    e.load(H + row("2026-09-28T14:00:00.000Z", "INFO", "bad service"));
    check(e.rejected() == 1, "space");
    e.load(H + row("2026-09-28T14:00:00.000Z", "INFO", std::string(65, 'x')));
    check(e.rejected() == 1, "length");
  });
  test("filters combine and time bounds inclusive", [] {
    Engine e;
    e.load(H + row("2026-09-28T14:00:00.000Z", "ERROR", "checkout", "abc", "10", "503", "Timeout") +
           row("2026-09-28T14:00:01.000Z", "INFO", "payments", "abc"));
    Query q;
    q.service = "checkout";
    q.level = "ERROR";
    q.trace = "abc";
    q.search = "TIMEOUT";
    q.from = parseTime("2026-09-28T14:00:00.000Z");
    q.to = q.from;
    check(e.query(q).summary.events == 1, "combined");
    q.trace = "other";
    check(e.query(q).summary.events == 0, "none");
  });
  test("nearest-rank p95 and request-only durations", [] {
    Engine e;
    std::string s = H;
    for (int i = 1; i <= 20; ++i)
      s += row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", std::to_string(i));
    s += "2026-09-28T14:00:00.000Z\tINFO\tx\tpool.wait\ta\t9999\t-\twait\n";
    e.load(s);
    check(e.query().summary.p95 == 19, "nearest rank");
  });
  test("pagination does not alter aggregates", [] {
    Engine e;
    std::string s = H;
    for (int i = 0; i < 120; ++i)
      s += row();
    e.load(s);
    Query q;
    q.offset = 110;
    q.limit = 1000;
    auto r = e.query(q);
    check(r.rows.size() == 10 && r.summary.events == 120, "tail");
    q.offset = 0;
    check(e.query(q).rows.size() == 100, "cap");
    q.offset = 200;
    check(e.query(q).rows.empty(), "out of range");
  });
  test("fixed timeline boundaries under filtering", [] {
    Engine e;
    e.load(H + row() + row("2026-09-28T15:00:00.000Z", "ERROR"));
    Query q;
    q.level = "ERROR";
    auto all = e.query(), filtered = e.query(q);
    check(all.buckets.size() <= 40, "bucket bound");
    check(all.buckets.size() == filtered.buckets.size() &&
              all.buckets.front().start == filtered.buckets.front().start,
          "stable extent");
    check(filtered.buckets.back().count == 1, "last bucket");
  });
  test("bounded diagnostics", [] {
    Engine e;
    std::string s = H;
    for (int i = 0; i < 110; ++i)
      s += "bad\n";
    e.load(s);
    check(e.rejected() == 110 && e.diagnostics().size() == 100, "cap");
  });
  test("oversized line", [] {
    Engine e;
    e.load(H +
           row("2026-09-28T14:00:00.000Z", "INFO", "x", "a", "0", "200", std::string(16385, 'x')));
    check(e.rejected() == 1, "line cap");
  });
  test("file and event limits", [] {
    Engine e;
    check(!e.load(std::string(10 * 1024 * 1024 + 1, 'a')), "byte cap");
    std::string s = H;
    for (int i = 0; i < 50001; ++i)
      s += row();
    check(!e.load(s) && e.events().empty(), "event cap");
  });
  test("new loads clear old data", [] {
    Engine e;
    e.load(H + row());
    e.load("bad");
    check(e.events().empty(), "stale events");
    check(e.eventByLine(2) == "null", "missing event");
  });
  test("sample investigation ground truth", [] {
    Engine e;
    std::ifstream f(SAMPLE_PATH);
    std::string s((std::istreambuf_iterator<char>(f)), {});
    check(e.load(s), "sample");
    auto r = e.query();
    check(r.summary.events == 36 && r.summary.errors == 12 && r.summary.failed == 6 &&
              r.summary.requests == 22,
          "sample totals");
    check(r.summary.p95 == 5090, "sample p95");
    check(e.findingsJson().find("Recovery evidence") != std::string::npos, "recovery");
    Query q;
    q.service = "checkout";
    q.level = "ERROR";
    q.trace = "chk-104";
    check(e.query(q).summary.failed == 2, "retry trace");
  });
  test("healthy files do not invent findings", [] {
    Engine e;
    e.load(H + row());
    check(e.findingsJson() == "[]", "no invented diagnosis");
  });
  std::cout << passed << " passed, " << failed << " failed\n";
  return failed ? 1 : 0;
}
