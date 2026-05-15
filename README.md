# 「나란히」 학교폭력 법률 안내 플랫폼

> 학교폭력 사안에 휘말린 학생·보호자에게 *법적 절차를 친화적 언어로 안내*하는 웹 플랫폼.
> 운영: **두루미팀** (학생 자원봉사) · 협력: **사단법인 두루** (공익법센터)

---

## 어서 와요

이 저장소에 처음 들어왔다면 *이 한 페이지만* 읽으면 시작할 수 있어요. 어려운 부분은 *반드시 막힐 수 있는 자리*에 *해결 방법까지* 적어놨어요. 막히면 GitHub Issues에 글 남기면 다른 팀원이 도와줘요.

## 이 프로젝트가 무엇인가요

**한 줄로**: 학교폭력 사안에 휘말린 학생이 *지금 자기 상황에 맞는 정보*를 *친구가 설명해주는 톤*으로 받을 수 있는 도구.

**왜 만드나요**:
- 학폭법은 복잡하고, 학교·교육청 안내는 어른 언어
- 학생이 *자기 권리·절차·결과 가능성*을 *자기 눈높이*로 알 수 있어야 함
- 두루의 공익 법률 자료를 *학생이 직접 접근 가능한 형태*로 변환

**누가 쓰나요** (페르소나):
- P-001: 사이버폭력 가해로 신고된 중학생 (메인 페르소나)
- P-005: 가정폭력 신호가 함께 있는 학생 (안전 분기 페르소나)
- 그 외 피해자·목격자·보호자

## 지금 어디까지 왔나요 — 솔직히

**최종 업데이트: 2026-05-15 (세션 5 완료 — 두루 자료 시범 추출 2건)**

```
✅ 작동하는 데모          localhost:5173에서 6단계 사용자 여정 + 안전 분기 정상
✅ GitHub 저장소           durumi-project/naranhi (비공개), 팀원 4명 합류 중
✅ 자료 15건                가상 10건 (검수완료) + OM2 3건 + 두루 시범 2건 (검수대기) — 신규
✅ 첫 진짜 판례             DR-PREC-001 (case_type=precedent) — 시범 추출 완료 — 신규
✅ 검수 트랙               src/data/cases/PENDING ↔ REVIEWED 폴더 구조
✅ 자동 검증               스키마 v2 (42필드) + validateCase 함수 (15/15 통과)
✅ 두루 매뉴얼 5종         활용 가능 확인됨 (docs/external/)
✅ 두루 직접 제공 자료     50건 사례 + 판례 10건 (docs/external/, 활용 허락 받음) — 신규
✅ PDF 처리 인프라         poppler 설치, PDF 추출 준비 완료
🟡 시범 사례 추출          1차 완료 (DR-CASE-047 + DR-PREC-001), 추가 추출 다음 세션
🟡 두루 변호사 검수        PENDING 5건 검수 패키지 미작성
❌ LLM 통합                미시작 (자료 더 모인 후)
❌ 배포                    미시작 (localhost만)
❌ 학교 현장 노출          미시작
```

**한 줄로**: *동작하는 데모는 완성. 팀 협업 + GitHub + 매뉴얼 정리까지 끝. 두루 매뉴얼에서 진짜 사례 추출하는 단계 진입.*

## 사전 준비

본인 노트북에서 다음이 필요해요:

1. **Mac** 또는 **Linux** (Windows는 WSL2 권장 — 안내는 별도 필요)
2. **Node.js v22 LTS 이상** ([nvm](https://github.com/nvm-sh/nvm)으로 설치 권장)
3. **Git** + **GitHub 계정**
4. **VS Code** 또는 본인 익숙한 코드 에디터
5. (선택) **Claude Code** — AI 코딩 도구. 빠른 작업에 큰 도움. [설치 안내](https://claude.ai/install.sh)
6. (PDF 자료 작업할 사람만) **Homebrew + poppler** — `brew install poppler`

## 환경 셋업 — 처음 한 번만

### 1. 저장소 복제 (clone)

본인의 *작업 폴더*로 가서 (예: `~/Desktop/`):

```bash
cd ~/Desktop
git clone https://github.com/durumi-project/naranhi.git
cd naranhi
```

> 만약 git이 아직 설치 안 됐다면: `xcode-select --install` (Mac) 또는 [git-scm.com](https://git-scm.com/) 참고.

### 2. Node.js 버전 맞추기

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use
```

`.nvmrc`가 자동으로 *Node v22 LTS*를 선택해줘요.

> *nvm이 없으면* `nvm use`에서 에러. nvm은 [공식 설치](https://github.com/nvm-sh/nvm#installing-and-updating) 한 줄로 가능.
> *Node v22가 없으면* `nvm install lts/jod` 후 다시 `nvm use`.

### 3. 의존성 설치

```bash
npm install
```

수십 초 걸려요. 끝나면 `node_modules/` 폴더가 생기고 *44 packages, 0 vulnerabilities* 같은 메시지가 나와요.

### 4. dev 서버 띄우기

```bash
npm run dev
```

다음과 같은 출력이 나오면 성공:

```
VITE v8.0.12 ready in 829 ms
➜ Local: http://localhost:5173/
```

브라우저로 `http://localhost:5173` 열면 *나란히 랜딩 화면*이 떠요.

### 5. 동작 확인 — 시나리오 3개

다음 3가지를 *직접 해보면* 환경 셋업이 잘 됐다는 증거예요:

**시나리오 A — 사이버폭력 가해자**
1. "시작하기" 클릭
2. 만 14-15세 + 중학교 + 가해 학생 입력
3. 상황: `단톡방에서 친구 별명을 부르면서 놀렸어요. 그 친구가 그만하라고 했는데 한 번 더 했고 캡처본이 있다고 해요.`
4. 결과 화면에 *사례 카드 1~3건*이 떠야 정상

**시나리오 B — 안전 분기 (이게 가장 중요해요)**
1. 처음으로 돌아가서 다시 시작
2. 정보 입력 후 Step 2 상황: `아빠가 자꾸 때려요. 집에 가기 싫어요.`
3. *결과 화면이 아니라 안전 안내 화면*이 떠야 정상
4. 1393·1388·1577-0199·112 같은 도움 전화 노출 확인

**시나리오 C — 데모 페르소나**
1. 랜딩 화면에 *데모 페르소나* 버튼이 있는지 확인
2. 있으면 P-001 자동 입력 → 결과까지 자동 진행 보임

3개 다 정상이면 환경 셋업 끝.

## 작업 시작 전 매번

```bash
cd ~/Desktop/naranhi      # 본인이 clone한 위치
git pull origin main      # 최신 코드 받기
nvm use                   # Node 버전 활성화 (셸 새로 띄울 때마다)
npm run dev               # dev 서버 (별도 터미널 권장)
```

## 핵심 원칙 — 작업 전 반드시 숙지

`CLAUDE.md` 파일이 *프로젝트 헌법*이에요. 다음 4가지는 *예외 없이 따라야 해요*:

### 1. 분류 코드 체계 `SV-[유형8]-[역할6]-[단계10]-[학교급4]`

- **유형 8가지**: PH(신체) / VB(언어) / EX(갈취) / CO(강요) / OS(따돌림) / SX(성폭력) / CY(사이버) / MX(복합)
  - 온라인 채널이면 무조건 **CY**
- **역할 6가지**: G(가해) / V(피해) / B(쌍방) / W(목격자) / P(보호자) / U(분류불가)
- **단계 0~9**: 사전예방(0) → 사건 직후(1) → 학교 신고(2) → 자체해결 검토(3) → 학폭위 통보(4) → 심의 직전(5) → 심의 진행(6) → 처분 결정(7) → 처분 이행(8) → 형사·민사(9)
- **학교급**: ES(초등) / MS(중등) / HS(고등) / OT(기타)

예: `SV-CY-G-4-MS` = 사이버폭력 가해 학생, 학폭위 통보 단계, 중학생

자세히는 `CLAUDE.md` §2-1 + `docs/분류코드표_v1.pdf`.

### 2. 친화 변환 5원칙

1. **이름은 관계어로** — 실명·가명 모두 *"같은 학교 친구"*, *"신고를 한 친구"* 식으로
2. **장소는 일반화** — 학교명·지역명 모두 ○○ 또는 일반화
3. **법률 용어는 풀어쓰기 + 정식명 1회** — `학교폭력대책심의위원회(학폭위) — 처분을 결정하는 회의`
4. **시점은 사용자 입장** — 가해·피해·보호자 역할에 따라 표현 다르게
5. **추측·해석 금지** — 원문에 명시된 사실만. 감정·동기 추측 절대 금지

자세히는 `CLAUDE.md` §2-2 + `docs/친화_변환_가이드_v1.pdf`.

### 3. 안전 분기 — 위기 신호 발견 시 *즉시 우회*

다음 신호가 발견되면 *일반 결과 화면 대신* SafetyBranchScreen으로:
- 가정폭력: "아빠가 때려요", "집에 가기 싫어요"
- 자해·자살: "죽고 싶어요", "이미 시도했어요"

노출 도움 전화: **1393** (자살예방) · **1388** (청소년) · **1577-0199** (정신건강위기) · **112** (긴급)

**금지 행위**:
- 위기 상태인지 *직접 묻지 않음* (트리거)
- 자해 방법·정도 디테일 절대 노출 금지
- "곧 지나갈 거예요" 같은 진정시키기 금지
- 감정 증폭형 반사적 듣기 자제

자세히는 `CLAUDE.md` §2-3.

### 4. 검수 트랙 — PENDING/REVIEWED 폴더

- `src/data/cases/PENDING/` — *검수 대기* (새로 추가한 자료)
- `src/data/cases/REVIEWED/` — *검수 완료* (두루 변호사 검토 통과)
- 검수가 끝나면 *파일을 PENDING → REVIEWED로 이동* + `review_status: "검수완료"` + `reviewer` + `reviewed_at` 채움
- 코드 변경 0, 파일 이동만으로 검수 상태 갱신

## 폴더 구조

```
naranhi/
├── CLAUDE.md                       ← 프로젝트 헌법 (필독)
├── README.md                       ← 이 문서
├── package.json                    ← 의존성·실행 명령
├── .nvmrc                          ← Node 버전 (lts/jod = v22)
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx                    ← React 진입점
│   ├── App.jsx                     ← UI + 로직 (1316줄, 단일 파일)
│   ├── index.css                   ← Tailwind v4 (한 줄 import)
│   ├── lib/
│   │   ├── validateCase.js         ← 스키마 v2 검증 함수
│   │   └── validateCase.test.js    ← 테스트 스크립트
│   └── data/
│       ├── cases/
│       │   ├── PENDING/            ← 검수 대기 사례
│       │   │   ├── DR-CASE-047.json (두루 50건 사례 47번 — 단톡방 강제 퇴장) — 신규
│       │   │   ├── DR-PREC-001.json (두루 판례 2024구합24300 — 첫 precedent) — 신규
│       │   │   ├── OM2-IV-001.json
│       │   │   ├── OM2-IV-002.json (⚠️ 자해 언급, safety_flag=true)
│       │   │   └── OM2-IV-003.json
│       │   ├── REVIEWED/           ← 검수 완료 (가상 사례)
│       │   │   ├── SAMPLE-001.json ~ SAMPLE-005.json
│       │   │   └── PR-006.json ~ PR-010.json
│       │   └── index.js            ← 자동 병합 (Vite import.meta.glob)
│       ├── documents.json          ← 12건 (학폭법 절차 문서)
│       ├── legal_terms.json        ← 10건 (용어 풀이)
│       ├── faqs.json               ← 10건
│       ├── resources.json          ← 8건 (도움 기관)
│       ├── question_trees.json     ← 5키 (후속 질문 트리)
│       ├── procedure_stages.json   ← 10건 (절차 단계 안내)
│       └── keyword_rules.json      ← 5키 (분류 규칙)
├── docs/
│   ├── SESSION_LOG.md              ← 진행 일지 (필독, 매 세션 갱신)
│   ├── 프로젝트_인수인계_v1.md
│   ├── 분류코드표_v1.pdf
│   ├── 친화_변환_가이드_v1.pdf
│   ├── 판례_검수_체크리스트_v1.pdf
│   └── external/                   ← 두루 매뉴얼 5종 (활용 가능 확인됨)
│       ├── 두루_65가지_아동청소년_법률지식.pdf (864K, 79쪽)
│       ├── 두루_소년보호사건_법률지원_매뉴얼.pdf (1.2M)
│       ├── 두루_아동청소년_법률지원_실무_매뉴얼.pdf (2.1M)
│       ├── 두루_보호소년_지원_매뉴얼.pdf (2.2M)
│       └── 두루_수용자자녀_법률지원_매뉴얼.pdf (8.4M)
├── _archive/
│   ├── legal_platform_v2_1.jsx     ← 원본 프로토타입 (보존)
│   └── old_collect_attempts/       ← 이전 자동 수집 시도
└── _staging/                       ← gitignore됨, 임시 작업 공간
```

## 두루 매뉴얼 5종 — 활용 가능 (세션 4 신규)

사단법인 두루의 공익 출판물 5종 *외부 활용 허락 받음*. `docs/external/`에 정리됨:

| 파일 | 분량 | 추정 활용도 |
|---|---|---|
| **65가지 아동·청소년 법률 지식** | 864K, 79쪽 (Q&A 형식) | legal_terms·faqs 집중 |
| **소년보호사건 법률지원 매뉴얼** | 1.2M | cases (precedent) + documents |
| **아동·청소년 법률지원 실무 매뉴얼** | 2.1M | cases (alternative_resolution) + documents (최고 가치) |
| **보호소년 지원 매뉴얼** | 2.2M | cases (사후 단계) + resources |
| **수용자 자녀 법률지원 매뉴얼** | 8.4M | 직접 관련 적음, 참고용 |

다음 세션 작업: 「65가지」 79쪽 분석 + 시범 사례 1~5건 추출.

> 인수인계의 「2025 아동·청소년 법률 매뉴얼」 152쪽은 위 5종에 *없음*. 다른 폴더 또는 「실무 매뉴얼」과 동일 자료 가능성 — 두루미팀에 확인 필요.

## 자주 하는 작업 — 흐름

### 새 사례 추가하기

1. `src/data/cases/PENDING/CASE-ID.json` 파일 생성
2. **스키마 v2 (42필드)** 따르기 — `CLAUDE.md` §4
3. 필수 필드 확인:
   - 기본 10: `case_id`, `case_type`, `type_main`, `role_focus`, `stage_focus`, `school_level`, `applies_to`, `friendly_title`, `friendly_summary`, `review_status`
   - case_type별 추가 필수 (예: `case_type="precedent"` → `source_type`, `source_citation`, `original_law`, `disposition_summary`)
   - 조건부: `safety_flag=true` → `safety_banner`
4. 검증 실행:
   ```bash
   node src/lib/validateCase.test.js
   ```
   에러 없이 통과해야 OK
5. 브라우저에서 동작 확인 (HMR 자동 갱신)
6. 커밋 → PR (아래 *기여 방법* 참고)

### 두루 매뉴얼에서 자료 추출 (다음 세션부터)

`docs/external/`의 매뉴얼 5종 활용 가능. 추출 절차 (예정):

1. 매뉴얼 한 종 선택 (또는 분담받기)
2. PDF 읽고 *학폭 관련 항목* 식별
3. 카테고리 결정 (legal_terms / faqs / cases / documents 등)
4. 스키마 v2 따라 JSON 작성
5. **출처 명시 필수** — `source_citation: "두루 「OOO 매뉴얼」 Q-NN"` 등
6. *원문 그대로 인용 금지* — 추출 + 친화 변환 + 출처 명시 원칙
7. PR

자세한 추출 가이드는 *다음 세션 시범 작업 후* 작성 예정.

### 사례 검수 완료 처리

1. 두루 변호사로부터 검수 피드백 받음
2. 피드백 반영해 사례 내용 수정
3. 파일을 `PENDING/` → `REVIEWED/`로 이동:
   ```bash
   git mv src/data/cases/PENDING/CASE-ID.json src/data/cases/REVIEWED/CASE-ID.json
   ```
4. JSON 내부 필드 갱신:
   - `review_status: "검수완료"`
   - `reviewer: "변호사 이름"`
   - `reviewed_at: "YYYY-MM-DD"`
   - `review_notes: "검수 의견"`
5. 커밋 → PR

### UI 변경 (App.jsx 수정)

가능한 *지양*. App.jsx는 1316줄 단일 파일이라 변경이 *데이터 추가보다 훨씬 위험*. 꼭 필요하면:

1. 작업 전 *팀에 알리기* (GitHub Issues 또는 채팅)
2. *별도 브랜치*에서 작업
3. 변경 *최소화* — 가능하면 *한 컴포넌트만*
4. *시나리오 A·B·C* 모두 동작 확인 후 PR

## 기여 방법 — PR 흐름

`main` 브랜치에 *직접 push 금지*. 모든 변경은 *Pull Request*로:

### 1. 새 브랜치 만들기

```bash
git checkout main
git pull origin main
git checkout -b 작업주제/짧은설명
```

브랜치 이름 예시:
- `feature/add-cases-from-incheon` (새 자료 추가)
- `fix/safety-banner-styling` (버그 수정)
- `docs/update-onboarding` (문서)
- `review/sample-001-update` (검수 결과 반영)
- `data/extract-65gaji-q1-5` (두루 매뉴얼 추출)

### 2. 작업 + 커밋

```bash
# 변경 후
git add 파일경로
git commit -m "feat(data): 65가지 법률 지식 Q1~5 legal_terms 추가

- 두루 매뉴얼에서 학폭 관련 용어 5개 추출·친화 변환
- source_citation 명시
- 시나리오 A·B 동작 확인"
```

커밋 메시지 규칙:
- 첫 줄: `타입: 짧은 제목` (한글 OK)
  - 타입: `feat` / `fix` / `docs` / `refactor` / `chore` / `review`
- 빈 줄
- 본문: *왜* 변경했는지, *무엇이* 바뀌었는지
- **`Co-Authored-By` 등 AI 자동 서명 금지** — `CLAUDE.md` §9 참고

### 3. push + PR 만들기

```bash
git push origin 작업주제/짧은설명
```

GitHub 저장소 페이지에 *Compare & pull request* 버튼이 떠요. 클릭:

- 제목: 커밋 메시지 첫 줄 그대로
- 본문: *무엇을 했고 어떻게 확인했는지*
- *Reviewers* 지정 (다른 팀원 한 명 이상)

### 4. 리뷰 → 머지

리뷰어가 코드 보고 *Approve* 또는 *Request changes*. Approve 받으면 *Merge* 버튼으로 main에 머지.

## 환경 운영 — 알아두면 좋은 것

### dev 서버는 *별도 터미널*에서

- 터미널 1: dev 서버 (`npm run dev`) — 작업 내내 켜둠
- 터미널 2: 일반 명령 (`git`, `npm test` 등)

### 작업 끝나면 *반드시* dev 서버 종료

dev 서버 띄운 터미널에서 `Ctrl+C`. 끄지 않으면 *다음 세션*에 *유령 화면* 보이는 문제 발생 (실제로 한 번 겪었어요).

### Claude Code 쓸 때 주의

- **Claude Code 안에서 `npm run dev` 띄우지 말 것** — 무한 대기 발생 (세션 4에서 한 번 사고)
- Claude Code 종료 후 *프로세스 잔존 확인*:
  ```bash
  ps aux | grep -i claude | grep -v grep
  ```
  결과 비어 있어야 함. 있으면 `kill -9 <PID>`.

### PDF 자료 작업 (다음 세션부터)

두루 매뉴얼 추출 작업하려면 *poppler 필요*. 한 번만 설치:

```bash
# Homebrew 없으면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# poppler 설치
brew install poppler

# 확인
which pdftoppm   # /opt/homebrew/bin/pdftoppm 나와야 함
```

## 도움이 필요할 때

1. **`CLAUDE.md`** — 프로젝트 헌법. 분류·친화·안전·스키마 모두.
2. **`docs/SESSION_LOG.md`** — 진행 일지. *최근 어떤 작업이 어떻게 됐는지*.
3. **`docs/팀원_공유_현황보고서.md`** — 프로젝트 현황·필요한 것·다음 마일스톤.
4. **`docs/` PDF 4종** — 분류코드표·친화변환·검수체크리스트·인수인계.
5. **`docs/external/` 두루 매뉴얼 5종** — 자료 추출 원천.
6. **GitHub Issues** — 질문·이슈 등록. 다른 팀원이 답해줘요.
7. **카톡·디스코드** — 빠른 질문 (팀 채널 따로 있으면 거기).

## 팀 역할 — 자연스러운 분담

초기엔 *한 사람이 여러 역할*. 팀 커지면 분리.

| 역할 | 어떤 작업 | 필요 기술 |
|---|---|---|
| **데이터 큐레이터** | 두루 매뉴얼 5종에서 자료 추출 → PENDING/에 추가 | JSON 편집, 스키마 v2 이해 |
| **법률 검수 연락** | 두루 변호사와 검수 일정 조율, 피드백 정리 | 학폭법 기초, 커뮤니케이션 |
| **친화 변환 담당** | 원문을 학생 눈높이로 변환 | 글쓰기, 친화 변환 5원칙 |
| **개발자** | UI 개선·기능 추가·LLM 통합 | React, JS, Git |
| **테스터** | 새 사례 추가 후 브라우저 동작 확인 | 사용자 입장 사고 |
| **운영자** | SESSION_LOG 관리, 회의록, 외부 소통 | 문서화 |

## 첫 작업 추천 — 새 팀원

기술 부담 적은 것부터 추천:

1. **이 README를 *처음 입장*에서 읽어보고 *막힌 자리* 알려주기** (Issues)
2. **`docs/SESSION_LOG.md` 통독** — 프로젝트 4세션 진행 흐름 이해
3. **시나리오 A·B·C 동작 확인** — 본인 노트북에서
4. **CLAUDE.md §2 (핵심 원칙) 통독** — 작업 전 반드시
5. **두루 매뉴얼 5종 훑어보기** — `docs/external/`에서 본인이 관심 있는 거 1종
6. **첫 작은 PR** — 예: 이 README 오타 수정, 또는 본인 환경에서 발견한 작은 문제

## 미해결 이슈 — 알아두면 좋은 것

`SESSION_LOG.md`에서 자세히. 요약:

- **P2 (LLM 통합 시점 재검토)**: Step 2 키워드 버튼이 학폭 시나리오 가정. 가정폭력·자해 등 안전 분기 시 어휘 부적응. → LLM 통합 시 동적 후속 질문 생성으로 본질적 해결.
- **P3 (PR-006~010 정체 확인 필요)**: case_id에 "PR" prefix가 *precedent*를 의미하는지, 두루미팀(인수인계 작성자)에 확인 필요. 내적 증거상 SAMPLE과 동일 등급.
- **「2025 아동·청소년 법률 매뉴얼」 152쪽** 추적: 두루 매뉴얼 5종 중 *없음*. 두루미팀 확인 필요.
- **두루 변호사 검수 1차**: PENDING의 OM2 3건 검수 패키지 작성 필요.
- **인천교육청 모음집**: 「제2회 학교폭력 예방 우수사례 모음집」 재요청 필요.

## 다음 마일스톤

```
[M1] 자료 30~50건 수집·검수 완료     →  두루 협력 보고 가능 단계
     ├─ 다음 세션: 「65가지」에서 시범 추출 1~5건
     ├─ 그 후: 매뉴얼 4종 팀원 분담
     └─ 병행: 두루 변호사 검수 시작

[M2] LLM 통합 (Claude API)            →  언어 이해 능력 폭발적 향상
[M3] 벡터DB (Supabase pgvector)       →  의미 유사도 기반 사례 매칭
[M4] 백엔드 API + 배포                →  실 도메인, 외부 접근 가능
[M5] 베타 사용자 테스트               →  교사·상담사 → 학생 순
[M6] 두루 공식 협력 + 학교 노출        →  프로젝트 본 목적 도달
```

**현재 위치**: M1 진입 시작점 (두루 자료에서 진짜 사례 추출 단계).

## 마지막으로

이 프로젝트는 **세대를 이어가며 완성**되는 종류예요. 졸업·진로 변경으로 *너가 떠나도* 다음 사람이 이어갈 수 있도록:

- 모든 결정은 *깃 커밋·SESSION_LOG*에 *맥락과 함께* 기록
- *너만 아는 정보 만들지 않기* — 막힘이 있으면 문서로 보존
- *작은 진전이라도 기록* — 누가 보면 *흐름*이 보여야 함

너의 한 PR이 *다음 학기 후배의 출발점*이 돼요. 부담 갖지 말고, 도움 필요하면 *언제든* 물어봐요.

---

**문의**: GitHub Issues · 또는 두루미팀 채널
**라이선스**: (검토 후 추가 예정)
**협력**: 사단법인 두루 (공익법센터)
