#!/usr/bin/env python3
"""진주시 경로당 목록 크롤링 (knoldman.or.kr)"""

import json
import urllib.request
import ssl
import time
import os
import re
from html.parser import HTMLParser

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://www.knoldman.or.kr/bbs/board.php"
PARAMS = "bo_table=05_01&swr_1=%EC%A7%84%EC%A3%BC%EC%8B%9C%EC%A7%80%ED%9A%8C"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
OUT_PATH = os.path.join(DATA_DIR, "jinju-senior-centers.json")


class TableParser(HTMLParser):
    """경로당 테이블 HTML 파싱"""
    def __init__(self):
        super().__init__()
        self.in_tbody = False
        self.in_tr = False
        self.in_td = False
        self.current_row = []
        self.current_cell = ""
        self.rows = []
        self.td_count = 0

    def handle_starttag(self, tag, attrs):
        if tag == "tbody":
            self.in_tbody = True
        elif tag == "tr" and self.in_tbody:
            self.in_tr = True
            self.current_row = []
            self.td_count = 0
        elif tag == "td" and self.in_tr:
            self.in_td = True
            self.current_cell = ""
            self.td_count += 1

    def handle_endtag(self, tag):
        if tag == "tbody":
            self.in_tbody = False
        elif tag == "tr" and self.in_tr:
            self.in_tr = False
            if self.current_row:
                self.rows.append(self.current_row)
        elif tag == "td" and self.in_td:
            self.in_td = False
            self.current_row.append(self.current_cell.strip())

    def handle_data(self, data):
        if self.in_td:
            self.current_cell += data


def fetch_page(page):
    url = f"{BASE_URL}?{PARAMS}&page={page}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            print(f"  page {page} 실패: {e}")
            return None


def parse_centers(html):
    parser = TableParser()
    parser.feed(html)

    centers = []
    for row in parser.rows:
        # 테이블 컬럼: 번호, 지회명, 분회명(읍면동), 경로당명, 회장명, 회원수, 운영형태
        if len(row) < 7:
            continue
        try:
            members = int(re.sub(r'[^\d]', '', row[5])) if row[5].strip() else 0
        except ValueError:
            members = 0

        centers.append({
            "name": row[3].strip(),       # 경로당명
            "dong": row[2].strip(),        # 분회 = 읍면동
            "president": row[4].strip(),
            "members": members,
            "type": row[6].strip(),
        })
    return centers


def main():
    all_centers = []
    page = 1

    while True:
        print(f"  page {page}...")
        html = fetch_page(page)
        if not html:
            break

        centers = parse_centers(html)
        if not centers:
            break

        all_centers.extend(centers)
        page += 1
        time.sleep(0.5)

    print(f"\n총 {len(all_centers)}개 경로당 수집")

    # 분회(읍면동)별 통계
    from collections import Counter
    branch_counts = Counter(c["dong"] for c in all_centers)
    print("\n분회별 경로당 수:")
    for branch, cnt in branch_counts.most_common():
        print(f"  {branch}: {cnt}개")

    # 저장
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_centers, f, ensure_ascii=False, indent=2)
    print(f"\n저장: {OUT_PATH}")


if __name__ == "__main__":
    main()
