#include "engine.hpp"
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>

int main(int argc, char **argv) {
  if (argc < 2) {
    std::cerr << "Usage: tracelens FILE [--service NAME] [--level LEVEL] [--trace ID] [--search "
                 "TEXT] [--from UTC] [--to UTC]\n";
    return 2;
  }
  tracelens::Query q;
  for (int i = 2; i < argc; ++i) {
    std::string flag = argv[i];
    if (i + 1 >= argc) {
      std::cerr << "Missing value for " << flag << '\n';
      return 2;
    }
    std::string value = argv[++i];
    if (flag == "--service")
      q.service = value;
    else if (flag == "--level")
      q.level = value;
    else if (flag == "--trace")
      q.trace = value;
    else if (flag == "--search")
      q.search = value;
    else if (flag == "--from" || flag == "--to") {
      auto t = tracelens::parseTime(value);
      if (!t) {
        std::cerr << "Invalid UTC timestamp\n";
        return 2;
      }
      if (flag == "--from")
        q.from = t;
      else
        q.to = t;
    } else {
      std::cerr << "Unknown option: " << flag << '\n';
      return 2;
    }
  }
  if (q.from && q.to && *q.from > *q.to) {
    std::cerr << "Start must precede end\n";
    return 2;
  }
  if (!q.level.empty() && q.level != "DEBUG" && q.level != "INFO" && q.level != "WARN" &&
      q.level != "ERROR") {
    std::cerr << "Unknown level\n";
    return 2;
  }
  std::ifstream file(argv[1], std::ios::binary);
  if (!file) {
    std::cerr << "Cannot open file\n";
    return 2;
  }
  // Bounded read: do not allocate an arbitrarily large file before validation.
  std::string input(10 * 1024 * 1024 + 1, '\0');
  file.read(input.data(), static_cast<std::streamsize>(input.size()));
  input.resize(static_cast<std::size_t>(file.gcount()));
  tracelens::Engine engine;
  engine.load(input);
  std::cout << "{\"parse\":" << engine.reportJson() << ",\"result\":" << engine.queryJson(q)
            << "}\n";
  return engine.fatal().empty() ? 0 : 1;
}
