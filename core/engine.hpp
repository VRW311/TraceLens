#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace tracelens {
struct Event {
  std::int64_t time;
  std::string timestamp, level, service, kind, trace, message;
  std::optional<int> duration, status;
  std::size_t line;
};
struct Diagnostic {
  std::size_t line;
  std::string reason;
};
struct Query {
  std::string service, level, search, trace;
  std::optional<std::int64_t> from, to;
  std::size_t offset = 0, limit = 50;
};
struct Summary {
  std::size_t events = 0, errors = 0, warnings = 0, traces = 0, failed = 0, requests = 0;
  std::optional<int> p95;
};
struct Bucket {
  std::int64_t start;
  std::size_t count = 0, errors = 0;
};
struct Result {
  Summary summary;
  std::vector<const Event *> rows;
  std::vector<Bucket> buckets;
  std::int64_t bucketWidth = 1000;
};
std::optional<std::int64_t> parseTime(const std::string &value);
std::string quote(const std::string &value);
std::string eventJson(const Event &event);
class Engine {
public:
  bool load(const std::string &text);
  Result query(const Query &query = {}) const;
  std::string reportJson() const;
  std::string queryJson(const Query &query = {}) const;
  std::string eventByLine(std::size_t line) const;
  std::string findingsJson() const;
  const std::vector<Event> &events() const { return events_; }
  const std::vector<Diagnostic> &diagnostics() const { return diagnostics_; }
  const std::string &fatal() const { return fatal_; }
  std::size_t rejected() const { return rejected_; }

private:
  std::vector<Event> events_;
  std::vector<Diagnostic> diagnostics_;
  std::string fatal_;
  std::size_t rejected_ = 0;
};
} // namespace tracelens
