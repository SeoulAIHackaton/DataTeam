# 첫집 내비 · 데이터 패키지 (Data/AI 파트)

2026 서울AI디지털배움터 청년 AI 해커톤 · 정리일 2026-11-10 · 3단계 개편 2026-11-12 · **PRD v1.2 기준 갱신 2026-11-17**

> 단계 번호는 **최종 서비스 (3단계)** 기준이에요.
> **STEP 1 내 상황** → **STEP 2 근거 있는 지원 추천 (+ 공고문에 물어보기 = RAG)** → **STEP 3 집 비교**
> 예전 "STEP 2 주거 전략 + 2년 살아보기"는 빠졌어요 (코드·결과는 `archive/`에 보관).
> 시연 기준일은 **본선 날짜 2026-11-21 (실제 날짜)** 예요. 가상 일정은 쓰지 않아요.
>
> 최신 기획은 [`docs/첫집내비_PRD_v1.2.md`](docs/첫집내비_PRD_v1.2.md)이고, 풀스택 문서(v1.0)와 달라진 점은 [`docs/첫집내비_서비스소개v4_변경사항.md`](docs/첫집내비_서비스소개v4_변경사항.md)에 있어요. PRD 요구사항(R1~R11)과 이 레포의 코드가 어떻게 이어지는지는 [8. PRD v1.2와 이 레포](#8-prd-v12와-이-레포)에 정리했어요.

```
firsthome_data/
├── README.md
├── .env.example          # API 키 넣는 틀 → .env로 복사해서 사용
├── raw/                  # 받은 그대로의 원본 (용량이 커서 압축본에는 없음)
├── processed/            # 서비스에서 바로 쓰는 데이터
│   ├── step2_support/    #   STEP 2 지원 추천 결과 (policy_result.json, explain_result.json)
│   ├── step3_homes/      #   STEP 3 집 비교 데이터·결과 (카카오·ODsay 수집, 추천 점수)
│   └── rag/              #   RAG 검색 색인 (공고문 조각 chunks.jsonl, index.pkl)
├── scripts/              # 수집·가공·계산·AI 코드
├── web/                  # index.html (최종 화면) · kakaomap_test.html
├── docs/                 # PRD v1.2 · v4 변경사항 정리 · 기능 CRUD 명세 (엑셀) · 서비스 소개 (PDF)
└── archive/              # 지금 안 쓰는 데이터·코드 보관 (주거 전략 단계, 전월세 시세·전환율, 예전 프로토타입)
```

금액 단위는 따로 적지 않으면 **만원**이에요.

---

## 실행하기 (화면 띄우기)

화면(`web/index.html`)과 API를 `scripts/server.py` 하나로 같이 띄워요. **API 키가 없어도 화면은 끝까지 돌아가요.**

### 1. 처음 한 번만

```bash
git clone https://github.com/SeoulAIHackaton/DataTeam.git
cd DataTeam
pip install numpy                 # 서버(공고문 검색)에 필요한 유일한 패키지
copy .env.example .env            # (선택) 키가 있을 때만 · 맥은 cp .env.example .env
```

- 파이썬 3가 있어야 해요. 윈도우에서 `python`이 안 되면 `py`로 바꿔서 실행해요.

### 2. 서버 켜기

```bash
python scripts/server.py
```

브라우저에서 **http://127.0.0.1:5500** 을 열어요 (`/web/index.html`로 바로 넘어가요). 끌 때는 터미널에서 `Ctrl+C`를 눌러요.

이렇게 나오면 잘 켜진 거예요.

```
검색 데이터 불러오는 중…
장소 검색 꺼짐 → 미리 정한 후보 목록
준비 완료 · AI 답변 꺼짐 → 공고문 원문으로 답해요

열기 → http://127.0.0.1:5500/web/index.html   (끄기: Ctrl+C)
```

서버만 확인하려면 http://127.0.0.1:5500/api/health 를 열어요 → `{"ok": true, "ai": false, "place": false}` (`ai`·`place`는 키가 있으면 `true`)

### 3. 키가 없을 때와 있을 때

| 기능 | 키 없을 때 | 키를 넣는 곳 |
|---|---|---|
| 1단계 자주 가는 곳 검색 | 미리 정한 후보 목록에서 골라요 | `.env` → `KAKAO_REST_API_KEY` |
| 2단계 공고문에 물어보기 | 공고문 원문 문장으로 답해요 | `.env` → `LLM_API_KEY` |
| 3단계 이 비교에 대해 물어보기 | 코드가 미리 정한 문장으로 답해요 | `.env` → `LLM_API_KEY` |
| 3단계 지도 | 2호선 그림 지도로 보여요 | `web/index.html`의 `KAKAO_JS_KEY` (`'JS_KEY'` 자리) |
| 3단계 새 주소의 오가는 시간 | 직선거리로 추정해요 (예시 집 3곳은 저장된 값) | `web/index.html`의 `ODSAY_WEB_KEY` (`'ODSAY_KEY'` 자리) |

- `.env`를 바꾸면 서버를 껐다 켜요. 키 값은 노션 「📦 데이터 · API 정리」 DB에 있어요.
- `web/index.html`에 넣은 키는 **커밋하지 말고** 내 컴퓨터에서만 써요.

### 자주 막히는 것

- **`포트 5500이 이미 쓰이고 있어요`**: VS Code Live Server가 켜져 있으면 꺼요 (같은 포트예요). 다른 포트로 켜려면 `PORT=8000 python scripts/server.py` (윈도우 cmd는 `set PORT=8000` 다음 줄에 실행)인데, 카카오 지도 키가 `http://127.0.0.1:5500`에 등록돼 있어서 **지도는 5500에서만 떠요.**
- **`ModuleNotFoundError: No module named 'numpy'`**: `pip install numpy`를 해요.
- **`index.html`을 더블클릭해서 열면**: 화면은 보이지만 서버가 없어서 공고문에 물어보기 · 장소 검색 · 비교 질문이 안 돼요. 꼭 서버를 켜고 위 주소로 열어요.
- **`localhost:5500`으로 열면** 카카오 지도가 안 뜰 수 있어요. 등록된 주소인 `127.0.0.1:5500`으로 열어요.

---

## 0. 한눈에 보기

상태 표시
- 📥 **파일 받음**: 사이트에서 직접 내려받거나 원문을 옮겨 적은 것 (키 없음)
- 🔑 **키 발급**: API 키만 받고 테스트까지 한 것
- ✅ **키로 수집 완료**: API 키로 실제 데이터를 받아 저장한 것
- ⬜ **아직**: 신청·수집 전

단계 표시
- **STEP 1·2·3**: 지금 서비스에서 쓰는 것
- **보관**: 안 써서 `archive/`로 옮긴 것 → [5-1. archive 폴더](#5-1-archive-폴더)
- **보류**: 지금은 안 쓰지만 다시 넣을 수 있어서 `raw/`·`scripts/`에 그대로 둔 것 (현재 LH)

| 단계 | 데이터 | 방식 | 상태 | 쓰는 곳 | 파일 |
|---|---|---|---|---|---|
| STEP 1 | 사용자 입력 (9개 항목, 한 화면) | 항목마다 맞는 입력 도구(출생연도 선택 상자·버튼·장소 검색·금액 입력)로 골라요 → 글자 해석 없음 (LLM 안 씀) | ✅ 화면 확인 18/18 | 프로필 (STEP 2·3에서 재사용) | `web/index.html`, `web/step1_rules.js`(항목 정의 `FIELDS`), `scripts/step1_ui_check.py` |
| 보관 | 서울시 부동산 전월세가 | 서울 열린데이터광장 API | ✅ 수집·가공 | 안 씀 (원본 없음, 가공본만 보관) | `archive/processed/rent_median_seoul.*` |
| STEP 2 | 주택도시기금 대출 3종 | 웹 원문 | 📥 | RAG 상담 (대출 조건·한도 질문) | `processed/loan_products.json` |
| STEP 2 | SH 청년안심주택 1·2차 공고 | PDF | 📥 | RAG 상담 (입주 자격·일정 질문) | `processed/sh_youth_housing.json` |
| 보관 | 서울시 전월세 전환율 | 웹 | 📥 | 주거 전략 단계용 → 안 씀 | `archive/processed/rent_conversion_rate_2026Q3.csv` |
| 보류 | LH 임대 공고 목록 API | 공공데이터포털 | ✅ 6건 수집 (청년 매입임대 포함) | 지금은 안 씀 (예전 전략 C용) | `raw/api_samples/lh_…json`, `raw/lh/` |
| 보류 | LH 공고별 공급정보 API | 공공데이터포털 | ✅ 6건 수집 | 공고별 주택 목록·공급호수 (보증금·월세는 대부분 없음 → 공고문 PDF) | `raw/lh/` |
| STEP 2 | 온통청년 청년정책 API | 온통청년 | ✅ 전체 3,960건 | 더 찾아본 지원 · RAG 색인 | `raw/youthcenter/`, `processed/youthcenter_seoul_housing.csv` |
| STEP 2 | 정부24 혜택 API | 공공데이터포털 | ✅ 수집 | 더 찾아본 지원 · RAG 색인 | `raw/gov24/`, `processed/gov24_housing.*` |
| STEP 2 | 현금 지원 4개 + 중복 규칙 | 온통청년 + 서울시 공고 | 📥 정리 완료 | 코드 판정 · 금액 합계 · 달력 · 중복 시 큰 쪽 자동 선택 | `processed/demo_policies.json` |
| STEP 2 | 공고문 조각 (RAG 색인) | 위 데이터로 생성 | ✅ 1,233개 | 공고문에 물어보기 | `processed/rag/` |
| STEP 2 | RAG 평가 22문항 | 공고문 원문과 대조 | ✅ 검색 22/22 · 근거 20/20 · 답 22/22 | LLM·검색 바꿀 때 다시 돌리기 | `processed/rag/eval_*.csv` |
| STEP 3 | 대중교통 길찾기 (ODsay) | ODsay API | ✅ 3곳 수집 | 회사·학교까지 시간·요금·환승 (카카오모빌리티 자동차 길찾기는 안 씀) | `processed/step3_homes/` |
| STEP 3 | 카카오 로컬 (주소·주변 시설 8종) | 카카오 API | ✅ 3곳 수집 | 생활 편의 표 · 지도 | `processed/step3_homes/` |

### 발급받은 API 키

| 키 | 발급처 | 쓰는 API | `.env` 이름 |
|---|---|---|---|
| 공공데이터포털 인증키 | data.go.kr | 정부24 혜택, LH 공고 목록·공급정보 (나중에 약국도 같은 키로 신청) | `DATA_GO_KR_API_KEY` |
| 온통청년 API 키 | youthcenter.go.kr | 청년정책 목록 | `YOUTHCENTER_API_KEY` |
| 카카오 | developers.kakao.com | 로컬(REST) · 지도(JavaScript 키는 HTML에) | `KAKAO_REST_API_KEY` |
| ODsay | lab.odsay.com | 대중교통 길찾기 (서버 IP 등록 필요) | `ODSAY_API_KEY` |
| LLM | 미정 (개발·테스트는 OpenAI 임시) | AI 설명 · RAG 답변 | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` |

서비스 LLM은 아직 정하지 않았어요. `.env`의 `LLM_BASE_URL`, `LLM_MODEL`만 바꾸면 OpenAI 호환 API를 쓰는 다른 모델로 코드 수정 없이 바뀌어요. `.env.example`의 `gpt-4o-mini`는 개발용 기본값일 뿐이에요. **모델을 바꾸면 `python scripts/rag_eval.py`로 22문항 평가를 다시 돌려요.**

키 값은 노션 「📦 데이터 · API 정리」 DB에 있어요. **`.env`에만 넣고 깃허브에는 절대 올리지 마세요** (`.gitignore`에 들어 있음).

---

## 1. 대출 · 청년주택 · 시세 데이터

> 3단계 개편 후: 원래 "주거 전략" 단계용이던 데이터예요. 지금은 **대출 3종·SH 공고는 RAG 색인**(STEP 2 AI 상담)에 들어가고,
> 전월세 시세·전환율·LH는 쓰지 않아요 (전월세 시세·전환율은 `archive/`에 보관). 아래 설명의 "전략 A·B·C"는 예전 기준이에요.

### 1-1. 서울시 부동산 전월세가 🔑 (보관: `archive/`, 지금은 안 씀)
> 수집·가공 스크립트는 `archive/scripts/collect_seoul_rent.py`, `build_rent_median.py`로 옮겼어요. 다시 쓰려면 `scripts/`로 되돌려 실행해요.

- 출처: 서울 열린데이터광장 「서울시 부동산 전월세가 정보」(OA-21276)
- **수집은 Open API로 해요** (최신 계약까지 들어옴). 2025년 파일 다운로드본은 API가 안 될 때의 대안이에요.
  - 호출: `http://openapi.seoul.go.kr:8088/{KEY}/json/tbLnOpendataRentV/{시작}/{끝}/{접수연도}/{자치구코드}`
  - 한 번에 1,000건까지라 스크립트가 끝까지 반복해서 받아요. **최근 3년치만** 제공돼요.
  - 수집: `python scripts/collect_seoul_rent.py` → `raw/seoul_rent/seoul_rent_api_{연도}_YYYYMMDD.json`
  - 접수연도·자치구 필터가 실제로 적용됐는지 응답으로 검사하고, 안 됐으면 멈춰요.
- 한 행 = 신고된 전월세 계약 1건

| 컬럼 | 뜻 | 쓰는 법 |
|---|---|---|
| `CGG_CD`, `CGG_NM` | 자치구 코드·이름 | 동네 특정 (법정동과 같이) |
| `STDG_CD`, `STDG_NM` | 법정동 코드·이름 | 예: 역삼동 |
| `CTRT_DAY` | 계약일 | 최근 1년 등 기간 필터 |
| `RENT_SE` | 전세 / 월세 | 전략 A·B 구분 |
| `RENT_AREA` | 임대면적(㎡) | 33~40㎡ 이하 = 원룸 근사 |
| `GRFE` | 보증금 (만원) | |
| `RTFE` | 월세 (만원) | 전세는 0 |
| `BLDG_USG` | 건물용도 (아파트, 연립다세대, 오피스텔, 단독다가구) | 아파트 제외 |
| `NEW_UPDT_YN` | 신규 / 갱신 | **신규만** 사용 |

주의
- "원룸" 분류는 없어요. 아파트를 빼고 면적으로 근사해요.
- 갱신계약은 인상 상한 때문에 시세보다 낮아요 → 신규만 써요.
- 평균 대신 **중앙값**을 써요.
- 가공: `python scripts/build_rent_median.py` → `processed/rent_median_seoul.json/.csv`
  - 아파트 제외, 임대면적 40㎡ 이하(`--max-area`로 변경), 신규만, 가장 최근 계약일부터 12개월(`--months`)
  - API 수집본(`seoul_rent_api_*.json`)이 있으면 그걸 쓰고, 없으면 zip·csv를 읽어요 (`--source api|file`로 지정 가능).
  - 파일은 한글·영문 헤더, utf-8·cp949 모두 읽어요. zip 그대로 넣어도 돼요.

```jsonc
{
  "meta": { "source", "built_at", "period": ["2025-01-02", "2025-12-28"], "filters", "units": "만원, ㎡", "min_sample": 5, "note" },
  "table": [
    { "gu_code": "11680", "gu": "강남구", "dong_code": "10100", "dong": "역삼동",   // dong="(구 전체)"는 구 단위 집계
      "rent_type": "월세",                         // 전세 / 월세
      "area_bin": "전체",                          // 전체 / ~20㎡ / 20~33㎡ / 33㎡~
      "n": 63, "sample_ok": true,                  // 표본 5건 미만이면 false → 구 전체 값 사용
      "deposit_median", "deposit_p25", "deposit_p75",
      "monthly_median", "monthly_p25", "monthly_p75",
      "area_median" }
  ]
}
```
- 신고된 거래만 있어서 아주 싼 월세는 빠졌을 수 있어요 → 화면에 "신고된 거래 기준"으로 표기해요.

### 1-2. 주택도시기금 대출 3종 📥 → `processed/loan_products.json`
- 출처: 주택도시기금 개인상품 안내 원문 (`raw/loan/*.txt`), 확인일 2026-11-10

```jsonc
{
  "meta": { "source", "checked_at", "units", "rate_type", "common_rules": [...], "duplicate_rule" },
  "products": [
    {
      "id": "youth_monthly_rent_loan",          // youth_jeonse_loan, general_jeonse_loan
      "name": "청년전용 보증부월세대출",
      "strategy": "B_월세",                      // 연결되는 전략
      "eligibility":  { "age_min", "age_max", "household", "income_max", "net_asset_max" },
      "target_house": { "area_max", "deposit_max", "monthly_rent_max",
                        "public_rental_target_allowed", "sharehouse_allowed" },
      "limit": { "deposit_loan_max", "rent_loan_max", "rent_loan_monthly_max", "rent_loan_months", "ratio_new_contract" },
      "rate":  { "deposit": 1.3, "rent": { "free_monthly_amount": 20, "rate_free_part": 0.0, "rate_over_part": 1.0 } },
      "term":  { "months", "max_months", "repayment" },
      "notes": [...]
    }
  ]
}
```

주의
- 세 상품은 **서로 같이 못 받아요**.
- 월세대출은 공공임대에 못 쓰고, 버팀목은 LH·SH 공공임대에도 쓸 수 있어요 → 전략 C는 버팀목과 연결해요.
- 만 35세부터는 청년전용 → 일반 버팀목 (한도 1.5억→1.2억, 비율 80%→70%).
- 변동금리라 화면에 확인일을 같이 표기해요.

### 1-3. SH 청년안심주택 📥 → `processed/sh_youth_housing.json`
- 출처: SH 2026년 1차(2026-03-31), 2차(2026-07-31) 청년안심주택(공공임대) 입주자모집공고 PDF (`raw/sh_notice/`)
- 범위: 청년 1인 일반형 77개 유형(814호). 신혼부부형·셰어형은 제외했어요.
- 공공 API가 없어서 PDF 표를 직접 옮겼어요. 다시 만들 때는 `scripts/build_sh_youth_housing.py`를 써요.

```jsonc
{
  "meta": { "source", "checked_at", "scope", "units", "rent_levels": { "A": "시세 30%", "B": "시세 50%" }, "warning" },
  "eligibility_youth": {
    "age": "만 19~39세, 미혼, 본인 무주택",
    "rank": { "1": {...}, "2": { "asset_max": 34500, "rent_level": "B" }, "3": { "asset_max": 25100, "rent_level": "B" } },
    "income_monthly_won": { "1인": { "50%": 2669354, "100%": 4576036 }, ... },   // 원 단위
    "selection_order", "bonus_points": [...]
  },
  "lease_terms": {
    "period": "2년, 재계약 4회",
    "conversion": { "deposit_to_monthly": { "rate": 0.025 }, "monthly_to_deposit": { "rate": 0.06 } }
  },
  "timeline": [ { "notice": "2026-1차", "announce", "apply", "winner", "contract", "move_in", "months_announce_to_movein": 6 } ],
  "complexes": [
    { "notice": "2026-1차", "complex": "리마크빌 구의", "address", "gu": "광진구", "supply", "type", "area_m2", "units",
      "rent": { "A": { "deposit": 3330.0, "monthly": 14.7 }, "B": { "deposit": 5550.0, "monthly": 24.5 } } }
  ]
}
```

주의
- 페르소나(27세, 월 230만, 자산 2천)는 **3순위 → B(시세 50%)** 예요.
- 공고부터 입주까지 약 6개월 → 전략 C의 "대기 중 원가 부담" 구간이에요.
- `note`가 붙은 행은 PDF 표 배치로 단지를 추정한 것이라, 시연에 쓰려면 원문과 대조해야 해요. 유벤투스 240은 B 월세가 A와 같게 적혀 있어요(공고 오기일 수 있음).

### 1-4. 서울시 전월세 전환율 📥 → `archive/processed/rent_conversion_rate_2026Q3.csv` (보관, 지금은 안 씀)
- 출처: 서울주택 정보마당(housinginfo.seoul.go.kr), 2026년 3분기

| 컬럼 | 예시 |
|---|---|
| `자치구` | 서울시 평균, 강남구, … (25개 구 + 평균) |
| `연립다세대_전환율(%)` | 5.5 |

- 원룸 값이 따로 없어서 **연립다세대 값을 대신** 써요 → 화면에 "연립다세대 기준 추정"으로 표기해요.
- 분기마다 바뀌어요. 갱신: housinginfo.seoul.go.kr 메인 → 「전월세 전환율」 탭 → 「연립다세대」 카드

### 1-5. LH 임대 공고 🔑
SH와 LH는 **다른 기관의 다른 공고**라서 전략 C(청년주택)에는 둘 다 들어가야 해요.
- SH(서울주택도시공사): 청년안심주택(공공임대분), SH 행복주택, 장기전세 등. API 없음 → PDF
- LH(한국토지주택공사): 청년 매입임대, 청년 전세임대, 행복주택, 통합공공임대 등. API 있음

**① 공고 목록 API** (🔑 테스트 완료)
- 호출: `https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1` (End Point 뒤에 기능명까지)
- 파라미터: `UPP_AIS_TP_CD=06`(임대주택: 행복·국민·통합공공임대) **+ `13`(주거복지: 매입임대·전세임대, 청년 매입임대는 여기)**, `CNP_CD=11`(서울), `PAN_NT_ST_DT`·`CLSG_DT` 필수 (YYYY.MM.DD), `PG_SZ`, `PAGE`
- **날짜 파라미터를 바꿔도 최근 공고만 돌아와요** (1년치를 2개월씩 나눠 조회해도 같은 2건만 나옴). 과거 공고는 API로 못 받아요 → 스크립트를 주기적으로 돌려서 `raw/lh/`에 누적해야 해요.
- 2026-11-10 수집 결과: 서울 6건, 모두 접수마감
  - 임대주택(06): 강서염창 통합공공임대 본공고 + 정정공고
  - 주거복지(13): **26년 3차 청년 매입임대**(9/17, 마감 9/30), 신혼·신생아 매입임대 Ⅰ·Ⅱ, 비분양전환형 든든전세

```jsonc
[
  { "dsSch": [ { "PAN_ST_DT", "PAN_ED_DT", "UPP_AIS_TP_CD": "06", "CNP_CD": "11", "PAGE", "PG_SZ" } ] },
  { "dsList": [
      { "PAN_ID": "2015122300020753",          // 공고 ID → 공급정보 API 호출에 사용
        "PAN_NM": "강서염창 통합공공임대주택 최초 입주자 모집공고",
        "AIS_TP_CD": "48", "AIS_TP_CD_NM": "통합공공임대",   // 매물유형
        "UPP_AIS_TP_CD": "06", "UPP_AIS_TP_NM": "임대주택",
        "CNP_CD_NM": "서울특별시",
        "PAN_NT_ST_DT": "2026.09.17",            // 공고일
        "CLSG_DT": "2026.10.01",                 // 접수 마감일 → 마감 임박
        "PAN_SS": "접수마감",                     // 공고중 / 접수중 / 접수마감 / 당첨자발표
        "SPL_INF_TP_CD": "062", "CCR_CNNT_SYS_DS_CD": "03",   // 공급정보 API 호출에 사용
        "DTL_URL": "https://apply.lh.or.kr/…",  // 공고 원문 페이지
        "ALL_CNT": "2" } ],
    "resHeader": [ { "SS_CODE": "Y", "RS_DTTM" } ] }
]
```

**② 공고별 공급정보 API** (✅ 2026-11-10 수집)
- 공공데이터포털 「한국토지주택공사_분양임대공고별 공급정보 조회 서비스」(data.go.kr/data/15056765), 같은 키 사용
- 호출: `https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1`
- 파라미터: 목록 API 응답의 `PAN_ID`, `SPL_INF_TP_CD`, `CCR_CNNT_SYS_DS_CD`, `UPP_AIS_TP_CD`, `AIS_TP_CD`를 그대로 넣음
- 원본: `raw/lh/lh_supply_YYYYMMDD.json` (공고마다 `request` + `response`를 그대로 저장)

```jsonc
[
  { "dsSch": [ { "PAN_ID", "SPL_INF_TP_CD", "CCR_CNNT_SYS_DS_CD", "UPP_AIS_TP_CD", "AIS_TP_CD" } ] },
  { "dsList01Nm": [ { … 아래 필드의 한글 이름표 … } ],
    "dsList01": [
      { "SBD_LGO_NM": "강서염창(가로주택) 통합공공임대주택",   // 단지명
        "HTY_NNA": "59A",                                    // 주택형
        "DDO_AR": "59.95",                                   // 전용면적(㎡)
        "SPL_AR": "76.56",                                   // 공급면적(㎡)
        "HSH_CNT": "14", "NOW_HSH_CNT": "14",                // 세대수, 금회공급 세대수
        "LS_GMY": "공고문 참조",                              // 임대보증금(원)
        "RFE": "공고문 참조" } ],                             // 월임대료(원)
    "resHeader": [ { "SS_CODE": "Y", "RS_DTTM" } ] }
]
```

**공고 유형마다 응답 구조가 달라요** (2026-11-10 수집분)

| 공고 | 목록 키 | 필드 | 건수 |
|---|---|---|---|
| 통합공공임대 (강서염창) | `dsList01` | 단지명 `SBD_LGO_NM`, 주택형 `HTY_NNA`, 전용 `DDO_AR`·공급면적 `SPL_AR`, 세대수 `HSH_CNT`, 보증금 `LS_GMY`·월세 `RFE` (원) | 1 (금액은 "공고문 참조") |
| **청년 매입임대 3차** | `dsList02` | 주택정보 `DNG_HS_ADR`(예: "강남역삼동(비엔트)"), 공급호수 `LTR_SPL_RMNO`, 모집인원 `QUP_CNT`, 지자체 `CNP_NM`, 전용여부 `SX_PP_DS_NM` | 110곳, 420호 |
| 신혼·신생아 매입임대 Ⅰ·Ⅱ | `dsList01` | 주택정보, 지자체명 `SGG_NM`, 공급호수, 모집인원 | 52곳 / 44곳 |
| 든든전세 | `dsList01` | 주택형 `HTY_DS_NM`(면적 구간), 지역명, 주택정보, 공급호수, 모집인원 | 34곳 |

- 각 목록 옆의 `dsList0xNm`이 필드 한글 이름표예요. 파싱할 때 이걸로 매핑하면 유형이 달라도 처리돼요.
- **청년 매입임대에는 보증금·월세·면적이 없어요.** 어느 동네에 몇 호가 나오는지만 있어요 → 금액은 공고문 PDF에서 가져와야 해요.
- 금액이 있는 유형은 **원** 단위예요. SH 데이터(만원)와 합칠 때 변환해요.
- 여성전용 주택은 `DNG_HS_ADR`에 "(여성전용)"으로 붙어 있어요.
- 강서염창 원공고와 정정공고는 공급정보가 같아요 → 최신 정정공고만 남겨요.

**SH와 합치는 법**
`sh_youth_housing.json`의 `complexes`와 같은 구조에 `provider: "SH" | "LH"`만 추가해서 넣어요.

---

## 2. STEP 2 · 근거 있는 지원 추천

추천 근거 표시, 마감 임박, 조건이 바뀌면?, 정책 비교, 중복 수혜 경고, 총액 추정에 쓰는 데이터예요.
나이·지역·무주택은 **코드 필터**, 서술형 소득·금액 조건만 **LLM 추출 후 "확인 필요/추정"** 으로 표시해요.

### 2-1. 온통청년 청년정책 API ✅
- 호출: `GET https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=…&pageNum=1&pageSize=100&rtnType=json`
- 전체 3,960건. **문서에 있는 검색 조건(`plcyNm`, `zipCd`, `lclsfNm` 등)이 실제로 안 먹어서** 전체를 받아서 직접 걸러요.
- 원본: `raw/youthcenter/youthcenter_policies_all_YYYYMMDD.json`

원본 구조
```jsonc
{
  "meta": { "collected_at", "totCount" },
  "youthPolicyList": [
    {
      "plcyNo": "20261021005400214208",       // 정책 ID
      "plcyNm": "2026 청년 월세 지원",          // 정책명
      "lclsfNm": "주거", "mclsfNm": "전월세 및 주거급여 지원",
      "plcyExplnCn", "plcySprtCn",            // 설명, 지원내용 (문장)
      "sprvsnInstCdNm",                       // 주관기관
      "sprtTrgtMinAge": "19", "sprtTrgtMaxAge": "39",
      "aplyPrdSeCd": "0057001",               // 신청기간 구분
      "aplyYmd": "20260101 ~ 20261231",       // 신청기간 (마감 임박 정렬)
      "earnCndSeCd": "0043003", "earnMaxAmt", "earnEtcCn",   // 소득 조건
      "addAplyQlfcCndCn",                     // 추가 자격 (문장)
      "ptcpPrpTrgtCn",                        // 참여제한대상 → 중복 수혜 근거
      "plcyAplyMthdCn", "aplyUrlAddr", "refUrlAddr1",
      "zipCd": "11110,11140,…"                // 거주지역 조건 (서울은 11로 시작)
    }
  ]
}
```

코드 뜻 (데이터로 추정, 코드정의서로 확인 필요)
- `aplyPrdSeCd`: 0057001 특정기간 / 0057002 상시·미정 / 0057003 연중
- `earnCndSeCd`: 0043001 무관 / 0043002 연소득 금액 제한 / 0043003 기타(문장)

가공본 `processed/youthcenter_seoul_housing.csv` (지금 들어 있는 117건은 `--age 27`로 거른 것 → 나이 없이 다시 돌리면 건수가 늘어남)

| 컬럼 | 뜻 |
|---|---|
| `id`, `name`, `category`, `org`, `top_org` | 정책 ID, 이름, 대·중분류, 주관기관 |
| `scope` | 전국/다지역 · 서울 전역 · 서울 일부 자치구 |
| `age_min`, `age_max` | 나이 조건 |
| `apply_type`, `apply_start`, `apply_end` | 신청기간 구분, 시작일, 마감일 |
| `income_type`, `income_max_manwon`, `income_text` | 소득 조건 (구분, 금액, 문장) |
| `support`, `extra_qualification`, `excluded`, `how_to_apply`, `url` | 지원내용, 추가자격, 제외대상, 신청방법, 링크 |
| `seoul_zip_count` | 서울 자치구 코드 개수 (25면 서울 전역) |

주의
- `zipCd`는 "거주지역 조건"이라 다른 지역 정책이 서울 코드를 포함하기도 해요 (예: 대구 귀환 청년 지원). 그래서 전국 정책도 필터를 통과해서, 117건 중 상당수가 농촌·창업 등 **노이즈**예요. 시연에는 `demo_policies.json`을 쓰고, 이 CSV는 `scope`와 기관으로 한 번 더 걸러서 써요.
- 서울시 정책 일부는 신청기간이 공고와 달라요 (예: 서울시 청년월세가 1/1~12/31로 들어 있음).

### 2-2. 정부24 혜택 API 🔑
- 호출: `GET https://api.odcloud.kr/api/gov24/v3/{serviceList | serviceDetail | supportConditions}?serviceKey=…&page=1&perPage=500`
- 필터: `cond[서비스분야::LIKE]=주거` 처럼 `cond[필드::LIKE|EQ]=값`
- 전체 10,942건. 수집: `scripts/collect_gov24.py` → `raw/gov24/gov24_{serviceList,supportConditions}_YYYYMMDD.json`
- 샘플: `raw/api_samples/gov24_*.json`

serviceList 구조
```jsonc
{
  "totalCount": 10942, "page": 1, "perPage": 500,
  "data": [
    { "서비스ID", "서비스명", "서비스분야": "주거·자립", "서비스목적요약",
      "지원대상", "선정기준", "지원내용", "지원유형": "현금",
      "신청기한": "○ 정기신청 : 5.1.~5.31. …",    // 문장
      "신청기한유형": "직접입력", "신청방법", "접수기관",
      "소관기관명", "소관기관유형": "중앙행정기관", "상세조회URL", "수정일시" }
  ]
}
```

supportConditions 구조
```jsonc
{ "data": [ { "서비스ID", "JA0110": 18, "JA0111": 65,   // 나이 하한·상한 (숫자)
              "JA0101": "Y", "JA0102": "Y", … } ] }    // 대상 포함 여부 (Y / null)
```

주의
- 신청기한이 문장이라 마감 임박에는 맞지 않아요 → 온통청년이 메인, 정부24는 보완용이에요.
- 지원조건의 `Y`는 "이 대상도 포함"이지 "필수"가 아니에요 → 나이(`JA0110~0111`)만 코드로, 나머지는 `선정기준` 문장에서 LLM으로 추출해요.
- 국토부 청년월세는 분야가 "생활안정"으로 들어 있어요 → 분야만으로 거르면 빠지니까 키워드를 같이 써요.

가공본 `processed/gov24_housing.json/.csv`는 `filter_seoul_housing.py`를 돌리면 생겨요.

### 2-3. 시연용 정책 4개 + 중복 규칙 📥 → `processed/demo_policies.json`
- 온통청년 값을 기본으로 하고, 금액·기간·한도는 서울시 공고로 보완했어요. 필드마다 출처 링크가 있어요.

| key | 정책 | 금액 | 신청기간 | 쓰는 곳 |
|---|---|---|---|---|
| `seoul_youth_rent` | 서울시 청년월세 | 월 20 × 12 = 240 | 2026-05-06 ~ 05-19 | 근거 표시, 총액, 비교 |
| `seoul_moving_brokerage` | 중개보수·이사비 | 최대 40 (생애 1회) | 1차 04-01~04-14, 2차 08-18~08-31 | 마감 임박, 총액 |
| `seoul_deposit_interest` | 임차보증금 이자지원 | 최대 2억 대출, 연 2.0% 지원 | 상시 | 비교 카드 |
| `molit_youth_rent` | 국토부 청년월세 | 월 20 × 24 = 480 | 2026-03-30 ~ 05-29 | 중복 수혜, 조건이 바뀌면?(35살) |

```jsonc
{
  "meta": { "description", "created", "units", "demo_reference_date_note", "field_status" },
  "policies": [
    {
      "key": "seoul_youth_rent", "name", "org", "youthcenter_id",
      "benefit": { "type", "monthly_max": 20, "months": 12, "total_max": 240, "rule", "source" },
      "apply_rounds": [ { "round", "start", "end", "channel", "source", "note" } ],
      "eligibility": [
        { "field": "age", "min": 19, "max": 39, "check": "code", "text": "원문 문장" },
        { "field": "income", "check": "llm", "text": "기준 중위소득 150% 이하" }
      ],
      "source_url"
    }
  ],
  "duplicate_rules": [
    { "pair": ["seoul_youth_rent", "molit_youth_rent"], "type": "중복 불가", "text", "sources": [...], "compare_hint" },
    { "condition": "SH 청년안심주택(공공임대) 입주", "excludes": ["molit_youth_rent"], "type": "중복 불가", ... },
    { "policy": "seoul_moving_brokerage", "type": "생애 1회", ... }
  ]
}
```

- `check: "code"` → 코드 필터로 ✓/✗ 판정, `check: "llm"` → 화면에 "확인 필요"로 표시
- **중복 수혜 근거**: 서울시 청년월세 ↔ 국토부 청년월세 중복 선정 시 지급중지 (서울주거포털 공지 2026-09-15). PDF 예시의 "월세 지원 ↔ 전세대출 이자지원"은 근거를 못 찾았으니 이 조합으로 바꿔서 시연해요.
- 이자지원 ↔ 청년월세 중복 여부는 원문에 명시가 없어서 "확인 필요"로 뒀어요.
- **기준일**: 본선 날짜 **2026-11-21 실제 날짜**로 계산해요. 이날은 현금 지원 접수가 모두 끝나서 화면에는 "내년에 신청하세요 + 공고 알림"으로 나오고,
  지금 신청 가능한 건 "더 찾아본 지원"에서 AI가 판정한 정책(청년안심주택 공급(매입)·안심계약 도움서비스 ~12/31, 대출보증 상시)이에요.

---

## 3. STEP 3 · 집 비교 ✅

후보 집 주소만 넣으면 생활 편의·비용·시간을 계산해서 우선순위별로 추천해요. 실제 주소 3곳으로 수집해 둔 데이터가 `processed/step3_homes/`에 있어요.

| 파일 | 내용 |
|---|---|
| `homes_summary.csv` | 집별 보증금·월세·좌표·자주 가는 곳까지 시간·요금·환승 |
| `nearest_places.csv` | 집별 가장 가까운 시설 8종 (역·마트·슈퍼·편의점·약국·내과·헬스장·공원)과 도보 시간 |
| `recommend_result.json` | 우선순위 4가지(균형·돈이 먼저·시간이 먼저·동네 생활)별 점수·순위·근거 문장 |
| `explain_result.json` | AI 설명 (키 없으면 템플릿) |
| `cache.json` | 카카오 응답 로컬 캐시 (`.gitignore`) |

밤 귀갓길 안전도(보안등·CCTV)와 약국 API는 범위에서 빠졌어요.

---

## 4. 수집하는 법

**처음 받은 컴퓨터에서 준비**
- 수집 스크립트는 파이썬 3 표준 라이브러리만 써요 (`pip install` 필요 없음). 화면 서버(`server.py`·`rag.py`)는 `numpy`가 필요해요 → [실행하기](#실행하기-화면-띄우기). `python`이 안 되면 `py`로 실행해요.
- zip에는 보안상 `.env`가 없어요 → `.env.example`을 복사해서 키를 채워요 (키 값은 노션 DB).

폴더 맨 위(`firsthome_data/`)에서 순서대로 실행해요.

```bash
copy .env.example .env                             # 윈도우 (맥은 cp .env.example .env), 처음 한 번만
python scripts/collect_youthcenter.py              # 온통청년 전체 약 3,960건 (100건씩 40번 호출)
python scripts/collect_gov24.py                    # 정부24 전체 약 10,942건 (목록 + 지원조건)
python scripts/filter_seoul_housing.py             # 서울 청년 주거 정책만 골라 processed/에 저장 (나이 조건 없이)
python scripts/build_sh_youth_housing.py           # (선택) SH JSON 재생성, 이미 processed/에 있음
```

LH는 현재 시연 범위에서 빠져 있어요. 다시 넣을 때만 실행해요.

```bash
python scripts/collect_lh.py                       # LH 서울 임대(06)+주거복지(13) 공고 + 공급정보
python scripts/collect_lh.py --no-supply           # 공급정보 API 활용신청 전이면 목록만
```

- 나이는 사용자마다 다르니 **수집 단계에서는 거르지 않아요.** 서비스에서 사용자 나이로 `age_min`·`age_max`를 비교해요. 테스트로 특정 나이만 보고 싶으면 `--age 27`처럼 붙여요.
- 모든 스크립트는 가장 최근 raw 파일을 자동으로 골라요.
- 해커톤 전에 미리 수집해서 파일로 저장해 두세요 (시연 중 API 장애 대비).

| 스크립트 | 하는 일 |
|---|---|
| `common.py` | `.env` 읽기, 재시도 붙은 GET, JSON 저장 |
| `collect_youthcenter.py` | 온통청년 전체 페이지 수집, 중복 제거 |
| `collect_gov24.py` | 정부24 serviceList·supportConditions 전체 수집 |
| `filter_seoul_housing.py` | 서울·주거·나이 기준으로 걸러 processed/에 JSON·CSV 저장 |
| `build_sh_youth_housing.py` | SH 공고 표 데이터로 `sh_youth_housing.json` 재생성 |
| `collect_lh.py` | LH 서울 임대 공고 목록 + 공고별 공급정보 수집 (공급정보 실패해도 목록은 저장) |

---

## 5. raw 폴더

| 경로 | 내용 | 비고 |
|---|---|---|
| `raw/loan/` | 대출 상품 원문 txt 3개 | |
| `raw/sh_notice/` | SH 1·2차 공고 PDF | |
| `raw/youthcenter/` | 온통청년 전체 수집본 | 스크립트 실행 후 생김 |
| `raw/gov24/` | 정부24 전체 수집본 | 스크립트 실행 후 생김 |
| `raw/lh/` | LH 공고 목록·공급정보 수집본 | 2026-11-10 수집분 포함 |
| `raw/api_samples/` | API 테스트 응답 (LH, 정부24, 온통청년) | 구조 확인용 |
| `processed/` | 가공본 + 단계별 결과 | 서비스에서 바로 사용 |

- LH(`raw/lh/`, `scripts/collect_lh.py`)는 **보류**예요. 지금은 안 쓰지만 다시 넣을 수 있어서 그대로 뒀어요.

### 5-1. archive 폴더

지금 서비스에서 **안 쓰는** 데이터·코드를 지우지 않고 모아 둔 곳이에요. 서비스·`check_data.py`는 이 폴더를 읽지 않아요 (전환율 파일 존재 확인만 해요).

| 경로 | 내용 | 빠진 이유 |
|---|---|---|
| `archive/processed/rent_median_seoul.json` / `.csv` | 서울 동네별 원룸 전월세 중앙값 (1-1) | 동네 추천 기능을 안 만들기로 함. 원본(API 수집본·zip)은 없음 |
| `archive/scripts/collect_seoul_rent.py`, `build_rent_median.py` | 위 데이터 수집·가공 스크립트 | 다시 쓰려면 `scripts/`로 옮겨서 실행 (`common.py`를 불러옴) |
| `archive/processed/rent_conversion_rate_2026Q3.csv` | 서울 전월세 전환율 (1-4) | 주거 전략 단계 삭제 |
| `archive/processed/step2_strategy/` | 주거 전략 추천·설명 결과 | 주거 전략 단계 삭제 |
| `archive/scripts/strategy.py` | 주거 전략 계산 코드 | 주거 전략 단계 삭제 (경로가 `processed/` 기준이라 그대로는 안 돌아감) |
| `archive/prototype_4단계.html` | 예전 4단계 화면 프로토타입 | 3단계로 개편 |
| `docs/archive/` | 예전 작업 정리 PDF | 3단계 개편 전 문서 |

---

## 6. 계산 · AI 코드 (3단계 기준, 2026-11-12)

원칙: **금액·자격·점수는 코드가 계산하고, AI는 근거 문장·공고문 원문만 보고 설명**해요.

### 실행 순서
```bash
python scripts/step1_ui_check.py       # STEP 1 화면 확인 15개 (server.py 켠 채로 · 확인용이라 Playwright 필요)
node scripts/step1_rules_eval.mjs      # (참고) 예전 글자 입력 규칙 평가 (Node만) → processed/step1/eval_result.csv
python scripts/policy_match.py         # STEP 2 지원 추천 → processed/step2_support/policy_result.json
python scripts/rag_build.py            # STEP 2 RAG 색인 → processed/rag/ (raw/ 필요, 한 번만)
python scripts/rag.py "35살인데 국토부 청년월세 받을 수 있어요?"   # RAG 답변 테스트
python scripts/collect_homes.py        # STEP 3 수집 (카카오·ODsay 키) → processed/step3_homes/*.csv
python scripts/recommend.py            # STEP 3 점수 → processed/step3_homes/recommend_result.json
python scripts/explain.py --step 2     # AI 설명 (2 = 지원 추천, 3 = 집 비교, --easy, --priority "시간이 먼저")
```
- 입력 프로필: `processed/profile_demo.json` (27세, 연소득 2,760만, 목돈 2,000만, 집 예산 `housing_plan` 월세 보증금 1,000/월 50, 12/1 입주)
  - 화면(`web/index.html`)의 1단계는 PRD R1의 9개 질문(출생연도, 상황, 자주 가는 곳, 보증금으로 쓸 돈, 월소득, 출퇴근 허용 시간, 입주 시기, 본인 명의 집, 세대 분리)으로 받아요. `profile_demo.json`은 그 전 형식이라 집 예산(`housing_plan`) 같은 필드가 남아 있어요. 스크립트 시연용으로만 써요.
- STEP 2와 RAG는 키 없이 돌아가요 (LLM 키가 없으면 원문 문장을 그대로 보여주는 모드). STEP 3 수집만 카카오·ODsay 키가 필요해요.

### STEP 1 · 1단계 한 화면 선택형 입력 (web/index.html, 2026-11-17)
팀 결정으로 1단계는 **한 화면에 9개 항목을 두고, 글자 대신 항목마다 맞는 입력 도구로** 골라요(시안 `step1_page.html`). 글자를 해석하지 않아서 정규식 오류가 생길 일이 없어요. 항목 정의(이름·보조 문구·버튼 값)는 `web/step1_rules.js`의 `FIELDS`예요. 고르는 즉시 저장해요.

| # | 항목 | 입력 도구 | 저장 |
|---|---|---|---|
| 1 | 출생연도 | 선택 상자 `<select>` (2010~1960, 처음엔 "선택") · 옆에 "만 27세" · 경계 연도만 생일 질문 | `birthYear`, `age`, `bday` |
| 2 | 지금 상황 | 버튼 4개 (대학생 · 대학원생 → '대학생') | `job` |
| 3 | 자주 가는 곳 | 장소 검색칸 · 서버 `GET /api/place`(카카오 로컬 장소+주소 검색, `.env` 키)로 실제 검색 · 맞는 `KNOWN_PLACES` 후보를 앞에, 카카오 결과를 뒤에 · 서버가 꺼져 있거나 키가 없으면 후보 목록만 · 고르면 이름·주소와 [바꾸기] | `place`, `placeOk`, `setDest()` |
| 4 | 보증금으로 쓸 돈 | 숫자 입력 (만 원, 0~100,000) + 빠른 선택 500만~1억 | `cash` |
| 5 | 한 달 수입 | [월급/연봉] 전환 + 숫자 + 빠른 선택 · 연봉이면 "= 월 ○○만 원"(÷ 12 반올림) · 월 `MED1 × 1.5`(385만 원) 이하/초과 안내 | `income`(세전 월), `incomeInput {mode, amount}` |
| 6 | 출퇴근 시간 (편도) | 버튼 30분·45분·1시간·1시간 30분·상관없어요 | `time` 30·45·60·90·999 |
| 7 | 입주 시기 | 버튼 이번 달·다음 달·3개월 안·아직 몰라요 | `when` |
| 8 | 본인 명의 집 | 버튼 없어요·있어요 | `S.own` |
| 9 | 부모님과 같은 주소 | 버튼 네, 같아요·아니요·잘 모르겠어요 | `S.sep` '네'·'아니요'·'모름' |

- 화면: 위에 "1단계 · 내 상황" · "내 상황을 알려 주세요" · [예시로 채우기], "한 번에 말하기" 상자(A에서는 [AI로 채우기] 비활성), 9개 항목 카드(왼쪽 이름 + 짧은 보조 문구, 오른쪽 입력 도구).
- 오른쪽: "내 조건" 패널(채운 개수 · 진행 막대 · 항목별 값, 안 채운 항목은 "—", 누르면 왼쪽 그 항목으로 스크롤), 주소가 같으면('네') "세대 분리 후 전입신고가 필요할 수 있어요" 한 줄, [받을 수 있는 지원 보기].
- [받을 수 있는 지원 보기]는 9개가 다 채워져야 눌려요. 덜 채우고 누르면 첫 빈 항목으로 스크롤하고 강조해요.
- 숫자칸은 값이 맞으면 바로 저장하고, 비우거나 범위를 넘으면 그 항목을 빈 항목으로 봐요.
- **출생연도 → 만 나이** (기준일 2026-11-21): 생일 전후로 지원 결과가 갈리는 연도만 "올해 생일 지났어요?"를 묻고, 고르기 전에는 빈 항목으로 봐요. 경계는 하드코딩하지 않고 `judge()`·`moreJ()`를 두 나이(만 N세, N−1세)로 돌려 결과가 다른지로 정해요(`ageSplit`) → 지금은 **2007·1991·1986년생**(만 18/19, 34/35, 39/40). 그 밖의 연도는 생일이 지났다고 봐요(2026 − 출생연도).
- [예시로 채우기]: 시연 값(1999년생 · 직장인 · 멀티캠퍼스 역삼 · 2,000만 원 · 월 230만 원 · 45분 · 다음 달 · 없어요 · 네)으로 9개를 채워요. 결과는 2단계 520만 원, 3단계 신림 86.4점.
- AI 표시(배지·다른 색)는 넣지 않아요. "한 번에 말하기"는 다음 작업 `feat/step1-fill`에서 연결해요.
- 접근성: 버튼 그룹은 `role="radiogroup"`(Tab 한 번에 한 그룹, 그룹 안은 화살표), 입력칸·선택 상자마다 label. 키보드만으로 9개를 끝까지 입력할 수 있어요.
- 쉬운 화면(`S.easy`)은 예전 그대로예요(집 유무·세대 분리 2개만 큰 버튼).
- 예전 글자 입력 함수(`typed1`·`alertSoft1`·`extra1`·`parseMsg` 등)와 채팅 화면(`step1Chat`)은 "선택형으로 대체(2026-11-17)" 주석을 달고 남겨 뒀어요. 1단계에서 공고문 질문을 받던 기능은 2단계 [공고문에 물어보기]에 있어서 뺐어요.

**화면 확인** (`python scripts/step1_ui_check.py`, 서버를 켜 둔 채로 · `--shots 폴더`면 빈 상태·다 채운 상태·생일 질문 상태 저장) — **18/18 통과 · 페이지 오류 0개**

| 시나리오 | 결과 |
|---|---|
| [예시로 채우기] · 9개를 직접 고르기 | 9/9 · 2단계 520만 원 · 3단계 신림 86.4점 |
| 출생연도 1991 | 생일 질문 뜸 · 지났어요 → 만 35세 280만 원 · 아직이에요 → 만 34세 520만 원 |
| 출생연도 1990 | 생일 질문 없음 · 만 36세 · 280만 원 |
| 수입 [연봉] 3,600 | "= 월 300만 원" · 저장 300 · 520만 원 |
| 수입 [월급] 400 | 기준 넘음 안내 · 서울시 청년월세·이사비 소득 기준 넘음 |
| 보증금 500 | 3단계 성수·역삼 "500만 원 부족" |
| 출퇴근 30분 | 3단계 성수·신림(30분) "넘음" 표시 없음 (경계값) |
| 본인 명의 집 '있어요' | 0원 · "무주택이어야 해요" |
| 세대 '잘 모르겠어요' | '모름' · 국토부 독립거주 '확인 필요' |
| 5개만 채우고 [받을 수 있는 지원 보기] | 비활성 · 누르면 첫 빈 항목으로 스크롤·강조 |
| 5개만 채우고 위쪽 2단계 버튼 | 예시 값 배너 |
| 패널 항목 누르기 | 그 항목으로 스크롤 |
| 키보드만으로 9개 | 가능 |
| 카카오 JS 키 없이 자주 가는 곳 | "판교" → 판교역·판교테크노밸리가 앞에, 카카오 결과가 뒤에 |
| 실제 장소 검색 (서버 `/api/place`) | "을지로입구역" → 을지로입구역 2호선 · 서울 중구 을지로 지하 42 |
| 장소 검색을 못 쓸 때 | "신촌" → 신촌역·연세대학교 후보 목록 |

### STEP 1 · 예전 글자 입력 규칙 (web/step1_rules.js, 참고)
선택형 입력으로 바꾸면서 **화면은 이 규칙을 쓰지 않아요.** 항목 정의 `FIELDS`·`KNOWN_PLACES`·`won`만 화면이 써요. 문장 해석 함수는 "한 번에 말하기"(LLM) 결과 검사나 React 이전 때 참고용으로 남겨 뒀어요.
- DOM·화면 상태(`S`) 없는 순수 함수라 브라우저(`<script src="step1_rules.js">` → `window.Step1Rules`)와 Node·React(`require`/`import`)에서 같이 써요.

```js
Step1Rules.interpretAnswer('income', '연봉 3600', {today: '2026-11-21'})
// → {field:'income', status:'confirm', value:300, display:'월 300만 원', explain:'연봉 3,600만 원 ÷ 12',
//    ask:'연봉 3,600만 원을 월 300만 원으로 이해했어요. 맞아요?', options:[['맞아요',300],['다시 입력',null]], evidence:'연봉 3600'}
Step1Rules.interpretUpdate('집을 샀어요', profile, {today: '2026-11-21'})   // 9개 질문이 끝난 뒤
// → {kind:'change'|'question'|'none', changes:[...interpretAnswer 형식...], message:'내 집을 있어요로 바꿨어요'}
Step1Rules.FIELDS · money(text) · KNOWN_PLACES · placeOpts(name)
```
- `status`: **ok** 바로 저장 · **confirm** `ask`와 `options` 버튼을 보여주고 고른 값 저장([다시 입력]이면 같은 질문) · **ask_back** 저장하지 않고 `ask`로 다시 묻거나 `options` 후보 제시("강남" → 강남역·역삼역·선릉역·멀티캠퍼스 역삼)
- `kind`(끝난 뒤): **question**은 조건을 안 바꾸고 `/api/ask`로 보내요("35살인데 받을 수 있어요?", "월급이 250이면 달라져요?" 같은 가정 포함) · **change**는 바뀐 항목만 · **none**은 "그 내용은 3단계에서 집별로 볼게요"
- 값 형식: 나이 만 나이 · 상황 '직장인'·'대학생'·'취업 준비'·'기타' · 장소 `{name, query}`(query = 카카오 검색어) · 보증금·소득 만 원(소득은 세전 월) · 출퇴근 분(상관없음 999) · 입주 '이번 달'·'다음 달'·'N월'·'3개월 안'·'아직 몰라요' · 집 '없어요'·'있어요'(본인 명의만) · 세대 '네'·'아니요'·**'모름'(새 값)**
- 단위 변환과 계산은 규칙이 해요: 출생연도 → 생일 전후 두 값 confirm, 연봉 ÷ 12 confirm, 원 단위(단위 없이 범위를 넘는 큰 숫자) ÷ 10,000 confirm, "1억 5천"·"3천5백"·"오백만원"·"스물일곱"·"이백삼십" 같은 한글 수사, "1시간 30분"·"1.5시간", "2주 뒤"·"6개월 뒤"(기준일 2026-11-21)
- 범위: 나이 14~99 · 보증금 0~10억(5억 넘으면 confirm) · 월소득 0~2,000만(1,000만 넘으면 confirm) · 출퇴근 5~180분 · 밖이면 ask_back
- 예전 화면 연결(지금은 안 씀): `QS1`·`typed1`·`extra1`·`parseMsg`가 `Step1Rules`를 썼어요.
- 2·3단계 연결: 1단계를 다 안 끝내고 넘어가면 "아직 답하지 않은 항목은 예시 값(27세·월 230만 원·2,000만 원)으로 보고 있어요" 배너가 떠요. 세대 분리 '모름'은 `me()`에서 '네'처럼 다뤄 국토부 독립거주가 '확인 필요'가 돼요. 2단계 근거의 "12월 서울 입주"는 1단계 입주 시기로 바뀌어요(다음 달 → 12월, 판정은 그대로).

**평가** (`node scripts/step1_rules_eval.mjs`, 평가셋 `processed/step1/eval_cases.csv` 119개 = 9개 질문 답 105 + 끝난 뒤 대화 14)

| | 정답 | 조용한 오답 (ok로 저장했는데 틀림) | value | confirm | ask_back | question·none |
|---|---|---|---|---|---|---|
| 지금 규칙 (main의 index.html) | 75/119 (63.0%) | 30개 | 65/95 | 0/9 | 7/11 | 3/4 |
| **보강 규칙 (`step1_rules.js`)** | **119/119 (100%)** | **0개** | 95/95 | 9/9 | 11/11 | 4/4 |

- 평가셋을 보면서 규칙을 짰기 때문에 100%는 실제보다 높게 나온 값이에요. 평가셋 밖 입력으로 따로 점검해서 "4천이에요"·"250이면"의 조사 '이'를 숫자로 읽는 버그를 고쳤어요. 새 표현을 찾으면 평가셋에 한 줄 넣고 다시 돌려요.
- 예전 채팅 화면의 연결 시나리오 13개는 한 화면 선택형 확인(위 표, 1991 두 갈래 포함 16개)으로 바꿨어요.

### STEP 2 · policy_match.py (코드 판정)
- 대상: 사람이 정리한 현금 지원 4개 (`demo_policies.json`) — 금액이 정해져 있어 합계·달력·중복 계산에 들어가요
- `check: code` 조건은 ✓/✗, `check: llm` 조건은 "확인 필요"
- 기준일 `DEMO_DATE = 2026-11-21` → 올해 접수 끝난 건 "올해 접수 끝 (내년 공고 확인)"
- 결과: 중개보수·이사비 40 + 국토부 청년월세 480 = **최대 520만 원** (서울시 청년월세 240은 중복이라 제외)
- 조건이 바뀌면?: 35살 → 280 / 국토부 소득 안 맞으면 → 280 / 전세로 계약하면 → 40 + 임차보증금 이자지원(대안)
- 더 찾아본 지원 32개(`more_policies`): 온통청년·정부24에서 서울·나이·1인 무주택으로 거른 목록 → 조건 판정은 RAG

### STEP 2 · RAG (rag_build.py → rag.py)
| 단계 | 하는 일 |
|---|---|
| 색인 | 온통청년(서울·전국, **다른 지자체가 올린 정책 제외**) 110 · 정부24(주거·자립 분야 또는 이름에 주거 단어) 168 · 대출 4 · SH 1 · 현금 지원 4 → 공고문을 항목별 조각 **1,233개**로 (`chunks.jsonl` 기준: 정부24 732 · 온통청년 447 · SH 22 · 시연 정책 18 · 주택도시기금 14) |
| 코드 필터 | 나이(질문 속 "35살"도 읽음) · 서울/내 구 · 지난 공고 제외. **정책 이름을 콕 집어 물으면** 나이가 안 맞아도 남기고 "나이 확인(코드 판정)" 문장을 근거로 붙임 |
| 검색 | TF-IDF(글자 2~3) + 동의어 확장(전세대출→버팀목, 1년→재직 1년 미만…) · 검증 문서 가산점 |
| 답변 | LLM이 찾은 원문만 보고 [번호] 출처와 함께 JSON 답 → 숫자 검사 통과 못 하면 원문 문장 그대로 |
- 화면 연결: `POST /api/ask` (공고문에 물어보기), `GET /api/place?q=` (1단계 자주 가는 곳 검색 → `{places:[{name, address, query}]}`, 키가 없으면 503), `GET /api/health` (서버 확인, `place` = 장소 검색 가능 여부) — `python scripts/server.py`로 화면과 API를 같이 띄워요 (`http://127.0.0.1:5500`). 더 찾아본 지원의 조건 판정(`/api/policies/judge`)은 아직 서버에 없어요.
- 범위 밖: 만 19~39세 밖 질문은 AI 없이 복지로(129)·120으로 안내하고, 근거가 없으면 "찾지 못했어요" + 상담기관 안내
- 서버가 꺼져 있으면 화면은 미리 넣어 둔 답으로 바꿔서 깨지지 않아요

### STEP 2 · RAG 평가 (rag_eval.py)
- 질문 22개(`processed/rag/eval_questions.csv`)를 공고문 원문과 대조해 만들었어요. Q21·Q22는 범위 밖 질문이라 "찾지 못했어요"로 답해야 맞아요.
- 최근 결과(`eval_result.csv`): **검색 22/22 · 근거 20/20(범위 밖 2개 제외) · 답 22/22** (AI 답 20 · 원문 답 2). LLM 연결 전에는 답 14/22였어요.
- LLM이나 검색 설정을 바꾸면 `python scripts/rag_eval.py`로 다시 돌려요.

### explain.py 환각 방지
1. 프롬프트 규칙 (주어진 숫자만, 추천 바꾸지 않기, 계산하지 않기, 아쉬운 점 꼭 말하기)
2. 숫자 검사: "숫자+단위"(만·%·분·개월…)가 입력에 없으면 답을 버림
3. 추천 검사: 한 줄에 코드가 고른 추천이 없으면 버림
4. 키가 없거나 오류면 템플릿 설명 → 시연이 멈추지 않음

### STEP 3 · 한 달 실부담과 종합 점수 (PRD v1.2 4절)
- **한 달 실부담 = 월세 + 관리비.** 관리비를 모르면 화면에 "–"로 두고 더하지 않아요. 보증금은 따로 보여주고, 1단계에서 말한 모아둔 돈보다 크면 "○○만 원 부족"을 붙여요.
- 교통비(ODsay 편도 요금 × 2 × 20일)는 출퇴근 칸에 **참고로만** 보여주고 실부담·비용 점수에는 넣지 않아요. 먼 집은 시간 점수에서 이미 깎이니까 비용에서 또 깎이지 않게 하려는 거예요. (`homes_summary.csv`의 `월교통비(원)` 열에는 그대로 남아 있어요.)
- 점수: 비용(가장 싼 집 100점, 1만 원 비쌀 때마다 −1.5점) · 시간(15분까지 100점, 그 뒤 1분마다 −2점) · 생활(시설 8종 도보 5분 100점 ~ 20분 0점의 평균)
- 프리셋 4개 (`recommend.py`, `web/index.html` 같은 값)

| 프리셋 | 비용 | 시간 | 생활 |
|---|---:|---:|---:|
| 균형 | 40 | 35 | 25 |
| 돈이 먼저 | 60 | 25 | 15 |
| 시간이 먼저 | 20 | 60 | 20 |
| 동네 생활 | 30 | 20 | 50 |

- 시연 결과 (균형): 신림 86.4 · 성수 76.2 · 역삼 68.1 → **신림 추천**. 실부담 42 / 60 / 90만 원. PRD 3.2절 표와 같아요.
- 종합 점수는 **지원 전 금액**으로 계산하고, "지원 받으면 한 달 실부담"(예: 신림 42만 → 22만)은 집별 지원 표에만 보여줘요.

### STEP 3 주의
- 카카오 로컬 응답 원본(`processed/step3_homes/cache.json`)은 시연용 로컬 캐시라 `.gitignore`에 넣었어요.
- ODsay는 호출하는 PC·서버 IP를 lab.odsay.com에 등록해야 해요 (본선장·배포 서버 IP 추가).
- 카카오 지도 JavaScript 키는 사이트 도메인 등록이 필요해요 (로컬 `http://127.0.0.1:5500`, 배포 도메인 추가).

---

## 7. 폴더 안내
```
firsthome_data/
├── processed/        데이터 + 단계별 결과 (step1 평가셋 · step2_support · step3_homes · rag)
├── scripts/          수집·가공·계산·AI 코드
├── web/              index.html (최종 화면) · step1_rules.js (1단계 항목 정의 + 예전 글자 입력 규칙) · kakaomap_test.html (카카오 지도 테스트)
├── docs/             PRD v1.2 · 서비스 소개 v4 변경사항 정리 · 기능 CRUD 명세(엑셀, 3단계 번호) · 서비스 소개(PDF) · step1_page/ 1단계 화면 스크린샷 · archive/ 예전 작업 정리
├── archive/          안 쓰는 것 보관: 주거 전략 단계 (strategy.py, 결과, 전환율) · 전월세 시세 · 예전 4단계 프로토타입
└── raw/              원본 (용량이 커서 압축본에는 빠져 있음 → 기존 raw 폴더를 그대로 옮겨 넣기)
```
- 이 정리본에는 **키가 하나도 들어 있지 않아요.** 키는 `.env`(REST·ODsay·AI)와 `web/index.html`의 `JS_KEY` 자리(카카오 JavaScript 키)에만 넣어요.
- 지금 `.env`의 `KAKAO_REST_API_KEY`에 든 키는 카카오가 등록된 웹 주소(origin)를 요구해요(JavaScript 키처럼 동작). 그래서 `server.py`의 장소 검색은 `KA: os/javascript origin/http://127.0.0.1:5500` 헤더를 붙여요(`KAKAO_ORIGIN`으로 바꿀 수 있어요). `collect_homes.py`는 이 헤더가 없어서 같은 키로는 401이 날 수 있어요.
- 카카오 지도는 VS Code에서 `web` 폴더를 열고 Live Server(`http://127.0.0.1:5500`)로 열어야 떠요. 키가 없으면 그림 지도로 보여요.

---

## 8. PRD v1.2와 이 레포

PRD v1.2(2026-11-16)의 요구사항이 이 레포 어디에 있는지 정리했어요. 상태는 PRD 표기를 따르고, "레포"는 2026-11-17 기준으로 이 레포에 실제로 들어 있는지예요.

| ID | 요구사항 | PRD 상태 | 레포 |
|---|---|---|---|
| R1 | 1단계 9개 질문 대화 · 정리 카드 | 구현 | **한 화면 선택형 입력**으로 바꿈(9개 항목 + 항목별 입력 도구, 글자 해석 없음) — `web/index.html`, 항목 정의 `web/step1_rules.js` `FIELDS`, 확인 `scripts/step1_ui_check.py`, 스크린샷 `docs/step1_page/`. PRD 3.4 #2(AI 대화 이해)는 "한 번에 말하기"(LLM, `feat/step1-fill`)로 옮겨 가요 |
| R2 | 지원 판정 · 총액(최대 520만 원) · 중복 시 큰 쪽 자동 선택 | 구현 | `scripts/policy_match.py`, `web/index.html`, `processed/demo_policies.json` |
| R3 | 조건 변경 재계산 (27세 520만 → 35세 280만) | 구현 | `policy_match.py`(`what_if`), `web/index.html` |
| R4 | 공고문에 물어보기 (RAG) · 22문항 평가 | 구현 | `rag_build.py` → `rag.py` → `server.py`, `rag_eval.py`, `processed/rag/` |
| R5 | 후보 집 넣기 (카카오 주소·장소 검색) | 구현 | `web/index.html`, `collect_homes.py` |
| R5-a | 매물 정보 자동 입력 (OCR + LLM) | 시간 남으면 | 없음 |
| R6 | 집 비교 (ODsay 출퇴근, 실부담 = 월세 + 관리비, 보증금 부족, 집별 지원) | 구현 | `web/index.html`, `collect_homes.py`, `recommend.py` |
| R7 | 종합 추천 (프리셋 4개 · 말한 우선순위 → 가중치) | 프리셋 구현 · AI 가중치 구현 예정 | 프리셋만 (`recommend.py`, `web/index.html`) |
| R8 | AI 추천 보조 (시설 고르기 · 추천 이유 · "왜 신림이야?") | 구현 예정 | 추천 이유는 `explain.py`(LLM + 숫자·추천 검사, 키 없으면 템플릿)만 있고 화면 연결 전. 시설 고르기·후속 질문은 없음 |
| R9 | 디지털 포용 (듣기, 큰 글씨·고대비, 말로 답하기, 음성 모드) | 시간 남으면 | "쉬운 화면"만 있음 |
| R10 | 자체 사이트 로그인 | 시간 남으면 | 없음 (시연은 이름 입력) |
| R11 | 다음 단계 (axe-core, "예산에 맞는 동네" 등) | 미구현 | 실거래 데이터는 `archive/`에 보관 |

**이번에 PRD에 맞춰 고친 것 (2026-11-17)**
- 한 달 실부담에서 교통비를 뺐어요 (`web/index.html`, `collect_homes.py`, `homes_summary.csv` 재계산 → `recommend_result.json`·`explain_result.json` 다시 생성). 균형 기준 결과가 PRD 3.2절(86.4 / 76.2 / 68.1)과 같아졌어요. 교통비는 참고 표시로 남겼어요.
- README를 PRD v1.2 기준으로 맞췄어요 (RAG 조각 수 1,233개, 평가 결과, LLM 교체 방법, 서버 API, 프리셋 값).
- `docs/`에 PRD v1.2와 서비스 소개 v4 변경사항 정리를 넣었어요.

**1단계 규칙 보강 (2026-11-17, `feat/step1-rules`)**
- 1단계 규칙을 `web/index.html`에서 `web/step1_rules.js`로 떼어내고 보강했어요. 평가 119개에서 지금 규칙 75 → 119, 조용한 오답 30 → 0개.
- 팀 결정으로 PRD 3.4 #2(1단계 대화 이해)는 LLM 없이 규칙으로 해요.
- 세대 분리 '잘 모르겠어요'는 이제 '모름'으로 저장하고 국토부 독립거주를 '확인 필요'로 봐요(예전엔 '네'로 저장).

**1단계 한 화면 선택형 입력 (2026-11-17, `feat/step1-page`)**
- 1단계를 채팅 + 글자 입력에서 **한 화면 9개 항목 + 항목별 입력 도구**로 바꿨어요. 출생연도 선택 상자, 장소 검색, 금액(월급/연봉) 입력, 버튼, 오른쪽 패널(누르면 그 항목으로).
- 출생연도를 받아서 만 나이를 계산하고, 판정이 갈리는 연도(2007·1991·1986)만 생일을 물어요.
- 저장 형식은 그대로라 2·3단계 판정·점수 코드는 안 바꿨어요. 새 값: `S.prof.birthYear`, `bday`, `incomeInput`.

**팀에서 정할 것 (PRD 7절)과 이 레포에 걸리는 부분**
- 서버 구조: 지금 시연본은 Python(`server.py`, `rag.py`). Spring Boot와 합치는 방법을 정하면 여기 `scripts/`의 역할이 바뀌어요.
- 지원 반영 실부담: 지금은 월 지원액(월세 지원 20만 원)만 빼요. 1회성 지원(이사비) 처리는 정하면 `web/index.html`의 `after()`를 고쳐요.
- 교통비 참고 표시: 지금은 편도 요금 × 2 × 20일 고정(`DAYS`, `COMMUTE_DAYS`).
- 서비스 LLM: 정하면 `.env`만 바꾸고 `rag_eval.py`를 다시 돌려요.
