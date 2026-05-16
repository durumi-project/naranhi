# LLM 통합 설계 (M2 진입 — v0.1 초안)

> 작성: 2026-05-16, 세션 9 (M2 시작 단계)
> 단계: *옵션 비교 + 호출 패턴 + 안전 분기 통합 + 비용·보안 검토*
> 결정 자리는 *옵션 비교만 적고 결정은 미룸* — 두루미팀·두루 변호사·멘토 합의 후 확정.

---

## 0. 이 문서의 범위

본 문서는 *M2 LLM 통합 시작 단계*의 설계 초안이다. 다음 두 가지를 분리한다.

- **합의된 결정**: 모델은 Claude API(Anthropic SDK) 사용. 초기 모델은 *Haiku 4.5*. 키는 `.env.local`에서만 읽고 백엔드에서만 호출.
- **미결정 자리**: ① 백엔드 호스팅 (Vercel Edge / Cloudflare Workers / Express+Vercel) ② 응답 파싱 스키마 ③ rate limit 임계값 ④ 시스템 프롬프트의 사례 데이터 컨텍스트 주입 방식 (전체 vs 검색 후 주입).

미결정 자리는 *세션 10~12*에서 단계적으로 좁힌다.

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

## 2. 아키텍처 옵션 비교

LLM 키는 *브라우저에 절대 노출 금지* (CLAUDE.md §1 금지사항). 따라서 *백엔드 경유 호출*이 필수. 세 가지 옵션을 비교한다.

### 옵션 A — Vercel Edge Functions

- **장점**:
  - Vite/React 정적 호스팅과 동일 플랫폼에서 API Routes 운영 가능
  - 콜드 스타트 거의 없음 (Edge runtime), 한국 사용자에게 빠름
  - 환경변수 관리·배포·로그가 한 대시보드에서 통합
- **단점**:
  - Edge runtime에서 Node 모듈 일부 제약 (현재는 SDK 호환 OK)
  - 호출량 폭증 시 Vercel 함수 호출 단가가 누적될 수 있음
- **비용 (대략, Hobby 무료/Pro $20)**: 무료 티어 호출 100K/월, 그 위 사용량 과금
- **운영 부담**: 낮음. 학생 자원봉사 팀 운영에 적합

### 옵션 B — Cloudflare Workers

- **장점**:
  - 세계 분산 엣지에서 가장 빠른 응답 (한국·미국 모두 ms급)
  - 단가 매우 저렴 (월 100K 무료 + 이후 호출당 \$0.50/M)
  - 환경변수·Secrets 관리 좋음
- **단점**:
  - 프런트엔드(Vite)는 별도 호스팅 (Cloudflare Pages 또는 Vercel) — *프런트·백엔드 콘솔 분리*
  - 학생 팀 학습 부담 약간 증가 (Workers 모델·KV·D1 등)
- **비용**: 매우 저렴. 월 10만 호출까지 무료
- **운영 부담**: 중간

### 옵션 C — Express + Vercel (또는 Render·Fly.io)

- **장점**:
  - 가장 익숙한 모델 (Node + Express)
  - 디버깅·로컬 개발 쉬움
  - 향후 Supabase 연동·pgvector 검색·세션 관리 등 확장 용이
- **단점**:
  - 별도 컴퓨트 인스턴스 필요 → 콜드 스타트·유휴 비용
  - 프런트·백엔드 *두 개 배포 파이프라인* 관리
- **비용**: 백엔드 Render Hobby \$7/월 + Vercel 정적 무료
- **운영 부담**: 중간~높음

### 잠정 권고 (결정 미룸)

*초기 트래픽은 0에 가깝고, 학생 팀 운영 부담이 가장 큰 변수*. → **옵션 A (Vercel Edge)** 가 *학습 부담·콜드 스타트·통합 관리* 모두에서 균형이 좋다는 점만 명시. 단, **확장성·세션·pgvector 검색이 필요해지는 M3 단계**에서 옵션 C로 재검토할 수 있도록 *호출 인터페이스를 추상화*해 둔다.

> *결정 자리*: 두루미팀 회의에서 *호스팅 옵션 선정*. 결정 후 본 문서 *§2 잠정 권고*를 *확정*으로 갱신.

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

### 3-3. 응답 스키마 (예시)

```jsonc
{
  "classification": {
    "type_main": "CY",
    "subtypes": ["VB"],
    "role_focus": "G",
    "stage_focus": 4,
    "school_level": "MS",
    "confidence": 0.82
  },
  "safety_flag": false,
  "safety_reason": null,
  "reasoning": "온라인 단톡방 행위라 CY 1차, 언어폭력 동반으로 VB subtype. 학폭위 통보 단계.",
  "suggested_query": "단톡방 사이버폭력 가해 학폭위 통보"
}
```

`suggested_query`는 *matchCases·textSimilarity에 그대로 흘려넣는 검색용 정제 문자열*. 향후 pgvector 임베딩 검색 입력으로도 동일 형태 재사용.

### 3-4. 호출 인터페이스 (백엔드 → SDK)

```js
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 600,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userContent }],
});
```

응답 파싱은 *try/catch + JSON.parse + 스키마 검증*. 검증 실패 시 *규칙 기반 fallback*으로 폴백 (현재 `classify.js`의 로직 유지).

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

## 5. 비용 추산

### 5-1. 모델별 단가 (2026 기준)

| 모델 | Input ($/MTok) | Output ($/MTok) | 비고 |
|---|---|---|---|
| Haiku 4.5 | 1.0 | 5.0 | 초기 단계, 충분한 성능 |
| Sonnet 4.6 | 3.0 | 15.0 | 복잡 추론 필요 시 |

### 5-2. 호출당 추정 토큰

- 시스템 프롬프트: ~1,200 tok (사례 데이터 컨텍스트 미주입 기준)
- 사용자 메시지: ~300 tok (메타 + 상황 본문)
- 응답: ~250 tok (JSON 한 객체)
- **호출당 합계: ~1,750 tok**

### 5-3. 시나리오별 월 비용

**시나리오 A — 학생 100명 × 평균 5회 호출/월 = 500 호출/월**

| 모델 | 호출당 | 월 비용 (USD) | 월 비용 (KRW) |
|---|---|---|---|
| Haiku 4.5 | ~$0.0028 | ~$1.4 | ~1,930원 |
| Sonnet 4.6 | ~$0.0083 | ~$4.2 | ~5,800원 |

**시나리오 B — 학생 500명 × 평균 5회 호출/월 = 2,500 호출/월**

| 모델 | 월 비용 (USD) | 월 비용 (KRW) |
|---|---|---|
| Haiku 4.5 | ~$7 | ~9,700원 |
| Sonnet 4.6 | ~$21 | ~28,900원 |

**시나리오 C — 사례 데이터 컨텍스트 *전부 주입* (사례 71건 × ~500자 = ~35,500 tok)**

호출당 토큰이 ~37,000 tok로 21배. Haiku 4.5 기준 호출당 ~\$0.04. 시나리오 A에 대입하면 월 \$20. → *전체 주입은 비현실적*. 따라서 *§3-3 suggested_query 기반 사후 검색* 또는 *벡터DB 검색 후 top-k 주입*으로 가야 한다 (M3 과제).

### 5-4. 초기 단계 권고

- 모델: **Haiku 4.5** 고정
- 사례 컨텍스트: *주입하지 않음* (분류 + safety_flag만 LLM, 매칭은 기존 코드)
- 월 예산 한도: **\$50 (Usage Limit)** 설정 — 학생 5,000명 분량 ÷ 안전 마진

---

## 6. 보안

### 6-1. API 키 노출 방지

- `.env.local`에만 저장 (커밋 금지, 이미 `.gitignore` 등록)
- `.env.example`로 *키 없는 템플릿*만 저장소에 포함
- 프런트엔드 빌드에 *키가 포함되지 않도록* — Vite 환경변수는 `VITE_` prefix만 번들 노출. ANTHROPIC_API_KEY는 *prefix 없음 → 번들 안 됨* (이미 안전)
- *백엔드에서만* `process.env.ANTHROPIC_API_KEY` 참조

### 6-2. Rate Limiting

- *세션 단위*: 학생 1명당 분당 N회 (초기 N=5 잠정), 시간당 30회
- *IP 단위*: 익명 사용자 보호용 + 남용 방어 (분당 10, 시간당 60)
- *전역 일일 한도*: 1일 호출 상한 N (초기 1000) — 예산 폭주 차단
- 한도 초과 시: *친화 메시지로 "잠시 후 다시 시도"* + *내부 알림*

구현: Vercel Edge 옵션 채택 시 *Upstash Redis* (무료 티어) 또는 *Vercel KV*로 카운터.

### 6-3. 입력 sanitization

- 학생 실명·학교명·전화번호 *백엔드 1차 마스킹* (정규식 패턴 + 한국어 이름 가능성 단어 휴리스틱)
- 프롬프트 인젝션 패턴 ("ignore previous instructions" 등) *차단 또는 무력화 토큰*으로 감쌈
- 응답 출력 *프런트엔드 렌더링 시 HTML 이스케이프* (현재 React 기본)

---

## 7. 다음 세션 일정 (잠정)

### 세션 10 — 백엔드 옵션 결정 + 첫 API Route

- 두루미팀 회의 결과 반영 → 옵션 A/B/C 중 1개 확정
- `api/classify.js` (또는 Workers handler) 작성 — *현재 classify.js를 LLM 호출로 교체*
- 키워드 1단계 안전 분기 백엔드 코드
- 로컬에서 e2e 테스트 (브라우저 → 백엔드 → SDK → 응답)

### 세션 11 — 응답 파싱 + 폴백 + UI 연동

- JSON 파싱 + 스키마 검증
- 검증 실패 시 *현재 규칙 기반 classify*로 폴백
- App.jsx에서 *비동기 호출 + 로딩 상태* UI
- 시나리오 A·B·C 동작 동일성 확인

### 세션 12 — Rate Limit + 입력 sanitization + 로깅

- Upstash Redis(또는 Vercel KV) 카운터
- 학생 실명·전화 마스킹
- 호출 로그(분류·safety_flag·토큰·비용) *익명화하여 SESSION_LOG에 누적*
- 두루 변호사 검수 패키지에 *LLM 응답 샘플 100건* 동봉 준비

### 세션 13+ (M3 진입 후보)

- 벡터DB(pgvector) 임베딩 검색 — *사례 데이터 컨텍스트 동적 주입*
- 사례 매칭 정확도 정량 평가 (현 규칙 기반 vs LLM)

---

## 8. 부록 — 환경 셋업 절차 (학생 팀용)

1. `.env.example`을 `.env.local`로 복사
2. https://console.anthropic.com/settings/keys 에서 키 발급
3. `.env.local`에 `ANTHROPIC_API_KEY=sk-ant-...` 붙여넣기
4. `npm install` (이미 `@anthropic-ai/sdk`, `dotenv` 의존성 추가됨)
5. `npm run llm:check` — Haiku 4.5 호출 + 토큰·비용 확인
6. 정상 응답 보이면 M2 진입 완료
