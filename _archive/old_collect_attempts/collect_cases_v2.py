#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=====================================================================
「나란히」 학폭 판례 자동 수집 스크립트 v2
=====================================================================

v1과 다른 점:
  - 진단 결과 반영: 효과 검증된 6개 키워드만 사용
  - 본문 300건까지 수집 (v1: 100건)
  - 학폭 관련성 자동 점수화 (relevance_score 0~10)
  - CSV가 학폭 관련성 높은 순으로 자동 정렬됨
  - 학생 연령대 자동 추출 (초/중/고/미상)

사용법:
    cd ~/Desktop/Durumi
    python3 collect_cases_v2.py

예상 시간: 약 10~15분

결과:
    output_collected_v2/
      ├── 학폭_판례_원본_v2.csv     (학폭 관련성 높은 순)
      ├── 학폭_판례_원본_v2.json
      └── 수집_리포트_v2.md
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
# 설정
# =====================================================================

LAW_OC = os.environ.get("LAW_OC", "durumitech")

# 진단 결과 기반 — 효과 검증된 키워드만
# (괄호 안 숫자는 진단 시점 총 건수)
KEYWORDS = [
    "미성년자",              # 196건 — 형사 사건 다수, 학폭 본 사건 잠재력
    "정보통신망 명예훼손",   # 107건 — 사이버 명예훼손 (학생 사건 골라내기)
    "학생",                  # 22건 — 학생 관련 사건
    "아동 성착취",           # 21건 — 성폭력 영역 (조심스럽게 다룸)
    "소년부 송치",           # 5건 — 소년보호사건
    "학교폭력",              # 3건 — 학폭 직접 키워드 (적지만 확실)
]

MAX_PAGES_PER_KEYWORD = 3   # 페이지당 100건 × 3 = 키워드당 최대 300건
MAX_BODY_FETCH = 300        # 전체 본문 수집 한도
DELAY_SEC = 0.6
OUTPUT_DIR = Path("output_collected_v2")

# =====================================================================
# 학폭 관련성 자동 점수화
# =====================================================================

# 점수 가중치
RELEVANCE_KEYWORDS = {
    # 강한 시그널 (각 +3점)
    'strong': [
        '학교폭력', '학폭위', '학교폭력예방법', '학교폭력대책심의위원회',
        '교내', '학급', '같은 반', '담임',
    ],
    # 중간 시그널 (각 +2점)
    'medium': [
        '학생', '학교', '중학교', '고등학교', '초등학교', '재학',
        '단톡방', '단체 카톡', '단체방',
        '소년보호', '보호처분', '촉법',
    ],
    # 약한 시그널 (각 +1점)
    'weak': [
        '미성년', '청소년', '동급생', '학년',
        '체육', '복도', '교실', '운동장',
        '왕따', '따돌림', '괴롭힘',
    ],
    # 학폭 *아님* 시그널 (각 -2점)
    'negative': [
        '음주운전', '가정폭력', '직장', '회사원', '근로자',
        '부동산', '대출', '계약', '상속',
    ],
}


def calculate_relevance(text):
    """본문에서 학폭 관련성 점수 계산 (0~10 정규화)"""
    if not text:
        return 0
    score = 0
    for kw in RELEVANCE_KEYWORDS['strong']:
        if kw in text:
            score += 3
    for kw in RELEVANCE_KEYWORDS['medium']:
        if kw in text:
            score += 2
    for kw in RELEVANCE_KEYWORDS['weak']:
        if kw in text:
            score += 1
    for kw in RELEVANCE_KEYWORDS['negative']:
        if kw in text:
            score -= 2
    # 0~10 범위로 정규화 (대략적)
    return max(0, min(10, score))


def detect_school_level(text):
    """본문에서 학생 연령대 자동 추출"""
    if not text:
        return ""
    levels = []
    if any(k in text for k in ['초등학교', '초등학생', '국민학교']):
        levels.append('초')
    if any(k in text for k in ['중학교', '중학생']):
        levels.append('중')
    if any(k in text for k in ['고등학교', '고등학생', '고교']):
        levels.append('고')
    if not levels and any(k in text for k in ['학생', '학교']):
        return '학생(연령미상)'
    if not levels:
        return ''
    return '/'.join(levels)


# =====================================================================
# API 호출
# =====================================================================

BASE_LIST_URL = "https://www.law.go.kr/DRF/lawSearch.do"
BASE_INFO_URL = "https://www.law.go.kr/DRF/lawService.do"


def _fetch_xml(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": "Naranhi-Collector/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return ET.fromstring(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"    HTTP 오류 {e.code}")
    except urllib.error.URLError as e:
        print(f"    네트워크 오류: {e.reason}")
    except ET.ParseError as e:
        print(f"    XML 파싱 오류: {e}")
    return None


def _text(node, field, default=''):
    el = node.find(field)
    if el is None or not el.text:
        return default
    return el.text.strip()


def search_keyword(kw):
    items = []
    for page in range(1, MAX_PAGES_PER_KEYWORD + 1):
        params = {
            "OC": LAW_OC, "target": "prec", "type": "XML",
            "query": kw, "display": 100, "page": page,
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
        if len(cases) < 100:
            break
        time.sleep(DELAY_SEC)
    return items


def fetch_body(case_id):
    params = {"OC": LAW_OC, "target": "prec", "type": "XML", "ID": case_id}
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
    if not text:
        return []
    found = []
    for kw in DOMAIN_KEYWORDS:
        if kw in text and kw not in found:
            found.append(kw)
            if len(found) >= top_n:
                break
    return found


def map_to_schema(case, body):
    body_text = (body.get('판시사항', '') + ' ' +
                 body.get('판결요지', '') + ' ' +
                 body.get('판례내용', ''))[:5000]

    # v2 핵심: 학폭 관련성 자동 점수화 + 학생 연령대 자동 추출
    relevance = calculate_relevance(body_text)
    school_level_auto = detect_school_level(body_text)

    return {
        # === v2 신규 — 학폭 관련성 자동 분석 ===
        "_relevance_score": relevance,                # 0~10, 높을수록 학폭 관련 가능성 큼
        "_school_level_auto": school_level_auto,      # 본문에서 자동 추출한 학생 연령대
        "_priority_for_review": "★" * min(relevance // 2, 5),  # 시각적 우선순위

        # === 자동 채워지는 필드 ===
        "case_id": f"AUTO-{case['판례일련번호']}",
        "_source": "법제처 OPEN API",
        "_collected_at": datetime.now().strftime("%Y-%m-%d"),
        "_search_keyword": case['_검색_키워드'],
        "_serial_number": case['판례일련번호'],

        # === v2.1 피드백 반영 필드 ===
        "decision_date": (case['선고일자'].replace('.', '-')
                          if case['선고일자'] else None),
        "court": case['법원명'],
        "case_number": case['사건번호'],
        "case_title_formal": case['사건명'] or f"({case['사건번호']})",
        "disposition_summary": (case['판결유형'] +
                                ((' ' + case['선고']) if case['선고'] else '')),

        # === 원문 ===
        "original_summary": body.get('판시사항', ''),
        "original_facts_raw": body.get('판결요지', ''),
        "original_law": body.get('참조조문', ''),
        "original_full_text": body.get('판례내용', '')[:3000],

        # === 자동 추출 ===
        "keywords_auto": extract_keywords(body_text),
        "_category_auto": categorize_case(case),

        # === 사람이 채우는 필드 (TODO) ===
        "type_main": "TODO",
        "subtypes": [],
        "role_focus": "TODO",
        "stage_focus": "TODO",
        "school_level": "TODO",       # (v2의 _school_level_auto 참고)
        "applies_to": [],
        "friendly_title": "TODO",
        "friendly_summary": "TODO",
        "recognition": "TODO",
        "category": case['사건종류명'],
        "sentence": "TODO",
        "key_factors": [],
        "not_recognized_reasons": [],
        "severity_factors": [],

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
    print_header(f"「나란히」 학폭 판례 자동 수집 v2 (진단 반영)")
    print(f"  OC          : {LAW_OC}")
    print(f"  키워드      : {len(KEYWORDS)}개 (효과 검증된 것만)")
    print(f"  본문 수집   : 최대 {MAX_BODY_FETCH}건")
    print(f"  v2 신규 기능: 학폭 관련성 자동 점수화 (★~★★★★★)")

    # ---------- 1단계 ----------
    print_header("[1/4] 키워드별 목록 검색")
    all_cases = {}
    for i, kw in enumerate(KEYWORDS, 1):
        print(f"  [{i}/{len(KEYWORDS)}] '{kw}' 검색 중...")
        items = search_keyword(kw)
        new_count = 0
        for item in items:
            sid = item['판례일련번호']
            if sid and sid not in all_cases:
                all_cases[sid] = item
                new_count += 1
        print(f"      → {len(items)}건 발견 (신규 {new_count}건, 누적 {len(all_cases)}건)")
        time.sleep(DELAY_SEC)

    if not all_cases:
        print("\n  ⚠ 수집된 판례가 없습니다.")
        return

    # ---------- 2단계 ----------
    print_header(f"[2/4] 사건 유형 분포 (총 {len(all_cases)}건)")
    type_dist = {}
    for c in all_cases.values():
        t = categorize_case(c)
        type_dist[t] = type_dist.get(t, 0) + 1
    for t, n in sorted(type_dist.items(), key=lambda x: -x[1]):
        bar = "▓" * min(n, 40)
        print(f"  {t:25s} {n:4d}건  {bar}")

    # ---------- 3단계 ----------
    cases_to_fetch = list(all_cases.values())[:MAX_BODY_FETCH] if MAX_BODY_FETCH else list(all_cases.values())
    print_header(f"[3/4] 본문 수집 ({len(cases_to_fetch)}건) — 시간 소요")
    print("  진행 상황은 10건마다 표시됩니다.")

    schema_records = []
    for i, case in enumerate(cases_to_fetch, 1):
        body = fetch_body(case['판례일련번호'])
        record = map_to_schema(case, body)
        schema_records.append(record)
        if i % 10 == 0 or i == len(cases_to_fetch):
            print(f"  진행: {i}/{len(cases_to_fetch)}")
        time.sleep(DELAY_SEC)

    # ---------- v2 핵심: 관련성 점수 기반 정렬 ----------
    print_header("[3.5/4] 학폭 관련성 점수 분포")
    score_dist = {}
    for r in schema_records:
        s = r['_relevance_score']
        score_dist[s] = score_dist.get(s, 0) + 1
    for s in sorted(score_dist.keys(), reverse=True):
        bar = "▓" * min(score_dist[s], 40)
        stars = "★" * min(s // 2, 5)
        print(f"  점수 {s:2d} {stars:6s} : {score_dist[s]:3d}건  {bar}")

    high_relevance = sum(1 for r in schema_records if r['_relevance_score'] >= 4)
    print(f"\n  ✓ 학폭 관련성 ≥ 4 (★★ 이상): {high_relevance}건 → 학생팀 우선 검토 대상")

    # 점수 내림차순 정렬
    schema_records.sort(key=lambda r: (-r['_relevance_score'],
                                        r.get('decision_date') or '0000'))

    # ---------- 4단계 ----------
    print_header("[4/4] 파일 저장")
    OUTPUT_DIR.mkdir(exist_ok=True)

    # CSV (관련성 높은 순)
    csv_path = OUTPUT_DIR / "학폭_판례_원본_v2.csv"
    keys = list(schema_records[0].keys())
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in schema_records:
            row = {}
            for k, v in r.items():
                row[k] = json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v
            w.writerow(row)
    print(f"  ✓ {csv_path}")

    json_path = OUTPUT_DIR / "학폭_판례_원본_v2.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(schema_records, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {json_path}")

    # 리포트
    kw_count = {}
    for r in schema_records:
        kw = r['_search_keyword']
        kw_count[kw] = kw_count.get(kw, 0) + 1

    report_path = OUTPUT_DIR / "수집_리포트_v2.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 학폭 판례 자동 수집 리포트 v2\n\n")
        f.write(f"- 수집 일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"- OC: `{LAW_OC}`\n")
        f.write(f"- 총 수집: **{len(all_cases)}건** (중복 제거 후)\n")
        f.write(f"- 본문 수집: {len(schema_records)}건\n")
        f.write(f"- 학폭 관련성 ★★ 이상: **{high_relevance}건**\n\n")

        f.write(f"## 사건 유형 분포\n\n| 유형 | 건수 |\n|---|---|\n")
        for t, n in sorted(type_dist.items(), key=lambda x: -x[1]):
            f.write(f"| {t} | {n} |\n")

        f.write(f"\n## 학폭 관련성 점수 분포 (v2 신규)\n\n| 점수 | 건수 | 의미 |\n|---|---|---|\n")
        for s in sorted(score_dist.keys(), reverse=True):
            meaning = ("★★★★★ 매우 높음 (반드시 검토)" if s >= 8 else
                       "★★★★ 높음 (검토 강력 권장)" if s >= 6 else
                       "★★★ 중간 (검토 권장)" if s >= 4 else
                       "★★ 낮음 (제외 가능)" if s >= 2 else
                       "★ 학폭 아닐 가능성 큼")
            f.write(f"| {s} | {score_dist[s]} | {meaning} |\n")

        f.write(f"\n## 키워드별 결과\n\n| 키워드 | 건수 |\n|---|---|\n")
        for kw, n in sorted(kw_count.items(), key=lambda x: -x[1]):
            f.write(f"| {kw} | {n} |\n")

        f.write(f"\n## 학생팀 다음 단계 — 우선순위\n\n")
        f.write(f"1. **★★ 이상 ({high_relevance}건) 우선 검토** — `_priority_for_review` 컬럼 기준\n")
        f.write(f"2. 본문에서 *진짜 학폭 사건*인지 확인 후 50건 선정\n")
        f.write(f"3. 분류 코드표 v1 + 친화 변환 가이드 v1 적용\n")
        f.write(f"4. 두루 변호사 검수\n")

    print(f"  ✓ {report_path}")

    print_header("✓ v2 수집 완료")
    print(f"\n  📁 결과: {OUTPUT_DIR.resolve()}")
    print(f"\n  📊 학폭 관련성 ★★ 이상: {high_relevance}건 (학생팀 우선 검토)")
    print(f"\n  다음 단계:")
    print(f"    1) CSV 열어서 _priority_for_review 컬럼으로 정렬")
    print(f"    2) ★★ 이상 위주로 본문 읽고 학폭 사건 골라내기")
    print(f"    3) 50건 선정 → 친화 변환 시작")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n중단됨. 부분 데이터가 {OUTPUT_DIR}/ 에 있을 수 있어요.")
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
