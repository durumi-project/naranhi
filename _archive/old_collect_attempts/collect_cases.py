#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=====================================================================
「나란히」 학폭 판례 자동 수집 스크립트 v1
=====================================================================

법제처 OPEN API로 학교폭력 관련 판례를 수집해
우리 cases.json 스키마에 맞춰 CSV·JSON으로 저장합니다.

▶ 사용법
    1) 본인 OC로 변경 (아래 LAW_OC 변수 또는 환경변수)
    2) 터미널에서:
       python collect_cases.py

▶ 실행 환경
    - Python 3.8 이상
    - 추가 패키지 설치 불필요 (표준 라이브러리만 사용)

▶ 결과물 (output_collected/ 폴더)
    - 학폭_판례_원본.csv      변호사 검수용
    - 학폭_판례_원본.json    학생팀 친화 변환 작업용
    - 수집_리포트.md          어떤 키워드에서 몇 건씩 모였는지

▶ 다음 단계
    1) 학생팀이 CSV 열어서 친화 변환 대상 선별
    2) 친화_변환_가이드_v1 의 5대 원칙대로 친화 콘텐츠 작성
    3) 두루 변호사 검수 (판례_검수_체크리스트_v1 활용)
    4) 검수 통과 → cases.json 으로 통합

▶ 한계
    - 법원 판결문만 제공됨 (학폭위 결정·교육청 사례는 별도 수집)
    - 일부 판례는 본문이 비어 있을 수 있음 (메타만 존재)
    - 친화 변환·검수는 자동화 불가 (사람 작업 필수)
=====================================================================
"""

import os
import sys
import time
import json
import csv
import re
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

# =====================================================================
# 설정 — 본인 환경에 맞게 수정
# =====================================================================

# OC (기관코드) — 본인 이메일 ID로 변경
# 환경변수 LAW_OC가 있으면 그걸 우선 사용
LAW_OC = os.environ.get("LAW_OC", "durumitech")

# 검색 키워드 8개 — 학폭 사건의 다양한 측면을 포착하도록 설계
KEYWORDS = [
    "학교폭력",                       # 가장 일반적
    "학교폭력예방법",                  # 법률 명시 사건
    "학교폭력대책심의위원회",          # 학폭위 관련
    "정보통신망 명예훼손 학생",        # 사이버 명예훼손
    "사이버 학교폭력",                # 사이버 일반
    "촉법소년",                       # 소년보호사건
    "학생 폭행",                      # 형사 폭행
    "단톡방 모욕",                    # 단톡방 사건
]

# 키워드당 최대 페이지 (페이지당 100건)
MAX_PAGES_PER_KEYWORD = 3

# 본문 수집할 최대 건수 (시간 절약용. 0이면 전체)
MAX_BODY_FETCH = 100

# API 호출 간 대기 시간 (서버 부하 방지)
DELAY_SEC = 0.6

# 출력 폴더
OUTPUT_DIR = Path("output_collected")

# =====================================================================
# API 호출
# =====================================================================

BASE_LIST_URL = "https://www.law.go.kr/DRF/lawSearch.do"
BASE_INFO_URL = "https://www.law.go.kr/DRF/lawService.do"


def _fetch_xml(url, timeout=15):
    """URL에서 XML을 가져와 ElementTree로 파싱"""
    req = urllib.request.Request(url, headers={"User-Agent": "Naranhi-Collector/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            xml_text = r.read().decode('utf-8')
        return ET.fromstring(xml_text)
    except urllib.error.HTTPError as e:
        print(f"    HTTP 오류 {e.code}: {url[:100]}")
    except urllib.error.URLError as e:
        print(f"    네트워크 오류: {e.reason}")
    except ET.ParseError as e:
        print(f"    XML 파싱 오류: {e}")
    return None


def _text(node, field, default=''):
    """XML 노드에서 안전하게 텍스트 추출"""
    el = node.find(field)
    if el is None:
        return default
    return (el.text or default).strip() if el.text else default


def search_keyword(kw):
    """한 키워드로 판례 목록 검색 — 모든 페이지 순회"""
    items = []
    for page in range(1, MAX_PAGES_PER_KEYWORD + 1):
        params = {
            "OC": LAW_OC,
            "target": "prec",
            "type": "XML",
            "query": kw,
            "display": 100,
            "page": page,
        }
        url = BASE_LIST_URL + "?" + urllib.parse.urlencode(params)
        root = _fetch_xml(url)
        if root is None:
            break

        cases = root.findall('prec')
        if not cases:
            break

        for c in cases:
            items.append({
                '판례일련번호': _text(c, '판례일련번호'),
                '사건명': _text(c, '사건명'),
                '사건번호': _text(c, '사건번호'),
                '선고일자': _text(c, '선고일자'),
                '법원명': _text(c, '법원명'),
                '사건종류명': _text(c, '사건종류명'),
                '사건종류코드': _text(c, '사건종류코드'),
                '판결유형': _text(c, '판결유형'),
                '선고': _text(c, '선고'),
                '판례상세링크': _text(c, '판례상세링크'),
                '_검색_키워드': kw,
            })

        # 페이지가 다 안 찼으면 마지막 페이지
        if len(cases) < 100:
            break
        time.sleep(DELAY_SEC)
    return items


def fetch_body(case_id):
    """판례 일련번호로 본문 조회"""
    params = {
        "OC": LAW_OC,
        "target": "prec",
        "type": "XML",
        "ID": case_id,
    }
    url = BASE_INFO_URL + "?" + urllib.parse.urlencode(params)
    root = _fetch_xml(url)
    if root is None:
        return {}

    body = {}
    for field in ['판시사항', '판결요지', '참조조문', '참조판례', '판례내용']:
        val = _text(root, field)
        if val:
            body[field] = val
    return body


# =====================================================================
# 분류 · 매핑
# =====================================================================

def categorize_case(case):
    """사건종류로 분류"""
    sjt = case.get('사건종류명', '') or ''
    code = case.get('사건종류코드', '') or ''
    if sjt == '일반행정' or code == '400107':
        return '행정 (불복 소송)'
    elif '형사' in sjt:
        return '형사 (가해 학생 처벌)'
    elif '소년' in sjt:
        return '소년보호 (촉법·형사미성년)'
    elif '민사' in sjt:
        return '민사 (손해배상 등)'
    elif sjt:
        return f'기타 ({sjt})'
    return '미분류'


# 우리 도메인에 의미 있는 키워드 후보 (cases.json keywords 필드 참고)
DOMAIN_KEYWORDS = [
    '단톡방', '카톡', '단체방', 'SNS', '인스타', '게임', '보이스챗',
    '욕설', '모욕', '명예훼손', '별명', '외모',
    '폭행', '폭력', '협박', '강요',
    '학폭위', '학폭', '심의위원회', '전담기구',
    '1호', '2호', '3호', '4호', '5호', '6호', '7호', '8호', '9호',
    '서면사과', '특별교육', '출석정지', '학급교체', '전학', '퇴학',
    '자체해결', '행정심판', '집행정지',
    '디지털', '캡처', '유포', '저장',
    '쌍방', '집단', '여러 명',
    '거부', '그만', '지속', '반복',
    '의무교육', '촉법', '소년',
    '갈취', '돈', '빵', '심부름', '셔틀',
    '따돌림', '왕따', '소외',
    '체육', '복도', '교실', '학교', '학급',
    '치료', '진단', '병원',
]


def extract_keywords(text, top_n=15):
    """본문에서 도메인 키워드 매칭 (간단 빈도 기반)"""
    if not text:
        return []
    found = []
    seen = set()
    for kw in DOMAIN_KEYWORDS:
        if kw in text and kw not in seen:
            found.append(kw)
            seen.add(kw)
            if len(found) >= top_n:
                break
    return found


def map_to_schema(case, body):
    """원본 데이터를 우리 cases.json 스키마에 매핑

    자동 채울 수 있는 필드와 사람이 채울 필드를 명확히 구분합니다.
    """
    body_text = (body.get('판시사항', '') + ' ' +
                 body.get('판결요지', '') + ' ' +
                 body.get('판례내용', ''))[:5000]

    return {
        # === 자동 채워지는 필드 (메타) ===
        "case_id": f"AUTO-{case['판례일련번호']}",
        "_source": "법제처 OPEN API",
        "_collected_at": datetime.now().strftime("%Y-%m-%d"),
        "_search_keyword": case['_검색_키워드'],
        "_serial_number": case['판례일련번호'],

        # === v2.1 피드백 반영 필드들 (자동 채움) ===
        "decision_date": (case['선고일자'].replace('.', '-')
                          if case['선고일자'] else None),
        "court": case['법원명'],
        "case_number": case['사건번호'],
        "case_title_formal": case['사건명'] or f"({case['사건번호']})",
        "disposition_summary": (case['판결유형'] +
                                ((' ' + case['선고']) if case['선고'] else '')),

        # === 원문 (변호사 검수용 — 자동) ===
        "original_summary": body.get('판시사항', ''),
        "original_facts_raw": body.get('판결요지', ''),
        "original_law": body.get('참조조문', ''),
        "original_full_text": body.get('판례내용', '')[:3000],

        # === 자동 추출 ===
        "keywords_auto": extract_keywords(body_text),
        "_category_auto": categorize_case(case),

        # === 사람이 채워야 하는 필드 (TODO 표시) ===
        # 분류 코드표 v1을 보고 학생팀이 결정
        "type_main": "TODO",            # PH/VB/EX/CO/OS/SX/CY/MX
        "subtypes": [],
        "role_focus": "TODO",           # G/V/B/W/P/U
        "stage_focus": "TODO",          # 0~9
        "school_level": "TODO",         # ES/MS/HS/OT
        "applies_to": [],               # 매칭에 사용될 코드 배열

        # === 친화 콘텐츠 (사람이 작성) ===
        # 친화_변환_가이드_v1.pdf 의 5대 원칙 적용
        "friendly_title": "TODO (한 줄 제목)",
        "friendly_summary": "TODO (150~250자)",
        "recognition": "TODO",          # 인정/불인정/일부인정
        "category": case['사건종류명'],
        "sentence": "TODO (처분 결과 요약)",
        "key_factors": [],              # 결정적 이유 3~5개
        "not_recognized_reasons": [],
        "severity_factors": [],         # 처분 수위 영향 요소

        # === 검수 상태 ===
        "review_status": "수집됨 (검수 대기)",
        "reviewer": "",
        "reviewed_at": "",
        "review_notes": "",
    }


# =====================================================================
# 메인
# =====================================================================

def print_header(title):
    print()
    print("=" * 60)
    print(title)
    print("=" * 60)


def main():
    print_header(f"「나란히」 학폭 판례 자동 수집 v1")
    print(f"  OC          : {LAW_OC}")
    print(f"  키워드      : {len(KEYWORDS)}개")
    print(f"  키워드당    : 최대 {MAX_PAGES_PER_KEYWORD}페이지 × 100건")
    print(f"  본문 수집   : 최대 {MAX_BODY_FETCH}건 (시간 절약)")
    print(f"  대기 시간   : {DELAY_SEC}초")

    # ---------- 1단계: 목록 검색 ----------
    print_header("[1/4] 키워드별 목록 검색")
    all_cases = {}  # 판례일련번호 → case (중복 자동 제거)

    for i, kw in enumerate(KEYWORDS, 1):
        print(f"  [{i}/{len(KEYWORDS)}] '{kw}' 검색 중...")
        items = search_keyword(kw)
        new_count = 0
        for item in items:
            sid = item['판례일련번호']
            if sid and sid not in all_cases:
                all_cases[sid] = item
                new_count += 1
        print(f"      → {len(items)}건 발견 (신규 {new_count}건, "
              f"누적 {len(all_cases)}건)")
        time.sleep(DELAY_SEC)

    if not all_cases:
        print("\n  ⚠ 수집된 판례가 없습니다.")
        print("  - OC가 정확한지 확인 (현재: " + LAW_OC + ")")
        print("  - 브라우저에서 단일 호출 테스트 가능한지 확인")
        return

    # ---------- 2단계: 사건 유형 분포 ----------
    print_header(f"[2/4] 사건 유형 분포 (총 {len(all_cases)}건)")
    type_dist = {}
    for c in all_cases.values():
        t = categorize_case(c)
        type_dist[t] = type_dist.get(t, 0) + 1
    for t, n in sorted(type_dist.items(), key=lambda x: -x[1]):
        bar = "▓" * min(n, 30)
        print(f"  {t:25s} {n:4d}건  {bar}")

    # ---------- 3단계: 본문 수집 ----------
    cases_to_fetch = list(all_cases.values())
    if MAX_BODY_FETCH > 0:
        cases_to_fetch = cases_to_fetch[:MAX_BODY_FETCH]

    print_header(f"[3/4] 본문 수집 ({len(cases_to_fetch)}건)")
    print("  주의: 한 건당 약 1초 소요. 잠시만 기다려주세요.")

    schema_records = []
    for i, case in enumerate(cases_to_fetch, 1):
        body = fetch_body(case['판례일련번호'])
        record = map_to_schema(case, body)
        schema_records.append(record)
        if i % 10 == 0 or i == len(cases_to_fetch):
            print(f"  진행: {i}/{len(cases_to_fetch)}")
        time.sleep(DELAY_SEC)

    # ---------- 4단계: 저장 ----------
    print_header("[4/4] 파일 저장")
    OUTPUT_DIR.mkdir(exist_ok=True)

    # CSV 저장
    csv_path = OUTPUT_DIR / "학폭_판례_원본.csv"
    keys = list(schema_records[0].keys())
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in schema_records:
            row = {}
            for k, v in r.items():
                if isinstance(v, (list, dict)):
                    row[k] = json.dumps(v, ensure_ascii=False)
                else:
                    row[k] = v
            w.writerow(row)
    print(f"  ✓ {csv_path}")

    # JSON 저장
    json_path = OUTPUT_DIR / "학폭_판례_원본.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(schema_records, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {json_path}")

    # 리포트 작성
    kw_count = {}
    for r in schema_records:
        kw = r['_search_keyword']
        kw_count[kw] = kw_count.get(kw, 0) + 1

    report_path = OUTPUT_DIR / "수집_리포트.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 학폭 판례 자동 수집 리포트\n\n")
        f.write(f"- 수집 일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"- OC: `{LAW_OC}`\n")
        f.write(f"- 총 수집 건수: **{len(all_cases)}건** ")
        f.write(f"(중복 제거 후)\n")
        f.write(f"- 본문 수집: {len(schema_records)}건\n\n")

        f.write(f"## 사건 유형 분포\n\n")
        f.write(f"| 유형 | 건수 |\n|---|---|\n")
        for t, n in sorted(type_dist.items(), key=lambda x: -x[1]):
            f.write(f"| {t} | {n} |\n")

        f.write(f"\n## 검색 키워드별 결과 (중복 제거 후 기준)\n\n")
        f.write(f"| 키워드 | 건수 |\n|---|---|\n")
        for kw, n in sorted(kw_count.items(), key=lambda x: -x[1]):
            f.write(f"| {kw} | {n} |\n")

        f.write(f"\n## 다음 단계\n\n")
        f.write(f"1. **학생팀 1차 검토**\n")
        f.write(f"   - `학폭_판례_원본.csv`를 엑셀/구글시트로 엽니다\n")
        f.write(f"   - `_category_auto` 컬럼으로 정렬해 사건 유형 확인\n")
        f.write(f"   - 친화 변환 대상 50건 선정 (사이버·신체·언어 균형)\n\n")
        f.write(f"2. **친화 변환 작업**\n")
        f.write(f"   - `친화_변환_가이드_v1.pdf` 의 5대 원칙 적용\n")
        f.write(f"   - TODO 표시된 필드들 채우기:\n")
        f.write(f"     - type_main, role_focus, stage_focus, school_level\n")
        f.write(f"     - friendly_title, friendly_summary\n")
        f.write(f"     - recognition, key_factors, severity_factors\n\n")
        f.write(f"3. **두루 변호사 검수**\n")
        f.write(f"   - `판례_검수_체크리스트_v1.pdf` 활용\n")
        f.write(f"   - 1건당 20~30분 목표\n\n")
        f.write(f"4. **cases.json 통합**\n")
        f.write(f"   - 검수 통과 데이터를 프로토타입 v2.1 데이터로 교체\n")

    print(f"  ✓ {report_path}")

    # ---------- 끝 ----------
    print_header("✓ 수집 완료")
    print(f"\n  📁 결과물 폴더: {OUTPUT_DIR.resolve()}")
    print(f"\n  다음 단계:")
    print(f"    1) {csv_path.name} 를 엑셀/구글시트로 열기")
    print(f"    2) 친화 변환 가이드 v1 적용")
    print(f"    3) 두루 변호사 검수 의뢰")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  ⚠ 사용자가 중단했습니다. 부분 데이터가 있다면 "
              f"{OUTPUT_DIR}/ 에 저장되었을 수 있어요.")
    except Exception as e:
        print(f"\n\n  ❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
