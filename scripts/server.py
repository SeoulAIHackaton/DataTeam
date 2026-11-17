"""
첫집 내비 시연 서버 · 화면(web/index.html) + 공고문 질문 API(/api/ask)를 한 번에 띄워요.

실행:  python scripts/server.py
열기:  http://127.0.0.1:5500/web/index.html

- 포트 5500을 쓰는 이유: 카카오 JS 키에 등록한 주소(http://127.0.0.1:5500)와 같아야 지도가 떠요.
  → VS Code Live Server는 꺼 두세요 (같은 포트라 둘 중 하나만 켜져요).
- LLM 키는 .env 에만 있고 서버에서만 써요. 브라우저(html)에는 키가 들어가지 않아요.
- POST /api/compare {"question": "...", "facts": {...}}  → 3단계 비교 결과 설명 (검색 없음)
- POST /api/ask  {"question": "...", "profile": {"age": 27}}
  → {"answer", "citations", "found", "mode", "sources": [{n, name, section, text, url}], "policies"}
- GET /api/place?q=판교   1단계 '자주 가는 곳' 검색 (카카오 로컬 장소 검색 + 주소 검색, .env 의 KAKAO_REST_API_KEY)
  → {"places": [{name, address, query}]}  · 키가 없으면 503 {"error": "no_key"} → 화면은 미리 정한 후보 목록으로 바꿔요
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rag import Rag  # noqa: E402  (rag.py가 .env 를 읽어요)
import compare  # noqa: E402  (3단계 이 비교에 대해 물어보기)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST, PORT = "127.0.0.1", int(os.environ.get("PORT", "5500"))

print("검색 데이터 불러오는 중…")
RAG = Rag()
KAKAO_LOCAL = "https://dapi.kakao.com/v2/local/search"
PLACE_CACHE = {}


def kakao_get(kind, q, size):
    key = os.environ.get("KAKAO_REST_API_KEY", "")
    url = f"{KAKAO_LOCAL}/{kind}.json?" + urllib.parse.urlencode({"query": q, "size": size})
    # .env 키가 JavaScript 키면 카카오가 등록된 웹 주소(origin)를 KA 헤더로 요구해요. REST 키면 이 헤더는 무시돼요.
    ka = f"os/javascript origin/{os.environ.get('KAKAO_ORIGIN', f'http://127.0.0.1:{PORT}')}"
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {key}", "KA": ka})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode("utf-8")).get("documents", [])


def search_place(q):
    """자주 가는 곳 검색: 이름(장소 검색) 먼저, 도로명·지번이면 주소 검색 결과를 뒤에 붙여요. query = 3단계 출퇴근 계산에 쓸 주소"""
    if q in PLACE_CACHE:
        return PLACE_CACHE[q]
    out, seen = [], set()
    for d in kakao_get("keyword", q, 8):
        addr = d.get("road_address_name") or d.get("address_name") or ""
        out.append({"name": d.get("place_name", ""), "address": addr, "query": addr or d.get("place_name", "")})
    for d in kakao_get("address", q, 5):
        addr = (d.get("road_address") or {}).get("address_name") or d.get("address_name", "")
        out.append({"name": addr, "address": d.get("address_name", "") if addr != d.get("address_name") else "", "query": addr})
    res = []
    for p in out:
        if p["name"] and p["name"] not in seen:
            seen.add(p["name"]); res.append(p)
    PLACE_CACHE[q] = res[:10]
    return PLACE_CACHE[q]


print(f"장소 검색 {'켜짐 (카카오 로컬)' if os.environ.get('KAKAO_REST_API_KEY') else '꺼짐 → 미리 정한 후보 목록'}")
print(f"준비 완료 · AI 답변 {'켜짐 (' + os.environ.get('LLM_MODEL', 'gpt-4o-mini') + ')' if os.environ.get('LLM_API_KEY') else '꺼짐 → 공고문 원문으로 답해요'}")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def log_message(self, fmt, *args):          # 정적 파일 로그는 생략, API만 출력
        pass

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/web/index.html")
            self.end_headers()
            return
        if self.path == "/api/health":
            return self._json(200, {"ok": True, "ai": bool(os.environ.get("LLM_API_KEY")), "place": bool(os.environ.get("KAKAO_REST_API_KEY"))})
        if self.path.startswith("/api/place"):
            q = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("q") or [""])[0].strip()[:50]
            if not q:
                return self._json(400, {"error": "q 가 비어 있어요"})
            if not os.environ.get("KAKAO_REST_API_KEY"):
                return self._json(503, {"error": "no_key"})
            try:
                return self._json(200, {"places": search_place(q)})
            except Exception as e:               # 키 값은 로그에 남기지 않아요
                print(f"[장소 검색 오류] {type(e).__name__}")
                return self._json(502, {"error": "kakao_unavailable"})
        # 키·원본 데이터는 내보내지 않아요
        if self.path.startswith(("/.env", "/raw/", "/scripts/")) or self.path.endswith((".env", ".pkl")):
            return self._json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/compare":                      # 3단계 · 계산된 비교 결과로만 AI가 설명 (검색 없음)
            try:
                n = int(self.headers.get("Content-Length", 0))
                req = json.loads(self.rfile.read(n) or b"{}")
                q, facts = (req.get("question") or "").strip()[:200], req.get("facts") or {}
                if not q or not facts.get("homes"):
                    return self._json(400, {"error": "question, facts 가 필요해요"})
                t = time.time()
                r = compare.answer(q, facts)
                print(f"[비교 질문] {q}  → {'AI' if r['answer'] else '코드 문장 (' + r['reason'] + ')'} · {time.time() - t:.1f}초" + (f" · {r['memo']}" if r.get("memo") else ""))
                return self._json(200, {k: v for k, v in r.items() if k != "memo"})
            except Exception as e:
                print(f"[비교 질문 오류] {e}")
                return self._json(500, {"error": str(e)})
        if self.path != "/api/ask":
            return self._json(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n) or b"{}")
            q = (req.get("question") or "").strip()[:300]
            if not q:
                return self._json(400, {"error": "question 이 비어 있어요"})
            t = time.time()
            r = RAG.answer(q, req.get("profile") or {})
            print(f"[질문] {q}  → {r['mode']} · {time.time() - t:.1f}초" + (f" · {r['memo']}" if r.get("memo") else ""))
            keep = ("n", "name", "org", "section", "text", "url", "source")
            return self._json(200, {"answer": r["answer"], "citations": r.get("citations", []), "found": r.get("found", True),
                                    "mode": r["mode"], "sources": [{k: s.get(k) for k in keep} for s in r.get("sources", [])],
                                    "policies": [p["name"] for p in r.get("policies", [])]})
        except Exception as e:                   # 화면은 실패하면 미리 넣어 둔 답으로 바꿔서 보여줘요
            print(f"[오류] {e}")
            return self._json(500, {"error": str(e)})


if __name__ == "__main__":
    print(f"\n열기 → http://{HOST}:{PORT}/web/index.html   (끄기: Ctrl+C)\n")
    ThreadingHTTPServer.allow_reuse_address = False      # 윈도우에서 Live Server와 같은 포트를 같이 잡지 않게 (겹치면 바로 알려줌)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except OSError:
        print(f"포트 {PORT}이 이미 쓰이고 있어요. VS Code Live Server를 끄고 다시 실행해 주세요.")
    except KeyboardInterrupt:
        print("\n서버를 껐어요.")
