#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=====================================================================
키워드 진단 스크립트 — 어떤 키워드가 데이터를 많이 가져오는지 확인
=====================================================================

사용법:
    cd ~/Desktop/Durumi
    python3 diagnose_keywords.py

결과:
    각 키워드별 총 매칭 건수 + 사건 유형 분포가 표로 출력됨
    약 1~2분 소요
=====================================================================
"""

import os
import time
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET

LAW_OC = os.environ.get("LAW_OC", "durumitech")
BASE_URL = "https://www.law.go.kr/DRF/lawSearch.do"
DELAY_SEC = 0.5

# 진단할 키워드들 — 4개 그룹
KEYWORD_GROUPS = {
    "1번. 학폭 직접 키워드": [
        "학교폭력",
        "학교폭력예방",
        "학폭",
    ],
    "2번. 학생 관련": [
        "학생",
        "중학생",
        "고등학생",
        "미성년자",
    ],
    "3번. 행위 유형 (학폭 본체)": [
        "교내 폭행",
        "촉법소년",
        "소년부 송치",
    ],
    "4번. 사이버 (피드백 강조 영역)": [
        "정보통신망 명예훼손",
        "딥페이크",
        "아동 성착취",
    ],
}


def diagnose(keyword):
    """한 키워드의 총 건수와 사건 유형 분포 반환"""
    params = {
        "OC": LAW_OC,
        "target": "prec",
        "type": "XML",
        "query": keyword,
        "display": 100,
        "page": 1,
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Naranhi-Diagnose/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            xml_text = r.read().decode('utf-8')
        root = ET.fromstring(xml_text)
    except Exception as e:
        return None, f"에러: {e}"

    # 총 건수
    total_el = root.find('totalCnt')
    total = int(total_el.text) if total_el is not None and total_el.text else 0

    # 첫 100건의 사건 유형 분포
    type_dist = {}
    for c in root.findall('prec'):
        sjt = c.find('사건종류명')
        sjt_text = (sjt.text if sjt is not None and sjt.text else '').strip()
        if not sjt_text:
            sjt_text = '미분류'
        type_dist[sjt_text] = type_dist.get(sjt_text, 0) + 1

    return total, type_dist


def main():
    print()
    print("=" * 70)
    print(f"  키워드 진단 (OC: {LAW_OC})")
    print("=" * 70)

    results = []
    for group_name, keywords in KEYWORD_GROUPS.items():
        print(f"\n[{group_name}]")
        for kw in keywords:
            total, info = diagnose(kw)
            if total is None:
                print(f"  {kw:25s}  {info}")
                continue
            # 사건 유형 상위 3개
            top_types = sorted(info.items(), key=lambda x: -x[1])[:3]
            types_str = ", ".join(f"{t}({n})" for t, n in top_types)
            if total == 0:
                types_str = "(데이터 없음)"
            print(f"  {kw:25s} {total:>5}건  | {types_str}")
            results.append((group_name, kw, total, info))
            time.sleep(DELAY_SEC)

    # 요약 표
    print()
    print("=" * 70)
    print("  요약 — 건수 많은 순")
    print("=" * 70)
    sorted_results = sorted(results, key=lambda x: -x[2])
    for group, kw, total, _info in sorted_results:
        bar = "▓" * min(total // 20, 30)
        print(f"  {kw:25s} {total:>5}건  {bar}")

    # 키워드 보강 추천
    print()
    print("=" * 70)
    print("  분석")
    print("=" * 70)
    total_sum = sum(r[2] for r in results)
    high_yield = [r for r in results if r[2] >= 50]
    print(f"  총 {len(results)}개 키워드, 합계 {total_sum}건")
    print(f"  50건 이상 키워드: {len(high_yield)}개")
    if high_yield:
        print(f"  → 다음 키워드를 본 수집 스크립트에 추가하세요:")
        for _, kw, total, _ in high_yield:
            print(f"      '{kw}'  ({total}건)")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n중단됨.")
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
