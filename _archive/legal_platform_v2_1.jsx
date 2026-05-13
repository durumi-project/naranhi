import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, FileText, AlertCircle, ChevronRight, ChevronLeft, Search,
  BookOpen, Shield, Phone, ArrowRight, Check, X, Sparkles,
  Users, Clock, ClipboardList, MessageCircleQuestion, ExternalLink,
  Heart, Info, ChevronDown, ChevronUp, Loader2, Home, RotateCcw,
  AlertTriangle, Code, Zap, Database, PlayCircle,
} from 'lucide-react';

/* ============================================================================
   「나란히」 프로토타입 v2 — 데이터 구동 버전
   ----------------------------------------------------------------------------
   1·2·3순위 산출물의 결합:
   - 분류 코드표 v1 → 4축 코드 체계
   - 판례 수집 가이드 → 데이터 스키마와 콘텐츠
   - 페르소나 풀 트레이스 P-001 → 6단계 사용자 여정
   ----------------------------------------------------------------------------
   1순위 프로토타입과의 차이:
   - 모든 콘텐츠가 JSON 데이터로 분리됨 (실서비스에서는 파일로 외부화)
   - 입력에 따라 *실제로 다른* 결과가 나옴 (분류·매칭·필터)
   - 안전 분기 / 신뢰도 낮음 / 보호자 대리 등 엣지 케이스 처리
   - 5순위에서 LLM·벡터 DB 연결 시 classify()/textSimilarity()만 교체
   ============================================================================ */

/* ============================================================================
   DATA — 모든 콘텐츠 (실서비스에서는 외부 JSON 파일)
   ============================================================================ */

const CASES = [
  { case_id: "SAMPLE-001", type_main: "CY", subtypes: ["VB"], role_focus: "G", stage_focus: 7, school_level: "MS",
    applies_to: ["SV-CY-G-4-MS", "SV-CY-G-5-MS", "SV-CY-G-7-MS"],
    keywords: ["단톡방", "별명", "외모", "카톡", "한 달", "거부", "그만", "학폭위", "5호"],
    decision_date: "2024-05-15",
    court: "○○교육지원청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-A-123",
    case_title_formal: "학교폭력 처분 결정",
    disposition_summary: "특별교육이수(5호 처분) 결정",
    friendly_title: "단톡방에서 별명으로 놀린 사건",
    friendly_summary: "교실 단체 카톡방에서 한 학생을 외모 관련 별명으로 약 6주간 반복적으로 부른 사건이에요. 그 친구가 명확히 그만해달라고 말한 이후에도 행위가 계속됐고, 결국 학교를 못 가는 상황까지 이르렀어요. 학교폭력으로 인정되어 신고 대상이 된 학생은 특별교육이수(5호 처분)를 받았어요.",
    recognition: "인정", category: "형사", sentence: "5호 처분",
    key_factors: ["피해 학생의 명확한 거부 의사 표명 이후에도 행위가 지속됨", "단체 채팅방이라는 공개적 성격으로 인한 모욕감 가중", "피해 학생의 등교 거부·정신과 상담 등 정신적 피해 입증"],
    not_recognized_reasons: [],
    severity_factors: ["지속성: 약 6주간 반복", "공개성: 학급 단체방 다수 노출", "사과 여부: 처분 전 진심 어린 사과로 처분 경감"]
  },
  { case_id: "SAMPLE-002", type_main: "PH", subtypes: [], role_focus: "G", stage_focus: 2, school_level: "MS",
    applies_to: ["SV-PH-G-2-MS", "SV-PH-G-2-HS"],
    keywords: ["복도", "어깨", "장난", "친한", "쌍방", "CCTV", "경미"],
    decision_date: "2024-04-22",
    court: "○○교육지원청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-B-045",
    case_title_formal: "학교폭력 사안 처리 결정",
    disposition_summary: "학교폭력 불인정 (자체해결 종결)",
    friendly_title: "복도에서 장난으로 어깨를 친 사건",
    friendly_summary: "쉬는 시간 복도에서 친한 친구 사이에 어깨를 부딪치며 장난을 주고받았던 일이 학교폭력으로 신고된 사건이에요. 평소 친밀한 친구 사이였다는 점, CCTV에서 한쪽만 일방적으로 한 게 아니라 서로 주고받았다는 점, 다친 정도가 가벼웠다는 점이 함께 고려되어 학교폭력으로는 인정되지 않았어요.",
    recognition: "불인정", category: "형사", sentence: "자체해결",
    key_factors: ["평소 친밀한 친구 사이로 일상적 신체 접촉이 있었다는 점", "CCTV와 목격자 진술로 일방적이 아닌 쌍방향적 장난임이 입증됨", "신체적 피해 정도가 경미함", "행위가 1회성이며 권력관계의 비대칭이 없었음"],
    not_recognized_reasons: ["쌍방향적 장난으로 일방적 가해로 보기 어려움", "지속성·반복성이 인정되지 않음", "권력관계의 비대칭이 없음"],
    severity_factors: ["CCTV 영상이 핵심 판단 근거", "평소 친밀도 입증 자료가 결정적", "목격자 진술의 일관성"]
  },
  { case_id: "SAMPLE-003", type_main: "OS", subtypes: [], role_focus: "G", stage_focus: 7, school_level: "ES",
    applies_to: ["SV-OS-G-4-ES", "SV-OS-G-7-ES"],
    keywords: ["체육복", "숨김", "여러 명", "5일", "집단", "초등", "수업"],
    decision_date: "2024-06-10",
    court: "경기도교육청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-C-078",
    case_title_formal: "학교폭력 처분 결정",
    disposition_summary: "사회봉사(4호) 및 학교봉사(3호) 결정",
    friendly_title: "체육복을 숨긴 사건",
    friendly_summary: "초등학교 6학년 학급에서 네 명의 학생이 한 학생의 체육복을 약 5일간 돌려가며 숨긴 사건이에요. 그 친구는 체육 수업에 참여하지 못하고 정서적으로 위축되어 상담까지 받게 됐어요. 학교폭력으로 인정되어 주도한 학생은 사회봉사(4호 처분), 함께한 세 명은 학교 봉사(3호 처분)를 받았어요.",
    recognition: "인정", category: "형사", sentence: "3~4호 처분",
    key_factors: ["재물 임의 점유로 인한 실질적·정서적 피해", "여러 명이 가담한 집단성", "피해 학생의 수업 참여에 직접적 지장 발생", "자진 반환이 없었던 점"],
    not_recognized_reasons: [],
    severity_factors: ["가담 정도에 따라 처분 차등", "사과 시점이 처분에 영향", "의무교육 대상이라 9호 처분 불가"]
  },
  { case_id: "SAMPLE-004", type_main: "CY", subtypes: [], role_focus: "V", stage_focus: 9, school_level: "HS",
    applies_to: ["SV-CY-V-1-HS", "SV-CY-V-7-HS", "SV-CY-V-9-HS"],
    keywords: ["SNS", "비공개", "캡처", "유포", "단톡방", "정보통신망법", "휴학", "정신과"],
    decision_date: "2024-08-30",
    court: "인천지방법원",
    case_number: "(가상) 2024고단5678",
    case_title_formal: "정보통신망이용촉진및정보보호등에관한법률위반(명예훼손)",
    disposition_summary: "징역 6월, 집행유예 2년 (학폭위 6호 처분 별도)",
    friendly_title: "SNS 비공개 사진을 단톡방에 유포한 사건",
    friendly_summary: "고등학생이 다른 학생의 비공개 SNS 게시물을 동의 없이 캡처해 학년 단체방 세 곳에 유포한 사건이에요. 피해 학생은 정신과 진단을 받고 휴학까지 이르렀어요. 학교폭력으로 인정되어 출석정지(6호 처분)가 결정됐고, 정보통신망법 위반으로 형사 절차도 함께 진행됐어요.",
    recognition: "인정", category: "형사·민사", sentence: "6호 + 형사",
    key_factors: ["비공개 게시물의 무단 캡처·유포", "디지털 흔적의 광범위한 확산성", "피해자의 명시적 거부 의사 무시", "학폭과 형사 절차의 병행"],
    not_recognized_reasons: [],
    severity_factors: ["확산 범위가 처분 수위에 결정적", "게시물의 사적 성격이 강할수록 가중", "형사 절차 병행으로 변호사 조력 필요"]
  },
  { case_id: "SAMPLE-005", type_main: "CO", subtypes: [], role_focus: "G", stage_focus: 7, school_level: "MS",
    applies_to: ["SV-CO-G-4-MS", "SV-CO-G-7-MS"],
    keywords: ["빵", "강요", "체육시간", "셔틀", "위압", "3주", "다수"],
    decision_date: "2024-05-28",
    court: "경기도교육청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-D-156",
    case_title_formal: "학교폭력 처분 결정",
    disposition_summary: "학교에서의 봉사(3호) 결정",
    friendly_title: "체육시간 빵 강요 사건",
    friendly_summary: "중학생 세 명이 약 3주 동안 체육시간 직전마다 한 학생에게 매점에서 빵을 사오라고 반복적으로 요구한 사건이에요. 협박은 없었지만 여러 명이 함께 요구한 분위기 자체가 압박이 됐다는 점이 인정되어 학교폭력으로 판단됐고, 가담한 세 명 모두 학교 봉사(3호 처분)를 받았어요.",
    recognition: "일부인정", category: "형사", sentence: "3호 처분",
    key_factors: ["다수가 함께 요구한 점이 위압으로 인정됨", "약 3주간 반복된 점", "경제적 손실이 동반된 점"],
    not_recognized_reasons: [],
    severity_factors: ["명시적 협박이 없어 처분 수위는 낮은 편", "가담자가 다수일 때 각자에게 처분 부과", "자진 사과 및 비용 변상 시 처분 경감 가능"]
  },
  { case_id: "PR-006", type_main: "CY", subtypes: ["VB"], role_focus: "G", stage_focus: 4, school_level: "HS",
    applies_to: ["SV-CY-G-4-HS", "SV-CY-G-7-HS"],
    keywords: ["인스타", "DM", "욕설", "고등학생", "여러 번", "차단"],
    decision_date: "2024-09-12",
    court: "○○교육지원청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-E-234",
    case_title_formal: "학교폭력 처분 결정",
    disposition_summary: "출석정지(6호 처분) 결정",
    friendly_title: "인스타 DM으로 욕설을 보낸 사건",
    friendly_summary: "고등학생이 같은 학교 학생에게 인스타그램 다이렉트 메시지로 욕설을 약 2주간 보낸 사건이에요. 받는 학생이 차단했음에도 다른 계정으로 우회해 계속 보냈어요. 학교폭력으로 인정되어 출석정지(6호 처분)를 받았어요.",
    recognition: "인정", category: "형사", sentence: "6호 처분",
    key_factors: ["차단 회피 행위가 거부 의사 무시로 평가됨", "디지털 증거가 명확하게 보존됨", "고등학생이라 9호 처분도 가능했으나 6호로 결정"],
    not_recognized_reasons: [],
    severity_factors: ["차단 우회는 가중 사유", "고등학교는 의무교육 아니라 처분 범위 넓음"]
  },
  { case_id: "PR-007", type_main: "CY", subtypes: [], role_focus: "B", stage_focus: 2, school_level: "HS",
    applies_to: ["SV-CY-B-2-HS", "SV-CY-B-7-HS"],
    keywords: ["게임", "보이스챗", "쌍방", "욕설", "양측", "고등학생"],
    decision_date: "2024-07-05",
    court: "○○교육지원청 학교폭력대책심의위원회",
    case_number: "(가상) 학폭위 결정 2024-F-189",
    case_title_formal: "학교폭력 처분 결정",
    disposition_summary: "쌍방 서면사과(1호) 결정",
    friendly_title: "온라인 게임 보이스챗 욕설 쌍방 사건",
    friendly_summary: "같은 학교 친구 두 명이 온라인 게임 보이스챗에서 서로 욕설을 주고받은 사건이에요. 양쪽 다 신고했고, 두 명 모두 학교폭력으로 인정되어 쌍방 1호 처분(서면사과)을 받았어요.",
    recognition: "인정", category: "형사", sentence: "쌍방 1호 처분",
    key_factors: ["쌍방 가해·피해 관계가 동시에 인정됨", "학교 외부 시간이지만 학생 간 관계가 학교생활에 영향", "욕설 수위와 빈도가 양측 비슷함"],
    not_recognized_reasons: [],
    severity_factors: ["쌍방 사건은 양측 책임을 함께 검토", "먼저 시작한 사람에 대한 처분 가중 가능", "자율적 화해 시 처분 경감"]
  },
  { case_id: "PR-008", type_main: "PH", subtypes: ["VB"], role_focus: "G", stage_focus: 8, school_level: "MS",
    applies_to: ["SV-PH-G-7-MS", "SV-PH-G-8-MS"],
    keywords: ["행정심판", "7호", "학급교체", "불복", "전치", "치료"],
    decision_date: "2024-11-20",
    court: "서울특별시교육청 행정심판위원회",
    case_number: "(가상) 2024행심1234",
    case_title_formal: "학교폭력 처분 취소 청구",
    disposition_summary: "청구 기각 (원처분 7호 학급교체 유지)",
    friendly_title: "신체폭력 7호 처분 후 행정심판 사건",
    friendly_summary: "중학생이 친구를 폭행해 전치 2주의 상해를 입혔고, 학폭위에서 학급교체(7호 처분)가 결정됐어요. 신고를 받은 학생 측은 처분이 과하다고 보고 행정심판을 청구했지만, 행정심판위원회는 원처분을 유지했어요.",
    recognition: "인정", category: "형사", sentence: "7호 처분 유지",
    key_factors: ["전치 2주 이상이라 자체해결 불가능", "학폭위 처분의 재량 범위 내라고 인정됨", "행정심판 청구 자체는 정당한 권리 행사"],
    not_recognized_reasons: [],
    severity_factors: ["행정심판은 90일 이내 청구 가능", "집행정지 함께 신청해야 처분 미뤄짐", "원처분 유지율이 높은 편이므로 변호사 조력 권장"]
  },
  { case_id: "PR-009", type_main: "EX", subtypes: ["CO"], role_focus: "V", stage_focus: 1, school_level: "MS",
    applies_to: ["SV-EX-V-1-MS", "SV-EX-V-2-MS"],
    keywords: ["선배", "돈", "갈취", "한 달", "만 원", "신고", "50만원"],
    decision_date: "2024-10-08",
    court: "○○중학교 학교폭력 전담기구",
    case_number: "(가상) 학내 신고 2024-09-15",
    case_title_formal: "학교폭력 사실 확인 조사",
    disposition_summary: "(조사 진행 중, 학폭위 회부 예정)",
    friendly_title: "선배에게 한 달간 금품을 빼앗긴 사건",
    friendly_summary: "중학생이 선배에게 한 달간 매주 만 원씩 빼앗긴 사건이에요. 부모님과 함께 학교에 신고했고, 50만 원 미만이지만 지속적인 갈취였기 때문에 학교폭력으로 접수되어 사실 확인 조사가 진행됐어요.",
    recognition: "인정", category: "형사", sentence: "(처분 진행 중)",
    key_factors: ["선후배 권력관계가 명확", "지속적 반복으로 갈취 인정", "위계관계가 있는 인간관계로 보기 어려운 위계"],
    not_recognized_reasons: [],
    severity_factors: ["50만 원 이상이면 자체해결 불가", "선후배 관계는 권력 비대칭 가중 요소", "지속성이 처분 수위 결정에 핵심"]
  },
  { case_id: "PR-010", type_main: "OS", subtypes: [], role_focus: "V", stage_focus: 0, school_level: "ES",
    applies_to: ["SV-OS-V-0-ES", "SV-OS-V-1-ES"],
    keywords: ["따돌림", "초등", "학급", "무시", "보호자", "신고고민"],
    decision_date: null,
    court: "(해당 없음 · 미신고 단계)",
    case_number: "(미신고 단계)",
    case_title_formal: "(학교 신고 전)",
    disposition_summary: "(절차 미시작)",
    friendly_title: "초등학교 학급에서 따돌림을 당하는 사건",
    friendly_summary: "초등학교 5학년 학생이 학급 내에서 점차 따돌림을 당하고 있는 상황이에요. 친구들이 말을 걸지 않고 모둠활동에서 빼는 행동이 한 달째 계속되고 있어요. 보호자가 학교에 신고할지 고민 중인 단계예요.",
    recognition: "(미신고)", category: "—", sentence: "(미진행)",
    key_factors: ["장기간 지속된 무시·소외 행위", "초등학생의 정서적 위축이 우려됨", "신고 결정 자체가 어려운 단계"],
    not_recognized_reasons: [],
    severity_factors: ["신고 전에도 담임·학교상담사 면담 가능", "117 학교폭력 신고센터 익명 상담 가능", "보호자가 함께 학교에 면담 요청 추천"]
  }
];

const DOCUMENTS = [
  { doc_id: "DOC-001", name: "사건 경위서", description: "언제, 어디서, 누구와, 어떤 일이 있었는지 시간 순서로 정리한 글", priority: "high",
    applies_to: ["SV-*-G-2-*", "SV-*-G-4-*", "SV-*-G-5-*", "SV-*-V-2-*", "SV-*-V-4-*"] },
  { doc_id: "DOC-002", name: "소명서", description: "본인의 입장을 정리하거나 잘못한 부분에 대해 설명하는 글", priority: "high",
    applies_to: ["SV-*-G-4-*", "SV-*-G-5-*", "SV-*-G-6-*"] },
  { doc_id: "DOC-003", name: "카톡·SNS 대화 내역 캡처", description: "관련된 대화가 있다면 시간이 보이도록 캡처. 사이버 사건의 핵심 증거", priority: "high",
    applies_to: ["SV-CY-*-*-*", "SV-VB-*-*-*"] },
  { doc_id: "DOC-004", name: "평소 친밀도 입증 자료", description: "평소 사이가 좋았다는 점을 보여주는 메시지·사진", priority: "mid",
    applies_to: ["SV-CY-G-*", "SV-PH-G-*", "SV-VB-G-*"] },
  { doc_id: "DOC-005", name: "사과 시도 기록", description: "사건 후 사과를 시도한 내역 (메시지·편지·면담 기록 등)", priority: "mid",
    applies_to: ["SV-*-G-4-*", "SV-*-G-5-*", "SV-*-G-6-*"] },
  { doc_id: "DOC-006", name: "담임·상담교사 의견서", description: "평소 학교생활에 대한 선생님의 의견", priority: "mid",
    applies_to: ["SV-*-G-4-*", "SV-*-G-5-*", "SV-*-V-4-*"] },
  { doc_id: "DOC-007", name: "가족 진술서", description: "평소 성격이나 가정 내 분위기에 대한 보호자의 글", priority: "low",
    applies_to: ["SV-*-G-4-*", "SV-*-G-5-*"] },
  { doc_id: "DOC-008", name: "CCTV·목격자 영상 자료", description: "사건 당시 상황을 보여주는 영상 또는 사진", priority: "high",
    applies_to: ["SV-PH-*-*-*", "SV-CO-*-*-*"] },
  { doc_id: "DOC-009", name: "목격자 진술서", description: "같은 반 친구나 사건 현장에 있던 사람의 진술", priority: "mid",
    applies_to: ["SV-PH-*-2-*", "SV-OS-*-2-*", "SV-CO-*-2-*"] },
  { doc_id: "DOC-010", name: "치료·상담 기록", description: "병원 진료, 상담, 정신과 진단 기록", priority: "high",
    applies_to: ["SV-*-V-*-*"] },
  { doc_id: "DOC-011", name: "행정심판 청구서", description: "학폭위 처분에 불복할 때 작성하는 서류", priority: "high",
    applies_to: ["SV-*-*-8-*"] },
  { doc_id: "DOC-012", name: "보호자 동의서·위임장", description: "보호자가 자녀의 절차에 함께 참여한다는 서류", priority: "mid",
    applies_to: ["SV-*-*-4-*", "SV-*-*-6-*"] }
];

const LEGAL_TERMS = [
  { term_id: "T-001", term: "학교폭력대책심의위원회 (학폭위)",
    applies_to: ["SV-*-*-4-*", "SV-*-*-5-*", "SV-*-*-6-*", "SV-*-*-7-*"],
    explanation: {
      ES: "학교폭력 사건이 일어났을 때 어떻게 처리할지 결정하는 회의예요. 선생님과 부모님 같은 어른들이 모여서 이야기해요.",
      MS: "학교폭력 사건이 일어났을 때 어떻게 처리할지 결정하는 회의예요. 교육지원청에 설치되어 있고, 선생님·학부모·법조인 등이 참여해요.",
      HS: "학교폭력 사건의 처분을 결정하는 심의기구예요. 교육지원청에 설치되어 있으며, 비공개로 진행됩니다."
    }
  },
  { term_id: "T-002", term: "1호~9호 처분",
    applies_to: ["SV-*-*-7-*", "SV-*-G-4-*", "SV-*-G-5-*"],
    explanation: {
      ES: "학폭위에서 결정하는 처분의 종류예요. 1호(서면사과)부터 9호(퇴학)까지 9가지가 있어요.",
      MS: "학폭위에서 결정하는 처분의 종류예요. 1호(서면사과)부터 9호(퇴학)까지 있어요. 9호 퇴학은 의무교육 대상이 아닌 고등학생부터 가능해요.",
      HS: "학교폭력예방법 제17조 제1항이 정한 9가지 처분. 1호 서면사과부터 9호 퇴학까지."
    }
  },
  { term_id: "T-003", term: "보호처분",
    applies_to: ["SV-*-*-9-*"],
    explanation: {
      ES: "잘못한 청소년이 처벌 대신 받는 도움이에요.",
      MS: "만 10~19세 청소년이 범죄를 저질렀을 때 형벌 대신 받는 조치예요. 처벌이 아니라 다시 잘 살 수 있게 도와주는 성격이에요.",
      HS: "소년법에 따른 보호처분. 형사처벌 대신 부과되는 조치로, 1호부터 10호까지의 처분이 있습니다."
    }
  },
  { term_id: "T-004", term: "행정심판",
    applies_to: ["SV-*-*-8-*"],
    explanation: {
      ES: "학폭위 결정이 부당하다고 생각될 때 다시 봐달라고 요청하는 절차예요.",
      MS: "학폭위 결정이 부당하다고 생각될 때 '다시 봐달라'고 요청하는 절차예요. 처분 받은 날부터 90일 이내에 신청할 수 있어요.",
      HS: "행정처분에 대한 불복절차. 처분일로부터 90일 이내, 시·도 교육청 행정심판위원회에 청구."
    }
  },
  { term_id: "T-005", term: "자체해결",
    applies_to: ["SV-*-*-3-*"],
    explanation: {
      ES: "학교에서 직접 해결하는 거예요. 학폭위까지 안 가도 되는 가벼운 사건일 때 가능해요.",
      MS: "학폭위 안 거치고 학교에서 직접 해결. 가벼운 사건이고 양측이 동의해야 해요.",
      HS: "학교장 자체해결제. 일정 요건(전치 2주 미만, 재산상 피해 50만 원 미만 등)을 모두 충족해야 가능."
    }
  },
  { term_id: "T-006", term: "촉법소년",
    applies_to: ["SV-*-*-*-ES"],
    explanation: {
      ES: "만 10살부터 13살까지의 어린이·청소년이에요. 법을 어겨도 형사처벌은 받지 않아요.",
      MS: "만 10세 이상 14세 미만 청소년. 형사처벌은 받지 않지만 보호처분은 받을 수 있어요.",
      HS: "만 10세 이상 14세 미만으로 형벌법령에 저촉되는 행위를 한 자. 소년보호사건으로만 다뤄짐."
    }
  },
  { term_id: "T-007", term: "쌍방 사건",
    applies_to: ["SV-*-B-*-*"],
    explanation: {
      ES: "두 사람이 서로 가해자이자 피해자인 사건이에요.",
      MS: "서로가 서로에게 가해 행위를 한 사건. 양쪽 다 가해자이자 피해자가 되며, 각자의 행위에 대해 따로 판단해요.",
      HS: "양 당사자가 모두 가해 행위를 한 사건. 학폭위는 각 행위에 대해 별개로 처분을 부과할 수 있습니다."
    }
  },
  { term_id: "T-008", term: "정보통신망법",
    applies_to: ["SV-CY-*-*-*"],
    explanation: {
      ES: "인터넷에서 다른 사람을 괴롭히면 안 된다는 법이에요.",
      MS: "인터넷·SNS에서 다른 사람의 명예를 훼손하거나 괴롭히면 형사처벌까지 받을 수 있는 법이에요.",
      HS: "「정보통신망 이용촉진 및 정보보호 등에 관한 법률」. 학폭과 별도로 형사 절차가 진행될 수 있습니다."
    }
  },
  { term_id: "T-009", term: "의무교육 대상",
    applies_to: ["SV-*-*-*-ES", "SV-*-*-*-MS"],
    explanation: {
      ES: "초등학교와 중학교는 누구나 다녀야 하는 학교예요. 그래서 9호 처분(퇴학)은 받을 수 없어요.",
      MS: "초·중학생은 의무교육 대상이라 9호 처분(퇴학)을 받지 않아요. 8호(전학)까지가 최대.",
      HS: "초·중등교육법상 의무교육 대상은 초등 6년·중등 3년."
    }
  },
  { term_id: "T-010", term: "소명자료",
    applies_to: ["SV-*-G-4-*", "SV-*-G-5-*"],
    explanation: {
      ES: "내가 어떤 상황이었는지 설명하는 자료예요.",
      MS: "본인의 입장을 설명하기 위해 제출하는 자료예요. 사진, 대화 내역, 목격자 글 같은 것들이 해당돼요.",
      HS: "본인의 입장·주장을 뒷받침하는 증거자료의 총칭."
    }
  }
];

const FAQS = [
  { faq_id: "F-001", applies_to: ["SV-*-G-4-*", "SV-*-G-5-*", "SV-*-G-6-*"], priority: "high",
    q: "학폭위는 어떻게 진행되나요?",
    a: "학교에서 사건 조사를 마치면 교육지원청에서 학폭위가 열려요. 보통 사건 발생 후 2~3주 안에 진행되며, 본인과 보호자가 함께 출석해서 입장을 말할 수 있어요. 변호사가 함께 갈 수도 있어요. 회의는 비공개로 진행되고, 발언은 짧게(보통 5~10분 이내) 정리해서 하는 게 좋아요." },
  { faq_id: "F-002", applies_to: ["SV-*-G-4-*", "SV-*-G-5-*"], priority: "high",
    q: "변호사 없이 출석해도 괜찮나요?",
    a: "괜찮아요. 다만 처분 수위가 높을 것 같거나(7호 이상), 사건이 복잡할 때는 도움을 받는 게 좋아요. 비용이 부담된다면 대한법률구조공단(132번)이나 청소년 무료 법률 지원을 받을 수 있어요." },
  { faq_id: "F-003", applies_to: ["SV-*-*-7-*", "SV-*-*-8-*"], priority: "high",
    q: "처분에 동의하지 않으면 어떻게 하나요?",
    a: "처분 받은 날부터 90일 이내에 행정심판을 청구할 수 있어요. 시·도 교육청 행정심판위원회에 신청해요. 신청한다고 처분이 자동으로 멈추는 건 아니지만, '집행정지'를 함께 신청하면 결과가 나올 때까지 처분을 미룰 수 있어요." },
  { faq_id: "F-004", applies_to: ["SV-*-G-7-*"], priority: "mid",
    q: "학폭위 결과가 생활기록부에 남나요?",
    a: "네, 일부 처분은 학교생활기록부에 기재돼요. 다만 1~3호 처분 중 일부는 졸업과 동시에 삭제되고, 더 무거운 처분도 일정 기간 후 삭제 절차가 있어요." },
  { faq_id: "F-005", applies_to: ["SV-*-G-9-*", "SV-PH-*-*-*", "SV-SX-*-*-*"], priority: "high",
    q: "경찰 조사는 따로 받게 되나요?",
    a: "학교폭력 사건이 동시에 형사 사건에 해당하면 별도로 경찰 조사가 진행될 수 있어요. 만 14세 이상이면 소년보호사건 또는 형사사건으로, 만 14세 미만은 소년보호사건으로만 다뤄져요." },
  { faq_id: "F-006", applies_to: ["SV-*-G-3-*", "SV-*-G-4-*"], priority: "mid",
    q: "피해 학생과 화해하면 처분이 가벼워지나요?",
    a: "진심 어린 사과와 합의는 처분 결정에 영향을 줄 수 있어요. 다만 강제로 합의를 요구하는 건 안 되고, 학교 측 또는 분쟁조정을 통해 진행하는 게 안전해요." },
  { faq_id: "F-007", applies_to: ["SV-CY-*-*-*"], priority: "high",
    q: "단톡방 캡처본은 어떻게 모으나요?",
    a: "전체 대화 흐름이 보이도록 시간·날짜가 잘리지 않게 캡처하세요. 단톡방은 참여자 명단도 함께 캡처하면 좋아요. 캡처본은 한 번 모아두면 나중에 단톡방이 사라져도 증거로 쓸 수 있어요." },
  { faq_id: "F-008", applies_to: ["SV-CY-G-*", "SV-VB-G-*"], priority: "mid",
    q: "평소 친했던 친구라는 점이 변호 사유가 되나요?",
    a: "맥락 자료로는 도움이 될 수 있어요. 평소 친밀했던 메시지·사진을 모아 '쌍방향적 관계였다'는 점을 보여주면 학폭 인정 여부 판단에 영향을 줄 수 있어요." },
  { faq_id: "F-009", applies_to: ["SV-*-V-0-*", "SV-*-V-1-*"], priority: "high",
    q: "신고하기 전에 무엇을 해야 하나요?",
    a: "먼저 증거를 보존하세요. 메시지 캡처, 일기 형식의 메모, 목격자 연락처 등이 핵심이에요. 신뢰하는 어른(부모·담임·상담교사) 한 명에게 먼저 알리는 것이 좋고, 117(학교폭력 신고센터)이나 1388(청소년 사이버상담)에 익명으로 상담받는 것도 가능해요." },
  { faq_id: "F-010", applies_to: ["SV-*-G-*-ES", "SV-*-G-*-MS"], priority: "mid",
    q: "9호 처분(퇴학) 받을 수도 있나요?",
    a: "초등학생과 중학생은 의무교육 대상이라 9호 처분(퇴학)을 받지 않아요. 8호 전학까지가 최대예요. 고등학생부터는 9호도 가능합니다." }
];

const RESOURCES = [
  { res_id: "R-001", name: "청소년 사이버 상담센터", phone: "1388", description: "24시간 무료 상담. 채팅·전화·게시판 가능", tags: ["상담", "익명"], applies_to: ["SV-*-*-*-*"], priority_for_types: ["CY", "VB", "OS"] },
  { res_id: "R-002", name: "학교폭력 신고센터", phone: "117", description: "경찰청 운영. 익명 신고 가능", tags: ["신고", "익명"], applies_to: ["SV-*-V-0-*", "SV-*-V-1-*"], priority_for_types: ["PH", "SX", "CO", "EX"] },
  { res_id: "R-003", name: "대한법률구조공단", phone: "132", description: "청소년 무료 법률상담 및 변호사 연계", tags: ["법률", "무료"], applies_to: ["SV-*-G-4-*", "SV-*-G-5-*", "SV-*-G-8-*"], priority_for_types: [] },
  { res_id: "R-004", name: "두루 (공익법센터)", phone: "duroo.org", description: "아동·청소년 인권 전문 변호사 단체", tags: ["전문", "인권"], applies_to: ["SV-*-V-*", "SV-*-G-*"], priority_for_types: [] },
  { res_id: "R-005", name: "청소년인권운동연대 지음", phone: "youthhr.org", description: "어린이청소년인권상담소 운영", tags: ["인권", "상담"], applies_to: ["SV-*-V-*"], priority_for_types: ["OS", "SX"] },
  { res_id: "R-006", name: "여성긴급전화", phone: "1366", description: "가정폭력·성폭력 24시간 상담·보호", tags: ["긴급", "보호"], applies_to: ["SV-SX-V-*"], priority_for_types: ["SX"], is_emergency: true },
  { res_id: "R-007", name: "아동권리보장원", phone: "1577-1391", description: "아동학대 신고 및 보호 조치", tags: ["보호", "신고"], applies_to: ["SV-*-V-*-ES"], priority_for_types: [] },
  { res_id: "R-008", name: "교육지원청 학폭 담당관", phone: "지역별 다름", description: "학폭위 심의 직접 담당. 절차 문의 가능", tags: ["공식"], applies_to: ["SV-*-*-4-*", "SV-*-*-5-*", "SV-*-*-7-*"], priority_for_types: [] }
];

const QUESTION_TREES = {
  CY_G: { tree_id: "CY_G", questions: [
    { id: "q1", text: "신고된 단톡방은 어떤 성격이야?", options: ["학급 단톡방", "친한 친구 단톡", "외부 학년 포함 채팅방", "잘 모르겠어요"] },
    { id: "q2", text: "'그만해달라'고 한 시점 이후 너는 어떻게 했어?", options: ["바로 멈췄어요", "한두 번 더 했어요", "계속했어요", "거부 의사가 있었는지 잘 모르겠어요"] },
    { id: "q3", text: "카톡 대화 캡처본이나 대화 내역은?", options: ["캡처본 있어요", "단톡방에 아직 남아있어요", "삭제됐어요", "잘 모르겠어요"] },
    { id: "q4", text: "학폭위 출석일까지 며칠 남았어?", options: ["1주 이내", "1~2주", "2주 이상", "아직 모름"] },
    { id: "q5", text: "보호자(부모님)는 알고 있어?", options: ["네 알아요", "부분적으로 알아요", "모르세요"] }
  ]},
  PH_G: { tree_id: "PH_G", questions: [
    { id: "q1", text: "사건이 일어난 장소는?", options: ["학교 안 (교실·복도)", "학교 안 (체육관·운동장)", "학교 밖", "온라인+오프라인 혼합"] },
    { id: "q2", text: "다친 정도는 어땠어?", options: ["다치지 않음", "가벼운 멍·찰과상", "병원 진료 받음 (전치 2주 미만)", "전치 2주 이상"] },
    { id: "q3", text: "CCTV가 있을 만한 장소였어?", options: ["네, 있어요", "잘 모르겠어요", "없어요"] },
    { id: "q4", text: "지금 어느 단계까지 왔어?", options: ["담임 면담만 함", "학교폭력 전담기구 조사 중", "학폭위 출석 통보 받음", "아직 신고 안 됨"] },
    { id: "q5", text: "보호자(부모님)는 알고 있어?", options: ["네 알아요", "부분적으로 알아요", "모르세요"] }
  ]},
  OS_V: { tree_id: "OS_V", questions: [
    { id: "q1", text: "따돌림이 얼마나 지속되고 있어?", options: ["며칠 정도", "몇 주", "한 달 이상", "잘 모르겠어요"] },
    { id: "q2", text: "지금 학교에 가는 게 어렵니?", options: ["등교는 하고 있어요", "결석하는 날이 늘었어요", "학교 가기가 너무 힘들어요", "이미 결석 중이에요"] },
    { id: "q3", text: "신뢰할 수 있는 어른이 주변에 있어?", options: ["부모님과 잘 지내요", "담임 선생님과 이야기 가능", "상담 선생님과 이야기 가능", "혼자 해결하고 싶어요"] },
    { id: "q4", text: "지금까지 어떤 행동들이 있었어?", options: ["말 걸지 않음·무시", "험담·소문", "단톡방 따돌림", "여러 가지 동시"] }
  ]},
  CY_V: { tree_id: "CY_V", questions: [
    { id: "q1", text: "유포된 내용은 어떤 종류야?", options: ["내 사진/영상", "내 메시지·게시물", "허위 사실·소문", "여러 가지"] },
    { id: "q2", text: "캡처본·증거 자료는?", options: ["많이 가지고 있어요", "조금 있어요", "별로 없어요"] },
    { id: "q3", text: "지금 어느 단계까지 왔어?", options: ["아직 신고 안 함", "학교에 신고됨", "학폭위 통보 받음", "처분 결정됨"] },
    { id: "q4", text: "신뢰할 수 있는 어른이 주변에 있어?", options: ["부모님과 잘 지내요", "담임/상담 선생님", "혼자 해결하고 싶어요"] }
  ]},
  DEFAULT: { tree_id: "DEFAULT", questions: [
    { id: "q1", text: "지금 너는 어떤 입장이야?", options: ["신고를 당한 쪽 (가해자로 지목됨)", "신고를 한 쪽 (피해를 입었음)", "둘 다 (쌍방 신고)", "아직 잘 모르겠어요"] },
    { id: "q2", text: "지금 어느 단계까지 왔어?", options: ["아직 학교에 알리지 않음", "학교에서 조사 중", "학폭위 통보 받음", "처분 결정됨"] },
    { id: "q3", text: "보호자(부모님)는 알고 있어?", options: ["네 알아요", "부분적으로 알아요", "모르세요"] }
  ]}
};

const PROCEDURE_STAGES = [
  { stage: 0, label: "미인지·미신고", description: "사건만 발생, 학교에 알리지 않음" },
  { stage: 1, label: "학교 인지·신고 접수", description: "학교에 신고됨, 전담기구 인지" },
  { stage: 2, label: "사실 확인 조사 중", description: "전담기구 조사 진행 중" },
  { stage: 3, label: "학교장 자체해결 검토", description: "경미사안일 때" },
  { stage: 4, label: "학폭위 심의 통보", description: "심의위원회 출석 통보 받음" },
  { stage: 5, label: "학폭위 심의 직전", description: "심의 임박 (1주 이내)" },
  { stage: 6, label: "학폭위 심의 진행 중", description: "심의 당일 또는 직후" },
  { stage: 7, label: "처분 결정·통보", description: "처분 결과를 받음" },
  { stage: 8, label: "불복 절차 진행", description: "행정심판/행정소송" },
  { stage: 9, label: "형사·민사 병행", description: "별도 형사 또는 민사 절차" }
];

/* ============================================================================
   LIB — 핵심 로직 함수 (5순위에서 LLM·벡터 DB로 교체될 자리)
   ============================================================================ */

const KEYWORD_RULES = {
  SAFETY: [
    { keywords: ['집에서 도망', '죽고 싶', '죽을 것 같', '자해', '자살'], action: 'urgent_self_harm' },
    { keywords: ['아빠가 때', '엄마가 때', '아버지가 때', '어머니가 때', '부모가 때', '집에서 맞', '맞고 살'], action: 'urgent_domestic' },
  ],
  type: {
    CY: ['카톡', '단톡', '단체방', 'sns', '인스타', '디엠', 'dm', '온라인', '게시글', '댓글', '캡처', '유포', '딥페이크', '게임', '보이스챗'],
    SX: ['성희롱', '성추행', '성폭행', '성적', '몸을 만', '강제로 키스', '음란'],
    PH: ['때렸', '때려', '폭행', '맞았', '맞아', '밀쳤', '발로 차', '주먹', '머리채', '복도에서', '체육관'],
    EX: ['돈을 빼앗', '돈 빼앗', '돈 요구', '갈취', '물건을 빼앗', '강요해서 돈'],
    CO: ['빵셔틀', '셔틀', '심부름', '강요', '시켜서', '억지로 시'],
    OS: ['따돌림', '왕따', '소외', '무시', '말 안 걸', '집단으로'],
    VB: ['욕설', '욕', '비방', '모욕', '명예훼손', '협박', '위협'],
  },
  role: {
    G: ['신고당했', '신고를 받았', '가해자로', '학폭위에 출석', '소명', '내가 한 일'],
    V: ['신고했', '당했', '피해', '도와주세요', '괴롭혀', '맞았어'],
    B: ['둘 다', '쌍방', '서로', '양쪽 다'],
    P: ['우리 아이', '제 아이', '자녀가', '딸이', '아들이'],
  },
  stage: {
    9: ['형사', '경찰서', '재판'],
    8: ['행정심판', '불복', '재심'],
    7: ['처분 받았', '처분 결정', '처분이 나왔', '5호', '6호', '7호', '8호'],
    5: ['학폭위 곧', '학폭위 직전', '며칠 남'],
    4: ['학폭위', '심의위원회', '출석 통보', '출석하라'],
    2: ['조사 중', '사실 확인', '담임이 조사', '전담기구'],
    1: ['신고가 들어', '신고가 접수', '학교에 신고됐'],
    0: ['아직 신고', '신고할까', '신고 안'],
  },
  features: {
    persistence: ['한 달', '몇 주', '계속', '반복', '지속'],
    refusal_after_refusal: ['그만하라고 했는데', '거부했는데', '하지 말라고 했는데'],
    digital_evidence: ['캡처', '단톡방에 남', '저장돼', '대화 내역'],
    relationship_close: ['친한', '친했', '친구였', '평소'],
  },
};

function inferSchoolLevel(ageBand) {
  const map = {
    '7세 미만':   { school_level: 'ES', under_10: true,  criminal_resp: false, p9_eligible: false },
    '8-10세':     { school_level: 'ES', under_10: false, criminal_resp: false, p9_eligible: false },
    '11-13세':    { school_level: 'ES', under_10: false, criminal_resp: false, p9_eligible: false },
    '14-15세':    { school_level: 'MS', under_10: false, criminal_resp: true,  p9_eligible: false },
    '16-17세':    { school_level: 'HS', under_10: false, criminal_resp: true,  p9_eligible: true },
    '18세 이상':  { school_level: 'OT', under_10: false, criminal_resp: true,  p9_eligible: true },
  };
  return map[ageBand] || { school_level: 'OT' };
}

function classify(text) {
  const t = text.toLowerCase();

  for (const safety of KEYWORD_RULES.SAFETY) {
    if (safety.keywords.some(k => t.includes(k))) {
      return { is_safety_branch: true, safety_action: safety.action, confidence: 1.0 };
    }
  }

  const score = (rules) => {
    const result = {};
    for (const [code, keywords] of Object.entries(rules)) {
      let s = 0;
      for (const kw of keywords) if (t.includes(kw)) s += 1;
      if (s > 0) result[code] = s;
    }
    return result;
  };

  const typeScores = score(KEYWORD_RULES.type);
  const roleScores = score(KEYWORD_RULES.role);
  const stageScores = score(KEYWORD_RULES.stage);

  const top = (scores, fallback) => {
    const entries = Object.entries(scores);
    if (entries.length === 0) return [fallback, 0];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  };

  const [type_main, typeScore] = top(typeScores, 'PH');
  const [role, roleScore] = top(roleScores, 'V');
  const [stageStr, stageScore] = top(stageScores, '0');
  const stage_signal = parseInt(stageStr);

  const subtypes = [];
  if (type_main !== 'VB' && typeScores.VB > 0) subtypes.push('VB');

  const features = {};
  for (const [feat, kws] of Object.entries(KEYWORD_RULES.features)) {
    features[feat] = kws.some(k => t.includes(k));
  }

  const totalScore = typeScore + roleScore + stageScore;
  const confidence = Math.min(1.0, 0.4 + totalScore * 0.08);

  return {
    is_safety_branch: false,
    type_main, subtypes, role, stage_signal,
    confidence: Math.round(confidence * 100) / 100,
    features,
    raw_scores: { type: typeScores, role: roleScores, stage: stageScores },
  };
}

function selectQuestionTree(type, role) {
  const key = `${type}_${role}`;
  return QUESTION_TREES[key] || QUESTION_TREES.DEFAULT;
}

function matchAppliesTo(userCode, pattern) {
  const u = userCode.split('-');
  const p = pattern.split('-');
  if (u.length !== p.length) return false;
  return p.every((part, i) => part === '*' || part === u[i]);
}

function matchAnyPattern(userCode, patterns) {
  return patterns.some(p => matchAppliesTo(userCode, p));
}

function codeMatchWeight(userCode, patterns) {
  let best = 0;
  for (const p of patterns) {
    if (!matchAppliesTo(userCode, p)) continue;
    const wc = p.split('-').filter(x => x === '*').length;
    const w = wc === 0 ? 1.0 : wc === 1 ? 0.7 : wc === 2 ? 0.5 : wc === 3 ? 0.3 : 0.2;
    best = Math.max(best, w);
  }
  return best;
}

function textSimilarity(userText, caseKeywords) {
  const t = userText.toLowerCase();
  let matches = 0;
  for (const kw of caseKeywords) if (t.includes(kw.toLowerCase())) matches += 1;
  return Math.min(0.95, matches / Math.max(caseKeywords.length, 1));
}

function matchCases(userCode, userText, cases, options = {}) {
  const { topN = 6, threshold = 0.25 } = options;
  const scored = cases.map(c => {
    const codeWeight = codeMatchWeight(userCode, c.applies_to);
    const textSim = textSimilarity(userText, c.keywords);
    const finalScore = textSim * 0.6 + codeWeight * 0.4;
    return { ...c, _scores: {
      text_similarity: Math.round(textSim * 100) / 100,
      code_match: codeWeight,
      final: Math.round(finalScore * 1000) / 1000,
    }};
  });
  scored.sort((a, b) => b._scores.final - a._scores.final);
  return scored.filter(c => c._scores.final >= threshold).slice(0, topN);
}

function filterContent(userCode, contentList, options = {}) {
  const { sortByPriority = true, limit = null } = options;
  let filtered = contentList.filter(c => matchAnyPattern(userCode, c.applies_to));
  if (sortByPriority) {
    const order = { high: 0, mid: 1, low: 2 };
    filtered.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  }
  return limit ? filtered.slice(0, limit) : filtered;
}

function rankResources(userCode, type, resources) {
  return resources.map(r => {
    let score = 0;
    if (matchAnyPattern(userCode, r.applies_to)) score += 1;
    if (r.priority_for_types?.includes(type)) score += 2;
    if (r.is_emergency) score += 0.5;
    return { ...r, _score: score };
  }).filter(r => r._score > 0).sort((a, b) => b._score - a._score);
}

function selectLegalTerms(userCode, schoolLevel, allTerms, options = {}) {
  const { limit = 6 } = options;
  return allTerms
    .filter(t => matchAnyPattern(userCode, t.applies_to))
    .slice(0, limit)
    .map(t => ({ ...t, plain: t.explanation[schoolLevel] || t.explanation.MS }));
}

/* ============================================================================
   DESIGN TOKENS
   ============================================================================ */
const C = {
  bg: '#FAF5E4', bgSoft: '#F4ECCF', card: '#FFFFFF', cardWarm: '#FFF9E6',
  ink: '#1F2D1F', inkSoft: '#4A5A4A', inkMute: '#7B8A7B',
  line: '#E5DCB8', lineSoft: '#EFE7C9',
  accent: '#3F5D3F', accentInk: '#FFFFFF',
  amber: '#E8B547', amberDeep: '#C68A1F',
  tagYellow: '#F4E5A1', tagBlue: '#D6E4D6', tagRed: '#F5D5C3',
  danger: '#B5483A',
};

/* ============================================================================
   DEMO PERSONAS — 4순위 핵심 검증 도구
   ============================================================================ */
const DEMO_PERSONAS = [
  {
    id: 'P-001', emoji: '📱', label: '사이버 가해자',
    expected_code: 'SV-CY-G-4-MS', age_band: '14-15세', gender: '남자',
    text: '교실에서 같은 반 친구와 카톡 단체방에서 외모로 별명을 지어서 좀 놀렸어요. 처음엔 친구도 같이 웃어서 그냥 장난인 줄 알았어요. 근데 어느 순간부터 그만하라고 했는데도 계속해서 한 달 동안 했어요. 그래서 학폭으로 신고당했고, 학폭위에 출석하라는 통보를 받았어요. 평소에 친했던 친구라 너무 억울하고 무서워요.',
    summary: '15세 단톡방 외모 비하, 학폭위 통보',
  },
  {
    id: 'P-005', emoji: '😢', label: '초등 따돌림 피해',
    expected_code: 'SV-OS-V-0-ES', age_band: '11-13세', gender: '여자',
    text: '저는 학교에서 한 달 정도 따돌림을 당하고 있어요. 친구들이 저한테 말도 안 걸고 모둠활동에서도 빼요. 너무 힘든데 신고할까 말까 고민돼요. 아직 학교에는 알리지 않았어요.',
    summary: '12세 학급 따돌림, 미신고 단계',
  },
  {
    id: 'P-007', emoji: '🎮', label: '쌍방 사이버',
    expected_code: 'SV-CY-B-2-HS', age_band: '16-17세', gender: '남자',
    text: '게임 보이스챗에서 같은 학교 친구랑 서로 욕설을 주고받았어요. 양쪽 다 신고를 했고 지금 학교에서 사실 확인 조사 중이에요. 둘 다 잘못한 건 맞는데 어떻게 될지 모르겠어요.',
    summary: '17세 게임 보이스챗 쌍방, 조사 단계',
  },
  {
    id: 'SAFETY', emoji: '🚨', label: '안전 분기',
    expected_code: '(안전 분기)', age_band: '14-15세', gender: '여자',
    text: '집에서 매일 아빠가 때려요. 너무 무서워요. 도망치고 싶어요.',
    summary: '14세 가정폭력, 안전 분기 트리거',
  },
];

/* ============================================================================
   COMPONENTS
   ============================================================================ */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { background: ${C.bg}; }
      body { font-family: 'Pretendard', -apple-system, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; margin: 0; }
      .font-display { font-family: 'Gowun Batang', 'Pretendard', serif; letter-spacing: -0.02em; }
      .font-mono { font-family: ui-monospace, 'SF Mono', monospace; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      .anim-fade-up { animation: fadeUp 0.5s ease-out both; }
      .anim-fade-in { animation: fadeIn 0.4s ease-out both; }
      .anim-spin { animation: spin 1s linear infinite; }
      .anim-pulse { animation: pulse 1.6s ease-in-out infinite; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 4px; }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; white-space: nowrap; }
      .btn-primary { background: ${C.accent}; color: ${C.accentInk}; padding: 14px 28px; border-radius: 14px; font-weight: 600; font-size: 16px; border: none; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 8px; }
      .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px -8px ${C.accent}88; }
      .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn-ghost { background: transparent; color: ${C.ink}; padding: 12px 20px; border-radius: 12px; font-weight: 500; border: 1px solid ${C.line}; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 6px; }
      .btn-ghost:hover { background: ${C.bgSoft}; }
      .btn-danger { background: ${C.danger}; color: white; padding: 14px 24px; border-radius: 14px; font-weight: 600; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
      .card-base { background: ${C.card}; border: 1px solid ${C.lineSoft}; border-radius: 18px; transition: all 0.2s; }
      .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -16px rgba(31, 45, 31, 0.18); border-color: ${C.line}; }
      .pill-toggle { padding: 12px 18px; border-radius: 14px; border: 1.5px solid ${C.line}; background: ${C.card}; cursor: pointer; transition: all 0.15s; font-size: 15px; font-weight: 500; color: ${C.ink}; }
      .pill-toggle:hover { border-color: ${C.amber}; background: ${C.cardWarm}; }
      .pill-toggle.active { border-color: ${C.accent}; background: ${C.accent}; color: white; }
      .pretty-input { width: 100%; padding: 16px 18px; border-radius: 14px; border: 1.5px solid ${C.line}; background: ${C.card}; font-family: 'Pretendard', sans-serif; font-size: 15px; color: ${C.ink}; resize: vertical; line-height: 1.6; transition: all 0.15s; }
      .pretty-input:focus { outline: none; border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accent}22; }
    `}</style>
  );
}

function Header({ onHome, showBack, onBack }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: `${C.bg}f0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.lineSoft}` }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <button onClick={onHome} className="flex items-center gap-2.5" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: 'grid', placeItems: 'center' }}>
            <Scale size={18} color="white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-display text-lg font-bold" style={{ color: C.ink }}>나란히</span>
            <span className="text-[11px]" style={{ color: C.inkMute }}>v2 · 데이터 구동</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {showBack && <button onClick={onBack} className="btn-ghost text-sm"><ChevronLeft size={16} /> 이전</button>}
          <button onClick={onHome} className="btn-ghost text-sm"><Home size={15} /> 처음으로</button>
        </div>
      </div>
    </header>
  );
}

function ProgressBar({ step, total }) {
  const pct = (step / total) * 100;
  const labels = ['시작', '나에 대해', '사건 이야기', '확인 질문', '분석', '결과 안내'];
  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: C.inkSoft }}>
          {labels[step] || ''} <span style={{ color: C.inkMute }}>· {step}/{total}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: C.lineSoft, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.amber}, ${C.accent})`, borderRadius: 999, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function Landing({ onStart, onDemo }) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-20 anim-fade-in">
      <div className="grid md:grid-cols-12 gap-10 items-center mb-12">
        <div className="md:col-span-7 anim-fade-up">
          <div className="chip mb-6" style={{ background: C.tagYellow, color: C.amberDeep }}>
            <Sparkles size={14} /> v2 · 데이터 구동 프로토타입
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.1] mb-6" style={{ color: C.ink }}>
            법은 어렵지 않아요.<br />
            <span style={{ color: C.accent }}>너의 옆에 나란히</span> 설게요.
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: C.inkSoft }}>
            학교폭력으로 어려움을 겪고 있다면 너와 비슷한 사례를 찾아<br />
            지금 어떤 절차에 있는지, 무엇을 준비해야 하는지 쉬운 말로 알려드려요.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={onStart} className="btn-primary">지금 시작하기 <ArrowRight size={18} /></button>
          </div>
        </div>
        <div className="md:col-span-5 anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <div style={{ background: C.cardWarm, border: `1.5px solid ${C.line}`, borderRadius: 28, padding: 24, boxShadow: `0 30px 60px -30px ${C.amber}55` }}>
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} color={C.amberDeep} />
              <span className="text-xs font-bold" style={{ color: C.amberDeep }}>데이터 구동 검증</span>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: C.inkSoft }}>
              <strong style={{ color: C.ink }}>같은 앱 코드</strong>가 입력에 따라 <strong style={{ color: C.ink }}>다른 결과</strong>를 만들어내요.
              아래 데모로 확인해보세요.
            </p>
            <div className="space-y-2">
              {DEMO_PERSONAS.map(p => (
                <button key={p.id} onClick={() => onDemo(p)} style={{
                  width: '100%', textAlign: 'left', padding: 12,
                  background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 12,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.lineSoft; e.currentTarget.style.transform = ''; }}>
                  <span style={{ fontSize: 22 }}>{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: C.ink }}>{p.id}</span>
                      <span className="text-xs" style={{ color: C.inkMute }}>{p.label}</span>
                    </div>
                    <div className="text-xs truncate" style={{ color: C.inkSoft }}>{p.summary}</div>
                  </div>
                  <PlayCircle size={18} color={C.accent} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {[
          { icon: <BookOpen size={20} />, title: '쉬운 말로 풀어드려요', desc: '어려운 법률 용어 대신, 너의 학년에 맞는 표현으로.' },
          { icon: <Search size={20} />, title: '비슷한 사례를 찾아드려요', desc: '공개 판례 중 너의 상황과 가장 비슷한 사례를 찾아 보여드려요.' },
          { icon: <Shield size={20} />, title: '판단은 너의 몫이에요', desc: '법적 결정을 대신 내리는 것이 아닌, 네가 이해할 수 있도록 도와드려요.' },
        ].map((it, i) => (
          <div key={i} className="card-base p-6 anim-fade-up" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.cardWarm, color: C.amberDeep, display: 'grid', placeItems: 'center', marginBottom: 14 }}>{it.icon}</div>
            <h3 className="font-semibold text-base mb-1" style={{ color: C.ink }}>{it.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepInfo({ data, onChange, onNext, onBack }) {
  const canProceed = data.age_band;
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>나에 대해 알려주세요</h2>
        <p style={{ color: C.inkSoft }}>나이는 받을 수 있는 처분이 달라지기 때문에 꼭 필요해요.</p>
      </div>
      <div className="card-base p-7 mb-5">
        <label className="block text-sm font-semibold mb-3" style={{ color: C.ink }}>성별 <span style={{ color: C.inkMute, fontWeight: 400 }}>· 선택사항</span></label>
        <div className="flex flex-wrap gap-2">
          {['남자', '여자', '말하고 싶지 않아요'].map(g => (
            <button key={g} onClick={() => onChange({ ...data, gender: g })} className={`pill-toggle ${data.gender === g ? 'active' : ''}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="card-base p-7 mb-5">
        <label className="block text-sm font-semibold mb-3" style={{ color: C.ink }}>나이 <span style={{ color: C.danger, fontWeight: 400 }}>· 필수</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['7세 미만', '8-10세', '11-13세', '14-15세', '16-17세', '18세 이상'].map(a => (
            <button key={a} onClick={() => onChange({ ...data, age_band: a })} className={`pill-toggle ${data.age_band === a ? 'active' : ''}`}>{a}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">다음으로 <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function StepSituation({ data, onChange, onNext, onBack }) {
  const canProceed = data.user_text && data.user_text.trim().length >= 10;
  const templates = [
    '학교에서 반 친구와 어떤 일이 있었는데, 그 친구가 ___ ',
    'SNS/카톡에서 ___와 ___한 일이 있었는데, 그 이후로 ___ ',
    '집에서 ___와 ___한 일이 있었어요. 그래서 ___ ',
    '___에서 ___한 일이 있어서 경찰에 신고됐어요. 그런데 ___ ',
  ];
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>어떤 일이 있었는지 이야기해 주세요</h2>
        <p style={{ color: C.inkSoft }}>어려운 말 몰라도 괜찮아요. 평소에 이야기하듯 편하게 적어주세요.</p>
      </div>
      <div className="card-base p-7 mb-5">
        <label className="block text-sm font-semibold mb-3" style={{ color: C.ink }}>막막하다면 예시 중 하나로 시작해보세요</label>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {templates.map((t, i) => (
            <button key={i} onClick={() => onChange({ ...data, user_text: t })} style={{
              textAlign: 'left', padding: '10px 14px', borderRadius: 12,
              border: `1px solid ${C.lineSoft}`, background: C.bg, cursor: 'pointer', fontSize: 12,
            }} onMouseEnter={e => e.currentTarget.style.background = C.cardWarm} onMouseLeave={e => e.currentTarget.style.background = C.bg}>
              <div style={{ color: C.inkMute }}>{t}</div>
            </button>
          ))}
        </div>
        <textarea className="pretty-input" rows={8}
          placeholder="예) 교실에서 같은 반 친구와 카톡 단체방에서 외모로 별명을 지어서 좀 놀렸어요. 처음엔 친구도 같이 웃어서 장난인 줄 알았는데, 그만하라고 했는데도 한 달 동안 계속됐어요..."
          value={data.user_text || ''} onChange={e => onChange({ ...data, user_text: e.target.value })} />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: C.inkMute }}>{(data.user_text || '').length}자 / 최소 10자</span>
          {canProceed && <span className="text-xs flex items-center gap-1 anim-fade-in" style={{ color: C.accent }}><Check size={13} /> 충분해요</span>}
        </div>
      </div>
      <div style={{ background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
        <Heart size={18} color={C.amberDeep} style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
          이름이나 학교, 친구 이름 같은 <strong style={{ color: C.ink }}>개인정보는 적지 않아도 돼요</strong>. 이 화면에서만 사용되며 어디에도 저장되지 않아요.
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">분석 시작 <Sparkles size={16} /></button>
      </div>
    </div>
  );
}

function SafetyBranchScreen({ action, onReset }) {
  const messages = {
    urgent_self_harm: { title: '잠깐, 너의 안전이 가장 중요해', subtitle: '지금 너의 마음이 많이 힘든 것 같아.' },
    urgent_domestic: { title: '잠깐, 너의 안전이 가장 중요해', subtitle: '지금 안전한 곳에 있는지 먼저 확인할게.' },
  };
  const m = messages[action] || messages.urgent_domestic;
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 anim-fade-in">
      <div style={{ background: '#FFF', border: `2px solid ${C.danger}`, borderRadius: 24, padding: '32px 28px' }}>
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF0EE', display: 'grid', placeItems: 'center' }}>
            <AlertTriangle size={24} color={C.danger} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold" style={{ color: C.danger }}>{m.title}</h2>
            <p className="text-sm" style={{ color: C.inkSoft }}>{m.subtitle}</p>
          </div>
        </div>
        <p className="leading-relaxed mb-6" style={{ color: C.ink }}>
          이 앱이 도울 수 있는 범위를 넘어선 상황일 수 있어요. 지금 바로 도움을 받을 수 있는 곳이 있어. 무료이고, 24시간 운영되며, 신원이 보호돼.
        </p>
        <div className="space-y-3 mb-6">
          {[
            { name: '여성긴급전화', phone: '1366', desc: '가정폭력·성폭력 24시간', priority: true },
            { name: '아동권리보장원', phone: '1577-1391', desc: '아동학대 신고·보호', priority: true },
            { name: '자살예방상담전화', phone: '109', desc: '24시간 마음 상담', priority: action === 'urgent_self_harm' },
            { name: '긴급 신고', phone: '112', desc: '경찰 즉시 출동', priority: true },
          ].filter(x => x.priority).map((r, i) => (
            <div key={i} style={{
              background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14,
              padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div className="font-bold mb-1" style={{ color: C.ink }}>{r.name}</div>
                <div className="text-xs" style={{ color: C.inkSoft }}>{r.desc}</div>
              </div>
              <a href={`tel:${r.phone}`} className="btn-danger" style={{ fontSize: 18 }}>
                <Phone size={16} /> {r.phone}
              </a>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed mb-6" style={{ color: C.inkSoft }}>
          연락이 망설여진다면 친구·선생님·다른 가족 어른에게 먼저 이야기해도 돼. 혼자가 아니야.
        </p>
        <button onClick={onReset} className="btn-ghost"><RotateCcw size={15} /> 다른 상황으로 다시 시작하기</button>
      </div>
    </div>
  );
}

function StepConfirm({ classification, onConfirm, onUpdate, onBack }) {
  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고를 받은 쪽 (가해자로 지목됨)', V: '신고를 한 쪽 (피해를 입었음)', B: '쌍방', W: '목격자', P: '보호자', U: '아직 잘 모르겠음' };
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(classification.type_main);
  const [role, setRole] = useState(classification.role);
  const changed = type !== classification.type_main || role !== classification.role;

  const apply = () => {
    onUpdate({ type_main: type, role });
    setEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="card-base p-7 mb-5" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={18} color={C.amberDeep} />
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>이게 맞을까요?</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: C.inkSoft }}>
          적어주신 내용을 토대로 분류해봤어요. 신뢰도는 <strong>{Math.round(classification.confidence * 100)}%</strong>예요.
          맞지 않으면 아래에서 직접 수정할 수 있어요.
        </p>

        {!editing ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div style={{ background: C.card, padding: 14, borderRadius: 12 }}>
                <div className="text-xs mb-1" style={{ color: C.inkMute }}>사건 유형</div>
                <div className="font-bold" style={{ color: C.ink }}>{TYPE_LABELS[classification.type_main]}</div>
              </div>
              <div style={{ background: C.card, padding: 14, borderRadius: 12 }}>
                <div className="text-xs mb-1" style={{ color: C.inkMute }}>너의 입장</div>
                <div className="font-bold" style={{ color: C.ink }}>{ROLE_LABELS[classification.role]}</div>
              </div>
            </div>
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm" style={{
              width: '100%', justifyContent: 'center', padding: '10px 14px', background: C.card,
            }}>
              <Code size={14} /> 분류가 맞지 않아요 · 직접 수정하기
            </button>
          </>
        ) : (
          <div className="anim-fade-in">
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: C.inkMute }}>사건 유형을 선택해 주세요</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setType(k)}
                    style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                      border: `1.5px solid ${type === k ? C.accent : C.line}`,
                      background: type === k ? C.accent : C.card,
                      color: type === k ? 'white' : C.ink,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>{v}</button>
                ))}
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-xs font-semibold mb-2" style={{ color: C.inkMute }}>너의 입장을 선택해 주세요</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setRole(k)}
                    style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                      border: `1.5px solid ${role === k ? C.accent : C.line}`,
                      background: role === k ? C.accent : C.card,
                      color: role === k ? 'white' : C.ink,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>{v}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setEditing(false); setType(classification.type_main); setRole(classification.role); }}
                className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>취소</button>
              <button onClick={apply} disabled={!changed}
                className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>수정 적용</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onConfirm} className="btn-primary justify-center">맞아요, 계속 진행할게요 <ChevronRight size={16} /></button>
        <button onClick={onBack} className="btn-ghost justify-center">
          <ChevronLeft size={15} /> 이전 단계로 (작성 내용 유지)
        </button>
      </div>
    </div>
  );
}

function StepFollowUp({ tree, data, onChange, onNext, onBack }) {
  const canProceed = tree.questions.every(q => data.follow_up?.[q.id]);
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>몇 가지만 더 확인할게요</h2>
        <p style={{ color: C.inkSoft }}>너의 상황에 맞는 안내를 드리기 위해 필요해요.</p>
      </div>
      <div className="space-y-4 mb-8">
        {tree.questions.map((q, qi) => (
          <div key={q.id} className="card-base p-6 anim-fade-up" style={{ animationDelay: `${qi * 0.05}s` }}>
            <div className="flex items-start gap-3 mb-4">
              <div style={{ width: 26, height: 26, borderRadius: 999, background: C.accent, color: 'white', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{qi + 1}</div>
              <h3 className="font-semibold text-base pt-0.5" style={{ color: C.ink }}>{q.text}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map(o => (
                <button key={o} onClick={() => onChange({ ...data, follow_up: { ...(data.follow_up || {}), [q.id]: o } })}
                  className={`pill-toggle ${data.follow_up?.[q.id] === o ? 'active' : ''}`} style={{ fontSize: 14 }}>{o}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">분석 시작하기 <Sparkles size={16} /></button>
      </div>
    </div>
  );
}

function StepLoading({ onDone }) {
  const [phase, setPhase] = useState(0);
  const phases = ['사건의 핵심 요소를 살펴보고 있어요', '비슷한 공개 판례를 찾고 있어요', '현재 절차 단계를 확인하고 있어요', '필요한 서류를 정리하고 있어요'];
  useEffect(() => {
    const ts = [setTimeout(() => setPhase(1), 700), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 2300), setTimeout(() => onDone(), 3100)];
    return () => ts.forEach(clearTimeout);
  }, [onDone]);
  return (
    <div className="max-w-xl mx-auto px-6 py-20 anim-fade-in text-center">
      <div style={{ width: 80, height: 80, margin: '0 auto 28px', borderRadius: 24, background: C.cardWarm, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 8px ${C.tagYellow}55` }}>
        <Loader2 size={36} color={C.amberDeep} className="anim-spin" />
      </div>
      <h2 className="font-display text-3xl font-bold mb-3" style={{ color: C.ink }}>분석하고 있어요</h2>
      <p style={{ color: C.inkSoft, marginBottom: 32 }}>잠깐만 기다려줘요.</p>
      <div className="space-y-3 text-left max-w-md mx-auto">
        {phases.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3" style={{ background: i <= phase ? C.cardWarm : 'transparent', borderRadius: 12, transition: 'background 0.4s' }}>
            {i < phase ? <Check size={18} color={C.accent} /> : i === phase ? <Loader2 size={18} color={C.amberDeep} className="anim-spin" /> : <div style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${C.line}` }} />}
            <span className="text-sm" style={{ color: i <= phase ? C.ink : C.inkMute, fontWeight: i === phase ? 600 : 500 }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcedureTimeline({ currentStage }) {
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={18} color={C.accent} />
        <h3 className="font-semibold text-lg" style={{ color: C.ink }}>지금 어떤 단계인지 알려드릴게요</h3>
      </div>
      <p className="text-sm mb-6" style={{ color: C.inkSoft }}>너의 답변을 바탕으로 추정한 현재 단계예요.</p>
      <div className="relative">
        {PROCEDURE_STAGES.map((s, i) => {
          const done = i < currentStage, current = i === currentStage, future = i > currentStage;
          return (
            <div key={s.stage} className="flex gap-4 pb-6 relative">
              {i < PROCEDURE_STAGES.length - 1 && (
                <div style={{ position: 'absolute', left: 14, top: 32, bottom: 0, width: 2, background: done ? C.accent : C.lineSoft }} />
              )}
              <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                background: done ? C.accent : current ? C.amber : C.card,
                border: `2px solid ${done ? C.accent : current ? C.amberDeep : C.line}`,
                display: 'grid', placeItems: 'center',
                boxShadow: current ? `0 0 0 6px ${C.tagYellow}` : 'none',
                zIndex: 1 }}>
                {done ? <Check size={14} color="white" /> : current ? <div style={{ width: 8, height: 8, borderRadius: 999, background: 'white' }} /> : <div style={{ width: 6, height: 6, borderRadius: 999, background: C.lineSoft }} />}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold" style={{ color: future ? C.inkMute : C.ink }}>{s.label}</span>
                  {current && <span className="chip text-[11px]" style={{ background: C.tagYellow, color: C.amberDeep, padding: '2px 10px' }}>지금 여기</span>}
                  {done && <span className="chip text-[11px]" style={{ background: C.tagBlue, color: C.accent, padding: '2px 10px' }}>완료</span>}
                </div>
                <p className="text-sm" style={{ color: future ? C.inkMute : C.inkSoft }}>{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseCard({ c, onClick }) {
  return (
    <button onClick={onClick} className="card-base card-hover p-5 text-left w-full" style={{ background: C.cardWarm, borderColor: C.line }}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className="chip" style={{ background: C.amber, color: '#fff', padding: '4px 12px', fontSize: 12 }}>유사도 {Math.round(c._scores.final * 100)}%</span>
        <span className="chip" style={{
          background: c.recognition === '인정' ? C.tagBlue : c.recognition === '불인정' ? C.tagRed : C.bgSoft,
          color: c.recognition === '인정' ? C.accent : c.recognition === '불인정' ? C.danger : C.inkSoft,
          padding: '4px 10px', fontSize: 11,
        }}>{c.recognition}</span>
      </div>
      <h4 className="font-semibold text-base mb-2 leading-snug" style={{ color: C.ink }}>{c.friendly_title}</h4>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: C.inkSoft, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {c.friendly_summary}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex gap-1.5 flex-wrap">
          <span className="chip text-[11px]" style={{ background: C.bg, color: C.inkSoft, padding: '3px 9px' }}>{c.category}</span>
          <span className="chip text-[11px]" style={{ background: C.bg, color: C.inkSoft, padding: '3px 9px' }}>{c.sentence}</span>
        </div>
        <span className="text-xs flex items-center gap-1" style={{ color: C.accent, fontWeight: 600 }}>자세히 <ChevronRight size={12} /></span>
      </div>
      {/* 메타 정보 (선고일·법원·사건번호) */}
      <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 10, marginTop: 2 }}>
        <div className="flex items-center gap-2 mb-1 flex-wrap" style={{ fontSize: 10.5 }}>
          <span style={{ color: C.inkMute }}>📅 {c.decision_date || '진행 중'}</span>
          <span style={{ color: C.inkMute }}>· 🏛️ {c.court}</span>
        </div>
        <div style={{ fontSize: 10.5, color: C.inkMute, fontFamily: 'ui-monospace, monospace' }}>
          {c.case_number}
          {c.case_title_formal && c.case_title_formal !== '(학교 신고 전)' && (
            <span> [{c.case_title_formal}]</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CaseDetailModal({ c, onClose }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 anim-fade-in" style={{ background: 'rgba(31,45,31,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="h-full overflow-y-auto py-10 px-4">
        <div className="max-w-2xl mx-auto card-base p-8 anim-fade-up" style={{ background: C.bg }} onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="chip" style={{ background: C.amber, color: '#fff', padding: '4px 12px' }}>유사도 {Math.round(c._scores.final * 100)}%</span>
                <span className="chip" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px', fontSize: 11 }}>
                  텍스트 {c._scores.text_similarity} · 코드 {c._scores.code_match}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold leading-tight" style={{ color: C.ink }}>{c.friendly_title}</h3>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12, background: C.card, border: `1px solid ${C.lineSoft}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={18} color={C.inkSoft} /></button>
          </div>
          <div className="card-base p-5 mb-5" style={{ background: C.card }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.amberDeep }}>사건 개요</div>
            <p className="leading-relaxed" style={{ color: C.ink }}>{c.friendly_summary}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <div><div className="text-xs mb-1" style={{ color: C.inkMute }}>분류</div><div className="font-semibold text-sm" style={{ color: C.ink }}>{c.category}</div></div>
              <div><div className="text-xs mb-1" style={{ color: C.inkMute }}>처분 결과</div><div className="font-semibold text-sm" style={{ color: C.ink }}>{c.sentence}</div></div>
            </div>
          </div>
          {/* 정식 사건 정보 */}
          <div className="card-base p-5 mb-4" style={{ background: C.bgSoft, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} color={C.accent} />
              <h4 className="font-semibold text-sm" style={{ color: C.ink }}>정식 사건 정보</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>선고일</span>
                <span style={{ color: C.ink }}>{c.decision_date || '진행 중 (선고 전)'}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>판결 법원</span>
                <span style={{ color: C.ink }}>{c.court}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>사건번호</span>
                <span style={{ color: C.ink, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{c.case_number}</span>
              </div>
              {c.case_title_formal && c.case_title_formal !== '(학교 신고 전)' && (
                <div className="flex gap-2">
                  <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>사건 제목</span>
                  <span style={{ color: C.ink, fontSize: 13 }}>{c.case_title_formal}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>판결 주문</span>
                <span style={{ color: C.ink, fontSize: 13 }}>{c.disposition_summary}</span>
              </div>
            </div>
          </div>
          {c.recognition !== '불인정' && c.key_factors.length > 0 && (
            <div className="card-base p-5 mb-4" style={{ background: C.card }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.accent, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>왜 이렇게 판단됐나요?</h4>
              </div>
              <ul className="space-y-2">{c.key_factors.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><Check size={14} color={C.accent} style={{ marginTop: 4, flexShrink: 0 }} />{f}</li>)}</ul>
            </div>
          )}
          {c.not_recognized_reasons.length > 0 && (
            <div className="card-base p-5 mb-4" style={{ background: C.card }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.danger, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>왜 학교폭력으로 보지 않았나요?</h4>
              </div>
              <ul className="space-y-2">{c.not_recognized_reasons.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><X size={14} color={C.danger} style={{ marginTop: 4, flexShrink: 0 }} />{f}</li>)}</ul>
            </div>
          )}
          {c.severity_factors.length > 0 && (
            <div className="card-base p-5" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.amber, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>처분 수위에 영향을 준 요소들</h4>
              </div>
              <ul className="space-y-2">{c.severity_factors.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><span style={{ color: C.amberDeep, marginTop: 1, fontWeight: 700 }}>·</span>{f}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({ docs }) {
  const [checked, setChecked] = useState({});
  const done = Object.values(checked).filter(Boolean).length;
  if (docs.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2"><ClipboardList size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>준비하면 좋을 서류·자료</h3></div>
        <span className="chip text-xs" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px' }}>{done} / {docs.length}</span>
      </div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>너의 상황에 맞춰 추천된 서류예요. 하나씩 체크해 보세요.</p>
      <div style={{ height: 6, borderRadius: 999, background: C.lineSoft, marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${(done / docs.length) * 100}%`, background: C.accent, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
      <div className="space-y-2">{docs.map(d => {
        const isChecked = checked[d.doc_id];
        const cmap = { high: { bg: C.tagRed, fg: C.danger, label: '필수' }, mid: { bg: C.tagYellow, fg: C.amberDeep, label: '권장' }, low: { bg: C.tagBlue, fg: C.accent, label: '선택' } };
        const cs = cmap[d.priority] || cmap.mid;
        return (
          <button key={d.doc_id} onClick={() => setChecked(s => ({ ...s, [d.doc_id]: !s[d.doc_id] }))}
            style={{ width: '100%', textAlign: 'left', padding: 14, borderRadius: 12, background: isChecked ? C.cardWarm : C.bg, border: `1px solid ${isChecked ? C.line : C.lineSoft}`, display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2, background: isChecked ? C.accent : C.card, border: `2px solid ${isChecked ? C.accent : C.line}`, display: 'grid', placeItems: 'center' }}>
              {isChecked && <Check size={13} color="white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-sm" style={{ color: C.ink, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>{d.name}</span>
                <span className="chip text-[10px]" style={{ background: cs.bg, color: cs.fg, padding: '2px 8px' }}>{cs.label}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.inkMute }}>{d.description}</p>
            </div>
          </button>
        );
      })}</div>
    </div>
  );
}

function TermsSection({ terms }) {
  const [open, setOpen] = useState({});
  if (terms.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1"><BookOpen size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>어려운 말을 쉽게 풀어드려요</h3></div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>모르는 게 있을 때 펼쳐보세요.</p>
      <div className="space-y-2">{terms.map((t, i) => {
        const isOpen = open[i];
        return (
          <div key={t.term_id} style={{ background: isOpen ? C.cardWarm : C.bg, border: `1px solid ${isOpen ? C.line : C.lineSoft}`, borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpen(s => ({ ...s, [i]: !s[i] }))} style={{ width: '100%', padding: 14, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span className="font-medium text-sm" style={{ color: C.ink }}>{t.term}</span>
              {isOpen ? <ChevronUp size={16} color={C.inkSoft} /> : <ChevronDown size={16} color={C.inkSoft} />}
            </button>
            {isOpen && <div className="px-4 pb-4 anim-fade-in"><p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{t.plain}</p></div>}
          </div>
        );
      })}</div>
    </div>
  );
}

function FAQSection({ faqs }) {
  const [open, setOpen] = useState(null);
  if (faqs.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1"><MessageCircleQuestion size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>자주 묻는 질문</h3></div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>같은 상황의 친구들이 자주 궁금해 하는 질문이에요.</p>
      <div className="space-y-2">{faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.faq_id} style={{ background: isOpen ? C.cardWarm : C.bg, border: `1px solid ${isOpen ? C.line : C.lineSoft}`, borderRadius: 12 }}>
            <button onClick={() => setOpen(isOpen ? null : i)} style={{ width: '100%', padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', gap: 12 }}>
              <div className="flex items-start gap-3">
                <span style={{ color: C.amber, fontWeight: 700, fontSize: 16 }}>Q</span>
                <span className="font-medium text-sm leading-relaxed" style={{ color: C.ink }}>{f.q}</span>
              </div>
              {isOpen ? <ChevronUp size={16} color={C.inkSoft} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color={C.inkSoft} style={{ flexShrink: 0 }} />}
            </button>
            {isOpen && <div className="px-5 pb-5 anim-fade-in"><div className="flex gap-3"><span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>A</span><p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{f.a}</p></div></div>}
          </div>
        );
      })}</div>
    </div>
  );
}

function ResourcesSection({ resources }) {
  if (resources.length === 0) return null;
  return (
    <div className="card-base p-7" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-1"><Users size={18} color={C.amberDeep} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>혼자 해결하기 어렵다면</h3></div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>너의 상황에 맞는 무료 상담처예요.</p>
      <div className="grid sm:grid-cols-2 gap-3">{resources.map(r => (
        <div key={r.res_id} style={{ background: C.card, padding: 16, borderRadius: 14, border: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-start justify-between mb-2 gap-2">
            <span className="font-semibold text-sm" style={{ color: C.ink }}>{r.name}</span>
            <span className="chip text-[10px]" style={{ background: C.tagYellow, color: C.amberDeep, padding: '2px 8px' }}>{r.tags?.[0]}</span>
          </div>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: C.inkSoft }}>{r.description}</p>
          <div className="flex items-center gap-2" style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>
            {/^\d+/.test(r.phone) ? <Phone size={13} /> : <ExternalLink size={13} />}{r.phone}
          </div>
        </div>
      ))}</div>
    </div>
  );
}

function ClassificationDebugPanel({ data, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고 받은 쪽', V: '신고 한 쪽', B: '쌍방', W: '목격자', P: '보호자', U: '미정' };
  const [type, setType] = useState(data.classification.type_main);
  const [role, setRole] = useState(data.classification.role);

  useEffect(() => {
    setType(data.classification.type_main);
    setRole(data.classification.role);
  }, [data.classification.type_main, data.classification.role]);

  const changed = type !== data.classification.type_main || role !== data.classification.role;

  const apply = () => {
    onUpdate({ type_main: type, role });
    setEditing(false);
  };

  return (
    <div className="card-base p-5" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-2">
          <Code size={15} color={C.inkMute} />
          <span className="text-sm font-semibold" style={{ color: C.inkSoft }}>분류 결과 자세히 보기 · 수정 가능</span>
        </div>
        {open ? <ChevronUp size={16} color={C.inkMute} /> : <ChevronDown size={16} color={C.inkMute} />}
      </button>
      {open && (
        <div className="mt-4 anim-fade-in space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
              <div style={{ color: C.inkMute, marginBottom: 2 }}>full_code</div>
              <div className="font-mono font-bold" style={{ color: C.accent }}>{data.full_code}</div>
            </div>
            <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
              <div style={{ color: C.inkMute, marginBottom: 2 }}>분류 신뢰도</div>
              <div className="font-mono font-bold" style={{ color: data.confidence >= 0.7 ? C.accent : C.amberDeep }}>
                {Math.round(data.confidence * 100)}% {data.confidence >= 0.7 ? '✓' : '⚠'}
              </div>
            </div>
          </div>

          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs" style={{
              width: '100%', justifyContent: 'center', padding: '8px 12px', background: C.card,
            }}>
              <Code size={13} /> 분류가 정확하지 않다면 직접 수정하기
            </button>
          ) : (
            <div style={{ background: C.card, padding: 12, borderRadius: 8 }}>
              <div className="mb-3">
                <label className="block font-semibold mb-2" style={{ color: C.inkMute }}>사건 유형</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setType(k)} style={{
                      padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${type === k ? C.accent : C.line}`,
                      background: type === k ? C.accent : C.bg,
                      color: type === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block font-semibold mb-2" style={{ color: C.inkMute }}>너의 입장</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setRole(k)} style={{
                      padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${role === k ? C.accent : C.line}`,
                      background: role === k ? C.accent : C.bg,
                      color: role === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setType(data.classification.type_main); setRole(data.classification.role); }}
                  className="btn-ghost text-xs" style={{ flex: 1, justifyContent: 'center', padding: '8px' }}>취소</button>
                <button onClick={apply} disabled={!changed}
                  className="btn-primary text-xs" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 12 }}>
                  수정 · 결과 다시 계산
                </button>
              </div>
            </div>
          )}

          <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
            <div style={{ color: C.inkMute, marginBottom: 4 }}>특징 추출</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.features || {}).filter(([_, v]) => v).map(([k]) => (
                <span key={k} className="chip text-[10px]" style={{ background: C.tagBlue, color: C.accent, padding: '2px 8px' }}>{k}</span>
              ))}
              {Object.entries(data.features || {}).filter(([_, v]) => v).length === 0 && (
                <span style={{ color: C.inkMute }}>(없음)</span>
              )}
            </div>
          </div>
          <p style={{ color: C.inkMute, lineHeight: 1.5 }}>
            ※ v2 프로토타입은 키워드 룰 기반 분류예요. 5순위에서 LLM API로 교체하면 정확도가 올라갑니다.
          </p>
        </div>
      )}
    </div>
  );
}

function StepResults({ data, onReset, onNewDemo, onClassificationUpdate }) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [sortMode, setSortMode] = useState('relevance'); // 'relevance' | 'recent'
  const [expanded, setExpanded] = useState(false);

  // 매칭 결과는 항상 최대 10건까지 가져온 후, UI에서 정렬·페이징
  const allMatched = useMemo(() => matchCases(data.full_code, data.user_text, CASES, { topN: 10 }), [data.full_code, data.user_text]);
  const matchedCases = useMemo(() => {
    const arr = [...allMatched];
    if (sortMode === 'recent') {
      arr.sort((a, b) => {
        const da = a.decision_date || '0000-00-00';
        const db = b.decision_date || '0000-00-00';
        return db.localeCompare(da);
      });
    }
    return expanded ? arr.slice(0, 6) : arr.slice(0, 3);
  }, [allMatched, sortMode, expanded]);

  const matchedDocs = useMemo(() => filterContent(data.full_code, DOCUMENTS, { limit: 8 }), [data.full_code]);
  const matchedTerms = useMemo(() => selectLegalTerms(data.full_code, data.school_level, LEGAL_TERMS, { limit: 6 }), [data.full_code, data.school_level]);
  const matchedFaqs = useMemo(() => filterContent(data.full_code, FAQS, { limit: 5 }), [data.full_code]);
  const matchedResources = useMemo(() => rankResources(data.full_code, data.classification.type_main, RESOURCES).slice(0, 6), [data.full_code, data.classification.type_main]);

  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고를 받은 학생', V: '신고를 한 학생', B: '쌍방', W: '목격자', P: '보호자', U: '미정' };
  const LEVEL_LABELS = { ES: '초등학생', MS: '중학생', HS: '고등학생', OT: '비재학' };
  const TYPE_EMOJI = { PH: '👊', VB: '💬', EX: '💰', CO: '🔄', OS: '🚫', SX: '⚠️', CY: '📱', MX: '🔀' };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 헤더 */}
      <div className="anim-fade-up mb-6" style={{ background: `linear-gradient(135deg, ${C.cardWarm} 0%, ${C.bg} 100%)`, border: `1px solid ${C.line}`, borderRadius: 24, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
        <div className="relative">
          <div className="chip mb-3" style={{ background: C.card, color: C.inkSoft, padding: '6px 14px', border: `1px solid ${C.lineSoft}` }}>
            <Sparkles size={13} color={C.amberDeep} /> 분석이 끝났어요
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight" style={{ color: C.ink }}>
            <span style={{ fontSize: '1.3em', marginRight: 8 }}>{TYPE_EMOJI[data.classification.type_main] || '🏫'}</span>
            너의 상황은 <span style={{ color: C.accent }}>{TYPE_LABELS[data.classification.type_main]}</span>로 보여요
          </h2>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{ROLE_LABELS[data.classification.role]}</span>
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{PROCEDURE_STAGES[data.stage]?.label}</span>
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{LEVEL_LABELS[data.school_level]}</span>
          </div>
          <p className="leading-relaxed max-w-2xl text-sm" style={{ color: C.inkSoft }}>
            아래 내용은 공개 판례를 분석해 자동으로 정리한 안내예요. 법적 결정을 대신 내리는 게 아니라, 네가 상황을 이해하고 다음에 무엇을 할지 결정할 수 있도록 돕기 위한 정보예요.
          </p>
        </div>
      </div>

      {/* 디버그 패널 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.03s' }}>
        <ClassificationDebugPanel data={data} onUpdate={onClassificationUpdate} />
      </div>

      {/* 절차 단계 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.05s' }}>
        <ProcedureTimeline currentStage={data.stage} />
      </div>

      {/* 유사 사례 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.1s' }}>
        <div className="card-base p-7">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="flex items-center gap-2"><Search size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>너의 사건과 비슷한 사례를 찾았어요</h3></div>
            <span className="chip text-xs" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px' }}>
              {matchedCases.length}건 표시 / 전체 {allMatched.length}건 매칭
            </span>
          </div>
          <p className="text-sm mb-4" style={{ color: C.inkSoft }}>카드를 누르면 어떤 부분이 결정적이었는지 자세히 볼 수 있어요.</p>

          {/* 정렬 토글 */}
          {allMatched.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs" style={{ color: C.inkMute }}>정렬:</span>
              <button onClick={() => setSortMode('relevance')} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: `1px solid ${sortMode === 'relevance' ? C.accent : C.line}`,
                background: sortMode === 'relevance' ? C.accent : C.card,
                color: sortMode === 'relevance' ? 'white' : C.ink,
                cursor: 'pointer',
              }}>관련도순</button>
              <button onClick={() => setSortMode('recent')} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: `1px solid ${sortMode === 'recent' ? C.accent : C.line}`,
                background: sortMode === 'recent' ? C.accent : C.card,
                color: sortMode === 'recent' ? 'white' : C.ink,
                cursor: 'pointer',
              }}>최신순</button>
            </div>
          )}

          {allMatched.length === 0 ? (
            <div style={{ background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <AlertCircle size={28} color={C.amberDeep} style={{ margin: '0 auto 8px' }} />
              <p style={{ color: C.inkSoft, fontSize: 14 }}>비슷한 사례가 적어요. 흔치 않은 사건일 수 있어요. 변호사 직접 상담을 권장해요.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                {matchedCases.map(c => <CaseCard key={c.case_id} c={c} onClick={() => setSelectedCase(c)} />)}
              </div>
              {/* 더보기 / 접기 */}
              {allMatched.length > 3 && (
                <div className="mt-4 text-center">
                  <button onClick={() => setExpanded(!expanded)} className="btn-ghost" style={{
                    padding: '10px 24px', background: C.cardWarm, borderColor: C.line,
                  }}>
                    {expanded ? (
                      <>접기 <ChevronUp size={15} /></>
                    ) : (
                      <>사례 더 찾아보기 ({Math.min(allMatched.length, 6) - 3}건 더 보기) <ChevronDown size={15} /></>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 서류 체크리스트 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.15s' }}>
        <ChecklistSection docs={matchedDocs} />
      </div>

      {/* 용어 + FAQ */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="anim-fade-up" style={{ animationDelay: '0.2s' }}><TermsSection terms={matchedTerms} /></div>
        <div className="anim-fade-up" style={{ animationDelay: '0.25s' }}><FAQSection faqs={matchedFaqs} /></div>
      </div>

      {/* 기관 */}
      <div className="anim-fade-up mb-8" style={{ animationDelay: '0.3s' }}>
        <ResourcesSection resources={matchedResources} />
      </div>

      {/* 면책 */}
      <div className="card-base p-5 mb-8" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
        <div className="flex gap-3">
          <AlertCircle size={18} color={C.amberDeep} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
            <strong style={{ color: C.ink }}>이 안내는 법률 자문을 대신하지 않아요.</strong> 모든 사건은 구체적 사실관계에 따라 판단이 달라질 수 있어요. 중요한 결정 전에는 반드시 변호사와 상의해 주세요.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center mb-12">
        <button onClick={onReset} className="btn-ghost"><RotateCcw size={15} /> 다시 시작하기</button>
        <button onClick={onNewDemo} className="btn-primary"><PlayCircle size={16} /> 다른 데모 시도하기</button>
      </div>

      <footer className="pt-8 text-center" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        <div className="font-display text-base font-bold mb-2" style={{ color: C.ink }}>나란히 v2 · 데이터 구동 프로토타입</div>
        <p className="text-xs" style={{ color: C.inkMute }}>두루미팀 · 두루 공익법센터 협력 · 테크포임팩트 캠퍼스<br />
          판례 {CASES.length}건 · 서류 {DOCUMENTS.length}건 · 용어 {LEGAL_TERMS.length}건 · FAQ {FAQS.length}건 · 기관 {RESOURCES.length}건
        </p>
      </footer>

      {selectedCase && <CaseDetailModal c={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}

/* ============================================================================
   MAIN APP — 6단계 상태 머신
   ============================================================================ */
export default function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    gender: '', age_band: '', user_text: '',
    classification: null, full_code: '', school_level: '',
    follow_up: {}, stage: 0,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [safetyAction, setSafetyAction] = useState(null);

  const reset = () => {
    setData({ gender: '', age_band: '', user_text: '', classification: null, full_code: '', school_level: '', follow_up: {}, stage: 0 });
    setShowConfirm(false);
    setSafetyAction(null);
    setStep(0);
  };

  const loadDemo = (persona) => {
    reset();
    setData(d => ({ ...d, gender: persona.gender, age_band: persona.age_band, user_text: persona.text }));
    setStep(2); // Skip to situation, but data is prefilled. User clicks "분석 시작"
  };

  // Step 2 → Classify
  const handleSituationNext = () => {
    const cls = classify(data.user_text);
    if (cls.is_safety_branch) {
      setSafetyAction(cls.safety_action);
      return;
    }
    const levelInfo = inferSchoolLevel(data.age_band);
    const fullCode = `SV-${cls.type_main}-${cls.role}-${cls.stage_signal}-${levelInfo.school_level}`;
    setData(d => ({ ...d, classification: cls, full_code: fullCode, school_level: levelInfo.school_level, stage: cls.stage_signal }));
    // 항상 분류 확인 화면 노출 (사용자가 분류 수정할 수 있도록)
    setShowConfirm(true);
  };

  const tree = data.classification ? selectQuestionTree(data.classification.type_main, data.classification.role) : null;

  // Safety branch override
  if (safetyAction) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
        <GlobalStyles />
        <Header onHome={reset} />
        <SafetyBranchScreen action={safetyAction} onReset={reset} />
      </div>
    );
  }

  // 분류 결과 수정 핸들러 (StepConfirm + 결과 페이지에서 모두 사용)
  const handleClassificationUpdate = ({ type_main, role }) => {
    const levelInfo = inferSchoolLevel(data.age_band);
    setData(d => {
      const newCls = { ...d.classification, type_main, role };
      const newCode = `SV-${type_main}-${role}-${newCls.stage_signal}-${levelInfo.school_level}`;
      return { ...d, classification: newCls, full_code: newCode };
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
      <GlobalStyles />
      <Header onHome={reset} showBack={step > 0 && step < 4 && !showConfirm} onBack={() => { setShowConfirm(false); setStep(s => Math.max(0, s - 1)); }} />
      {step > 0 && step < 5 && !showConfirm && <ProgressBar step={step} total={5} />}

      <main>
        {step === 0 && <Landing onStart={() => setStep(1)} onDemo={loadDemo} />}
        {step === 1 && <StepInfo data={data} onChange={setData} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && !showConfirm && <StepSituation data={data} onChange={setData} onNext={handleSituationNext} onBack={() => setStep(1)} />}
        {showConfirm && data.classification && (
          <StepConfirm
            classification={data.classification}
            onConfirm={() => { setShowConfirm(false); setStep(3); }}
            onUpdate={handleClassificationUpdate}
            onBack={() => { setShowConfirm(false); setStep(2); }}
          />
        )}
        {step === 3 && tree && <StepFollowUp tree={tree} data={data} onChange={setData} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <StepLoading onDone={() => setStep(5)} />}
        {step === 5 && <StepResults data={data} onReset={reset} onNewDemo={() => setStep(0)} onClassificationUpdate={handleClassificationUpdate} />}
      </main>
    </div>
  );
}
