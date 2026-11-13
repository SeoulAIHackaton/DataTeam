"""수집 스크립트 공통 유틸: .env 읽기, HTTP GET(JSON) 재시도, 저장."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # firsthome_data/


def load_env(path=ROOT / ".env"):
    """간단한 .env 파서 (KEY=VALUE). 이미 환경변수에 있으면 그 값을 우선."""
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def require_env(name):
    load_env()
    v = os.environ.get(name, "").strip()
    if not v:
        raise SystemExit(f"[에러] {name} 가 비어 있어요. firsthome_data/.env 에 {name}=키값 을 넣어주세요.")
    return v


def get_json(url, params, retries=4, timeout=30):
    """GET 요청 후 JSON 반환. 실패하면 지수 백오프로 재시도."""
    full = url + "?" + urllib.parse.urlencode(params, safe="[]:")
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "firsthome-hackathon/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
            return json.loads(body)
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            last = e
            wait = 2 ** i
            print(f"  재시도 {i + 1}/{retries} ({e}) → {wait}s 대기")
            time.sleep(wait)
    raise SystemExit(f"[에러] 요청 실패: {last}\nURL: {url}")


def today():
    return datetime.now().strftime("%Y%m%d")


def save_json(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"저장: {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")
