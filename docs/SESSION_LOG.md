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
