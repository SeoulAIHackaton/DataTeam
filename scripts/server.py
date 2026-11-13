"""
첫집 내비 시연 서버 · 화면(web/index.html) + 공고문 질문 API(/api/ask)를 한 번에 띄워요.

실행:  python scripts/server.py
열기:  http://127.0.0.1:5500/web/index.html

- 포트 5500을 쓰는 이유: 카카오 JS 키에 등록한 주소(http://127.0.0.1:5500)와 같아야 지도가 떠요.
  → VS Code Live Server는 꺼 두세요 (같은 포트라 둘 중 하나만 켜져요).
- LLM 키는 .env 에만 있고 서버에서만 써요. 브라우저(html)에는 키가 들어가지 않아요.
- POST /api/ask  {"question": "...", "profile": {"age": 27}}
  → {"answer", "citations", "found", "mode", "sources": [{n, name, section, text, url}], "policies"}
"""
import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rag import Rag  # noqa: E402  (rag.py가 .env 를 읽어요)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST, PORT = "127.0.0.1", int(os.environ.get("PORT", "5500"))

print("검색 데이터 불러오는 중…")
RAG = Rag()
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
            return self._json(200, {"ok": True, "ai": bool(os.environ.get("LLM_API_KEY"))})
        # 키·원본 데이터는 내보내지 않아요
        if self.path.startswith(("/.env", "/raw/", "/scripts/")) or self.path.endswith((".env", ".pkl")):
            return self._json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
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
