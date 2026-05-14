// PENDING/ + REVIEWED/ 폴더의 JSON 사례를 자동 병합 export.
// CLAUDE.md §7-3 정책: 개발(DEV)에서는 둘 다 노출, 프로덕션에서는 REVIEWED만.
// VITE_SHOW_PENDING="true"|"false"로 명시 오버라이드 가능.
//
// Vite의 import.meta.glob은 빌드 시 폴더를 정적 스캔 → 새 JSON 추가 시 import 갱신 불필요.

const reviewedModules = import.meta.glob('./REVIEWED/*.json', { eager: true });
const pendingModules = import.meta.glob('./PENDING/*.json', { eager: true });

// case_id 기준 정렬 — App.jsx의 인라인 배열 순서를 안정 재현하지는 않지만
// 매칭 점수 순으로 결과를 보여주므로 입력 순서 의존 없음.
function sortByCaseId(modules) {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => m.default);
}

const reviewed = sortByCaseId(reviewedModules);
const pending = sortByCaseId(pendingModules);

const envFlag = import.meta.env.VITE_SHOW_PENDING;
const showPending =
  envFlag === 'true' ? true : envFlag === 'false' ? false : import.meta.env.DEV;

export const cases = showPending ? [...reviewed, ...pending] : reviewed;
export default cases;
