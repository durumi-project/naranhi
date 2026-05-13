## 2026-05-13 세션 1 — 부트스트랩 + 프로토타입 이전

### 완료한 작업
- [x] CLAUDE.md, claude_code_instructions.md, docs/ 인수인계 자료 5종 셋업 (b3c66b5)
- [x] _archive/ 보존 (b0e8935)
- [x] Vite + React 18 + Tailwind v4 부트스트랩 (5f7bade)
- [x] 프로토타입 v2.1 (1695줄)을 src/App.jsx로 이전 (이번 커밋)
- [x] localhost:5173에서 6단계 여정 + 안전 분기 정상 동작 확인

### 현재 베이스라인
- 4건 가상 사례 (SAMPLE-001~004) 인라인
- 진짜 기능 4가지 작동: classify, 안전 분기, matchCases, filterContent
- LLM 통합: 0% (Step 4에서 진행 예정)
- 실제 자료 통합: 0% (Step 2에서 진행 예정, _staging/에 온마음2 자료 4개 JSON 대기 중)

### 검증 중 발견한 이슈 — Step 2 키워드 버튼의 시나리오 비적응성

**증상**: 사용자가 가정폭력 신호("아빠가 때려요" 등)를 입력해도 Step 2의 자유 텍스트 옆 *키워드 버튼 옵션*은 여전히 학폭 시나리오 키워드(단톡방·복도·체육복 등)로 고정됨.

**근본 원인**: KEYWORD_RULES가 *학폭 시나리오 가정* 위에서 설계됨. 안전 분기 시나리오(가정폭력·성폭력·자해 등)별로 *적합한 어휘 영역*이 별도 존재해야 하나 사전에 없음.

**영향**:
- UX: 사용자가 자기 상황과 무관한 옵션을 보면 *"이 도구는 내 일을 모르나 봐"* 라고 느낌 → 이탈 위험
- 안전: 가정폭력 사용자가 *"학폭 도구잖아"*라고 떠나면 진짜 도움 기회 상실
- 분류 정확도: 어색한 키워드를 억지 선택 시 classify 엔진 혼란

**해결 방향 (LLM 통합 시 자연스럽게 풀림)**:
- 키워드 사전 시나리오별 확장은 *유지보수 부담*이라 비권장
- LLM이 *맥락 이해 후 동적으로 후속 질문 생성*하는 방식이 본질적 해결
- 즉 이 결함은 *LLM 통합이 미해결 사항으로 남은 이유 자체*임

**우선순위**: P2 — LLM 통합 시점에 재검토. 그 전까지는 *현재 안전 분기(SafetyBranchScreen 우회)*가 가정폭력 사용자를 보호하므로 *결과 화면에 도달하지는 않음*이 안전망.

### 다음 세션 시작 시 할 일
- Step 1-4: 인라인 데이터 8종을 src/data/*.json으로 외부화
- 동작 동일성 유지가 핵심 (HMR로 즉시 확인 가능)
- 외부화 후 커밋
- 그 다음 Step 2 — 통합 스키마 v2로 SAMPLE + OM2 사례 병합

### 환경 메모
- dev 서버 명령: cd ~/Desktop/Durumi && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use && npm run dev

---

## 2026-05-13 세션 2 — 데이터 외부화

### 완료한 작업
- [x] src/data/ 폴더에 JSON 8종 추출 (deep equality 검증 통과)
- [x] App.jsx 외부화 적용 (1695줄 → 1316줄, 함수·컴포넌트 본문 무변경)
- [x] 시나리오 A·B·C 동작 동일성 확인
- [x] 두 커밋으로 분리하여 데이터 추출과 코드 변경을 의미적으로 구분

### 외부화 결과
- 데이터: src/data/cases.json (10건), documents.json (12), legal_terms.json (10), faqs.json (10), resources.json (8), question_trees.json (5키), procedure_stages.json (10), keyword_rules.json (5키)
- 코드: src/App.jsx 1316줄 — import 8개 추가, const 8개 제거. 로직 함수와 UI 컴포넌트 완전 보존
- 검증: deep equality (의미적 동일성 수학적 증명) + 5종 grep 검증 + 시나리오 A·B·C 수동 검증

### 발견 이슈 — CASES 항목 수 불일치 + PR prefix 정체 미확인 (P3)

**증상**: 지난 세션 SESSION_LOG.md에 "4건 가상 사례 (SAMPLE-001~004)"로 기록했으나 실제 src/App.jsx에는 10건 (SAMPLE-001~005 + PR-006~010).

**추정**: PR prefix는 "precedent"(판례)일 가능성. 인수인계 시점에 이미 수동 수집된 판례 5건이 들어가 있었으나 우리가 인지 못 함.

**다음 행동**: Step 2 직전에 별도 검토. 두루 변호사·인수인계 작성자에게 PR-006~010 출처 확인 필요.

**우선순위**: P3 — 외부화·Step 2 진행에 직접 차단 요소 아님. 통합 스키마 적용 전까지 답 받으면 됨.

### 운영 메모 — 세션 1에서 띄운 dev 서버가 세션 2까지 살아 있어 문제 발생

**증상**: 외부화 후 브라우저에 세션 1 부트스트랩 placeholder가 보임. 1695줄 프로토타입 이전과 외부화가 모두 적용 안 된 듯한 화면.

**원인**: 세션 1 종료 시 dev 서버 터미널을 Ctrl+C로 종료하지 않음. PID 1813이 :5173에서 24시간+ 계속 응답. HMR이 큰 변경(부트스트랩→프로토타입 통째 교체, 인라인→외부화)을 따라잡지 못한 것으로 추정. Vite 캐시(node_modules/.vite)도 옛 의존성 그래프로 굳음.

**복구**: dev 서버 Ctrl+C 종료 → node_modules/.vite 삭제 → 재기동 → Cmd+Shift+R. 파일은 무손상.

**예방 (모든 세션 종료 시)**: dev 서버 Ctrl+C로 명시 종료 + 세션 종료 단계에 SESSION_LOG.md에 자동 추가하는 체크리스트 항목 신설 제안. 다음 세션 시작 시 :5173 점유 프로세스 사전 확인.

### 다음 세션 시작 시 할 일
- :5173 점유 프로세스 사전 확인 (lsof -nP -iTCP:5173 -sTCP:LISTEN)
- Step 2 진입 전: PR-006~010 출처 확인 (두루 변호사 또는 인수인계 작성자에게 문의 필요 여부 판단)
- Step 2 본격 작업: 통합 스키마 v2 설계 → SAMPLE/PR 변환 → onmaeum2 사례 3건 병합 → cases/PENDING/, cases/REVIEWED/ 폴더 구조 도입

### 세션 종료 체크리스트 (다음 세션 시작 전까지 살아 있어야 함)
- [ ] dev 서버 터미널에서 Ctrl+C
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (모든 변경 커밋 완료)
- [ ] SESSION_LOG.md 다음 세션 항목 채워졌는지
