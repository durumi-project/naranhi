# Claude Code 작업 지시문 모음

이 문서의 각 블록을 **순서대로** Claude Code 세션에 붙여넣어 진행해.
각 블록은 *한 번에 하나씩*, 직전 작업이 끝나고 동작 확인까지 마친 후 다음으로.

---

## 사전 준비 (한 번만)

### 0-1. 저장소 클론·세팅
```bash
# 두루미팀 깃 저장소 클론 (URL은 두루미팀에 확인)
git clone <두루미팀_저장소_URL> naranhi
cd naranhi

# CLAUDE.md를 저장소 루트에 복사
cp /path/to/onmaeum2_outputs/CLAUDE.md ./CLAUDE.md

# 우리 산출물 5개를 임시 폴더에 두기 (작업 시 참조용)
mkdir -p _staging/onmaeum2_outputs
cp /path/to/onmaeum2_outputs/*.json _staging/onmaeum2_outputs/
cp /path/to/onmaeum2_outputs/README.md _staging/onmaeum2_outputs/

# 현재 프로토타입을 _archive에 백업
mkdir -p _archive
cp /path/to/legal_platform_v2_1.jsx _archive/

# Claude Code 시작
claude
```

### 0-2. 첫 세션 인사 (Claude Code에게)
```
CLAUDE.md를 먼저 읽어줘. 그리고 현재 저장소 상태(파일 트리, package.json, 어떤 빌드 도구가 설정돼 있는지)를 확인해서 한 화면에 요약해줘. 변경은 아직 하지 마.
```

---

## Step 1. 프로젝트 골조 확인 + 데이터 외부화

### 1-1. 현재 상태 진단

```
저장소 현재 상태를 다음 관점에서 진단해줘:
1. 이미 Vite + React 프로젝트로 셋업돼 있는지, 아니면 새로 만들어야 하는지
2. _archive/legal_platform_v2_1.jsx가 그대로 src/App.jsx로 들어갈 수 있는 상태인지
3. package.json의 의존성(react, lucide-react 등)이 충분한지
4. .gitignore에 _staging, _archive가 들어가 있는지

진단 결과를 표로 정리하고, *다음에 무엇을 해야 하는지*만 알려줘. 아직 변경하지 마.
```

### 1-2. 프로젝트 부트스트랩 (필요 시)

만약 1-1 결과 *Vite 프로젝트가 없으면* 이 블록 실행. 이미 있으면 건너뛰어:

```
Vite + React 프로젝트로 부트스트랩해줘. 단, 다음 조건:
1. 이미 있는 파일들(legal_platform_v2_1.jsx 등)은 덮어쓰지 말 것
2. package.json은 react, react-dom, lucide-react만 의존성으로
3. Tailwind는 일단 설치하지 말고, lucide-react만으로 진행 (현재 프로토타입이 Tailwind 안 쓰는지 먼저 확인)
4. .gitignore에 node_modules, dist, _staging, .env, .env.local 추가
5. src/main.jsx는 src/App.jsx를 import해서 #root에 렌더
6. 작업 전 변경 계획을 먼저 보여줘
```

### 1-3. 프로토타입을 src/App.jsx로 이전 (동작 확인)

```
_archive/legal_platform_v2_1.jsx의 내용을 src/App.jsx로 복사해줘. 한 줄도 수정하지 말고, 그대로. 그 다음 npm run dev로 띄워서 http://localhost:5173에서 정상 렌더되는지 확인해줘. 에러 있으면 *원인부터* 분석.
```

**여기서 반드시 멈추고 사용자가 직접 브라우저에서 확인.**
- 랜딩 → 정보 → 상황 → 분류 확인 → 후속 → 결과 6단계 모두 정상 동작
- 데모 페르소나 버튼 동작 확인
- 안전 분기 (P-005) 동작 확인 ("아빠가 때려요" 같은 입력)

문제 없으면 다음으로:
```
지금 상태로 git add → git commit -m "초기 프로토타입 v2.1을 src/App.jsx로 이전" 해줘.
```

### 1-4. 데이터 외부화 — 계획부터

```
src/App.jsx에서 다음 인라인 데이터 8개를 src/data/ 폴더의 별도 JSON 파일로 분리할 계획을 세워줘:
1. CASES → src/data/cases.json
2. DOCUMENTS → src/data/documents.json
3. LEGAL_TERMS → src/data/legal_terms.json
4. FAQS → src/data/faqs.json
5. RESOURCES → src/data/resources.json
6. QUESTION_TREES → src/data/question_trees.json
7. PROCEDURE_STAGES → src/data/procedure_stages.json
8. KEYWORD_RULES → src/data/keyword_rules.json

계획에 포함할 것:
- App.jsx의 어느 줄을 어떻게 수정할지
- 각 JSON 파일의 *상단 구조* (직접 배열 vs { "cases": [...] } 객체)
- import 문 위치와 형식
- 동작이 외부화 *전후로 완전히 동일*함을 보장하는 방법 (테스트 시나리오 3개 제안)

아직 변경하지 말고 계획만 보여줘. 검토 후 진행 신호 줄게.
```

**여기서 사용자가 계획 검토 후 OK 신호.**

### 1-5. 데이터 외부화 — 실행

```
1-4의 계획대로 실행해줘. 단 다음 순서로:
1. src/data/ 폴더 생성
2. JSON 파일 8개 먼저 모두 만들고 (App.jsx는 아직 수정 안 함)
3. JSON 8개 모두 유효성 검증 (각 파일 JSON.parse 성공 + 원본 배열 길이와 동일)
4. App.jsx 상단에 import 문 8개 추가
5. App.jsx 본문의 const CASES = [...] 등 8개 인라인 선언을 제거
6. npm run dev로 다시 띄워서 동작 확인

각 단계 끝날 때마다 진행 상황 보고. 에러 있으면 즉시 멈추고 원인 보고.
```

**동작 확인 후:**
```
git diff --stat로 변경 규모 보여주고, git add → git commit -m "데이터 8종을 src/data/ JSON 파일로 외부화. 동작 동일성 확인 완료." 해줘.
```

---

## Step 2. 우리 산출물 병합 — 통합 스키마 v2 적용

### 2-1. 스키마 대조 분석

```
다음 두 cases.json을 스키마 관점에서 대조해줘:
- src/data/cases.json (현재 SAMPLE-001 ~ SAMPLE-004, 약 14필드 사용)
- _staging/onmaeum2_outputs/cases_from_onmaeum2.json (OM2-IV-001 ~ 003, 33필드 사용)

대조 표로:
1. 양쪽에 모두 있는 필드 (이름·구조 동일)
2. 양쪽에 모두 있으나 *이름이나 구조가 다른* 필드
3. SAMPLE만 있는 필드
4. OM2만 있는 필드

CLAUDE.md의 §4 통합 스키마 v2를 기준으로, *어느 쪽을 어떻게 변환*해야 통합되는지 결정. 변환 매핑표를 보여줘. 아직 변경 X.
```

### 2-2. 검수 트랙 폴더 구조 도입

```
다음 폴더 구조를 만들고 기존 cases.json을 분해해줘:

src/data/cases/
├── PENDING/
│   ├── OM2-IV-001.json
│   ├── OM2-IV-002.json
│   └── OM2-IV-003.json
├── REVIEWED/
│   ├── SAMPLE-001.json
│   ├── SAMPLE-002.json
│   ├── SAMPLE-003.json
│   └── SAMPLE-004.json
└── index.js  ← PENDING + REVIEWED 자동 병합 (Vite의 import.meta.glob 활용)

작업:
1. 폴더 만들기
2. 기존 cases.json의 4건을 각각 REVIEWED/SAMPLE-00X.json으로 분리. 단, 2-1에서 결정한 통합 스키마 v2로 *필드 변환* 적용. SAMPLE 4건은 이미 가상이지만 review_status는 "검수완료"로 표시.
3. _staging의 cases_from_onmaeum2.json에서 3건을 각각 PENDING/OM2-IV-00X.json으로 분리. review_status는 "검수대기".
4. index.js에서 두 폴더의 JSON을 import.meta.glob으로 자동 로드해서 단일 배열로 export. 환경변수 VITE_SHOW_PENDING으로 PENDING 노출 여부 제어.
5. App.jsx에서 cases.json import를 cases/index로 교체.

각 단계 끝날 때마다 보고. 변경 계획부터 먼저 보여줘.
```

### 2-3. 안전 배너 노출 로직 추가

```
src/data/cases/PENDING/OM2-IV-002.json은 safety_flag=true이고 safety_banner 객체가 있어. 이걸 UI에 노출하는 로직을 추가해줘:

요구사항:
1. 사례 카드 컴포넌트가 safety_flag=true인 사례를 렌더할 때 *본문 위*에 SafetyBanner 컴포넌트 노출
2. 배너 색상은 앰버 계열 (위험 빨강 X)
3. resources 배열의 전화번호는 tel: 링크로 (모바일에서 즉시 전화)
4. CLAUDE.md §2-3의 do_not 항목 준수 (위기 상태 직접 묻지 않기 등)
5. SafetyBanner를 src/components/SafetyBanner.jsx로 분리해서 재사용 가능하게

설계 먼저 보여주고 OK 받은 후 구현.
```

---

## Step 3. 검증·문서·커밋

### 3-1. 동작 확인 시나리오

```
다음 시나리오 3개를 npm run dev로 띄운 상태에서 수동으로 확인할 체크리스트를 만들어줘. 각 시나리오마다 *기대 결과*와 *확인 방법*을 명시:

1. SAMPLE-001 단톡방 사례 (검수완료) 표시 — 외부화 전과 동일하게 노출되는지
2. OM2-IV-002 4년 후 따돌림 사례 (검수대기, safety_flag=true) 표시 — 개발 환경에서 SafetyBanner와 함께 노출되는지
3. VITE_SHOW_PENDING=false로 빌드 시 PENDING 사례가 *완전히 숨겨지는지*

체크리스트를 docs/QA_step2.md로 저장해줘.
```

### 3-2. README 업데이트

```
저장소 루트 README.md를 업데이트해줘:
- 프로젝트 한 줄 설명
- 빠른 시작 (npm install / npm run dev)
- 폴더 구조 트리 (Step 2까지 반영)
- 검수 트랙 설명 (PENDING vs REVIEWED)
- 환경변수 (.env.example) 안내
- 기여 가이드 한 단락 — *데이터 추가는 PENDING/ 에 JSON 하나로*

이미 README가 있으면 *추가만* 하고 기존 내용 보존.
```

### 3-3. 최종 커밋

```
지금까지 변경사항 git status / git diff --stat 로 보여주고, 다음 형식으로 커밋해줘:

feat: 검수 트랙 폴더 구조 + 통합 스키마 v2 적용

- src/data/cases를 PENDING/REVIEWED 폴더로 분리
- SAMPLE-001~004 (검수완료) + OM2-IV-001~003 (검수대기) 통합
- 통합 스키마 v2 (33필드) 적용
- SafetyBanner 컴포넌트 추가 (OM2-IV-002 자해 언급 처리)
- import.meta.glob으로 자동 로드, VITE_SHOW_PENDING으로 노출 제어
- QA 체크리스트 docs/QA_step2.md 추가
```

---

## Step 4. (선택, 다음 세션) LLM 통합 준비

여기는 *자료가 좀 더 모인 후* 들어갈 단계. 미리 적어둘게:

### 4-1. lib 분리

```
src/App.jsx에서 다음 함수들을 src/lib/로 분리해줘:
- classify() → src/lib/classify.js
- textSimilarity() → src/lib/textSimilarity.js
- matchCases() → src/lib/matchCases.js
- filterContent() → src/lib/filterContent.js
- 분류 코드 패턴 매칭 유틸 → src/lib/codeUtils.js

인터페이스(입출력 시그니처)는 절대 바꾸지 마. 단순 위치 이동 + 명시적 export만.
```

### 4-2. classify를 Claude API로 교체

```
src/lib/classify.js의 내부 구현을 Claude API 호출로 교체해줘:
- 입출력 시그니처는 동일 ({ text: string } → { type_main, role_focus, stage_focus, school_level, confidence })
- API 키는 환경변수 (.env.local의 ANTHROPIC_API_KEY) 사용
- 직접 fetch가 아니라 백엔드 API Route 경유 (Next.js로 마이그레이션 또는 Vite + Vercel Functions)
- 폴백: API 실패 시 기존 규칙 기반 classify로 자동 회귀
- 비용 보호: 요청당 max_tokens=200 제한, 디바운스 500ms

작업 계획부터 보여줘. 백엔드 형태(Next.js vs Vercel Functions vs Supabase Edge) 선택은 이 시점에서 결정.
```

---

## 진행 중 자주 쓰는 명령

```
# 변경 사항 한눈에
git status
git diff --stat
git log --oneline -10

# 동작 빠르게 확인
npm run dev          # localhost:5173
npm run build        # dist/ 생성
npm run preview      # 빌드 결과 미리보기

# 데이터 검증
node -e "console.log(require('./src/data/cases.json').length)"

# 검수 진행 상황 (PENDING 개수)
ls src/data/cases/PENDING/ | wc -l
ls src/data/cases/REVIEWED/ | wc -l
```

---

## Claude Code 세션 종료 전 체크리스트

매 세션 종료 전에 Claude Code에게:

```
이번 세션에서 한 일을 다음 형식으로 정리해줘:
1. 완료한 작업 (체크박스)
2. 변경된 파일 목록 + 한 줄 요약
3. 다음 세션 시작 시 이어갈 곳
4. 미해결 이슈/질문

이걸 docs/SESSION_LOG.md에 append (없으면 새로 만들기). 그 다음 git status 보여줘.
```

이렇게 하면 *세션 간 컨텍스트 영속화*가 됨 — `CLAUDE.md`가 *영구 컨텍스트*고, `SESSION_LOG.md`가 *진행 일지*.
