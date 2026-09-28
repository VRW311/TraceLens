#include "engine.hpp"
#include <emscripten/bind.h>
#include <stdexcept>
namespace {
tracelens::Engine engine;
std::string loadLogs(const std::string& text){engine.load(text);return engine.reportJson();}
std::string queryLogs(const std::string& service,const std::string& level,const std::string& search,const std::string& trace,const std::string& from,const std::string& to,unsigned offset,unsigned limit){
  tracelens::Query q;q.service=service;q.level=level;q.search=search;q.trace=trace;q.offset=offset;q.limit=limit;
  if(!from.empty()){q.from=tracelens::parseTime(from);if(!q.from)return "{\"error\":\"Invalid start timestamp\"}";}
  if(!to.empty()){q.to=tracelens::parseTime(to);if(!q.to)return "{\"error\":\"Invalid end timestamp\"}";}
  if(q.from&&q.to&&*q.from>*q.to)return "{\"error\":\"Start must precede end\"}";
  return engine.queryJson(q);
}
std::string eventByLine(unsigned line){return engine.eventByLine(line);}
}
EMSCRIPTEN_BINDINGS(tracelens){emscripten::function("loadLogs",&loadLogs);emscripten::function("queryLogs",&queryLogs);emscripten::function("eventByLine",&eventByLine);}
