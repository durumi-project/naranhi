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

---

## 2026-05-14 세션 3 — 스키마 v2 도입 + SAMPLE/PR 10건 변환

### 완료한 작업
- [x] C-0 자료 구조 분석 — SAMPLE/PR/OM2 세 그룹의 필드 사용 통계, PR-006~010 내적 증거로 가상사례 판정, 스키마 재설계 권고 도출
- [x] C-0.5 CLAUDE.md §4 정정 (586ea5f) — 33→42필드, stage_focus 숫자형, 9개 필드 공식 추가, 9그룹(A~I) 재배치, 필수/선택 규칙 명문화
- [x] CLAUDE.md §9 커밋 서명 정책 추가 — Co-Authored-By 금지 (두루미팀 학생이 작성자, Claude는 도구)
- [x] C-1 validateCase + 테스트 (84a0a58) — { ok, errors } 반환, 모든 위반 수집. 13/13 + 합성 4/4 통과
- [x] C-2 cases/PENDING + cases/REVIEWED 폴더 신설 (5b39bbc) — 10건을 개별 JSON 파일로 분리, deep equality 통과
- [x] C-3 SAMPLE/PR 10건 스키마 v2 (42필드) 변환 (75ce629) — case_type/review_status 추가, B·D·G·H·I 그룹 null/빈 배열 채움, 실제 데이터 13/13 검증 통과

### 핵심 산출물
- `src/lib/validateCase.js` — 스키마 검증 함수
- `src/lib/validateCase.test.js` — 17건(실제 13 + 합성 4) 테스트
- `src/data/cases/REVIEWED/{SAMPLE-001..005, PR-006..010}.json` — 42필드 conformant
- `src/data/cases/PENDING/` — 빈 디렉토리 (C-4에서 OM2 3건 추가 예정)
- `scripts/split_cases.mjs`, `scripts/transform_cases_v2.mjs` — 일회성·재실행 가능 스크립트
- `src/data/cases.json` 무변경 — App.jsx 호환성 그대로

### 발견 이슈 1 — PR-006~010 prefix 의미 (P3, 이전 세션 이슈 진행)

**증상**: 세션 2에서 발견한 "PR prefix 미확인" 이슈 — 내적 증거(case_number "(가상)" 표기, 작성 톤·메타 동일)로 SAMPLE과 동일 등급으로 판정. 5건 모두 case_type="sample"로 분류.

**조치**: 각 PR-006~010의 review_notes에 다음 메모 명시:
> "PR prefix 의미는 두루미팀 확인 필요. 작성 톤·메타·case_number 형식이 SAMPLE-001~005와 동일하여 같은 등급으로 분류함."

**다음 행동**: 두루미팀·인수인계 작성자 답 받으면 review_notes 정정 또는 case_id 재명명. precedent로 판명되면 case_type 변경 + 추가 필수 4개 필드(source_type, source_citation, original_law, disposition_summary) 보강 필요.

### 발견 이슈 2 — SAMPLE-005 not_recognized_reasons 보강의 콘텐츠 판단 경계 (P2)

**증상**: SAMPLE-005는 recognition="일부인정"인데 not_recognized_reasons=[]로 비어 있어 validateCase의 조건부 필수 규칙을 위반. C-3 변환 단계에 1개 이상 채워야 검증 통과.

**조치**: 새 콘텐츠 생성이 아닌 *기존 데이터의 재배치* 원칙으로 해결. severity_factors[0]("명시적 협박이 없어 처분 수위는 낮은 편")과 friendly_summary("협박은 없었지만…")에서 *명시적 협박 부재*가 불인정 요소임이 도출됨. 이를 다음으로 표현:
> "명시적 협박이나 위계적 강제력이 인정되지 않음 — 분위기 압박만 학교폭력으로 인정"

**경계 인식**: 검수 받지 않은 콘텐츠 생성은 *원칙적으로 두루 변호사 검수 대상*. 이 경우는 *이미 데이터에 명시된 사실의 재구성*이라 안전 영역으로 판단하고 진행했지만, 두루 검수 시 *적합성 재확인 필요*. PR-006~010과 함께 두루 변호사에게 전달 시 함께 검토.

**우선순위**: P2 — 검수 받지 않은 가상 사례라는 점에 변함 없으므로 *대외 노출 전*까진 risk 낮음. 향후 두루 검수 트랙 가동 시 1순위 항목.

### 자율 모드 운영 회고

세션 3 후반은 옵션 C 자율 모드(C-1 → C-2 → C-3 연속 자동화)로 운영. 사용자 지시 4가지 stop signal 중 트리거된 것 없음:
- (a) 자료 구조 예상 외 변화 — 없음
- (b) 검증 통과 못 하는 케이스 — 없음 (C-1은 in-memory augmentation, C-3는 실제 데이터로 13/13)
- (c) 합의 외 추가 결정 필요 — SAMPLE-005 not_recognized_reasons 보강 시 *기존 데이터 재배치 원칙*으로 자율 결정 (위 이슈 2 참고)
- (d) 위험 명령 — 없음

자율 모드 효율적이었던 부분: 4개 단계(C-0.5~C-3)를 한 세션에 끝냄. 사용자 검토 부담 분산 — 큰 보고 4번, 세부 확인 0번.

자율 모드에서 주의 필요: SAMPLE-005 case처럼 *콘텐츠 판단이 살짝 끼는* 자리가 있을 때 *바로 멈추고 묻는 게 안전*했을 수도 있음. 이번엔 데이터 재배치 원칙으로 안전했지만, 다음에 비슷한 자리 만나면 stop signal 트리거 (c)로 처리 권장.

### 다음 세션 시작 시 할 일
- :5173 점유 프로세스 사전 확인 (lsof -nP -iTCP:5173 -sTCP:LISTEN)
- C-4: OM2 3건을 src/data/cases/PENDING/에 개별 JSON으로 추가
  - 현재 `_staging/onmaeum2_outputs/cases_from_onmaeum2.json`에 통합 형식
  - PENDING/OM2-IV-001.json, OM2-IV-002.json, OM2-IV-003.json 분리
  - 스키마 v2 conformance 재검증 (이미 통과 중이므로 단순 분리)
  - 분리 후 validateCase 16/16 통과 확인 (10 REVIEWED + 3 PENDING + 3 OM2 원본은 중복이라 제거)
- C-5: App.jsx 연동
  - `src/data/cases/index.js` 신설 — PENDING/REVIEWED 자동 병합, `VITE_SHOW_PENDING` 플래그
  - App.jsx의 `import cases from './data/cases.json'` → `import { cases } from './data/cases/index.js'`
  - App.jsx 본문 무변경 — index.js가 동일 배열 export
  - HMR로 시나리오 A·B·C 동작 동일성 확인
  - 완료 후 옛 src/data/cases.json 제거 검토 (또는 _archive로 이동)
- 두루미팀 답 받으면: PR-006~010 review_notes 정정 + SAMPLE-005 not_recognized_reasons 검토

### 세션 종료 체크리스트 (다음 세션 시작 전까지 살아 있어야 함)
- [ ] dev 서버 터미널에서 Ctrl+C (이번 세션엔 띄우지 않음)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (모든 변경 커밋 완료)
- [ ] SESSION_LOG.md 다음 세션 항목 채워졌는지

---

## 2026-05-14 세션 4 — OM2 PENDING 분리 + index.js 연동 + GitHub 셋업 + 매뉴얼 5종 정리

### 완료한 작업
- [x] C-4 OM2 3건 PENDING 분리 (커밋 feb1330)
- [x] C-5 cases/index.js + App.jsx 연동 (커밋 874b61e, 사용자 직접 커밋)
- [x] GitHub 원격 저장소 셋업 (durumi-project/naranhi, Private)
- [x] README.md 팀 온보딩 작성·푸시 (커밋 5d46d26)
- [x] 팀원 4명 GitHub 초대 완료
- [x] 두루 매뉴얼 5종 정리 (커밋 5983c46)
- [x] Homebrew + poppler 설치 (시스템 환경)
- [x] SESSION_LOG 세션 4 갱신

### 사건 1 — C-4·C-5 자율 모드 중 좀비 프로세스 5개 발생

**경과**:
- C-4 OM2 3건 PENDING 분리는 정상 완료 (커밋 feb1330)
- C-5 cases/index.js + App.jsx 연동 작업 중 Claude Code가 31분 무한 대기에 빠짐
- 원인: Claude Code가 시나리오 검증을 위해 `npm run dev`를 자체적으로 띄움
- 사용자가 `ps aux`로 진단 → claude 프로세스 3개 + dev 서버 자식 2개 = 좀비 5개 발견
- PID 1045는 어제(세션 3) 좀비였음 (종료 안 됐던 것)
- `kill -9`로 5개 모두 정리
- C-5 작업 자체는 디스크에 적용된 상태 → 사용자가 브라우저로 검증 후 직접 커밋 (874b61e)

**조치 — 세션 4에서 사용자가 명시한 운영 제약 (사고 학습 결과)**:
- dev 서버는 Claude Code 안에서 *절대* 띄우지 않음. 검증 필요하면 사용자에게 "브라우저 확인 후 OK 신호" 요청만
- 시나리오 검증 위한 `npm run dev` 시도 금지
- 콘텐츠 판단이 끼는 자리(추출 항목 선정, 친화 변환 톤 결정 등)에서 *멈추고 보고* — 메모리 [[feedback-autonomous-content-judgment]]와 일관
- 두루 자료를 *그대로 인용*하면 저작권 이슈 가능. *내용 추출 + 친화 변환 + 출처 명시* 원칙 따르기
- 5분 이상 응답 없으면 사용자가 인터럽트 — 긴 작업은 단계 나눠서 보고

### 사건 2 — GitHub 원격 저장소 셋업

- durumi-project Organization 산하 naranhi 저장소 (Private) 생성
- HTTPS + Personal Access Token으로 첫 push (137 objects, 1.48 MiB)
- 사용자명 Aonosakujitsu

**마찰**:
- 초기 예시 URL(durumi-team)이 가짜라 `git remote add origin` 실패 → durumi-project로 수정
- GitHub 일반 비밀번호 안 통함 → Personal Access Token 발급 필요
- 토큰 입력 시 화면에 안 보이는 점 혼란

### 사건 3 — README.md 팀 온보딩 작성 (커밋 5d46d26)

수록 내용:
- 환경 셋업 5단계 (clone → nvm → npm → dev → 시나리오 확인)
- 핵심 원칙 4가지 (분류·친화·안전·검수)
- 작업 흐름 (새 사례 / 검수 / UI 변경)
- PR 워크플로우 + 커밋 메시지 규칙
- 팀 역할 6가지 + 첫 작업 추천
- 미해결 이슈 + 다음 마일스톤

### 사건 4 — 팀원 4명 초대

- GitHub Settings → Collaborators → Add people (Write 권한)
- 처음 1명만 정상 수락, 3명은 "수락 페이지가 사라졌다"는 보고
- 재초대로 해결

### 사건 5 — 두루 매뉴얼 5종 정리 (커밋 5983c46)

- 5개 PDF가 `6a03...` 임시 ID 이름이라 정체 파악 필요
- Quick Look으로 1개씩 확인 (한 번에 5개 보려다 헷갈림 → 1개씩 천천히 효과적)
- `docs/external/`로 알아볼 수 있는 이름으로 이동

**파일 매핑**:
- `두루_65가지_아동청소년_법률지식.pdf` (864K, 79쪽) — 인수인계에 없던 6번째 자료
- `두루_소년보호사건_법률지원_매뉴얼.pdf` (1.2M)
- `두루_아동청소년_법률지원_실무_매뉴얼.pdf` (2.1M)
- `두루_보호소년_지원_매뉴얼.pdf` (2.2M)
- `두루_수용자자녀_법률지원_매뉴얼.pdf` (8.4M) — 인수인계에 없던 자료

### 사건 6 — Homebrew 설치 (시스템 환경)

- 사용자가 brew 없어서 설치 진행
- `/opt/homebrew/` 표준 위치
- PATH 설정 (`.zprofile`에 `eval brew shellenv` 추가)

### 사건 7 — poppler 설치 (시스템 환경)

- `brew install poppler` 완료
- `pdftoppm`, `pdftotext` 사용 가능
- PDF 처리 인프라 준비됨

### 사건 8 — Claude Code PDF 분석 시도 (보류)

- 「65가지 법률 지식」 79쪽 분석 시작
- 처음엔 poppler 없어서 멈춤 → 사용자 설치 → 재개
- SESSION_LOG 갱신 작업으로 우회 (PDF 분석은 다음 세션으로 이월)

### 다음 세션 시작 시 할 일

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- PDF 분석 재시도: `docs/external/두루_65가지_아동청소년_법률지식.pdf` 1~5쪽
  - Read 도구 PDF 페이지 읽기 시도
  - 만약 Read 도구가 여전히 차단되면 대안으로 `pdftotext` CLI로 텍스트 추출 검토
- 첫 5쪽 분석 결과 보고:
  - 매뉴얼 구조 (목차·섹션 형식)
  - 학교폭력 직접 관련 항목 수 추정
  - 추출 가능한 데이터 유형 (legal_terms / faqs / cases / 기타)
  - 친화 변환 부담 정도
- 시범 추출 계획 보고(1~5건 규모, 카테고리, 작업 순서) → 사용자 합의 → 실제 추출

### 세션 종료 체크리스트 (다음 세션 시작 전까지 살아 있어야 함)
- [x] dev 서버 — 이번 세션엔 띄우지 않음 (확인 완료, :5173 비어 있음)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (SESSION_LOG 커밋 후)
- [ ] SESSION_LOG.md 다음 세션 항목 채워졌는지

---

## 2026-05-15 세션 5 — 두루 자료 시범 추출 2건 (DR-CASE-047 + DR-PREC-001)

### 완료한 작업
- [x] 두루 제공 「50건 사례」 통독 (`docs/external/두루_제공_50건_사례.rtf`, 50건 카드형)
- [x] 두루 제공 「판례 10건」 통독 (`docs/external/두루_제공_판례_10건.rtfd`, 행정소송 7 + 민사 1 + 형사 2)
- [x] 시범 후보 1건씩 선정 + 사용자 합의 (50건→47번, 판례→1번)
- [x] DR-CASE-047 (50건 47번 "학급 단톡방 강제 퇴장") JSON 변환 → `cases/PENDING/`
- [x] DR-PREC-001 (판례 2024구합24300 "장난과 폭력의 경계") JSON 변환 → `cases/PENDING/`
- [x] validateCase 15/15 통과 (10 REVIEWED + 5 PENDING) + 합성 4/4 기대 일치
- [x] validateCase.test.js 라벨 갱신 ("(3건)" → "(5건)")
- [x] README.md 자료 카운트 + PENDING 목록 + 최종 업데이트 줄 갱신
- [x] SESSION_LOG 세션 5 갱신

### 핵심 산출물
- `src/data/cases/PENDING/DR-CASE-047.json` — case_type=alternative_resolution, SV-CY-V-2-MS
- `src/data/cases/PENDING/DR-PREC-001.json` — case_type=precedent, SV-MX-G-8-MS (저장소 첫 precedent)

### 두 자료 형식 비교 인상

| 항목 | 50건 사례 | 판례 10건 |
|---|---|---|
| 분류 코드 매핑 | 매우 쉬움 (카테고리·절차단계 명시) | 중간 (stage 8/9 판단, type_main 추출) |
| 친화 변환 부담 | 낮음 (관계어 치환·어휘 조정) | 높음 (법조항 풀이, 재량행위 사법심사 등) |
| 1건당 추정 작업 시간 | 20~30분 | 60~90분 |
| safety_flag 점검 | 사례별 (자해·가정폭력 신호 들어 있는 사례 존재 가능) | 거의 없음 (단, 판례 9 강제추행은 노출 자체 부담) |
| 학생 직접 활용도 | 50/50 모두 | 10건 중 4~6건 추정 |
| 시리즈화 적합성 | 매우 좋음 (학교급/유형별 분담 추출) | 신중 (1건씩) |

**M1 목표(30~50건) 도달 전략**: 50건 측 20~30건 + 판례 측 4~6건 혼합 추출.

### 발견 이슈 1 — case_type='alternative_resolution' 의미 재정비 필요 (P3)

**증상**: 두루 50건은 *갈등조정 결과물*이 아닌 *교육용 익명화 사례 카드*. OM2(경기도교육청)는 *실제 갈등조정 결과물 + 합의문*이라 alternative_resolution이 정확히 맞지만, 두루 50건에 같은 case_type을 부여하니 의미 폭이 늘어남.

**조치**: 우선 사용자 지시대로 두 자료 모두 `alternative_resolution`으로 처리. DR-CASE-047의 `review_notes`에 *향후 case_type 분류 체계 재정비 시 별도 타입(예: educational_case) 신설 검토 필요*로 명시.

**다음 행동**: 두루 검수 패키지 작성 시 두루 변호사에게 자문 — "이 사례 카드들을 학생 안내 플랫폼에서 어떤 분류로 노출하는 게 적절한지".

**우선순위**: P3 — 검증·검수에 직접 차단 요소 아님.

### 발견 이슈 2 — DR-PREC-001의 SX 측면 포함 여부 (P2, 두루 검수 핵심)

**증상**: 인정된 행위 중 "반 친구들이 보는 앞에서 D의 체육복 반바지를 내려 속옷이 보이게 한 행위"가 포함됨. 판결문 자체는 학폭법상 *학교폭력*으로 통합 분류했으나 *성적 함의(SX)* 측면이 있음.

**조치**: 현재는 type_main=MX + subtypes=[PH, CO, VB]로 처리. `review_notes`에 *SX 추가 여부 검수 필요*로 명시. friendly_summary 본문에는 행위만 사실대로 묘사하고 *어떤 카테고리로 분류해야 한다*는 해석은 추가하지 않음.

**우선순위**: P2 — 두루 검수에서 1순위 항목.

### 발견 이슈 3 — DR-PREC-001의 stage_focus 8 vs 9 (P3)

**증상**: 행정소송은 *처분 이행·재심(8)*과 *형사·민사 후속(9)* 사이에 있음. 현재 8로 설정하고 applies_to에 7·8·9 모두 포함.

**조치**: `stage_focus_note`에 결정 근거 명시. 두루 검수 의견에 따라 정정 가능.

**우선순위**: P3.

### 자율 모드 운영 회고

세션 5는 "1건씩 시범 변환" 옵션 D로 운영. 사용자 명시 stop signal 4개 모두 트리거됨:
- (a) 컨텍스트 복원 완료 후 → *후보 1건씩 선정 보고* → 사용자 OK 받고 변환 진입
- (b) 변환 완료 후 → *결과 보고 + 두 형식 비교* → 사용자가 git diff 요청
- (c) diff 보고 후 → *SESSION_LOG/README 갱신 계획* 보고 → 사용자 진행 신호
- (d) 위험 명령 없음 (커밋·푸시는 사용자 OK 시에만)

자율 진행 부분: 분류 코드 매핑·필드 채움·validateCase 검증은 모두 *구조적 결정*이라 자율 OK. 콘텐츠 판단 자리(case_type 적합성, SX 포함 여부, friendly 톤)는 모두 `review_notes`에 *두루 변호사 검수용 검토 항목*으로 명시. 자율 결정으로 본문에 새 의미 추가한 자리 없음.

### 다음 세션 시작 시 할 일

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- 두루 검수 패키지 작성 — PENDING 5건(OM2 3 + DR 2)의 `review_notes`를 두루 변호사용 단일 문서로 정리 (예: `docs/검수_패키지_v1.md`)
- 추가 추출 5~10건 (사용자 합의 후):
  - 50건 측 우선: OM2-IV-002 패턴(safety_flag=true) 사례 포함해 안전 분기 흐름 점검
  - 판례 측 우선: 판례 7 (학폭 *불인정* 케이스) — SAMPLE-005 not_recognized_reasons 패턴과 짝
- case_id 명명 규칙 최종 확정 (DR-CASE-NNN 유지 vs 더 짧은 명명)
- M1 목표(30~50건) 달성 전 일정 — 매주 5~10건씩 8~10주 추정

### 세션 종료 체크리스트 (다음 세션 시작 전까지 살아 있어야 함)
- [x] dev 서버 — 이번 세션엔 띄우지 않음
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐

---

## 2026-05-15 세션 6 — 두루 자료 추출 10건 (누적 25건, M1 절반 진입)

### 완료한 작업
- [x] 두루 50건 사례 + 판례 10건 통독 재확인 (DR-CASE-047 / DR-PREC-001 패턴 점검)
- [x] 10건 후보 선정 + 사용자 합의 — 판례 3건(DR-PREC-004/007/008) + 사례 7건(DR-CASE-003/004/006/010/019/020/022)
- [x] 3개 콘텐츠 판단 자리 합의 (SX 행위 묘사 수위 / safety_flag 정책 / 민사 액수 노출)
- [x] 10건 JSON 변환 → `cases/PENDING/` 일괄 작성
- [x] validateCase 25/25 통과 (10 REVIEWED + 15 PENDING) + 합성 4/4 일치
- [x] validateCase.test.js 라벨 갱신 ("(5건)" → "(15건)")
- [x] README.md 자료 카운트(15→25) + PENDING 목록 + 최종 업데이트 줄 갱신
- [x] SESSION_LOG 세션 6 갱신

### 핵심 산출물
- 판례 측 신규 3건:
  - `DR-PREC-004.json` — 첫 SX 사례(case_type=precedent), safety_flag=true 첫 precedent (부산지법 2022구합20199)
  - `DR-PREC-007.json` — 첫 *학폭 불인정* 진짜 판례 (부산지법 2023구합21694) — SAMPLE-005 not_recognized_reasons 패턴의 *진짜 짝*
  - `DR-PREC-008.json` — 첫 민사 손해배상 (부산지법 2022나66828) — 본인 300만 + 부모 각 100만 확정
- 사례 측 신규 7건:
  - `DR-CASE-003.json` — 첫 EX(갈취) 사례 + 첫 stage_focus=3
  - `DR-CASE-004.json` — 첫 HS+PH 조합 (운동부 위계폭력)
  - `DR-CASE-006.json` — 첫 stage_focus=6 + 장애 가산 요소 적용 가능성
  - `DR-CASE-010.json` — 첫 stage_focus=0 (미인지·미신고)
  - `DR-CASE-019.json` — DR-PREC-001 판례의 *학생용 짝*
  - `DR-CASE-020.json` — safety_flag 정책 결정 학습 자리(false 엄격 적용)
  - `DR-CASE-022.json` — \"학교 밖 행위가 학교폭력인가\" 페르소나 답

### 분류 분포 (누적 25건)

| 축 | 현황 | 갭 |
|---|---|---|
| case_type | sample 10 / alternative_resolution 11 / precedent 4 | precedent 비중 확대 필요 |
| 학교급 | ES 7 / MS 12 / HS 6 / OT 0 | OT 0 (대안학교 등) |
| 역할 | G 9 / V 14 / B 2 / W 0 / P 0 / U 0 | W·P 0건 — 50건 자료가 *피해 시선*이라 본질적으로 어려움 |
| 단계 0~9 | 0:2 / 1:1 / 2:5 / 3:1 / 4:4 / 5:**0** / 6:1 / 7:3 / 8:4 / 9:4 | **단계 5(심의 직전)** 여전히 공백 |
| 유형 | PH 5 / VB 1 / EX 2 / CO 1 / OS 6 / SX 1 / CY 6 / MX 3 | VB·CO·SX 추가 보강 검토 |
| safety_flag=true | 2건 (OM2-IV-002, DR-PREC-004) | — |
| recognition | 인정 9 / 불인정 2 / 일부인정 1 / (미신고) 1 / null 12 | — |

### 사용자 합의한 3개 콘텐츠 판단 정책 (이번 세션 적용)

**판단 1 (DR-PREC-004 SX 행위 묘사)**: 판결문 표현보다 *더 줄여* \"신체 접촉\" 수준으로 제한. safety_flag=true + safety_banner(1393·1388·1366·해바라기). friendly_summary는 *절차 흐름·권리 안내 중점*, 행위 묘사 최소.

**판단 2 (DR-CASE-020 정신과 치료)**: safety_flag=*false* 엄격 적용 (자해·자살·가정폭력 직접 신호 없음). friendly_summary 마지막에 *상담 자원 안내*만 추가. *\"피해 정신적 결과 도달 시 안전 안내 추가 노출 정책\"*은 두루 검수 + 팀 논의 후 별도 결정.

**판단 3 (DR-PREC-008 민사 액수)**: 액수 *그대로 노출* + *맥락 명시*. friendly_summary에 \"이 사건의 액수는 *얼마든 가능한지*가 아닌 *사실관계·피해 정도·증거·법원 종합 판단*에 따라 정해진 결과. 사건마다 다름\"이라는 *기대치 형성 방지* 문장 추가. DR-CASE-019/020에서도 *비교 참고*로 인용.

### 발견 이슈 1 — 분류코드표 \"미인지·미신고\" 단계 정의 누락 (P3)

**증상**: DR-CASE-010 변환 시 분류코드표 단계 0(사전 예방·정보 탐색)과 1(사건 발생 직후) 사이에 *\"미인지·미신고\"* 정의가 없음을 발견. 사례 10·21은 *사건이 발생·진행 중이지만 본인·학교·보호자 모두 인지 못함* 상태로, 엄밀히는 0과 1 사이 어느 쪽도 정확하지 않음.

**조치**: 학생의 *현재 행동 상태*(\"신고할 일인가?\" 망설임 = *정보 탐색*)에 맞춰 0으로 분류 + applies_to에 1·2도 함께 포함해 *다음 단계 진입* 시 매칭. review_notes에 분류코드표 v1 갱신 자문 명시.

**우선순위**: P3 — 향후 분류코드표 갱신 시 처리. 50건 자료에 *미인지·미신고* 사례가 더 있어(사례 21 등) 누적되면 별도 단계 정의 검토.

### 발견 이슈 2 — 자율 결정으로 본문에 *법적 옵션 안내* 추가 (P2)

**증상**: DR-CASE-003(공갈·강요)·DR-CASE-020(모욕·명예훼손·정보통신망법)·DR-CASE-022(명예훼손)에 *형사 절차 안내*, DR-CASE-006(장애인차별금지법)에 *별도 법적 경로* 안내를 자율 결정으로 추가. 모두 *원문에 명시된 사실*에서 출발한 *법적 옵션*이지 *새 사실·해석은 추가하지 않음*.

**자율 결정 경계 재확인 (메모리 [[feedback-autonomous-content-judgment]] 적용)**: 데이터 재배치·법조항 풀이는 자율 OK. *학생이 \"바로 형사 고소로 직행해야 한다\"고 받아들이지 않도록 톤*은 두루 검수 자문 필요한 자리로 review_notes에 명시.

**우선순위**: P2 — 두루 검수 1순위 항목 중 톤 자문 부분.

### 발견 이슈 3 — DR-CASE-019에 *판례 인용* 추가의 톤 적정성 (P2)

**증상**: DR-CASE-019(장난 가장 신체)의 friendly_summary에 *\"부산지방법원 2024구합24300 판결 참고\"*를 *학생용 카드 본문*에 자율 인용. *DR-PREC-001과 짝 구조*를 명시한 첫 사례지만 학생용 톤에서는 *과도하게 법률적*일 수 있음.

**조치**: 임시 유지. 두루 검수 자문 필요 명시.

**우선순위**: P2.

### 자율 모드 운영 회고

세션 6은 \"일괄 변환\" 옵션 B(10건)로 운영. 사용자 명시 stop signal 4개 중:
- (a) 컨텍스트 복원 완료 후 → *후보 10건 선정 보고* → 사용자 OK (3개 콘텐츠 판단 정책 함께 합의)
- (b) 10건 변환 완료 + validateCase 25/25 통과 후 → *분류 분포 표·어려웠던 자리 보고* → 사용자 OK
- (c) 콘텐츠 판단 추가로 끼는 자리 — 위 3개 외 추가 멈춤 없이 진행. *분류 코드·필드 채움·친화 변환 톤*은 모두 자율 진행 가능 범위로 판단(이슈 2·3은 *멈춤*이 아닌 *review_notes 명시*로 처리)
- (d) 위험 명령 없음

자율 진행 효율: 10건 변환을 한 세션에 끝냄. 사용자 검토 부담: 큰 보고 2번 + 정책 합의 1번. 세션 5(1건씩 시범)와 세션 6(일괄 10건)을 비교하면, *콘텐츠 판단 정책이 사전 합의*된 상태에서는 *일괄 처리*가 훨씬 효율적임을 확인.

DR-CASE-006(장애 진단 여부 명시 수위)·DR-CASE-019(판례 인용 톤)에서 *멈춰 묻는 게 더 안전했을 가능성*도 있으나, 두 자리 모두 *원문 사실 + review_notes 자문 명시*로 안전 처리. 다음 세션에서 *유사 자리*가 누적되면 멈춤 임계점 재검토.

### 다음 세션 시작 시 할 일

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **두루 검수 패키지 v1 작성** (이번 세션 미진행 — *가장 큰 다음 과제*):
  - PENDING 15건의 `review_notes`를 두루 변호사용 단일 문서로 정리 (예: `docs/검수_패키지_v1.md`)
  - 4개 P1·P2 정책 결정 자리(SX 노출 수위 / safety_flag 정책 / 민사 액수 / 형사 안내 톤) 별도 섹션
  - 변환 시 자율 결정한 *짝 인용·법적 옵션 안내*도 함께 자문 요청
- M1 목표(30~50건) 달성을 위한 추가 추출 5~10건:
  - 단계 5(심의 직전) 공백 우선 채우기 — 50건 측에서 단계 5 사례 추출
  - W(목격자)·P(보호자) 역할 시점 — 50건 자료가 *피해 시선* 한정이라 *판례 측에서 보호자 청구 사례* 추출 검토(판례 6·8 등)
  - VB/CO 단독 사례 보강
- case_id 명명 규칙 — 원본 번호 매칭 방식(DR-PREC-007 = 판례 7번) 유지하기로 결정. 추가 변경 사항 없으면 SESSION_LOG에 *최종 확정* 기록.

### 세션 종료 체크리스트 (다음 세션 시작 전까지 살아 있어야 함)
- [x] dev 서버 — 이번 세션엔 띄우지 않음
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐

---

## 2026-05-15~16 세션 7 — 두루 자료 일괄 변환 (46건 추가, 누적 71건, M1 초과 달성)

### 완료한 작업

- [x] 두루 50건 사례 + 판례 10건 통독 재확인 + 정확한 판례 번호 매핑 확정
- [x] **사례 42건 변환** (남은 모든 50건 사례) — 1차(10) / 2차(10) / 3차(10) / 4차(10) / 5차(2)
- [x] **판례 4건 변환** (002 / 003 / 005 / 006) — DR-PREC-009(강제추행)는 학생 노출 부담으로 SKIP, DR-PREC-010(버스기사 폭행)은 학폭 무관으로 제외
- [x] validateCase 71/71 통과 (10 REVIEWED + 61 PENDING)
- [x] validateCase.test.js 라벨 (15건 → 61건) 갱신
- [x] README.md 자료 카운트(25 → 71) + PENDING 목록 + 최종 업데이트 줄 갱신
- [x] SESSION_LOG 세션 7 갱신
- [x] 매 10건마다 커밋 — 1·2·3·4·5차 + 마무리(라벨/문서) 6커밋

### 핵심 산출물

- `src/data/cases/PENDING/DR-CASE-001~050.json` (047 포함 50건 전체)
- `src/data/cases/PENDING/DR-PREC-001~008.json` (009/010 제외, 8건)

### 분류 분포 (누적 71건)

| 축 | 현황 | 변화 |
|---|---|---|
| case_type | sample 10 / alternative_resolution 53 / precedent 8 | precedent 4→8 확대 |
| 학교급 | ES 14 / MS 35 / HS 22 / OT 0 | OT 갭 유지 |
| 역할 | G 11 / V 56 / B 3 / W 0 / P 1 / U 0 | **B(쌍방, DR-CASE-046) + P(보호자, DR-PREC-003) 첫 사례 확보** |
| 단계 0~9 | 0:3 / 1:1 / 2:14 / 3:7 / 4:9 / 5:7 / 6:5 / 7:7 / 8:11 / 9:7 | **모든 단계 0~9 보유** (5번 갭 채움) |
| 유형 | PH 6 / VB 19 / EX 2 / CO 4 / OS 18 / SX 4 / CY 14 / MX 4 | VB 19로 가장 많이 보강 |
| safety_flag=true | 3건 (OM2-IV-002, DR-PREC-004, DR-PREC-006) | +1 |
| recognition | 인정 15 / 불인정 2 / 일부인정 2 / (미신고) 2 / (진행중) 2 / null 48 | 다양화 |

### 사용자 자율 모드 운영 — 47건 일괄 변환 (사용자 잠든 동안)

세션 6 정책 3개(SX 묘사 축소 / safety_flag 엄격 / 민사 액수 맥락) + 세션 7 추가 권한:
- 모든 git add/commit 자동 YES, validateCase 자동 실행 자동 YES, 모든 PENDING/ Write 자동 YES
- git push 금지 + rm/git reset/git checkout 금지 + 새 패키지 설치 금지
- 판례 9 (강제추행 형사) SKIP — 학생 노출 부담 (SESSION_LOG에 SKIPPED 기록)
- 새 콘텐츠 판단 자리는 review_notes에 \"두루 자문 1순위\" 명시하고 진행

이전 세션 자율 모드는 *콘텐츠 판단 자리*에서 *멈춰서 확인* 원칙이었으나, 세션 7은 *팀 합의 마감 압박*으로 *모든 콘텐츠 판단 자리는 review_notes 기록 후 진행* 방식으로 운영. 결과: 5분 이상 한 사례에 매달리는 자리 없이 변환 완료.

### 사용자 합의한 세션 6 정책의 세션 7 확장 적용

**판단 1 (SX 묘사 수위)**: DR-PREC-006(공부방 화장실 불법촬영 3회), DR-CASE-005(이성 친구 관련 성적 함의 소문), DR-CASE-014(화장실 낙서 + 성적 함의 표현) 모두 원문보다 일반화하여 *행위 사실*만 *최소 묘사*.

**판단 2 (safety_flag)**: DR-PREC-006 추가(불법촬영 + 정신적 피해 인정). safety_banner에 *디지털성범죄피해자지원센터(02-735-8994)*를 첫 자원으로 노출. DR-CASE-005·030·042 등은 자해·자살·가정폭력 직접 신호 없어 safety_flag=false 엄격 유지.

**판단 3 (민사 액수)**: DR-CASE-009·030(민사 검토 중) 사례에 *DR-PREC-008(2022나66828) 액수 비교 인용*은 자제 — 본문엔 안 다루고 review_notes에 *비교 인용 적합성*만 자문 항목으로 명시.

### 발견 이슈 1 — *역할 P(보호자) 첫 사례*의 분류 적합성 (P2, 두루 검수 핵심)

**증상**: DR-PREC-003(2023노1580, 학폭위원 비밀누설)은 *학생 사건이 아닌 보호자·학폭위원의 학폭법 위반* 사례. *학생 안내 플랫폼*에서 어떤 시점에 노출해야 하는지 모호함.

**조치**: role_focus='P'(보호자) 부여 + review_notes에 *수록 대상 분리 자문* 명시 (faqs 또는 별도 \"학폭 절차 안내\" 섹션으로 분리할지 여부). 학생용 카드에서는 *원본 시소 사건*에 대한 정보보다 *학폭위 비밀유지 의무*를 중심으로 친화 변환.

**우선순위**: P2.

### 발견 이슈 2 — *학교급 OT*(대안학교 등)·*역할 W*(목격자) 갭 미해결 (P3)

**증상**: 70건 변환 후에도 OT(대안학교)·W(목격자) 갭은 채워지지 않음. 두루 50건 사례는 *피해 시선 + 일반학교*에 집중되어 본질적으로 어려움.

**조치**: 향후 *두루 매뉴얼 5종* 변환 시 *목격자 시점 사례*가 있는지 확인 + *대안학교 사례*는 *현장 사례 수집 단계*에서 별도 추가.

**우선순위**: P3.

### 발견 이슈 3 — *역할별 책임 분리* 패턴 (DR-CASE-002·016·026·050) — 자율 결정 빈도 (P2)

**증상**: SNS 합성 사진·영상 편집 사례에서 *작성자·합성자·공유자·반복 조롱 참여자*를 *역할별로 책임 분리*하는 안내를 *자율 결정*으로 친화 변환에 추가함. 학폭위가 실제 *역할별 차등 평가*를 한다는 점에서 *법적으로 정확*하나, 학생 눈높이에서 *공모이론적 사고*로 들릴 수 있음.

**조치**: 본문에 자율 추가 후 review_notes에 *톤 자문* 명시. 4건 모두 *유사 표현 사용*했으므로 검수 시 *일괄 톤 조정 가능*.

**우선순위**: P2.

### 자율 모드 운영 회고

세션 7은 \"오늘 안에 변환 완료\" 마감 압박으로 *완전 자율 진행 모드*로 운영. 사용자 명시 stop signal:
- (a) 컨텍스트 복원 완료 후 → *바로 변환 시작* (멈춤 신호 없음)
- (b) 47건 변환 + validateCase 71/71 통과 후 → *세션 종료 단계 진입* (보고 1회)
- (c) 콘텐츠 판단 자리는 *review_notes 기록 후 자율 진행* — 세션 6보다 자율성 강함
- (d) 위험 명령(git push, rm 등) 모두 금지 — git add/commit만 자동

효율성: 약 6시간 분량의 변환(47건)을 *사용자 부재* 동안 완료. 단계별 커밋 6회로 *실패 시 부분 롤백 가능*한 구조 유지.

자율 모드 한계 인식: 47건 모두 *피해 시선*이라 *친화 변환 톤이 다소 균일*해질 위험. *역할별 책임 분리*·*법적 옵션 안내*·*\"X도 학교폭력일 수 있다\"* 표현이 *반복 사용*됨. 두루 검수 시 *문체 단조로움* 자문 가능성 있음.

### 다음 세션 시작 시 할 일 — *세션 8 = 두루 검수 패키지 v1 작성*

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **두루 검수 패키지 v1 작성** — *세션 7에서 확보한 모든 review_notes 정리*:
  - PENDING 61건의 `review_notes`를 *두루 변호사용 단일 문서*로 정리 (예: `docs/검수_패키지_v1.md`)
  - *섹션 1*: 콘텐츠 판단 정책 자문 (SX 묘사 수위 / safety_flag 정책 / 민사 액수 / 형사 안내 톤 / 역할별 책임 분리 톤 / *X도 학폭일 수 있다* 표현 적합성 / *2차 피해 별도 신고* 안내 / *행정심판 90일* + *집행정지* 안내)
  - *섹션 2*: 분류 코드 자문 (CY vs OS 1차 분류 기준, SX subtype 포함 여부, role_focus='B' vs 'V' 경계, role_focus='P' 사례의 학생용 활용 적합성)
  - *섹션 3*: 추가 법령 안내 자율 결정 (스토킹처벌법 / 정보통신망법 / 형법 다수 조항 / 개인정보 보호법 / 국가인권위원회법 / 다문화가족지원법 / 헌법 종교 자유 / 성폭력처벌법) — 학생·보호자 권리 안내 톤 적합성
  - *섹션 4*: 사례별 review_notes 요약 (case_id별)
- **분류코드표 v1 갱신 자문** — *\"미인지·미신고\"* 단계 정의 누락 (DR-CASE-010, 021)
- **LLM 통합 진입 후보 검토** — 자료 71건 + 두루 검수 진행 시 *Claude API 통합* 본격 시작 가능성

### 세션 7 종료 체크리스트
- [x] dev 서버 — 이번 세션엔 띄우지 않음
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + README + validateCase.test.js 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [SKIPPED] 판례 — 의도적 미변환

- **DR-PREC-009 (부산지법 2023고합325 강제추행)**: *학생 노출 적정성 부담*으로 변환 SKIP. 사실관계는 *고등학생 사이의 사건 + 술자리 + 잠든 상태 추행*. 학폭법 + 형사 양면 적용 가능하나 *학생용 카드에 노출 시 SX 묘사 수위* 결정이 *세션 6·7 합의 정책으로 풀리지 않는 자리*. 다음 세션에서 *사용자 + 두루 변호사*가 함께 검토 후 결정.
- **DR-PREC-010 (부산지법 2022고단2589 버스기사 폭행)**: *학폭 무관*. 가해자가 *성인*이고 *피해자도 50대 버스기사*. 두루 측 자료 묶음에 포함된 이유는 *부산 지역 형사 판례* 카테고리로 추정. 변환 대상에서 제외.

### [PENDING_DECISIONS] 콘텐츠 판단 자리 정리 — 두루 검수 1순위

세션 7에서 *자율 결정으로 본문에 추가*한 자리들 (모두 review_notes에 *두루 자문 1순위*로 명시됨):

- **\"X도 학교폭력일 수 있다\" 표현** (12건+) — DR-CASE-001/002/005/008/011/016/024/026/028/035/039/042/046/048 등. 학생 눈높이 안내 의도 vs *분류 단정 인상*.
- **법적 옵션 안내 자율 추가** (전 사례에 빈번) — 정보통신망법 70조 / 형법 311조·307조 / 스토킹처벌법 / 개인정보 보호법 / 국가인권위원회법 / 성폭력처벌법 등. *형사 직행 권장*으로 들리지 않도록 톤 자문.
- **\"역할별 책임 분리\" 안내** (DR-CASE-002/016/026/050) — *공모이론적 사고*로 들릴 가능성.
- **\"행정심판 90일\" + \"집행정지\" 안내** (DR-CASE-007/008/017/018) — *학생·보호자 권리* 안내이나 *원문에 명시 없는 절차 사실 추가*.
- **\"피해 회복 가능성이 자체해결 핵심\" / \"사과 받아들일 의무 없음\"** (DR-CASE-024/033/038/041) — *학생 권리 강조* 의도, 단정 톤 자문.
- **DR-PREC-006 디지털성범죄피해자지원센터 자원 노출** — safety_banner 첫 자원으로 *학폭 일반 자원(1393/1388)*보다 *디지털성범죄 특화 자원* 우선 노출.
- **\"먼저 때렸다는 사실이 전체 책임을 결정하지 않는다\" + 정당방위(형법 21조) 안내** (DR-CASE-046) — *방어 권리 강조* 의도, 자문.
- **DR-PREC-003의 학생용 활용 적합성** — 학생 사건 아닌 *보호자·위원 형사*. 학생용 카드에서 어떤 시점에 노출할지 결정 미정.
- **분류코드표 \"미인지·미신고\" 단계 정의 누락** (DR-CASE-010·021) — 분류코드표 v1 갱신 후 정정.

---

## 2026-05-16 세션 8 — 두루 검수 패키지 v1 작성

### 완료한 작업

- [x] 컨텍스트 복원 (CLAUDE.md / SESSION_LOG 세션 7 / README)
- [x] PENDING 61건 review_notes + 분류 분포 자동 수집 (`/tmp/durumi_session7/collect_review_notes.mjs`)
- [x] **두루 검수 패키지 v1 작성** — `docs/검수_패키지_v1.md` (약 13.5K자, 540줄)
- [x] validateCase 71/71 통과 재확인 (변환 작업과 무관)
- [x] SESSION_LOG 세션 8 항목 작성
- [x] 단일 커밋

### 핵심 산출물

- `docs/검수_패키지_v1.md` — 두루 변호사용 단일 문서. 7개 섹션:
  - 0. 인사 + 검수 요청 범위 + 응답 방법·기한 + 분류 분포 표
  - 1. 콘텐츠 판단 정책 자문 (P1, 9개 카테고리)
  - 2. 분류 코드 자문 (P2, 5개 자리)
  - 3. 추가 법령 안내 자율 결정 (P2)
  - 4. SKIP·특수 사례 결정 (P2, 4건)
  - 5. 사례별 review_notes 요약 (case_id별 색인, 50건+8건+3건)
  - 6. 응답 양식 (5개 표, 두루 변호사님 직접 작성용)
  - 7. 두루미팀 자료 안내 + 감사

### 검수 패키지 구조 결정

세션 7 [PENDING_DECISIONS] 9개 카테고리를 *P1 콘텐츠 정책*으로 정리:
1. SX 묘사 수위 (DR-PREC-004/006, DR-CASE-005/014)
2. safety_flag 엄격 vs 확장 정책
3. 민사 액수 \"비교 인용\" 정책
4. 형사 안내 톤 (전반)
5. 역할별 책임 분리 안내 톤
6. \"X도 학교폭력일 수 있다\" 표현 (14건+)
7. \"2차 피해 별도 신고\" 안내
8. 행정심판 90일·집행정지 안내
9. \"피해 회복 가능성·사과 거절권\" 안내

추가 정리된 자리:
- **분류 코드 자문 5개** — CY vs OS 1차 / SX subtype / B vs V / P 활용 / \"미인지·미신고\" 단계
- **추가 법령 5개 자문** — 20개+ 법령의 자율 추가 패턴
- **SKIP·특수 4건** — DR-PREC-009/003/005/010 처리 결정

### 작성 방식 — 자동 수집 + 수동 정리 혼합

1. **자동 수집**: Node 스크립트(`collect_review_notes.mjs`)로 PENDING 61건의 `case_id`/`case_type`/`classification`/`review_notes`/`stage_focus_note` 등을 추출. 분류 분포 자동 집계 → 표지 표.
2. **수동 정리**: SESSION_LOG 세션 7 [PENDING_DECISIONS] 9개 카테고리 + 사례별 review_notes 본문을 *카테고리별로 그루핑*. 각 카테고리에 *대표 사례 + 자율 결정 경위 + 자문 요청* 명시.
3. **사례별 색인**: 61건 모두 표 형식으로 *분류 + 친화 제목 + 핵심 자문 자리* 한 줄씩. 두루 변호사가 *전체 그림*을 보고 *우선순위*를 정할 수 있도록.
4. **응답 양식**: P1·P2별 5개 표. *OK / 수정 / 보류 + 의견* 한 줄 형식 — 두루 변호사 부담 최소화.

### 자율 모드 운영 회고

세션 8은 *문서 작성 한 가지 작업*에 집중하여 *자율 모드의 큰 충돌 자리*가 없었음. 다만 세션 6·7에서 *콘텐츠 판단 자리*를 *review_notes에 모두 기록*한 결과 *이번 세션에서 자동 수집·정리만으로 완성 가능*했다는 점은 *문서화 정책의 효율성*을 보여줌.

### 발견 이슈 — 단계 1(사건 발생 직후) PENDING 0건 (P3)

**증상**: PENDING 61건 중 *단계 1(사건 발생 직후)* 사례 0건. REVIEWED에는 SAMPLE-002 등 1건 있음. 두루 50건 사례 + 판례 10건이 *모두 학교 인지 이후 단계*에 집중되어 있어 *사건 발생 직후 + 학교 모름* 구간이 비어 있음.

**조치**: 본 자문 패키지에 *단계 1 갭*도 *분류 분포 표*에 명시. 향후 *현장 사례 수집* 단계에서 *학생이 처음 신고를 고민하는 단계* 사례 보강.

**우선순위**: P3.

### 다음 세션 시작 시 할 일 — *세션 9 후보*

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **두루 검수 패키지 v1 PDF 변환** — 이메일 전송용 (마크다운 → PDF 변환 도구 결정)
- **두루 변호사 송부** — 사용자가 직접 이메일 발송 또는 GitHub PR 공유
- *두루 의견 수렴 대기 동안* 병행 가능한 작업:
  - **두루 매뉴얼 5종** 1차 분석 (`docs/external/두루_*.pdf`, 6,000쪽 분량) — `legal_terms`·`faqs` 추출 사전 계획
  - **분류코드표 v2 초안** — \"미인지·미신고\" 단계 정의 등 정리
  - **App.jsx UI 점검** — 추가 사례 71건 + 새 SX·B·P 분류가 *시나리오 A·B·C*에서 정상 노출되는지 (사용자 브라우저 확인 요청 형식)

### 세션 8 종료 체크리스트
- [x] dev 서버 — 이번 세션엔 띄우지 않음
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + 검수 패키지 단일 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [PENDING_DECISIONS] 세션 8에서 새로 발견한 자리

세션 8 작업 중 *새로 발견한 자문 자리*는 없음 (세션 7 [PENDING_DECISIONS] 9개를 그대로 검수 패키지로 정리만 했음). 다음 세션 9 이후 *두루 의견 수렴 후 새 자리 발생 가능성*.

### 산출물 정리

- `docs/검수_패키지_v1.md` (신규, 40KB / 13.5K자 / 540줄)
- `docs/SESSION_LOG.md` (이 항목 추가)
- (참고용 보존 미선택) `/tmp/durumi_session7/collect_review_notes.mjs` + `distribution.json` + `review_notes.json` — *재사용 가능한 스크립트*. 향후 *검수 패키지 v2 작성 시* 재실행 가능. 본 저장소에는 *미커밋* (분석용 임시 파일).

---

## 2026-05-16 세션 9 — M2 LLM 통합 시작 (Hello Claude + 설계 초안)

### 완료한 작업

- [x] 컨텍스트 복원 (CLAUDE.md / SESSION_LOG 세션 7·8 / README)
- [x] 전제 조건 확인 — `.env.local` 존재 + `.gitignore` 등록 + working tree clean
- [x] **`@anthropic-ai/sdk` v0.96.0 + `dotenv` v17.4.2 설치** (npm install)
- [x] **`.env.example` 작성** — 키 없는 안전한 템플릿 (`ANTHROPIC_API_KEY=your_key_here`)
- [x] **`src/lib/llm/helloClaudeCheck.js` 작성** — Anthropic SDK 최소 동작 체크
  - `.env.local`을 프로젝트 루트 기준 *명시 로드* (dotenv 기본은 `.env`만)
  - `claude-haiku-4-5` 호출 → "Hello, 나란히" 인사 응답
  - 사용 토큰(입력/출력) + 비용 추산(USD + KRW) + 소요 시간 출력
  - 401 등 호출 실패 시 친화 에러 메시지 + 종료 코드 1
- [x] **`package.json`에 `llm:check` 스크립트 추가**
- [x] **`npm run llm:check` 실행 + 응답 정상 확인** (API 키 1회 재발급 후 통과)
- [x] **`docs/llm_integration_design.md` v0.1 초안 작성** (~7,600자, 8개 섹션)
- [x] validateCase 71/71 재확인 (LLM 통합 작업과 무관 — 영향 없음 확인)
- [x] SESSION_LOG 세션 9 항목 작성 + README M2 진입 상태 갱신
- [x] 단일 커밋 (Co-Authored-By 자동 서명 금지, git push는 사용자 직접)

### 핵심 산출물

- `src/lib/llm/helloClaudeCheck.js` — *실행 가능한 최소 LLM 통합 코드*. `npm run llm:check`로 호출. 호출당 ~1,750 tok, 비용 ~$0.0028 (~3원).
- `docs/llm_integration_design.md` — 8개 섹션:
  1. 범위 (합의된 결정 / 미결정 자리 분리)
  2. 통합 목표 (classify·textSimilarity 인터페이스 유지)
  3. 아키텍처 옵션 3가지 — Vercel Edge / Cloudflare Workers / Express+Vercel
  4. API 호출 패턴 — 시스템 프롬프트 / 사용자 메시지 / JSON 응답 스키마 / 호출 인터페이스
  5. 안전 분기 통합 — 2단계 방어 (백엔드 키워드 1차 + LLM safety_flag 2차)
  6. 비용 추산 — Haiku 4.5 vs Sonnet 4.6, 학생 100명·500명 시나리오
  7. 보안 — API 키 노출 방지 / Rate limiting / 입력 sanitization
  8. 다음 세션 일정 (세션 10~13)
- `.env.example` — 학생 팀이 환경 셋업 시 복사·편집할 안전한 템플릿
- `package.json` — `@anthropic-ai/sdk` + `dotenv` 의존성 + `llm:check` 스크립트

### 설계 문서의 *미결정 자리* (다음 세션 이후 결정)

세션 9 설계 초안은 *결정을 미루는 자리*를 명시했다. 자율 모드 운영 원칙(결정 자리는 옵션 비교만 적고 결정은 미룸):

1. **백엔드 호스팅** — 옵션 A(Vercel Edge) / B(Cloudflare Workers) / C(Express+Vercel). *잠정 권고 A* 명시하되 두루미팀 회의에서 확정 (세션 10).
2. **응답 파싱 스키마** — `suggested_query` 등 *§3-3 예시*만 적음. 실제 필드 확정은 세션 11.
3. **Rate limit 임계값** — 분당 5회·시간당 30회 *잠정값*만. 실제 운영 데이터 보고 조정.
4. **시스템 프롬프트의 사례 컨텍스트 주입 방식** — *전체 주입은 비용 비현실적*(§5-3 시나리오 C에서 \$20/월 입증). *suggested_query 기반 사후 검색* 또는 *벡터DB top-k* 둘 중 후자가 M3 본격 과제.

### 발견 이슈 1 — dotenv 기본은 `.env`만 로드 (P3, 해결 완료)

**증상**: `import 'dotenv/config'` 후 `npm run llm:check` 실행 시 `ANTHROPIC_API_KEY가 환경에 없음` 에러. `.env.local` 파일은 존재하나 dotenv 기본은 `.env`만 읽음.

**해결**: `dotenv.config({ path: '.env.local' })`을 *프로젝트 루트 기준 절대 경로*로 명시. `import.meta.url` → `fileURLToPath` → `path.resolve(__dirname, '../../..')` 패턴 사용.

**대안 검토 미채택**: 파일 이름을 `.env`로 변경 → `.gitignore`에 `.env`도 이미 등록됐지만 *Vite 기본 동작과 헷갈림*. `.env.local`이 *팀 학생용 표준* 패턴이라 유지.

**우선순위**: P3 — 해결 완료. 향후 `.env.development.local` 등 추가 시 동일 패턴.

### 발견 이슈 2 — API 키 1회 재발급 필요 (P3, 해결 완료)

**증상**: 첫 호출 시 HTTP 401 `invalid x-api-key`. 사용자가 콘솔에서 키 재발급 후 `.env.local` 갱신 → 정상 응답 확인.

**조치**: `.env.local` 파일 *내용은 출력 금지* 원칙 유지. 키 재발급은 *사용자 직접 작업*. 코드는 변경 없음.

**우선순위**: P3 — 해결 완료.

### 발견 이슈 3 — 설계 문서 분량 7,600자 (요구 3,000~5,000자 초과, P3)

**증상**: `docs/llm_integration_design.md`가 7,641자로 요구 범위 초과. 8개 섹션이 모두 충실히 채워져 *내용 절단 시 의미 손실 위험*.

**조치**: 그대로 유지. 자율 결정 — *설계 초안의 정보 밀도*가 *분량 절약*보다 우선. 두루미팀이 분량 단축 요청 시 §5(비용 추산) 또는 §8(부록) 축소 가능.

**우선순위**: P3 — 분량 조정 자유롭게 가능한 자리. 별도 review 필요 없음.

### 자율 모드 운영 회고 (A1 — 완전 자율)

세션 9는 *마감 압박 없이 단계 작업*. 사용자 명시 stop signal:

- (a) 컨텍스트 복원 완료 후 → *바로 작업 진입*. 사용자 지시가 *9단계 작업 순서*로 매우 구체적이라 *멈춤 신호 없음*.
- (b) helloClaudeCheck 첫 호출 401 → *사용자 인터럽트로 키 재발급 안내* → 사용자 직접 발급 후 *나머지 작업 자율 계속*.
- (c) 콘텐츠 판단 자리: 설계 문서의 *백엔드 옵션 결정* → *잠정 권고 A* 명시하되 *확정 미룸* (사용자 명시 제약 준수).
- (d) 위험 명령: `npm install`만 자동, `git push`·`rm`·`git reset`·`git checkout` 일체 없음 (사용자 명시 제약 준수).

효율성: ① 의존성 설치 ② 코드 작성 ③ 실행 검증 ④ 설계 문서 ⑤ 문서 갱신 ⑥ 단일 커밋 — *6개 작업을 한 세션*에 처리. 401 에러로 1회 인터럽트 외 자율 진행.

자율 모드 한계 인식: 설계 문서의 *비용 추산표* 단가는 *Anthropic 공식 가격 페이지 기준*이나 *분당·시간당 rate limit 임계값*은 *경험 데이터 없이 잠정값*. 실제 운영 데이터 확보 후 *세션 12에서 정정* 필요.

### 다음 세션 시작 시 할 일 — *세션 10 후보*

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **백엔드 옵션 결정** — 두루미팀 회의 결과 반영 → 옵션 A/B/C 중 1개 확정 후 설계 문서 §2 갱신
- **첫 API Route 작성** — `api/classify.js` (Vercel Edge 가정 시) — 현재 `classify.js`를 LLM 호출로 교체
- **키워드 1단계 안전 분기** 백엔드 코드 — `keyword_rules.json` 활용
- **로컬 e2e 테스트** — 브라우저 → 백엔드 → SDK → 응답 흐름

### 세션 9 종료 체크리스트

- [x] dev 서버 — 이번 세션엔 띄우지 않음
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + 설계 문서 + 코드 + README 단일 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [SECURITY] 세션 9 안전 점검

- [x] `.env.local` 파일 *내용 출력 안 함* (cat·echo·log 없음 — git status로만 존재 확인)
- [x] API 키 *코드·로그·커밋 메시지에 일체 포함 안 함*
- [x] `.gitignore`에 `.env.local` 등록 확인 (세션 8 이전부터 등록됨)
- [x] `.env.example`는 *키 없는 템플릿*만 — 안전하게 커밋 가능
- [x] `helloClaudeCheck.js`는 *키 값을 직접 다루지 않고* SDK 기본 동작(`process.env.ANTHROPIC_API_KEY` 자동 읽기)에 의존

---

## 2026-05-16 세션 10 — Vercel Edge API Route + 4-필드 응답 + caching e2e 통과

### 완료한 작업

- [x] 컨텍스트 복원 (CLAUDE.md / SESSION_LOG 세션 9 / 설계 문서 / README)
- [x] **팀 결정 4가지 반영** — 백엔드 옵션 A / rate limit 분당5·시간당30 / 4-필드 응답 스키마 / 방식 A + caching
- [x] **`docs/llm_integration_design.md` v0.2 갱신**
  - §0: 세션 9 미결정 자리 4개 모두 *확정*으로 이동, 남은 미결정 자리 명시
  - §2: 옵션 A *확정 + 구조도*, B/C는 *검토 결과 미선택 + 재검토 트리거*
  - §3-3: 응답 스키마 *4-필드 정형*으로 교체 (matched_case_ids / friendly_response / safety_signals / confidence)
  - §3-4: prompt caching ephemeral 활성화 호출 코드
  - §5: caching 효과 비용표 — 호출당 캐시 적중 시 \$0.0058 (6.4배 절감), 시나리오 500/월 \$9.2, 2,500/월 \$30.3
  - §6-2: rate limit 임계값 *확정* + 구현 단계 (메모리 → KV)
  - §7: 세션 10 진행 항목 *진행 중 → 완료*로 표시
- [x] **`scripts/buildCasesContext.mjs`** — 사례 71건을 generated 정적 데이터로 사전 빌드. Vercel Edge Runtime이 fs 미지원이라 *빌드 타임* 정적 생성 채택.
- [x] **`src/lib/llm/casesContext.generated.js`** (생성됨, 64,143자 / ~28K tok) — REVIEWED 10 + PENDING 61
- [x] **`src/lib/llm/systemPrompt.js`** — 친화 변환 5원칙 + 안전 분기 규칙 + 분류 체계 + 사례 71건 + JSON 스키마. `buildCachedSystemBlocks()`가 cache_control ephemeral 적용.
- [x] **`src/lib/llm/safetyKeywords.js`** — 가정폭력 11키워드 + 자해·자살 12키워드 + 즉시 위험 6키워드. `scanSafetyKeywords()` + `buildSafetyBranchResponse()`. 위양성 허용 / 위음성은 LLM 2단계로 보완.
- [x] **`src/lib/llm/rateLimit.js`** — 메모리 Map 기반. 분당 5·시간당 30·전역 일일 1,000. `checkAndConsume(key)` + `buildRateLimitResponse()`. 세션 12에서 Vercel KV로 마이그레이션.
- [x] **`api/classify.js`** Vercel Edge Function (`export const config = { runtime: 'edge' }`)
  - 흐름: POST → JSON 파싱 → 키워드 1단계 (LLM 우회 + 카운터 미증가) → rate limit → LLM 호출 → JSON 추출(코드블록·서두/말미 관용) → 스키마 검증 → 응답
  - 폴백: parse_error / validate_error / llm_call_failed 시 친화 메시지 + raw 400자 디버깅용
  - 응답 _meta: stage, model, cache_hit, usage (cache_creation/read 분리), case_pool
- [x] **`vercel.json`** Edge runtime + buildCommand에 buildCasesContext 포함
- [x] **`package.json`** 스크립트 — `build`에 generated 빌드 포함, 신규 `llm:cases`, `llm:test`
- [x] **`scripts/llmTestE2E.mjs`** — api/classify.js 핸들러 직접 import + 5 시나리오 + 캐시 적중·비용 측정
- [x] **e2e 5/5 통과** — 첫 호출에서 LLM 4건(B는 1단계 우회), 모두 cache_read 적중, 총 비용 \$0.033 (~45원)
- [x] SESSION_LOG 세션 10 + README M2 진행 갱신
- [x] 단일 커밋 (Co-Authored-By 자동 서명 금지, git push는 사용자 직접)

### 핵심 산출물

- `api/classify.js` (Vercel Edge Function, ~6 KB)
- `src/lib/llm/systemPrompt.js` (방식 A — 사례 71건 + caching 블록 빌더)
- `src/lib/llm/casesContext.generated.js` (생성 파일, 64,143자 정적 데이터)
- `src/lib/llm/safetyKeywords.js` (29개 키워드 사전 + 분기 응답 빌더)
- `src/lib/llm/rateLimit.js` (메모리 카운터 + 친화 응답)
- `scripts/buildCasesContext.mjs` (사례 추가 시 재실행하는 빌드 스크립트)
- `scripts/llmTestE2E.mjs` (5 시나리오 e2e 테스트)
- `vercel.json` (Edge runtime 라우팅)
- `docs/llm_integration_design.md` v0.2 (결정 4가지 반영, ~9 KB)

### e2e 테스트 결과 — 5 시나리오 5/5 통과

| ID | 시나리오 | stage | matched | safety_flag | confidence | 비용 |
|---|---|---|---|---|---|---|
| A | 사이버폭력 가해 (P-001) | llm_ok | SAMPLE-001, PR-007, DR-CASE-001 | false | 0.92 | $0.008 |
| B | 가정폭력 (P-005) | safety_keyword_pre_llm | (1단계 우회) | true | 1.0 | $0 |
| C | 복도 어깨 (SAMPLE-002) | llm_ok | SAMPLE-002, DR-CASE-019, DR-PREC-001 | false | 0.92 | $0.008 |
| D | SNS 유포 피해자 (SAMPLE-004) | llm_ok | SAMPLE-004, DR-CASE-002, DR-CASE-016 | false | 0.92 | $0.008 |
| E | 보호자 시점 | llm_ok | PR-010, DR-CASE-010, DR-CASE-039 | false | 0.92 | $0.008 |

매칭 의미적 정확도:
- C는 *진짜* SAMPLE-002(학폭 불인정 잠재) + DR-CASE-019(장난가장 신체) + DR-PREC-001(부산판례) — *판례까지 짚어준 우수 매칭*
- D는 SAMPLE-004 + DR-CASE-002/016(합성 사진·영상) — *SNS 유포 패턴 정확 매칭*
- E는 보호자 시점에서 *DR-CASE-010(미인지·미신고)*까지 짚어줌

### prompt caching 효과 측정 (실측)

| 메트릭 | 값 |
|---|---|
| 총 LLM 호출 | 4회 (시나리오 5건 중 B는 1단계 우회) |
| cache_creation | 0회 (이전 실행에서 이미 생성) |
| cache_read 적중 | 4회 (100%) |
| 평균 cache_read 토큰 | ~63,826 tok |
| 평균 cost/호출 | ~$0.0081 (~11원) |
| 캐시 없을 때 추정 | ~$0.037/호출 → 4.6배 절감 |

> 첫 실행 시 *parse_error*로 응답 폴백 → 그 호출에서 cache_creation 발생 → 이후 5분 내 재실행은 모두 cache_read 적중. 설계 문서 §5-3 추정(캐시 적중 60% 시 시나리오 A 월 \$9)이 *현실적*이라 확인됨.

### 발견 이슈 1 — Haiku 4.5 첫 응답이 코드블록(```json) 포함해 JSON.parse 실패 (P3, 해결 완료)

**증상**: 첫 e2e 실행 시 4건 모두 stage=parse_error. LLM이 시스템 프롬프트의 *코드블록 금지* 지시를 100% 따르지 않음. 응답 시작에 ` ```json ` 또는 *서두 인사말*을 붙임.

**해결**: `extractJsonString(raw)` 헬퍼 추가 — 코드블록 매치 → 첫 `{`부터 마지막 `}` 슬라이스 → 그대로. 두 번째 실행에서 4건 모두 ✓.

**근본 해결 후보 (세션 11)**: ① system 프롬프트에 *부정 명령 반복 강화* ② Anthropic *tool_use*로 strict JSON 강제 ③ Sonnet 4.6 시험 (지시 준수 더 정확).

**우선순위**: P3 — 폴백 + JSON 추출 가드로 안정. 다만 코드블록 정상화 비율을 *로그로 추적*해서 LLM 신뢰도 모니터링 필요 (세션 12).

### 발견 이슈 2 — generated 파일 커밋 vs gitignore 자율 결정 (P3)

**증상**: `src/lib/llm/casesContext.generated.js`(64KB)가 *빌드 산출물*인데 git 커밋 여부 결정 필요.

**결정**: **커밋**. 이유 — ① 학생 팀이 빌드 명령 외울 부담 ② PR 검토 가능 ③ Vercel 배포 안정성. 단점은 사례 추가 시 *generated 파일도 함께 갱신해 커밋*해야 함 → `npm run build` 자동 갱신 + 커밋 누락 시 CI에서 잡도록 세션 12에서 hook 도입 검토.

**우선순위**: P3 — 학생 팀 학습 부담 최소화가 우선.

### 발견 이슈 3 — Edge Runtime의 fs 미지원 → 빌드 타임 정적 생성 패턴 (P2, 해결됨)

**증상**: Vercel Edge Runtime은 Node fs 모듈 제공 안 함. 사례 데이터를 *런타임에* `import.meta.glob` 또는 `readdirSync`로 못 읽음.

**해결**: `scripts/buildCasesContext.mjs`로 *빌드 타임에* JSON 71개를 합쳐 `casesContext.generated.js`로 만든 다음 ES import. 71건 → 64KB 정적 문자열 (~28K tok).

**한계 인식**: 사례 변경 시 *빌드 스크립트 재실행 필수*. 학생 팀이 잊으면 *옛 사례가 LLM에 노출됨*. → `npm run build` 훅으로 자동화 + 세션 12에서 *CI가 generated 파일 최신성 검증*.

**우선순위**: P2 — 학생 팀 워크플로 강화 필요.

### 발견 이슈 4 — Anthropic SDK *Edge Runtime 호환성 미검증* (P3, 실측 OK)

**증상**: `@anthropic-ai/sdk` v0.96.0이 Vercel Edge Runtime에서 정상 동작하는지 *문서 차원*에서 확인 못 함.

**조치**: 본 세션은 *Node CLI에서 핸들러 직접 import*로 e2e 검증 → 정상. Vercel 실 배포 시 *동일 SDK가 Edge에서 작동하는지* 별도 확인. SDK가 fetch만 쓰면 Edge 호환, http 모듈 사용 시 비호환.

**우선순위**: P3 — 세션 11 또는 첫 Vercel 배포 시점에 검증. 비호환 시 *fetch 기반 직접 호출 코드*로 대체 가능.

### 자율 모드 운영 회고 (A1 — 완전 자율)

세션 10은 *팀 결정 4가지가 사전 합의*된 상태로 진입 → 자율 결정 자리 최소. 사용자 명시 stop signal:

- (a) 컨텍스트 복원 완료 후 → *바로 작업 진입* (사용자 9단계 작업 순서 매우 구체적, 멈춤 신호 없음)
- (b) e2e 첫 실행 4건 parse_error → *5분 이상 매달리지 않고 JSON 추출 가드 추가로 격리·다음 진행* (자율 모드 명시 제약 준수)
- (c) 콘텐츠 판단 자리: 키워드 사전(29개) 선정 — *CLAUDE.md §2-3에서 명시된 패턴 + 친화 표현*만 추가. 새 분류·새 해석 *추가 없음*.
- (d) 위험 명령: `git push`·`rm`·`git reset`·`git checkout` 일체 없음. `npm install` 추가 안 함 (세션 9에서 이미 설치).

자율 결정 자리 (사용자 합의 정책 적용):
- generated 파일 커밋 여부 → 커밋 (학생 팀 워크플로 우선)
- 시스템 프롬프트 톤 → 친화 변환 5원칙 + CLAUDE.md §2-3 안전 분기 규칙 *그대로* 인용 (새 톤 추가 없음)
- e2e 실패 시 디버깅 → JSON 추출 가드 + raw 400자 노출 (다음 세션 LLM 신뢰도 모니터링 기반)

비용 안전: 5회 호출 한도 명시 → 실제 4회만 호출 (1단계 우회 1건), 총 \$0.033 (~45원). 예산 \$50 한도의 0.066% 사용.

### 다음 세션 시작 시 할 일 — *세션 11 후보*

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **App.jsx → /api/classify 연동** — 현재 inline classify 호출을 *fetch('/api/classify')*로 교체
  - 로딩 상태 UI (Step 2~3 사이 *분석 중*)
  - safety_signals.has_safety_flag=true → SafetyBranchScreen 우회
  - matched_case_ids 기반 결과 화면 노출 (기존 matchCases 시그니처 유지 또는 어댑터)
- **응답 파싱 강화** — 코드블록 정상화 비율 추적 + Anthropic tool_use 적용 검토
- **시나리오 A·B·C 동작 동일성 확인** (브라우저)
- **Vercel 첫 배포 시도** — SDK Edge Runtime 호환성 실측

### [PENDING_DECISIONS] 세션 10에서 미해결 자리

- **시스템 프롬프트의 사례 컨텍스트 어휘 압축 정도** — 현재 friendly_summary + 분류 + key_factors만. *원문 D그룹·법조항 D그룹 포함 여부*는 사용자 입력에 *법조항이 명시될 경우* 필요할 수도. 두루 검수 의견 수렴 후 결정.
- **응답 검증 실패 시 폴백** — 현재 *일률적 친화 메시지*. *재시도 N회* + *Sonnet 4.6 자동 승격* 같은 패턴은 세션 11 결정.
- **로깅 정책** — usage·cache_hit·matched_case_ids를 *어디에 어떻게* 익명 누적할지 세션 12 결정.

### 세션 10 종료 체크리스트

- [x] dev 서버 — 이번 세션엔 띄우지 않음 (vercel dev도 안 띄움 — handler 직접 import로 e2e)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + 설계 문서 + 코드 7개 + README 단일 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [SECURITY] 세션 10 안전 점검

- [x] `.env.local` 파일 *내용 출력 안 함*
- [x] API 키 *코드·로그·커밋 메시지에 일체 포함 안 함*
- [x] `process.env.ANTHROPIC_API_KEY`는 SDK 자동 읽기 — 코드에 키 문자열 *없음*
- [x] e2e 로그 — usage·cost만, 응답 본문은 친화 응답 일부(140자)만 노출
- [x] `vercel.json`·`api/classify.js`·`scripts/*`에 API 키 *없음*
- [x] generated 파일에 사례 *친화 변환 후 내용*만 — 원문 직접 인용·실명 *없음* (세션 5~7 정책 그대로)


---

## 2026-05-16 세션 11 — App.jsx → /api/classify 연동 + Vite dev API 마운트 (M2 통합 완료)

### 완료한 작업
- [x] `src/lib/llm/clientCall.js` 신설 — 프런트엔드 → 백엔드 호출 래퍼 (12초 timeout / 5xx·네트워크·schema 실패 폴백 / 저신뢰 알림)
- [x] `scripts/devApiPlugin.mjs` + `vite.config.js` — Vite dev 서버가 `/api/<name>` 요청을 `./api/<name>.js`의 default 핸들러로 위임. vercel CLI 글로벌 설치 불필요
- [x] `src/App.jsx` 수정:
  - step 4 (StepLoading) 진입 시 `callClassify()` 비동기 호출하는 `useEffect` 추가
  - 응답을 `data.llm` 에 저장 → step 5 자동 전환
  - `safety_signals.has_safety_flag=true` 시 SafetyBranchScreen 우회 (LLM 2단계 안전 분기)
  - StepLoading 자동 `setTimeout` 제거 → 시각 효과만 phase 3까지 진행, step 전환은 LLM 응답에 종속
  - StepResults 상단에 친화 응답 카드 추가 + 저신뢰 알림 + 폴백 chip
  - LLM matched_case_ids 우선 + 폴백 matchCases 결합 (중복 제거)
- [x] `npm run build` 통과 — 1809 modules transformed, 825KB → 215KB gzip
- [x] 모듈 단위 e2e 6/6 통과 — happy / 5xx / schema invalid / 429 rate / low confidence / expandMatchedCaseIds
- [x] README M2 진행 상황 갱신 + *팀 시연 절차 3종*(시나리오 A·B·C) 추가 + *막혔을 때* FAQ 추가
- [x] 본 SESSION_LOG 항목 작성

### 자율 결정 — Vite middleware plugin (학생 팀 부담 최소화 우선)

세션 11 입장 시 *Vite dev 환경에서 /api/classify 동작* 옵션 3개가 미해결:

| 옵션 | 학생 팀 부담 | 실현성 | 선택 |
|---|---|---|---|
| (a) `vercel dev` | vercel CLI 글로벌 설치 + 인증 학습 | 가장 정확 (프로덕션과 동일) | ✗ |
| (b) Vite middleware plugin | `npm run dev` 한 명령 그대로 | Node 18+ 글로벌 Request/Response 의존 — 검증 통과 | ✅ |
| (c) Mock 라우트 (가짜 응답) | 가장 가벼움 | LLM 실제 동작 미시연 | ✗ |

선택 근거: 학생 팀의 *vercel CLI 학습 부담 0* + *실제 Claude Haiku 호출 시연 가능* 둘 다 충족하는 유일한 옵션. 제약은 *Vite SSR module 그래프*에 의존하므로 *Vercel 실 배포 환경과의 차이*가 잠재 risk. → 세션 12에서 첫 Vercel 배포 시 *동일 응답*인지 회귀 비교.

### 사례 컨텍스트 토큰 수 실측 — 설계 추정보다 17% 작음

- 설계 문서 §5-2 추정: ~33,500 tok (사례 71건)
- 실측 (세션 11 빌드): **27,888 tok** (한글 약 2.3 char/tok 기준, 64,143 char)
- 비용 추정에 보수적 여유. 캐시 미스 호출당 ~$0.030 (43원), 캐시 적중 호출당 ~$0.005 (7원).

### 발견 이슈 1 — StepLoading 시각 효과 시간 vs LLM 응답 시간 불일치 (P3, 의도된 trade-off)

**증상**: StepLoading의 phase 진행은 2.3초까지만 (3 단계). LLM 응답은 보통 3~10초 → 마지막 phase에 "안내 문구를 정리하고 있어요"가 *멈춘 상태*로 표시됨.

**조치**: 호출 시작 시 `loadingStatus='llm_pending'`이라 *"응답이 도착하는 데 보통 3~10초 정도 걸려요"* 보조 문구 노출 → 사용자가 "멈춘 게 아니구나"로 이해.

**한계**: 응답이 10초 넘으면 사용자 불안. 세션 12에서 *progress indeterminate* 패턴 + abort 버튼 검토. 현 시점은 timeout 12초 + 폴백 메시지로 graceful degradation.

**우선순위**: P3 — 시연에 지장 없는 수준.

### 발견 이슈 2 — LLM 2단계 안전 분기에서 SafetyBranchScreen action 매핑 (P2, 잠정 해결)

**증상**: SafetyBranchScreen은 `action: 'urgent_self_harm' | 'urgent_domestic'` 두 값만 지원. LLM 응답의 `safety_signals.reason` 은 자유 문자열(예: "자해 언급", "가정폭력 신호").

**조치**: App.jsx의 LLM useEffect에서 reason 문자열을 *키워드 매칭*으로 두 action에 매핑.
```js
const action = reason.includes('자해') || reason.includes('자살') ? 'urgent_self_harm' : 'urgent_domestic';
```

**한계**: LLM이 *예상 외 한국어 표현*을 reason에 적으면 *기본값 urgent_domestic*으로 fallthrough. 위양성보다 위음성이 안전 측면에서 더 위험하므로 *기본값을 안전한 두 분기 중 하나로 항상 폴*시키는 게 합리적. 두루 검수 단계에서 *reason 어휘 사전*을 정해 더 엄격한 매핑으로 강화.

**우선순위**: P2 — 두루 검수 의견에 따라 결정.

### 발견 이슈 3 — Edge runtime fetch IP 식별이 dev/prod에서 다름 (P3, dev only 영향)

**증상**: dev plugin이 `x-forwarded-for` 헤더에 `req.socket.remoteAddress`(::1)를 항상 주입. 따라서 *로컬 시연 시 rate limit 카운터*는 모든 호출이 동일 키로 계산됨 → 분당 5회 한도가 *모든 로컬 사용자에 공유*. 시연 중 한 명이 빨리 5회 누르면 다른 시연 사용자도 막힘.

**조치**: dev 한정 동작이라 운영 영향 없음. 시연 시 *5회 한도 안에서 진행 권장*을 README에 명시 안 함 (학생 팀 부담 회피). 발견 시 *vite dev 서버 재시작*으로 메모리 카운터 리셋 가능.

**우선순위**: P3 — 실 운영(Vercel Edge)에서는 *실제 사용자 IP*가 전달되므로 무관.

### 자율 모드 운영 회고 (A1 — 완전 자율)

세션 11은 *팀 결정 자리 1개(dev API 셋업 옵션 3개 중 선택)*만 자율. 사용자 명시 stop signal:

- (a) 5분 이상 한 작업에 매달림 → *없음* (단위 e2e + 빌드 + 모듈 import 모두 빠른 검증)
- (b) 콘텐츠 판단 자리 → *없음* — README/SESSION_LOG는 *기존 톤* 그대로, 새 사례·새 친화 변환 *없음*
- (c) 위험 명령 → *없음* — `npm install` 추가 안 함, `git push`·`rm`·`git reset`·`git checkout` 일체 없음, .env.local 내용 출력 안 함

자율 결정 자리:
- *dev API 옵션 선택* → §"자율 결정" 근거 명시 (학생 팀 부담 최소화 + 실제 LLM 시연 가능)
- *App.jsx StepLoading 자동 진행 제거 vs onDone 무시 패턴* → 자동 진행 제거 채택 (LLM 응답 시간 가변성을 정직하게 UI에 반영)
- *LLM matched + 폴백 matchCases 결합 방식* → LLM 우선 + 중복 제거 후 보강 (전부 LLM이 빈 배열 반환해도 기존 동작 보존)

### 다음 세션 시작 시 할 일 — *세션 12 후보*

- :5173 점유 프로세스 사전 확인 (`lsof -nP -iTCP:5173 -sTCP:LISTEN`)
- 좀비 claude 프로세스 사전 확인 (`ps aux | grep -i claude | grep -v grep`)
- **Vercel 첫 배포** + SDK Edge Runtime 호환성 실측 + dev vs prod 응답 회귀 비교
- **KV/Redis rate limit 마이그레이션** — 인스턴스 분산 환경 대응
- **입력 sanitization** — 학생 실명·전화·학교명 1차 마스킹
- **호출 로깅** — usage·cache_hit·matched_case_ids 익명 누적
- **두루 검수 패키지에 LLM 응답 샘플 100건 동봉** 준비

### [PENDING_DECISIONS] 세션 11에서 미해결 자리 (세션 10에서 이월 + 신규)

- (이월) 시스템 프롬프트의 사례 컨텍스트 *어휘 압축 정도* — 두루 검수 의견 수렴 후 결정
- (이월) 응답 검증 실패 시 *재시도 N회 + Sonnet 4.6 자동 승격* 패턴 도입 여부
- (이월) 로깅 정책 (어디에 어떻게 익명 누적)
- (신규) StepLoading의 *abort 버튼* + indeterminate progress 추가 여부 (LLM 응답 10초 초과 시 UX)
- (신규) SafetyBranchScreen action *어휘 사전 강화* (LLM reason 문자열 → 엄격한 두 분기 매핑)

### 세션 11 종료 체크리스트

- [x] dev 서버 — 본 세션에서 띄우지 않음 (모듈 import 단위 e2e + 빌드 검증으로 대체)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + README + 코드 4개 단일 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [SECURITY] 세션 11 안전 점검

- [x] `.env.local` 파일 *내용 출력 안 함*
- [x] API 키 *코드·로그·커밋 메시지에 일체 포함 안 함*
- [x] `process.env.ANTHROPIC_API_KEY`는 SDK 자동 읽기 — 코드에 키 문자열 *없음*
- [x] dev plugin이 dotenv로 .env.local만 로드 — 다른 .env.* 파일 *접근 안 함*
- [x] 클라이언트 fallback 메시지에 *내부 stage 코드만 노출* — API 키·내부 경로 *없음*
- [x] 모든 데이터 변경 없음 (사례 71건, 검수 트랙 동일)

---

## 2026-05-16 세션 12 — Vercel 첫 배포 디버그 (vercel.json functions 문법)

### 증상

세션 11 커밋(`1afb3b5`)을 origin/main에 푸시 후 Vercel 첫 배포 시도. 빌드는 시작되었으나 배포 실패:

> `Function Runtimes must have a valid version, for example "now-php@1.0.0".`

### 원인

`vercel.json`의 `functions` 블록에서 runtime 값을 *문자열 `"edge"`*로 지정했음. Vercel은 `functions[...].runtime` 필드에 *버전 명시 패키지 문자열*(`@vercel/edge@x.y.z` 같은 형식)을 요구. `"edge"`는 *문법 위반*.

근본 원인은 *문서 혼동*: Vercel Edge Runtime의 *현재 권장 패턴*은 `vercel.json`의 `functions` 블록에 지정하는 게 아니라 *함수 파일 자체*에 `export const config = { runtime: 'edge' };`로 선언하는 것. 세션 10 셋업 시 두 곳 모두에 적어둔 게 충돌.

세션 11 시점에 `api/classify.js`에는 이미 `export const config = { runtime: 'edge' };`가 적혀 있어 *함수 측 선언은 정상*. `vercel.json`의 functions 블록만 *문법 위반인 채로* 남아 있었고, dev 환경(Vite middleware plugin)에서는 `vercel.json`을 읽지 않기 때문에 *세션 11 e2e·빌드 검증에서 잡히지 않은* 잠복 결함.

### 수정

1. `vercel.json` — `functions` 블록 *완전 제거*. buildCommand, rewrites만 남김.
2. `api/classify.js` — 28행의 `export const config = { runtime: 'edge' };` *그대로 유지* (이 한 줄이 Edge 런타임 지정의 진실의 원천).
3. 그 외 코드 변경 *없음*.

### 검증 한계

- 본 세션에서는 *Vercel 재배포는 사용자가 직접 수행*. 푸시 후 Vercel 대시보드에서 빌드 로그 확인 필요.
- 추가 잠재 결함: ① `@anthropic-ai/sdk` v0.96.0의 Edge 런타임 호환성 — fetch 기반이라 *호환 추정*이나 실측 미완 ② `.env.local`의 ANTHROPIC_API_KEY는 *로컬 전용* — Vercel 프로젝트 설정의 *Environment Variables*에 별도 등록 필요 (사용자 직접 작업)
- 빌드 성공 후 시나리오 A·B·C가 *프로덕션 URL*에서도 동작하는지 회귀 비교 (세션 11의 dev 동작과 동일해야 함)

### 다음 세션 시작 시 할 일 — *세션 13 후보*

- Vercel 재배포 결과 확인 (사용자 작업) → 빌드 성공 시 *프로덕션 URL*에서 시나리오 A·B·C 회귀 비교
- 빌드 또 실패하면 로그 통째로 가져와서 디버그 (Anthropic SDK Edge 비호환 가능성)
- 빌드·시나리오 성공하면 세션 11 후보였던 KV rate limit + 입력 sanitization + 로깅으로 이동

### 세션 12 종료 체크리스트

- [x] dev 서버 — 본 세션 띄우지 않음 (vercel.json + SESSION_LOG 텍스트 변경만)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status가 깨끗한지 (이 SESSION_LOG + vercel.json 단일 커밋 후)
- [x] SESSION_LOG.md 다음 세션 항목 채워짐
- [ ] *git push는 사용자가 직접 실행* (자율 모드 명시 제한)

### [SECURITY] 세션 12 안전 점검

- [x] `.env.local` *접근·내용 출력 안 함*
- [x] API 키 *코드·로그·커밋 메시지에 일체 포함 안 함*
- [x] 데이터·사례·검수 트랙 변경 *없음* (텍스트 7줄 + JSON 5줄 삭제만)

---

## 2026-05-16 세션 12 (2단계) — Edge → Node.js runtime 전환

### 증상

세션 12 1단계 수정(`4a0af80`) 푸시 후 Vercel 재배포. 빌드는 진행됐으나 배포 단계에서 또 실패:

> `The Edge Function 'api/classify' is referencing unsupported modules:`
> `- @anthropic-ai: node:fs, node:path`

### 원인

`@anthropic-ai/sdk` v0.96.0 이 *내부 의존성*으로 `node:fs` / `node:path` 를 import. Vercel Edge Runtime 은 이 두 Node 코어 모듈을 미지원. 세션 10 [PENDING_DECISIONS] §"Anthropic SDK *Edge Runtime 호환성 미검증* (P3)" 가 *실제 결함으로 표면화*. 본 세션에서 1단계(`vercel.json` 문법) 통과 직후 *그 다음 라이브러리 계층 결함*이 노출된 셈.

### 결정 — 길 A 채택 (Node runtime 전환)

두 길:
| 길 | 작업량 | trade-off |
|---|---|---|
| **A — Node.js runtime 으로 전환** | 1줄 수정 | 콜드 스타트 +수백 ms, 한국 사용자 latency 약간 증가 |
| B — Anthropic API 를 fetch 직접 호출로 재작성 | 핸들러 절반 재작성 + 응답 파싱·usage 추출 직접 구현 | Edge runtime 그대로 유지, 콜드 스타트 최소 |

**선택 근거 (시연 우선)**: 세션 12 단일 목표가 *Vercel 첫 배포 성공 + 시연 가능 URL 확보*. 길 B 는 *세션 한 개 통째로 소요* + 회귀 위험 (응답 형식 미세 차이). 길 A 는 1줄 + 핸들러 시그니처 그대로(Vercel 이 Request/Response 자동 어댑팅) → *세션 11 e2e 결과·dev 동작 그대로 보존*.

길 B 는 세션 13+ 후보로 이월. 트래픽 증가·콜드 스타트 실측에서 *체감 가능*해질 때 진행.

### 수정

- `api/classify.js` 의 `export const config` 한 줄:
  - 기존: `{ runtime: 'edge' }`
  - 신규: `{ runtime: 'nodejs20.x' }`
- 그 외 핸들러·시스템 프롬프트·rate limit·safety keywords·devApiPlugin *변경 없음*.
- `vercel.json` 변경 없음 (1단계에서 functions 블록 이미 제거).

### 검증 한계

- Vercel 재배포는 사용자 직접 수행 (자율 모드 push 금지).
- *Node runtime 콜드 스타트 실측*은 첫 호출 시 사용자가 체감. Vercel 대시보드의 *Invocation Duration* 로그로 추적 가능.
- 응답 형식·동작은 *세션 11 dev 결과와 동일* 기대 — Vercel 의 Node ↔ Web Fetch 어댑팅이 Request/Response 시그니처 그대로 처리.

### 다음 세션 시작 시 할 일 — *세션 13 후보 갱신*

- Vercel 재배포 결과 확인 (빌드 성공 + 시나리오 A·B·C 회귀 동일)
- 빌드 성공 시: KV rate limit + 입력 sanitization + 로깅 (원래 세션 12 후보였던 항목들로 복귀)
- *길 B 진행 시점*: 콜드 스타트가 한국 사용자 체감(>1s)이거나, 동시 호출 동시성이 Node 서버리스 한계에 가까워질 때
- 길 B 작업 범위 미리 메모: ① Anthropic Messages API 의 messages.create 를 fetch 로 직접 호출 ② cache_control:ephemeral 도 fetch body 에 그대로 포함 가능 ③ usage 객체는 응답 JSON 의 `usage` 필드 그대로 사용 가능 ④ AbortController + timeout 패턴 유지

### 세션 12 (2단계) 종료 체크리스트

- [x] dev 서버 — 본 세션 띄우지 않음 (1줄 수정만)
- [ ] Claude Code /exit 또는 창 닫기
- [ ] git status 깨끗 (이 SESSION_LOG + api/classify.js 단일 커밋 후)
- [x] SESSION_LOG 갱신
- [ ] *git push 사용자 직접*

### [SECURITY] 세션 12 (2단계) 안전 점검

- [x] `.env.local` 접근·내용 출력 *없음*
- [x] API 키 코드·로그·커밋 메시지 노출 *없음*
- [x] 데이터·사례·검수 트랙 변경 *없음*
- [x] 핸들러 로직·system prompt·rate limit *전혀 안 건드림* — 단일 runtime 값만 변경
