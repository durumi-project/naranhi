# 「나란히」 — 학교폭력 법률 안내 플랫폼

> Claude Code가 이 저장소에서 작업을 시작할 때 가장 먼저 읽는 문서.
> 이 문서를 *바꾸지 않고* 무시하는 작업은 금지.

---

## 0. 프로젝트 개요

- **이름**: 「나란히」 (영문: naranhi)
- **운영팀**: 두루미팀 (학생 자원봉사 그룹)
- **협력 기관**: 사단법인 두루 (공익법센터)
- **성격**: 비영리, 학생 자원봉사 운영
- **목적**: 학교폭력 사안에 휘말린 학생(피·가해·목격자·보호자)이 *법적 절차를 친화적 언어로 안내받는* 웹 플랫폼
- **메인 페르소나**: P-001 (만 15세 중학생, 사이버폭력 가해 신고, 학폭위 4단계)
- **안전 분기 페르소나**: P-005 (가정폭력 — 위기 신호 시 즉시 도움 안내로 우회)

---

## 1. 기술 스택

- **프런트엔드**: React 18 + Vite + Tailwind CSS
- **아이콘**: `lucide-react`
- **상태 관리**: React `useState`/`useMemo` (외부 상태 라이브러리 사용 안 함)
- **데이터**: 정적 JSON 파일 (`src/data/`) — 향후 Supabase로 확장 예정
- **향후 통합 예정**:
  - `lib/classify.js` → Claude API 호출로 교체
  - `lib/textSimilarity.js` → Supabase pgvector(벡터DB) 검색으로 교체
  - 백엔드: Next.js API Routes 또는 Supabase Edge Functions (LLM 키 보호용)

### 사용 가능 라이브러리 (현재 시점 기준)
- `react`, `react-dom`
- `lucide-react`
- 추후 추가 예정: `@anthropic-ai/sdk`, `@supabase/supabase-js`

### 금지 사항
- `localStorage` / `sessionStorage` 사용 금지 (artifact 시스템 호환 + 프라이버시 정책)
- 외부 CDN 직접 import 금지 (모두 npm 패키지로)
- 환경변수에 API 키 평문 저장 금지 (백엔드 API Route 경유)

---

## 2. 절대 잊으면 안 되는 핵심 원칙

### 2-1. 분류 코드 체계 (분류코드표 v1)

형식: `SV-[유형8]-[역할6]-[단계10]-[학교급4]`

| 축 | 코드 | 의미 |
|---|---|---|
| 유형 (8) | `PH` | 신체폭력 |
| | `VB` | 언어폭력 |
| | `EX` | 강제적 심부름 (갈취) |
| | `CO` | 강요 |
| | `OS` | 따돌림 |
| | `SX` | 성폭력 |
| | `CY` | 사이버폭력 (행위가 온라인 채널이면 무조건 CY) |
| | `MX` | 복합형 |
| 역할 (6) | `G` | 가해 학생 (Gaehae) |
| | `V` | 피해 학생 (Victim) |
| | `B` | 쌍방 (Both) |
| | `W` | 목격자 (Witness) |
| | `P` | 보호자 (Parent) |
| | `U` | 분류 불가 (Unknown) |
| 단계 (10) | `0` | 사전 예방·정보 탐색 |
| | `1` | 사건 발생 직후 |
| | `2` | 학교 신고·사실확인 |
| | `3` | 학교장 자체해결 검토 |
| | `4` | 학폭위 심의 통보 |
| | `5` | 학폭위 심의 직전 |
| | `6` | 학폭위 심의 진행 중 |
| | `7` | 처분 결정·통보 |
| | `8` | 처분 이행·재심 |
| | `9` | 형사·민사 병행 또는 후속 |
| 학교급 (4) | `ES` | 초등학교 |
| | `MS` | 중학교 |
| | `HS` | 고등학교 |
| | `OT` | 기타 (대안학교 등) |

예: `SV-CY-G-4-MS` = 사이버폭력 가해 학생, 학폭위 심의 통보 단계, 중학교

### 2-2. 친화 변환 5대 원칙 (가이드 v1)

1. **이름은 모두 관계어로**: 실명·가명 모두 *"같은 학교 친구"*, *"신고를 한 친구"*, *"신고 대상이 된 친구"* 같은 관계어로 변환
2. **장소는 일반화**: 학교명·지역명·동명 모두 일반화 또는 ○○로 처리
3. **법률 용어 풀어쓰기 + 정식 명칭 1회 노출**: `학교폭력대책심의위원회(학폭위) — 처분을 결정하는 회의` 형식
4. **시점은 사용자 입장**: applies_to에 G/V/P 등 여러 역할 코드를 두고, 사용자 역할에 따라 표현 변경
5. **추측·해석 금지**: 원문에 명시된 사실만. 감정 추측·동기 해석 일체 금지

### 2-3. 안전 분기 — 위기 신호 발견 시 즉시 우회

다음 키워드/사실관계 발견 시 *일반 결과 화면 대신* `SafetyBranchScreen` 또는 `SafetyBanner`로 분기:

- **가정폭력 신호**: "아빠가 때려요", "엄마가 무서워요", "집에 가기 싫어요" 등 → P-005 안전 분기
- **자해·자살 신호**: "죽고 싶어요", "다 끝내고 싶어", "이미 시도했어요" 등 → `safety_flag=true` 사례(OM2-IV-002 등) 노출 시 안전 배너 동반
- **즉시 노출 도움 전화**: 1393(자살예방), 1388(청소년 종합), 1577-0199(정신건강위기), 112(긴급)
- **금지 행위**:
  - 위기 상태인지 *직접 묻지 않음* (묻는 행위 자체가 트리거)
  - 자해 방법·정도에 대한 어떤 디테일도 노출 금지
  - "곧 지나갈 거예요" 같은 진정시키기 금지
  - 감정 증폭형 반사적 듣기 (*"정말 힘드셨겠어요…"*) 자제

### 2-4. 검수 체크리스트 v1 (5영역 18항목)

모든 데이터(`cases`, `documents`, `resources` 등)는 두루 변호사 검수 *전후*가 명확히 구분돼야 함:

- 영역 A: 출처·신뢰도 (3항목)
- 영역 B: 분류 코드 정확성 (4항목)
- 영역 C: 사실관계·법조항 정확성 (4항목)
- 영역 D: 친화 변환 톤·정확성 (4항목)
- 영역 E: 개인정보·안전성 (3항목)

검수 흐름: `data/cases/PENDING/` → 두루 변호사 → `data/cases/REVIEWED/`

---

## 3. 작업 디렉토리 구조 (목표)

```
naranhi/
├── CLAUDE.md                         ← 이 파일
├── README.md
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── App.jsx                       ← UI 컴포넌트만
│   ├── main.jsx
│   ├── lib/
│   │   ├── classify.js               ← 분류 로직 (향후 Claude API)
│   │   ├── textSimilarity.js         ← 유사도 (향후 벡터DB)
│   │   ├── matchCases.js             ← 사례 매칭
│   │   ├── filterContent.js          ← 콘텐츠 필터링
│   │   └── codeUtils.js              ← 분류 코드 패턴 매칭 유틸
│   ├── components/                   ← UI 컴포넌트 분리 (선택)
│   │   ├── Header.jsx
│   │   ├── Landing.jsx
│   │   ├── StepInfo.jsx
│   │   └── ...
│   └── data/
│       ├── cases/
│       │   ├── PENDING/              ← 검수 대기
│       │   │   ├── OM2-IV-001.json
│       │   │   ├── OM2-IV-002.json
│       │   │   └── OM2-IV-003.json
│       │   ├── REVIEWED/             ← 검수 완료
│       │   │   ├── SAMPLE-001.json   ← (프로토타입 가상 사례 4건)
│       │   │   ├── SAMPLE-002.json
│       │   │   ├── SAMPLE-003.json
│       │   │   └── SAMPLE-004.json
│       │   └── index.js              ← PENDING/REVIEWED 자동 병합
│       ├── documents/
│       │   ├── PENDING/D-OM2-001.json
│       │   ├── REVIEWED/
│       │   └── index.js
│       ├── resources.json
│       ├── procedure_stages.json
│       ├── legal_terms.json
│       ├── faqs.json
│       ├── question_trees.json
│       └── keyword_rules.json
├── docs/                             ← 인수인계 자료 등 (선택)
│   ├── 인수인계_v1.md
│   ├── 분류코드표_v1.md
│   ├── 친화_변환_가이드_v1.md
│   └── 판례_검수_체크리스트_v1.md
└── _archive/                         ← 옛 프로토타입 보관
    └── legal_platform_v2_1.jsx
```

---

## 4. 통합 cases.json 스키마 v2 (33필드)

```jsonc
{
  "case_id": "string",                     // 고유 ID (예: OM2-IV-001, SAMPLE-001)
  "case_type": "string",                   // "precedent" | "alternative_resolution" | "sample"
  "source_type": "string",                 // "대법원판결" | "케이스노트" | "두루자료" | "교육청공시"
  "source_citation": "string",             // 출처 인용 (역추적 가능)
  "decision_date": "string|null",          // "2024-05-15" 또는 null
  "court": "string|null",                  // 법원/심의기구
  "case_number": "string|null",            // 사건번호
  "case_title_formal": "string",           // 정식 사건명
  "disposition_summary": "string",         // 처분 요약
  "type_main": "PH|VB|EX|CO|OS|SX|CY|MX",
  "subtypes": ["string"],                  // 부속 유형 배열
  "role_focus": "G|V|B|W|P|U",
  "stage_focus": "0-9",
  "school_level": "ES|MS|HS|OT",
  "applies_to": ["string"],                // 매칭 가능 코드 배열 (와일드카드 * 허용)
  "keywords": ["string"],                  // 자동/수동 추출 키워드
  "original_summary": "string",            // 원문 요약 (200~400자)
  "original_facts": ["string"],            // 사실관계 불릿 (5~8개)
  "original_facts_raw": "string",          // 원문 그대로 (가공 전)
  "original_law": "string",                // 관련 법조항
  "original_disposition": "string",        // 원문 처분
  "original_full_text": "string",          // 원문 전문 (또는 발췌)
  "original_text_snippet": "string",       // 출처 검증용 짧은 발췌
  "friendly_title": "string",              // 친화 제목
  "friendly_summary": "string",            // 친화 요약 (학생 눈높이)
  "key_factors": ["string"],               // 핵심 요소 불릿
  "severity_factors": ["string"],          // 심각도 요소
  "related_laws_friendly": [               // 법조항 풀이
    {"law": "string", "friendly": "string"}
  ],
  "safety_flag": "boolean",                // 자해·자살·가정폭력 등 위기 신호
  "safety_banner": {                       // safety_flag=true일 때 노출 정책
    "show": "boolean",
    "title": "string",
    "body": "string",
    "resources": [{"name": "string", "number": "string", "available": "string"}]
  },
  "privacy_check": "Y|N",
  "review_status": "검수대기|검수완료|반려",
  "reviewer": "string|null",
  "reviewed_at": "string|null",
  "review_notes": "string|null"
}
```

> 주의: 프로토타입 v2.1의 인라인 CASES 배열은 *4~6필드*만 채워져 있음. 외부화 시 *나머지 필드는 null 또는 빈 배열*로 채우고, 검수 통해 점진 보강.

---

## 5. 현재 보유 자료 인벤토리

### 5-1. 검수 대기 (PENDING)
- **온마음2 추출 사례 3건** (`onmaeum2_outputs/cases_from_onmaeum2.json`)
  - OM2-IV-001 교제 갈등 (MX+B+4+MS)
  - OM2-IV-002 4년 후 따돌림 (OS+V+9+ES, ⚠️ 자해 언급)
  - OM2-IV-003 초6 손해배상 분쟁 (PH+G+4+ES)
- **합의문 양식 1건** (`documents_agreement_form.json` → D-OM2-001)
- **기관 정보 30+건** (`resources_from_onmaeum2.json`)
- **절차 보강 6건 + 운영 Tip 6건 + 안전 가이드 2건** (`procedure_and_safety_supplements.json`)

### 5-2. 검수 완료 (REVIEWED)
- **프로토타입 가상 사례 4건** (현재 `legal_platform_v2_1.jsx` 인라인)
  - SAMPLE-001 단톡방 별명 (CY+G+7+MS)
  - SAMPLE-002 복도 어깨 (PH+G+2+MS) — 학폭 불인정 사례
  - SAMPLE-003 체육복 숨김 (OS+G+7+ES)
  - SAMPLE-004 SNS 유포 (CY+V+9+HS)

### 5-3. 미통합 외부 자료
- 두루 「2025 아동·청소년 법률 매뉴얼」 (152쪽) — *외부 활용 허락 범위 확인 필요*
- 두루 「온 마을이 함께하는 아동·청소년 법률지원 실무 매뉴얼」 (212쪽)
- 두루 「소년보호사건 법률지원 매뉴얼」 (128쪽)
- 두루 「보호소년 지원 매뉴얼 — 소년보호사건 이것이 궁금해요」 (8쪽)
- 인천교육청 「제2회 학교폭력 예방 우수사례 모음집」 — 미첨부

---

## 6. 미해결 결정 사항 (인수인계 v1)

1. LLM API: Claude vs OpenAI 비교 — *자료가 어느 정도 모인 후 결정*
2. 벡터 DB: Supabase pgvector 후보
3. 백엔드: Next.js API Routes vs Supabase Edge Functions 후보
4. 두루 자료 외부 활용 허락 범위 — 두루 변호사 확인 필요
5. 확장 시나리오 5가지 (보호자·교사용 등) — 두루·교수님·멘토 논의 필요

---

## 7. 작업 워크플로우

### 7-1. 안전한 진행 순서
1. **계획 먼저**: 큰 변경 전 *"무엇을, 어떻게, 어느 파일을"* 보여주고 사용자 승인 받기
2. **백업 브랜치**: 큰 리팩토링 전 `git checkout -b refactor/외부화` 등 별도 브랜치
3. **잦은 커밋**: 단위 작업 끝날 때마다 커밋, 메시지에 *변경의 의도* 명시
4. **동작 확인**: 데이터 외부화 같은 *비기능 변경*은 *변경 전후 동작 동일성*을 `npm run dev`로 확인

### 7-2. 실행 명령
- `npm run dev` → 개발 서버 (http://localhost:5173)
- `npm run build` → 프로덕션 빌드
- `npm run preview` → 빌드 결과 미리보기
- `npm test` → 테스트 (아직 미작성)
- `git status` / `git diff` → 변경사항 확인 (작업 중 자주)

### 7-3. 검수 트랙 자동화 (선택)
- `data/cases/index.js`가 `PENDING/`과 `REVIEWED/` 폴더의 JSON을 자동 import
- 빌드 시 *검수 완료된 것만* 노출하는 옵션 플래그 (`VITE_SHOW_PENDING=false`)
- 개발 환경에서는 둘 다 노출, 프로덕션은 `REVIEWED/`만

---

## 8. 핵심 함수 — 변경 시 주의

### `classify(text)` — `src/lib/classify.js`
- 현재: 규칙 기반 키워드 매칭 (`KEYWORD_RULES` 참조)
- 향후: Claude API 호출로 교체 예정
- **인터페이스 유지**: 입력 `{ text: string }` → 출력 `{ type_main, role_focus, stage_focus, school_level, confidence }`
- 인터페이스만 같으면 *내부 구현을 자유롭게 교체* 가능 (이 게 외부화의 핵심 이유)

### `textSimilarity(userText, caseKeywords)` — `src/lib/textSimilarity.js`
- 현재: 키워드 카운트 기반 단순 유사도
- 향후: pgvector 임베딩 검색으로 교체 예정
- **인터페이스 유지**: 입력 `(string, string[])` → 출력 `number (0~1)`

### `matchCases(userCode, userText, cases, options)` — `src/lib/matchCases.js`
- 사용자 분류 코드 + 텍스트로 cases 배열에서 매칭 + 점수 계산
- 외부화 후에도 *동일한 시그니처 유지* — 데이터만 외부에서 import

---

## 9. 커뮤니케이션 규칙 (Claude Code에게)

- **한국어로 응답** — 학생팀과의 협업이라 영어 응답 자제
- **변경 전 계획 보여주기** — 어떤 파일을 어떻게 바꿀지 먼저
- **변경 후 git diff 결과 요약** — 무엇이 바뀌었는지 사람이 빠르게 파악 가능하게
- **에러 발생 시 *원인부터*** — 해결책 제안 전에 *왜 그렇게 됐는지* 1~2줄 설명
- **불확실하면 묻기** — 추측보다 짧은 확인 질문이 안전

---

## 10. 참고 문서

저장소 내 `docs/` 폴더에 있어야 하는 문서들 (없으면 두루미팀에 요청):
- `인수인계_v1.md` — 프로젝트 전체 맥락
- `분류코드표_v1.md` — 8×6×10×4 코드 체계 상세
- `친화_변환_가이드_v1.md` — 5대 원칙 상세 + 예시
- `판례_검수_체크리스트_v1.md` — 18항목 체크리스트
- `페르소나_풀트레이스_P001.md` — P-001 6단계 여정 상세
- `페르소나_풀트레이스_P005.md` — P-005 안전 분기 케이스
