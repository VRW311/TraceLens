#include "engine.hpp"
#include <algorithm>
#include <charconv>
#include <cmath>
#include <set>
#include <sstream>
#include <string_view>

namespace tracelens {
namespace {
constexpr std::size_t maxBytes = 10 * 1024 * 1024, maxEvents = 50000;
const std::string header = "timestamp\tlevel\tservice\tevent\ttrace_id\tduration_ms\tstatus\tmessage";
bool utf8(const std::string& s) {
  for (std::size_t i=0; i<s.size();) {
    auto c=static_cast<unsigned char>(s[i++]);
    if(c==0) return false;
    if(c<0x80) continue;
    int n; unsigned cp;
    if(c>=0xc2 && c<=0xdf) { n=1; cp=c&31; }
    else if(c>=0xe0 && c<=0xef) { n=2; cp=c&15; }
    else if(c>=0xf0 && c<=0xf4) { n=3; cp=c&7; }
    else return false;
    const int original=n;
    while(n--) { if(i==s.size()) return false; auto d=static_cast<unsigned char>(s[i++]); if((d&0xc0)!=0x80) return false; cp=(cp<<6)|(d&63); }
    if((original==2 && cp<0x800)||(original==3 && cp<0x10000)||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)) return false;
  }
  return true;
}
bool identifier(const std::string& s) {
  return !s.empty() && s.size()<=64 && std::all_of(s.begin(),s.end(),[](unsigned char c){return (c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='.'||c=='_'||c=='-';});
}
bool number(const std::string& s,int lo,int hi,std::optional<int>& out) {
  if(s=="-") {out.reset();return true;}
  if(s.empty()||!std::all_of(s.begin(),s.end(),[](char c){return c>='0'&&c<='9';})) return false;
  int value=0; const auto r=std::from_chars(s.data(),s.data()+s.size(),value);
  if(r.ec!=std::errc() || r.ptr!=s.data()+s.size() || value<lo || value>hi) return false;
  out=value; return true;
}
bool unescape(const std::string& s,std::string& out) {
  for(std::size_t i=0;i<s.size();++i) {
    char c=s[i];
    if(c!='\\') { if(static_cast<unsigned char>(c)<32) return false; out+=c; continue; }
    if(++i==s.size()) return false;
    switch(s[i]) {case 't':out+='\t';break;case 'n':out+='\n';break;case 'r':out+='\r';break;case '\\':out+='\\';break;default:return false;}
  }
  return true;
}
std::string lower(std::string s) {for(char& c:s) if(c>='A'&&c<='Z')c=static_cast<char>(c+32);return s;}
std::string nullable(const std::optional<int>& n) {return n?std::to_string(*n):"null";}
}

std::optional<std::int64_t> parseTime(const std::string& s) {
  if(s.size()!=24||s[4]!='-'||s[7]!='-'||s[10]!='T'||s[13]!=':'||s[16]!=':'||s[19]!='.'||s[23]!='Z')return {};
  auto read=[&](int at,int n){int v=0;for(int i=0;i<n;++i){char c=s[static_cast<std::size_t>(at+i)];if(c<'0'||c>'9')return -1;v=v*10+c-'0';}return v;};
  int y=read(0,4),m=read(5,2),d=read(8,2),h=read(11,2),min=read(14,2),sec=read(17,2),ms=read(20,3);
  if(y<1970||m<1||m>12||d<1||h<0||h>23||min<0||min>59||sec<0||sec>59||ms<0)return {};
  const bool leap=y%4==0&&(y%100!=0||y%400==0);
  const int days[]={31,28,31,30,31,30,31,31,30,31,30,31};
  if(d>days[m-1]+(m==2&&leap?1:0))return {};
  auto leapsBefore=[](int year){return (year-1)/4-(year-1)/100+(year-1)/400;};
  std::int64_t total=365LL*(y-1970)+leapsBefore(y)-leapsBefore(1970);
  for(int month=1;month<m;++month)total+=days[month-1]+(month==2&&leap?1:0);
  total+=d-1;
  return (((total*24+h)*60+min)*60+sec)*1000+ms;
}
std::string quote(const std::string& s) {
  std::string out="\"";const char* hex="0123456789abcdef";
  for(unsigned char c:s) {switch(c){case '"':out+="\\\"";break;case '\\':out+="\\\\";break;case '\n':out+="\\n";break;case '\r':out+="\\r";break;case '\t':out+="\\t";break;default:if(c<32){out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}else out+=static_cast<char>(c);}}
  return out+'"';
}
std::string eventJson(const Event& e) {
  return "{\"line\":"+std::to_string(e.line)+",\"time\":"+std::to_string(e.time)+",\"timestamp\":"+quote(e.timestamp)+",\"level\":"+quote(e.level)+",\"service\":"+quote(e.service)+",\"event\":"+quote(e.kind)+",\"trace\":"+quote(e.trace)+",\"duration\":"+nullable(e.duration)+",\"status\":"+nullable(e.status)+",\"message\":"+quote(e.message)+"}";
}
bool Engine::load(const std::string& text) {
  events_.clear();diagnostics_.clear();fatal_.clear();rejected_=0;
  if(text.size()>maxBytes) {fatal_="File exceeds the 10 MiB limit.";return false;}
  if(!utf8(text)) {fatal_="File must contain valid UTF-8 without NUL bytes.";return false;}
  std::istringstream stream(text);std::string line;std::size_t lineNumber=0;
  if(!std::getline(stream,line)) {fatal_="File is empty. Expected the TraceLens TSV header.";return false;}
  if(!line.empty()&&line.back()=='\r')line.pop_back();
  if(line.compare(0,3,"\xef\xbb\xbf")==0)line.erase(0,3);
  if(line!=header) {fatal_="Invalid header. Expected TraceLens TSV v1 (eight tab-separated columns).";return false;}
  ++lineNumber;
  auto reject=[&](const std::string& reason){++rejected_;if(diagnostics_.size()<100)diagnostics_.push_back({lineNumber,reason});};
  while(std::getline(stream,line)) {
    ++lineNumber;if(!line.empty()&&line.back()=='\r')line.pop_back();if(line.empty())continue;
    if(line.size()>16384){reject("Line exceeds 16 KiB.");continue;}
    std::vector<std::string> f;std::size_t start=0;
    for(std::size_t i=0;i<=line.size();++i)if(i==line.size()||line[i]=='\t'){f.push_back(line.substr(start,i-start));start=i+1;}
    if(f.size()!=8){reject("Expected exactly eight tab-separated fields.");continue;}
    auto time=parseTime(f[0]);if(!time){reject("Invalid UTC timestamp.");continue;}
    if(f[1]!="DEBUG"&&f[1]!="INFO"&&f[1]!="WARN"&&f[1]!="ERROR"){reject("Unknown level.");continue;}
    if(!identifier(f[2])||!identifier(f[3])||!identifier(f[4])){reject("Invalid service, event, or trace identifier.");continue;}
    Event e{};e.time=*time;e.timestamp=f[0];e.level=f[1];e.service=f[2];e.kind=f[3];e.trace=f[4]=="-"?"":f[4];e.line=lineNumber;
    if(!number(f[5],0,86400000,e.duration)){reject("Invalid duration_ms.");continue;}
    if(!number(f[6],100,599,e.status)){reject("Invalid HTTP status.");continue;}
    if(!unescape(f[7],e.message)){reject("Invalid message escape or control character.");continue;}
    events_.push_back(std::move(e));
    if(events_.size()>maxEvents){events_.clear();fatal_="File exceeds the 50,000-event limit.";return false;}
  }
  std::stable_sort(events_.begin(),events_.end(),[](const Event& a,const Event& b){return a.time<b.time;});
  return true;
}
Result Engine::query(const Query& q) const {
  Result r;std::set<std::string> traces;std::vector<int> durations;
  if(events_.empty())return r;
  const auto start=events_.front().time, span=events_.back().time-start;
  r.bucketWidth=std::max<std::int64_t>(1000,(span+40)/40);
  const auto count=static_cast<std::size_t>(span/r.bucketWidth+1);
  for(std::size_t i=0;i<count;++i)r.buckets.push_back({start+static_cast<std::int64_t>(i)*r.bucketWidth,0,0});
  const auto needle=lower(q.search);
  for(const auto& e:events_) {
    if((!q.service.empty()&&q.service!=e.service)||(!q.level.empty()&&q.level!=e.level)||(!q.trace.empty()&&q.trace!=e.trace)||(q.from&&e.time<*q.from)||(q.to&&e.time>*q.to))continue;
    if(!needle.empty()&&lower(e.service+" "+e.kind+" "+e.trace+" "+e.message).find(needle)==std::string::npos)continue;
    auto& s=r.summary;
    if(s.events>=q.offset&&r.rows.size()<std::min<std::size_t>(100,q.limit))r.rows.push_back(&e);
    ++s.events;s.errors+=e.level=="ERROR";s.warnings+=e.level=="WARN";
    if(!e.trace.empty())traces.insert(e.trace);
    if(e.kind=="request.completed"){++s.requests;if(e.status&&*e.status>=500)++s.failed;if(e.duration)durations.push_back(*e.duration);}
    auto& b=r.buckets[static_cast<std::size_t>((e.time-start)/r.bucketWidth)];++b.count;b.errors+=e.level=="ERROR";
  }
  r.summary.traces=traces.size();
  if(!durations.empty()){std::sort(durations.begin(),durations.end());r.summary.p95=durations[(95*durations.size()+99)/100-1];}
  return r;
}
std::string Engine::findingsJson() const {
  const Event *change=nullptr,*exhausted=nullptr,*rollback=nullptr,*ready=nullptr,*success=nullptr;
  for(const auto& e:events_)if(e.kind=="pool.exhausted"){exhausted=&e;break;}
  if(exhausted)for(const auto& e:events_) {
    if(e.service!=exhausted->service)continue;
    if(e.kind=="config.changed"&&e.time<=exhausted->time)change=&e;
    if(!rollback&&e.kind=="config.rollback"&&e.time>=exhausted->time)rollback=&e;
    if(rollback&&!ready&&e.kind=="pool.ready"&&e.time>=rollback->time)ready=&e;
    if(ready&&!success&&e.kind=="request.completed"&&e.status&&*e.status<400&&e.time>=ready->time)success=&e;
  }
  std::string out="[";bool first=true;
  auto add=[&](const std::string& title,const std::string& detail,std::vector<const Event*> evidence){if(!first)out+=",";first=false;out+="{\"title\":"+quote(title)+",\"detail\":"+quote(detail)+",\"lines\":[";bool sep=false;for(auto e:evidence){if(!e)continue;if(sep)out+=",";sep=true;out+=std::to_string(e->line);}out+="]}";};
  if(exhausted)add("Connection pool exhausted", "The first recorded pool exhaustion occurred in "+exhausted->service+". Follow its trace to inspect the request outcome.",{exhausted});
  if(change)add("Configuration change preceded failure", "A configuration change in the same service preceded pool exhaustion by "+std::to_string((exhausted->time-change->time)/1000)+" seconds. Timing supports investigation; it does not establish causation.",{change,exhausted});
  if(rollback&&ready&&success)add("Recovery evidence after rollback","A rollback was followed by a ready pool and a successful request. Confirm whether success continued beyond this file.",{rollback,ready,success});
  return out+"]";
}
std::string Engine::reportJson() const {
  std::set<std::string> services;for(const auto& e:events_)services.insert(e.service);
  std::string out="{\"ok\":"+std::string(fatal_.empty()?"true":"false")+",\"error\":"+quote(fatal_)+",\"accepted\":"+std::to_string(events_.size())+",\"rejected\":"+std::to_string(rejected_)+",\"services\":[";
  bool sep=false;for(const auto& s:services){if(sep)out+=",";sep=true;out+=quote(s);}out+="],\"diagnostics\":[";sep=false;
  for(const auto& d:diagnostics_){if(sep)out+=",";sep=true;out+="{\"line\":"+std::to_string(d.line)+",\"reason\":"+quote(d.reason)+"}";}
  out+="],\"start\":"+(events_.empty()?"null":std::to_string(events_.front().time))+",\"end\":"+(events_.empty()?"null":std::to_string(events_.back().time))+",\"findings\":"+findingsJson()+"}";return out;
}
std::string Engine::queryJson(const Query& q) const {
  auto r=query(q);const auto& s=r.summary;
  std::string out="{\"summary\":{\"events\":"+std::to_string(s.events)+",\"errors\":"+std::to_string(s.errors)+",\"warnings\":"+std::to_string(s.warnings)+",\"traces\":"+std::to_string(s.traces)+",\"failed\":"+std::to_string(s.failed)+",\"requests\":"+std::to_string(s.requests)+",\"p95\":"+nullable(s.p95)+"},\"rows\":[";
  bool sep=false;for(auto e:r.rows){if(sep)out+=",";sep=true;out+=eventJson(*e);}out+="],\"bucketWidth\":"+std::to_string(r.bucketWidth)+",\"buckets\":[";sep=false;
  for(const auto& b:r.buckets){if(sep)out+=",";sep=true;out+="{\"start\":"+std::to_string(b.start)+",\"count\":"+std::to_string(b.count)+",\"errors\":"+std::to_string(b.errors)+"}";}return out+"]}";
}
std::string Engine::eventByLine(std::size_t line) const {for(const auto& e:events_)if(e.line==line)return eventJson(e);return "null";}
}
