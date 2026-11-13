"""
RAG ① 문서 정리 + 검색 색인 만들기
  온통청년(전체) · 정부24(전체) · 대출 3종 · SH 청년안심주택 · 시연용 정책 4개(+중복 규칙)를
  '정책 하나 = 여러 청크(지원 대상 / 지원 내용 / 신청 방법 / 제외 대상 …)'로 나누고
  정책 ID · 기관 · 나이 · 지역 · 신청기간 · 링크를 메타데이터로 붙인다.

실행: python scripts/rag_build.py            (raw/ 필요, 1~2분)
결과: processed/rag/chunks.jsonl     청크 + 메타데이터 (팀 공용, 사람이 읽을 수 있음)
      processed/rag/index.pkl        TF-IDF 검색 색인 (키 없이 동작)
      processed/rag/emb.npy          (선택) 임베딩 — EMBED_BACKEND 설정 시

범위: 첫 집 서비스에 맞게 '주거·금융·생활안정' 관련 정책만 담는다 (전체를 담으면 농업·창업이 섞임).
"""
import json
import os
import pickle
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, PROC = os.path.join(BASE, "raw"), os.path.join(BASE, "processed")
OUT = os.path.join(PROC, "rag")
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HOUSING_NAME = re.compile(r"주거|주택|월세|전세|임대|보증금|임차|이사비|중개보수|청약|고시원|기숙사|셰어하우스|전입")
HOUSING = re.compile(r"주거|주택|월세|전세|임대|보증금|임차|이사|중개|청약|대출|보증료|고시원|기숙사|셰어|쉐어|자취|1인가구|전입")
# 서울이 아닌 지자체 이름 (주관기관이 이걸로 시작하면 다른 지역 정책)
OTHER_REGION = re.compile(r"^(부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|전남광주)")
NATIONAL_HINT = re.compile(r"(부|처|청|위원회|공사|공단|재단|진흥원|기금)$")


def clean(t):
    t = (t or "").replace("\r", "")
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n{2,}", "\n", t).strip()


def ymd(s):
    s = re.sub(r"\D", "", s or "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 else None


def region_of(org, org_type=""):
    org = (org or "").strip()
    if org.startswith("서울"):
        rest = org.replace("서울특별시", "").strip()
        m = re.match(r"([가-힣]+구)\b", rest)
        return ("서울-" + m.group(1)) if m else "서울"
    if OTHER_REGION.match(org) or org_type in ("시군구", "광역시도") and not org.startswith("서울"):
        return "타지역"
    return "전국"


chunks = []


def add(pid, source, name, org, region, age, apply, url, section, text, extra=None):
    text = clean(text)
    text = re.sub(r"(\s*[가-힣·()/ ]{1,15}:\s*)+$", "", text)        # 내용 없이 끝나는 항목('제출 서류:')은 지움
    body = text.replace(name, "", 1).strip(" :·-")
    if len(text) < 6 or len(re.sub(r"^[가-힣·()/ ]{0,20}:?", "", body).strip()) < 4:   # 정책 이름 + 제목만 있는 조각은 빼요
        return
    for i, part in enumerate(split_long(text)):
        chunks.append({"chunk_id": f"{pid}#{section}#{i}", "policy_id": pid, "source": source, "name": name,
                       "org": org, "region": region, "age_min": age[0], "age_max": age[1],
                       "apply": apply, "url": url, "section": section, "text": part, **(extra or {})})


def split_long(t, limit=500):
    """긴 문단은 문장 경계로 500자 안팎씩 자른다"""
    if len(t) <= limit:
        return [t]
    parts, cur = [], ""
    for s in re.split(r"(?<=[.다요\n])\s+", t):
        if len(cur) + len(s) > limit and cur:
            parts.append(cur.strip()); cur = ""
        cur += s + " "
    if cur.strip():
        parts.append(cur.strip())
    return parts


def to_int(v):
    try:
        v = int(float(v))
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


# ── 온통청년 ──
def load_youthcenter():
    path = os.path.join(RAW, "youthcenter")
    f = sorted(x for x in os.listdir(path) if x.startswith("youthcenter_policies_all"))[-1]
    with open(os.path.join(path, f), encoding="utf-8") as fp:
        L = json.load(fp)["youthPolicyList"]
    n = 0
    for p in L:
        body = " ".join(str(p.get(k) or "") for k in ("plcyNm", "plcyExplnCn", "plcySprtCn", "lclsfNm", "mclsfNm", "plcyKywdNm"))
        if not (p.get("lclsfNm", "").startswith("주거") or HOUSING.search(body)):
            continue
        org = p.get("sprvsnInstCdNm") or p.get("operInstCdNm") or ""
        region = region_of(org)
        reg_top = p.get("rgtrHghrkInstCdNm") or ""
        zips = [z for z in (p.get("zipCd") or "").split(",") if z]
        if region == "타지역" or (OTHER_REGION.match(reg_top) or reg_top.endswith("시청")):
            continue                     # 다른 지자체가 올린 정책 (국토부 사업을 지자체가 다시 올린 것 포함)
        if zips and not any(z.startswith("11") for z in zips):
            continue                     # 서울 거주자가 대상이 아닌 정책
        pid, name = "YC-" + p["plcyNo"], clean(p["plcyNm"])
        age = (to_int(p.get("sprtTrgtMinAge")), to_int(p.get("sprtTrgtMaxAge")))
        a = (p.get("aplyYmd") or "").split("~")
        apply = {"start": ymd(a[0]) if a else None, "end": ymd(a[1]) if len(a) > 1 else None, "text": clean(p.get("aplyYmd"))}
        url = p.get("aplyUrlAddr") or p.get("refUrlAddr1") or f"https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{p['plcyNo']}"
        head = f"[{name}] ({org}, 분류: {p.get('lclsfNm','')} > {p.get('mclsfNm','')})"
        add(pid, "온통청년", name, org, region, age, apply, url, "개요", f"{head}\n{p.get('plcyExplnCn','')}")
        add(pid, "온통청년", name, org, region, age, apply, url, "지원 내용", f"{name} 지원 내용: {p.get('plcySprtCn','')}")
        qual = [f"나이 {age[0] or ''}~{age[1] or ''}세" if any(age) else "", p.get("addAplyQlfcCndCn", ""),
                f"소득: {p.get('earnEtcCn')}" if p.get("earnEtcCn") else ""]
        add(pid, "온통청년", name, org, region, age, apply, url, "지원 대상", f"{name} 지원 대상: " + " / ".join(q for q in qual if q))
        add(pid, "온통청년", name, org, region, age, apply, url, "제외 대상", f"{name} 참여 제한 대상: {p.get('ptcpPrpTrgtCn','')}")
        add(pid, "온통청년", name, org, region, age, apply, url, "신청 방법",
            f"{name} 신청 방법: {p.get('plcyAplyMthdCn','')} 신청 기간: {p.get('aplyYmd','') or '상시/공고 확인'} 제출 서류: {p.get('sbmsnDcmntCn','')}")
        n += 1
    return n


# ── 정부24 ──
def load_gov24():
    path = os.path.join(RAW, "gov24")
    fs = sorted(os.listdir(path))
    sl = [x for x in fs if "serviceList" in x][-1]
    sc = [x for x in fs if "supportConditions" in x][-1]
    with open(os.path.join(path, sl), encoding="utf-8") as fp:
        S = json.load(fp)["data"]
    with open(os.path.join(path, sc), encoding="utf-8") as fp:
        cond = {c["서비스ID"]: c for c in json.load(fp)["data"]}
    n = 0
    for s in S:
        body = " ".join(str(s.get(k) or "") for k in ("서비스명", "서비스목적요약", "지원내용", "서비스분야"))
        if not (s.get("서비스분야") in ("주거·자립",) or HOUSING_NAME.search(s.get("서비스명", ""))):
            continue                     # 정부24는 범위가 넓어서 '주거·자립' 분야이거나 이름에 주거 단어가 있는 것만
        org = s.get("소관기관명") or ""
        region = region_of(org, s.get("소관기관유형", ""))
        if region == "타지역":
            continue
        c = cond.get(s["서비스ID"], {})
        age = (to_int(c.get("JA0110")), to_int(c.get("JA0111")))
        pid, name = "GOV-" + s["서비스ID"], clean(s["서비스명"])
        apply = {"start": None, "end": None, "text": clean(s.get("신청기한"))}
        url = s.get("상세조회URL") or ""
        head = f"[{name}] ({org}, 분야: {s.get('서비스분야','')})"
        add(pid, "정부24", name, org, region, age, apply, url, "개요", f"{head}\n{s.get('서비스목적요약','')}")
        add(pid, "정부24", name, org, region, age, apply, url, "지원 내용", f"{name} 지원 내용: {s.get('지원내용','')}")
        add(pid, "정부24", name, org, region, age, apply, url, "지원 대상", f"{name} 지원 대상: {s.get('지원대상','')} 선정 기준: {s.get('선정기준','')}")
        add(pid, "정부24", name, org, region, age, apply, url, "신청 방법",
            f"{name} 신청 방법: {s.get('신청방법','')} 신청 기한: {s.get('신청기한','')} 접수 기관: {s.get('접수기관','')} 문의: {s.get('전화문의','')}")
        n += 1
    return n


# ── 대출 3종 (주택도시기금) ──
def won(v):
    """만 원 단위 숫자 → 읽기 쉬운 말 (15000 → 1억 5천만 원)"""
    if not isinstance(v, (int, float)):
        return str(v)
    if v >= 10000:
        e, r = divmod(int(v), 10000)
        rest = "" if r == 0 else (f" {r // 1000}천" if r % 1000 == 0 else f" {r:,}")
        return f"{e}억{rest}만 원"
    return f"{v:,g}만 원"


LABEL = {"area_max": ("전용면적", "㎡ 이하"), "area_max_if_under25_single": ("만 25세 미만 단독세대주 전용면적", "㎡ 이하"),
         "deposit_max": ("보증금", "이하"), "deposit_max_capital_area": ("수도권 보증금", "이하"), "monthly_rent_max": ("월세", "이하"),
         "max": ("최대 한도", ""), "max_if_under25_single": ("만 25세 미만 단독세대주 한도", ""), "max_capital_area": ("수도권 최대 한도", ""),
         "deposit_loan_max": ("보증금 대출 최대", ""), "rent_loan_max": ("월세 대출 최대", ""), "rent_loan_monthly_max": ("월세 대출 월 최대", "")}


def human(d):
    out = []
    for k, v in d.items():
        if k in LABEL:
            lab, suf = LABEL[k]
            out.append(f"{lab} {v:g}{suf}" if "㎡" in suf else f"{lab} {won(v)}{(' ' + suf) if suf else ''}")
        elif k == "ratio_new_contract":
            out.append(f"보증금의 {v * 100:g}% 이내" if isinstance(v, (int, float)) else str(v))
        elif k == "rent_loan_months":
            out.append(f"월세 대출 {v}개월")
        elif k == "public_rental_target_allowed":
            out.append("공공임대 주택도 가능" if v else "공공임대 주택은 안 됨")
        elif k == "sharehouse_allowed":
            out.append("셰어하우스도 가능" if v else "셰어하우스는 안 됨")
    return ", ".join(out)


def rate_text(r):
    if "by_income" in r:
        t = ", ".join(f"연소득 {won(x['income_max'])} 이하 연 {x['rate']}%" for x in r["by_income"])
    elif "by_income_and_deposit" in r:
        t = ", ".join(f"연소득 {won(x['income_max'])} 이하 연 {x['deposit_le_5000']}~{x['deposit_over_10000']}%" for x in r["by_income_and_deposit"])
    else:
        t = f"보증금 대출 연 {r.get('deposit')}%" + (f", 월세 대출: {r['rent']['rule']}" if isinstance(r.get("rent"), dict) else "")
    if r.get("bonus_cap"):
        t += f" (우대금리 최대 {r['bonus_cap']}%p, 최저 연 {r.get('floor')}%)"
    return t


def load_loans():
    with open(os.path.join(PROC, "loan_products.json"), encoding="utf-8") as fp:
        L = json.load(fp)
    m = L["meta"]
    url = "https://nhuf.molit.go.kr"
    age = (19, None)
    add("LOAN-common", "주택도시기금", "주택도시기금 대출 공통 규칙", "국토교통부", "전국", age, {"text": "상시"}, url, "공통 규칙",
        "주택도시기금 전세·월세 대출 공통 규칙: " + " / ".join(r for r in m["common_rules"] if "출처 미확인" not in r) + f" / 중복: {m['duplicate_rule']} / 금리: {m['rate_type']} (확인일 {m['checked_at']})")
    for r in m["common_rules"]:                              # 재직 1년 미만 소득 증빙은 질문이 많아서 따로 한 조각으로 (검색·답에서 묻히지 않게)
        if "1년 미만" in r and "출처 미확인" not in r:
            add("LOAN-common", "주택도시기금", "주택도시기금 대출 공통 규칙", "국토교통부", "전국", age, {"text": "상시"}, url, "재직 1년 미만",
                "주택도시기금 전세·월세 대출(버팀목 포함) 재직 1년 미만 소득 증빙: " + r)
    for p in L["products"]:
        e, t, lim, r = p["eligibility"], p["target_house"], p["limit"], p["rate"]
        pid, name = "LOAN-" + p["id"], p["name"]
        a = (e.get("age_min"), e.get("age_max"))
        add(pid, "주택도시기금", name, "국토교통부", "전국", a, {"text": "상시"}, url, "지원 대상",
            f"{name} 대상: " + (f"만 {e.get('age_min')}~{e.get('age_max')}세" if e.get('age_max') else f"만 {e.get('age_min')}세 이상 (나이 상한 없음)") + f", {e.get('household')}, 연소득 {won(e.get('income_max'))} 이하, 순자산 {won(e.get('net_asset_max'))} 이하"
            + (f", 연장: {e.get('age_extended_condition')} (최대 만 {e.get('age_max_extended')}세)" if e.get("age_extended_condition") else "")
            + f". 대상 주택: {human(t)}")
        add(pid, "주택도시기금", name, "국토교통부", "전국", a, {"text": "상시"}, url, "한도",
            f"{name} 한도: {human(lim)}" + (f" ({lim['ratio_new_contract']})" if isinstance(lim.get('ratio_new_contract'), str) else ""))
        add(pid, "주택도시기금", name, "국토교통부", "전국", a, {"text": "상시"}, url, "금리·기간",
            f"{name} 금리: {rate_text(r)}. 기간: {p['term'].get('months')}개월 단위, {p['term'].get('repayment')}")
        add(pid, "주택도시기금", name, "국토교통부", "전국", a, {"text": "상시"}, url, "참고", f"{name} 참고: " + " / ".join(p.get("notes", [])))
    return len(L["products"]) + 1


# ── SH 청년안심주택 ──
def load_sh():
    with open(os.path.join(PROC, "sh_youth_housing.json"), encoding="utf-8") as fp:
        S = json.load(fp)
    url = "https://www.i-sh.co.kr"
    e, lt = S["eligibility_youth"], S["lease_terms"]
    nm = "SH 청년안심주택(공공임대) 청년 1인 모집"
    age = (19, 39)
    ap = {"text": " / ".join(f"{t['notice']} 공고 {t['announce']}, 신청 {t['apply']}, 입주 {t['move_in']}" for t in S["timeline"])}
    add("SH-youth", "SH", nm, "서울주택도시공사", "서울", age, ap, url, "지원 대상",
        f"{nm} 자격: {e['age']}. 순위: " + " / ".join(f"{k}순위 {v.get('who')} (임대료 {v.get('rent_level')}형{', 자산 ' + str(v['asset_max']) + '만 원 이하' if v.get('asset_max') else ''})" for k, v in e["rank"].items())
        + f". 소득 기준(1인, 월, 원): 50% {e['income_monthly_won']['1인']['50%']:,} / 100% {e['income_monthly_won']['1인']['100%']:,}. 선정: {e['selection_order']}. 가점: " + ", ".join(e["bonus_points"]))
    add("SH-youth", "SH", nm, "서울주택도시공사", "서울", age, ap, url, "임대 조건",
        f"{nm} 임대료 수준: A형 {S['meta']['rent_levels']['A']}, B형 {S['meta']['rent_levels']['B']}. 기간: {lt['period']}. 납부: {lt['payment']}. "
        f"보증금→월세 전환: {lt['conversion']['deposit_to_monthly']['formula']} (최대 {int(lt['conversion']['deposit_to_monthly']['max_ratio']*100)}%). "
        f"월세→보증금 전환: {lt['conversion']['monthly_to_deposit']['formula']}. 관리비: {lt['maintenance_fee']}. 예비입주자: {lt['waitlist']}")
    add("SH-youth", "SH", nm, "서울주택도시공사", "서울", age, ap, url, "일정",
        f"{nm} 일정: " + " / ".join(f"{t['notice']}: 공고 {t['announce']}, 신청 {t['apply']}, 당첨 발표 {t['winner']}, 계약 {t['contract']}, 입주 {t['move_in']} (공고~입주 약 {t['months_announce_to_movein']}개월)" for t in S["timeline"]))
    by_gu = {}
    for c in S["complexes"]:
        if c.get("note"):
            continue
        by_gu.setdefault(c["gu"], []).append(c)
    for gu, cs in by_gu.items():
        lines = [f"{c['complex']}({c['address']}, {c['area_m2']}㎡, {c['notice']}): B형 보증금 {c['rent']['B']['deposit']:g}만·월 {c['rent']['B']['monthly']:g}만" for c in cs if c["rent"].get("B")]
        add("SH-youth", "SH", nm, "서울주택도시공사", "서울-" + gu, age, ap, url, f"단지-{gu}", f"{nm} {gu} 단지: " + " / ".join(lines))
    return 1


# ── 시연용 정책 4개 + 중복 규칙 ──
def load_demo():
    with open(os.path.join(PROC, "demo_policies.json"), encoding="utf-8") as fp:
        D = json.load(fp)
    for p in D["policies"]:
        pid, name, b = "DEMO-" + p["key"], p["name"], p["benefit"]
        ages = [c for c in p["eligibility"] if c["field"] == "age"]
        age = (ages[0]["min"], ages[0]["max"]) if ages else (None, None)
        r0 = p["apply_rounds"][0]
        ap = {"start": r0.get("start"), "end": p["apply_rounds"][-1].get("end"),
              "text": " / ".join(f"{r['round']} {r.get('start') or ''}~{r.get('end') or ''} ({r.get('channel','')})" for r in p["apply_rounds"])}
        add(pid, "시연 정책", name, p["org"], "서울" if "서울" in p["org"] else "전국", age, ap, p["source_url"], "지원 내용",
            f"{name} 지원 내용: {b['rule']}" + (f" (최대 {b['total_max']}만 원)" if b.get("total_max") else ""))
        add(pid, "시연 정책", name, p["org"], "서울" if "서울" in p["org"] else "전국", age, ap, p["source_url"], "지원 대상",
            f"{name} 자격: " + " / ".join(c["text"] for c in p["eligibility"]))
        add(pid, "시연 정책", name, p["org"], "서울" if "서울" in p["org"] else "전국", age, ap, p["source_url"], "신청 방법", f"{name} 신청: {ap['text']}" + (f" · 규모 {b['scale']}" if b.get("scale") else "") + (f" · 문의 {p['contact']}" if p.get("contact") else ""))
    for i, r in enumerate(D["duplicate_rules"]):
        title = " ↔ ".join(r.get("pair", [])) or r.get("condition") or r.get("policy")
        add(f"DEMO-dup-{i}", "시연 정책", f"중복 수혜 규칙: {title}", "서울시·국토부", "서울", (None, None), {"text": ""},
            (r.get("sources") or [""])[0], "중복 규칙", f"중복 수혜 규칙 ({r['type']}): {r['text']}")   # compare_hint(국토부가 총액상 유리)는 앱 계산용이라 AI 근거에서 뺌
        if r.get("stop_notice"):                                 # 중복 선정자 지급중지 공지 원문
            sn = r["stop_notice"]
            add(f"DEMO-dup-{i}", "시연 정책", f"중복 수혜 규칙: {title}", "서울시·국토부", "서울", (None, None), {"text": ""},
                sn["url"], "지급중지 안내", f"{sn['title']}: {sn['text']}")
    return len(D["policies"])


def main():
    counts = {"온통청년": load_youthcenter(), "정부24": load_gov24(), "대출": load_loans(), "SH": load_sh(), "시연 정책": load_demo()}
    with open(os.path.join(OUT, "chunks.jsonl"), "w", encoding="utf-8") as fp:
        for c in chunks:
            fp.write(json.dumps(c, ensure_ascii=False) + "\n")
    import rag
    rag.build_index(chunks, OUT)
    print("정책 수:", counts, "| 청크 수:", len(chunks))
    print("저장 → processed/rag/chunks.jsonl, index.pkl")


if __name__ == "__main__":
    main()
