# LLM 통합 설계 (M2 — v0.2)

> 작성: 2026-05-16, 세션 9 초안 → 세션 10 결정 반영
> 단계: 세션 9의 *옵션 비교*에서 *팀 결정 반영 + 첫 API Route 구현*으로 진행.

---

## 0. 이 문서의 범위

본 문서는 *M2 LLM 통합 구현 단계*의 설계 문서다. 세션 9 초안에서 *미결정 자리 4개를 모두 확정*했다.

- **세션 9 합의**: 모델 Claude API(Anthropic SDK), 초기 *Haiku 4.5*, 키 `.env.local`만, 백엔드 경유 호출.
- **세션 10 신규 확정 (팀 결정)**:
  1. **백엔드 호스팅**: 옵션 A (Vercel Edge Functions) ✅
  2. **Rate limit**: 분당 5회 / 시간당 30회 ✅
  3. **응답 스키마**: `matched_case_ids`, `friendly_response`, `safety_signals`, `confidence` (4-필드 정형) — §3-3 갱신 ✅
  4. **사례 컨텍스트 주입**: 방식 A (사례 71건 전체 시스템 프롬프트에 주입) + **prompt caching ephemeral 활성화** ✅

남은 미결정 자리: ① 시스템 프롬프트의 사례 컨텍스트 *어휘 압축 정도* (현재 friendly_summary + 분류 + key_factors만 주입, 원문 D그룹 제외) ② Vercel Edge KV 도입 시점 (세션 11/12에서 메모리 → KV 마이그레이션) ③ 응답 검증 실패 시 폴백 동작.

---

## 1. 통합 목표

학생 입력(자유 텍스트 + 메타) → *적절한 사례 매칭 + 안전 분기 감지 + 친화 변환 보강*.

현재 시스템은 *규칙 기반 키워드 매칭 + 키워드 유사도*로 동작한다 (`src/lib/classify.js`, `textSimilarity.js`). 이 두 함수는 *세션 1~2에서 외부화한 인터페이스*를 유지하면서 *내부 구현만 Claude API 호출로 교체*하는 방식으로 통합한다.

```
[현재]
  사용자 입력 → classify(text) → 키워드 매칭 → {type, role, stage, school}
                              → matchCases() → 사례 후보 → UI

[M2 후]
  사용자 입력 → classify(text) → Claude API → {type, role, stage, school, safety_flag, reasoning}
                              → matchCases() → 사례 후보 → UI
                              ↓
                       safety_flag=true 분기 → SafetyBranchScreen
```

핵심 원칙: *기존 인터페이스 유지*. App.jsx·matchCases·UI 코드는 무변경. 데이터 흐름만 외부 API 경유.

---

## 2. 아키텍처 — 옵션 A (Vercel Edge Functions) 확정

LLM 키는 *브라우저에 절대 노출 금지* (CLAUDE.md §1 금지사항). 따라서 *백엔드 경유 호출*이 필수.

### 확정 — 옵션 A (Vercel Edge Functions) ✅

**결정 근거**:
- Vite/React 정적 호스팅과 동일 플랫폼 → 프런트·백엔드 한 대시보드에서 통합 관리
- 콜드 스타트 거의 없음 (Edge runtime), 한국 사용자에게 빠른 응답
- 학생 자원봉사 팀의 *학습 부담·운영 부담 최저*
- Hobby 무료 티어 호출 100K/월 → M2 단계 트래픽 충분 커버

**확정에 따른 구조**:
```
naranhi/
├── api/                          ← Vercel Edge Functions (신규)
│   └── classify.js               ← /api/classify  (POST)
├── src/
│   ├── lib/
│   │   └── llm/                  ← 백엔드 라이브러리 (Edge runtime 호환)
│   │       ├── systemPrompt.js   ← 사례 71건 + caching 시스템 프롬프트
│   │       ├── safetyKeywords.js ← 1단계 키워드 안전 분기
│   │       ├── rateLimit.js      ← 분당 5 / 시간당 30 카운터 (메모리)
│   │       └── helloClaudeCheck.js (세션 9)
│   └── App.jsx                   ← 다음 세션에서 /api/classify 호출로 교체
└── vercel.json                   ← Edge runtime + 라우팅 (신규)
```

### 검토 결과 미선택 — 옵션 B/C

- **옵션 B (Cloudflare Workers)**: 가장 저렴·빠르지만 *프런트·백엔드 콘솔 분리*가 학생 팀 학습 부담. 트래픽 폭증 시점에 재검토.
- **옵션 C (Express + Vercel/Render)**: pgvector·세션 관리 필요해지는 M3 단계에 재검토. M2에선 과한 인프라.

> *M3 진입 시 재검토 트리거*: ① 사례 데이터 컨텍스트 *전체 주입*이 비용 압박이 될 때 ② 사용자별 대화 세션 필요할 때 ③ pgvector 검색 도입할 때.

---

## 3. API 호출 패턴 설계

### 3-1. 시스템 프롬프트 (개요)

```
당신은 한국 학교폭력 안내 플랫폼 「나란히」의 분류·매칭 엔진입니다.
학생(또는 보호자)이 자기 상황을 자유 텍스트로 입력하면, 다음을 수행하세요.

1. 분류 코드 추론 — SV-[유형8]-[역할6]-[단계10]-[학교급4] 체계로 분류.
   - 유형: PH/VB/EX/CO/OS/SX/CY/MX  (온라인 채널이면 무조건 CY)
   - 역할: G/V/B/W/P/U
   - 단계: 0~9 (사전예방 → 형사·민사 후속)
   - 학교급: ES/MS/HS/OT
2. 안전 분기 감지 — 가정폭력·자해·자살 신호가 있으면 safety_flag=true.
3. 친화 변환 가이드 적용 — 학생의 실명·학교명은 *언급 금지*.
4. JSON 한 객체로만 응답 (자유 텍스트 일체 금지).
```

### 3-2. 사용자 메시지 구조

```jsonc
{
  "role": "user",
  "content": "[메타]\n역할: 가해\n나이: 15\n학교급: MS\n\n[상황]\n단톡방에서 친구 별명을 부르면서 놀렸어요..."
}
```

메타는 *Step 1~Step 2 UI에서 이미 수집한 정보*를 *서버에서 안전하게 prepend*. 학생이 *상황 본문에 자기 이름·실명을 적어도* LLM에 노출되기 전에 *백엔드에서 1차 sanitize* (PII 패턴 마스킹).

### 3-3. 응답 스키마 (확정 — 4-필드 정형)

방식 A(사례 71건 전체 주입)이라 LLM이 *사례 데이터를 모두 본 상태*에서 직접 매칭·응답을 생성한다. 따라서 분류 코드 추론 결과를 별도로 받지 않고 *최종 응답* 4-필드로 정형화한다.

```jsonc
{
  "matched_case_ids": ["DR-CASE-019", "SAMPLE-002"],
  "friendly_response": "친구분, 그 상황은 학교폭력의 *언어폭력 + 사이버폭력* 양면이 있어 보여요. 비슷한 사례 2건을 함께 보여드릴게요. ...",
  "safety_signals": {
    "has_safety_flag": false,
    "reason": null
  },
  "confidence": 0.82
}
```

**필드 명세**:
- `matched_case_ids` (string[]) — `case_id` 값 1~3개. 우선순위 순 (가장 유사한 사례 먼저). 사례 데이터에 없는 ID 반환 시 *검증 실패 → 폴백*.
- `friendly_response` (string) — 친화 변환 5원칙 적용 학생 눈높이 응답. 150~400자 권장. 실명·학교명 *언급 금지*.
- `safety_signals.has_safety_flag` (boolean) — 위기 신호 감지 여부. true 시 프런트엔드는 `SafetyBranchScreen` 또는 `SafetyBanner` 노출.
- `safety_signals.reason` (string|null) — true일 때 *왜 트리거됐는지* (예: "가정폭력 신호", "자해 언급"). false일 때 null.
- `confidence` (number) — 0~1. matched_case_ids·classification 자체 신뢰도. 0.5 미만이면 UI에서 "비슷한 사례를 찾기 어려워요. 직접 도움 요청해 보세요" 노출 등.

### 3-4. 호출 인터페이스 (백엔드 → SDK, prompt caching 활성)

```js
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 600,
  system: [
    {
      type: 'text',
      text: SYSTEM_PROMPT_TEXT,  // 사례 71건 포함, ~35K tok
      cache_control: { type: 'ephemeral' },  // 5분 캐시
    },
  ],
  messages: [{ role: 'user', content: userContent }],
});
```

응답 파싱은 *try/catch + JSON.parse + 4-필드 스키마 검증*. 검증 실패 시 *규칙 기반 fallback*으로 폴백 (현재 `classify.js`의 로직 유지).

> *prompt caching*: 첫 호출 캐시 쓰기(1.25× input), 후속 호출 캐시 읽기(0.1× input). 5분 동안 활성. §5 비용 추산 갱신 참고.

---

## 4. 안전 분기 통합

위기 신호는 *2단계 방어*로 처리한다.

### 4-1. 1단계 — 백엔드 키워드 사전 감지 (LLM 호출 전)

`keyword_rules.json`에 이미 정의된 가정폭력·자해·자살 키워드를 *백엔드에서 LLM 호출 전*에 1차 스캔. 매치 시 *LLM 호출 생략하고 SafetyBranchScreen 우회 응답* 즉시 반환.

이유: ① 비용 절감 ② 위기 사용자에게 *추가 지연 없이* 안전 자원 노출 ③ LLM 오판(safety_flag=false 잘못 반환) 위험 차단

### 4-2. 2단계 — LLM 응답의 safety_flag 검사

키워드 1단계를 통과해도 LLM이 *맥락상 위기 신호*를 감지하면 `safety_flag=true` + `safety_reason` 반환. 프런트엔드는 *결과 화면 대신* SafetyBanner를 *결과 화면 위*에 동반 노출 (이미 OM2-IV-002 등에서 동일 패턴 적용 중).

### 4-3. CLAUDE.md §2-3 금지 행위는 시스템 프롬프트에 명시

- 위기 상태인지 *직접 묻지 않음*
- 자해 방법·정도 디테일 일체 노출 금지
- "곧 지나갈 거예요" 같은 진정시키기 금지
- 감정 증폭형 반사적 듣기 자제

→ 시스템 프롬프트에 *금지 행위 4종을 명시*. 향후 응답 톤 검수 시 *위반 사례를 SESSION_LOG에 기록*하고 *프롬프트 갱신*.

---

## 5. 비용 추산 — 방식 A (전체 주입) + prompt caching

### 5-1. 모델별 단가 (2026 기준)

| 모델 | Input ($/MTok) | Output ($/MTok) | 캐시 쓰기 (5분) | 캐시 읽기 |
|---|---|---|---|---|
| Haiku 4.5 | 1.0 | 5.0 | 1.25 (1.25×) | 0.10 (0.1×) |
| Sonnet 4.6 | 3.0 | 15.0 | 3.75 | 0.30 |

> 캐시 쓰기는 *첫 호출에서만* 발생. 그 후 5분간 동일 prefix 호출은 캐시 읽기 단가 적용.

### 5-2. 호출당 추정 토큰 (방식 A — 사례 71건 주입)

- 시스템 프롬프트: ~35,000 tok
  - 친화 변환 5원칙 + 안전 분기 규칙 + JSON 스키마: ~1,500 tok
  - 사례 71건 (case_id + friendly_summary + 분류 + key_factors만, 원문 D그룹 제외): ~33,500 tok
- 사용자 메시지: ~300 tok (메타 + 상황 본문)
- 응답: ~400 tok (matched_case_ids + friendly_response + safety_signals + confidence)

### 5-3. 캐싱 효과 — Haiku 4.5 기준

**캐시 없음 (매 호출 전체 input)**:
- 호출당: 35,300 × $1.0/MTok + 400 × $5.0/MTok = $0.0373 (~52원)

**캐시 적중 (첫 호출 이후, 5분 내)**:
- 호출당: 300 × $1.0/MTok + 35,000 × $0.1/MTok + 400 × $5.0/MTok = $0.0058 (~8원)
- **6.4배 절감**

**첫 호출 (캐시 쓰기)**:
- 35,000 × $1.25/MTok + 300 × $1.0/MTok + 400 × $5.0/MTok = $0.0463 (~64원)
- 캐시 쓰기는 *일반 input의 1.25배* — 첫 호출만 약간 비쌈

### 5-4. 시나리오별 월 비용 (방식 A + caching)

**시나리오 A — 학생 100명 × 평균 5회 호출/월 = 500 호출/월**

- 캐시 적중률 가정: *60%* (5분 TTL이라 자주 끊김. 동시 트래픽 적은 학생용 도구라 보수적 추정)
- 캐시 적중 300회 + 캐시 미스 200회 = 300 × $0.0058 + 200 × $0.0373 = $1.74 + $7.46 = **~$9.2 (~12,700원)**

**시나리오 B — 학생 500명 × 평균 5회 호출/월 = 2,500 호출/월**

- 캐시 적중률 가정: *80%* (트래픽 늘면 캐시 활용률 상승)
- 2,000 × $0.0058 + 500 × $0.0373 = $11.6 + $18.65 = **~$30.3 (~41,800원)**

### 5-5. 캐싱 미적용 vs 적용 비교

| 시나리오 | 캐싱 없음 | 캐싱 적용 | 절감률 |
|---|---|---|---|
| A (500/월) | $18.7 | $9.2 | 51% |
| B (2,500/월) | $93.3 | $30.3 | 67% |

캐싱은 *트래픽이 늘수록 효과 큼*. 학생 500명 규모에서 월 \$50 예산 한도 안에 충분히 들어옴.

### 5-6. 안전장치

- 모델: **Haiku 4.5** 고정 (M2 전체)
- 월 예산 한도: **\$50 (Usage Limit)** — Anthropic 콘솔에 이미 설정
- Rate limit (§6) + 키워드 1단계 안전 분기로 *불필요한 호출 차단*
- 호출 로그(토큰·캐시 적중·비용)를 *익명화하여 누적* (세션 12 작업)

---

## 6. 보안

### 6-1. API 키 노출 방지

- `.env.local`에만 저장 (커밋 금지, 이미 `.gitignore` 등록)
- `.env.example`로 *키 없는 템플릿*만 저장소에 포함
- 프런트엔드 빌드에 *키가 포함되지 않도록* — Vite 환경변수는 `VITE_` prefix만 번들 노출. ANTHROPIC_API_KEY는 *prefix 없음 → 번들 안 됨* (이미 안전)
- *백엔드에서만* `process.env.ANTHROPIC_API_KEY` 참조

### 6-2. Rate Limiting (확정 임계값)

| 단위 | 분당 | 시간당 | 일일 한도 |
|---|---|---|---|
| **IP/세션** | 5회 | 30회 | — |
| 전역 | — | — | 1,000회 (예산 폭주 차단) |

- 한도 초과 시: *친화 메시지로 "잠시 후 다시 시도해 주세요"* (HTTP 429) + *내부 알림 (세션 12)*
- 키워드 1단계 안전 분기에 걸린 호출은 *LLM 호출 자체를 안 함*이라 카운터 미증가 (안전 우선)

**구현 단계**:
- *세션 10 (지금)*: 메모리 기반 Map 카운터 — Vercel Edge Function 인스턴스 단위 (인스턴스 사이엔 공유 안 됨). 개발·소규모 운영용.
- *세션 12*: Upstash Redis 또는 Vercel KV로 마이그레이션 — 인스턴스 분산 환경 OK.

### 6-3. 입력 sanitization

- 학생 실명·학교명·전화번호 *백엔드 1차 마스킹* (정규식 패턴 + 한국어 이름 가능성 단어 휴리스틱)
- 프롬프트 인젝션 패턴 ("ignore previous instructions" 등) *차단 또는 무력화 토큰*으로 감쌈
- 응답 출력 *프런트엔드 렌더링 시 HTML 이스케이프* (현재 React 기본)

---

## 7. 세션 일정

### 세션 10 (진행 중) — 첫 API Route + 키워드 안전 + 메모리 rate limit

- ✅ 팀 결정 4가지 반영 (옵션 A / 응답 스키마 / caching / rate limit)
- ✅ `api/classify.js` Vercel Edge Function 작성
- ✅ `src/lib/llm/systemPrompt.js` — 사례 71건 + caching
- ✅ `src/lib/llm/safetyKeywords.js` — 키워드 1단계 안전 분기
- ✅ `src/lib/llm/rateLimit.js` — 메모리 기반
- ✅ `vercel.json` Edge runtime 설정
- ✅ `npm run llm:test` — 시나리오 5개 e2e 검증

### 세션 11 — 응답 파싱 강화 + 폴백 + UI 연동

- JSON 파싱 + 스키마 검증 강화 (matched_case_ids 실재 검증, friendly_response 빈 응답 차단)
- 검증 실패 시 *현재 규칙 기반 classify*로 폴백
- App.jsx에서 *비동기 호출 + 로딩 상태* UI
- 시나리오 A·B·C 동작 동일성 확인

### 세션 12 — KV rate limit + sanitization + 로깅

- Upstash Redis(또는 Vercel KV)로 카운터 마이그레이션 (인스턴스 분산 환경)
- 학생 실명·전화 마스킹 (입력 sanitization)
- 호출 로그(분류·safety_flag·토큰·비용·캐시 적중) *익명화하여 누적*
- 두루 변호사 검수 패키지에 *LLM 응답 샘플 100건* 동봉 준비

### 세션 13+ (M3 진입 후보)

- 벡터DB(pgvector) 임베딩 검색 — *방식 A 한계 시점에 검토*
- 사례 매칭 정확도 정량 평가 (현 규칙 기반 vs LLM)

---

## 8. 부록 — 환경 셋업 절차 (학생 팀용)

1. `.env.example`을 `.env.local`로 복사
2. https://console.anthropic.com/settings/keys 에서 키 발급
3. `.env.local`에 `ANTHROPIC_API_KEY=sk-ant-...` 붙여넣기
4. `npm install` (이미 `@anthropic-ai/sdk`, `dotenv` 의존성 추가됨)
5. `npm run llm:check` — Haiku 4.5 호출 + 토큰·비용 확인
6. 정상 응답 보이면 M2 진입 완료
