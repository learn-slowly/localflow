"""
경남 대한노인회 경로당 현황 스크래핑
https://www.knoldman.or.kr/bbs/board.php?bo_table=05_01

진주시지회 데이터를 수집하여 기존 CSV와 병합
추가 컬럼: 분회명, 회원수, 운영형태
"""

import csv
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

BASE_URL = "https://www.knoldman.or.kr/bbs/board.php"
JIHOE = "진주시지회"
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"


def fetch_page(page: int) -> str:
    """한 페이지의 HTML을 가져온다."""
    params = urllib.parse.urlencode({
        "bo_table": "05_01",
        "swr_1": JIHOE,
        "page": page,
    })
    url = f"{BASE_URL}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_rows(html: str) -> list[dict]:
    """HTML에서 경로당 테이블 행을 파싱한다."""
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.DOTALL)
    results = []
    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(cells) == 7:
            clean = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            results.append({
                "번호": clean[0],
                "지회명": clean[1],
                "분회명": clean[2],
                "경로당명": clean[3],
                "회장명": clean[4],
                "회원수": clean[5],
                "운영형태": clean[6],
            })
    return results


def get_total_pages(html: str) -> int:
    """총 페이지 수를 파싱한다."""
    # pg_end 링크에서 마지막 페이지 번호 추출
    end_match = re.search(r'pg_end[^>]*>.*?page=(\d+)', html, re.DOTALL)
    if end_match:
        return int(end_match.group(1))
    # fallback: Total <span>N건</span>
    match = re.search(r"Total\s*<[^>]*>(\d+)건", html)
    if match:
        total = int(match.group(1))
        per_page = 15
        return (total + per_page - 1) // per_page
    return 1


def load_existing_csv() -> list[dict]:
    """기존 CSV(EUC-KR)를 로드한다."""
    csv_path = OUTPUT_DIR / "경상남도_경로당 현황_20221231.csv"
    rows = []
    with open(csv_path, "r", encoding="euc-kr", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def normalize_name(name: str) -> str:
    """경로당명을 비교용으로 정규화한다."""
    s = name.strip()
    # 공통 접미사 제거
    for suffix in ["경로당", "경로회", "아파트", "APT", "apt"]:
        s = s.replace(suffix, "")
    s = s.replace(" ", "").replace("\u3000", "")
    s = re.sub(r"[^\w가-힣]", "", s)
    return s


def main():
    # 1) 웹사이트에서 진주시 경로당 전체 수집
    print("1단계: 웹사이트에서 진주시 경로당 데이터 수집...")
    first_html = fetch_page(1)
    total_pages = get_total_pages(first_html)
    print(f"  총 {total_pages}페이지")

    all_web_rows = parse_rows(first_html)
    print(f"  1/{total_pages}페이지 완료 ({len(all_web_rows)}건)")

    for page in range(2, total_pages + 1):
        time.sleep(0.5)  # 서버 부담 줄이기
        html = fetch_page(page)
        rows = parse_rows(html)
        all_web_rows.extend(rows)
        if page % 5 == 0 or page == total_pages:
            print(f"  {page}/{total_pages}페이지 완료 (누적 {len(all_web_rows)}건)")

    print(f"  웹사이트 수집 완료: {len(all_web_rows)}건")

    # 2) 웹 데이터만으로 새 CSV 저장 (진주시 전체)
    web_csv_path = OUTPUT_DIR / "진주시_경로당_현황_knoldman.csv"
    with open(web_csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["번호", "분회명", "경로당명", "회장명", "회원수", "운영형태"])
        writer.writeheader()
        for row in all_web_rows:
            writer.writerow({k: row[k] for k in writer.fieldnames})
    print(f"\n2단계: 웹 데이터 저장 → {web_csv_path.name}")

    # 3) 기존 CSV와 병합
    print("\n3단계: 기존 CSV와 병합...")
    existing = load_existing_csv()
    jinju_existing = [r for r in existing if "진주" in r.get("시군명", "")]
    print(f"  기존 CSV 진주시 경로당: {len(jinju_existing)}건")

    # 웹 데이터를 정규화된 이름으로 인덱싱
    web_index: dict[str, dict] = {}
    for row in all_web_rows:
        key = normalize_name(row["경로당명"])
        web_index[key] = row

    # 매칭 통계
    matched = 0
    fuzzy_matched = 0
    unmatched_csv = []
    web_keys = list(web_index.keys())

    def find_fuzzy(csv_key: str) -> dict | None:
        """부분 문자열 매칭 시도."""
        # CSV 키가 웹 키를 포함하거나, 웹 키가 CSV 키를 포함
        candidates = []
        for wk in web_keys:
            if len(csv_key) >= 2 and len(wk) >= 2:
                if csv_key in wk or wk in csv_key:
                    candidates.append((abs(len(csv_key) - len(wk)), wk))
        if candidates:
            candidates.sort()
            return web_index[candidates[0][1]]
        return None

    for row in jinju_existing:
        name = row.get("시설명", "")
        key = normalize_name(name)
        if key in web_index:
            web = web_index[key]
            row["분회명"] = web["분회명"]
            row["회원수"] = web["회원수"]
            row["운영형태"] = web["운영형태"]
            matched += 1
        else:
            web = find_fuzzy(key)
            if web:
                row["분회명"] = web["분회명"]
                row["회원수"] = web["회원수"]
                row["운영형태"] = web["운영형태"]
                fuzzy_matched += 1
            else:
                row["분회명"] = ""
                row["회원수"] = ""
                row["운영형태"] = ""
                unmatched_csv.append(name)

    print(f"  정확 매칭: {matched}건")
    print(f"  유사 매칭: {fuzzy_matched}건")
    print(f"  매칭 실패: {len(unmatched_csv)}건")
    if unmatched_csv[:10]:
        print(f"  미매칭 예시: {unmatched_csv[:10]}")

    # 4) 병합된 CSV 저장
    merged_path = OUTPUT_DIR / "진주시_경로당_병합.csv"
    fieldnames = ["연번", "시군명", "시설명", "주소", "분회명", "회원수", "운영형태"]
    with open(merged_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in jinju_existing:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
    print(f"\n4단계: 병합 파일 저장 → {merged_path.name}")

    # 5) 웹에만 있는 신규 경로당 (기존 CSV에 없는 것)
    csv_names = {normalize_name(r.get("시설명", "")) for r in jinju_existing}
    web_only = [r for r in all_web_rows if normalize_name(r["경로당명"]) not in csv_names]
    print(f"\n웹에만 있는 신규 경로당: {len(web_only)}건")
    if web_only[:5]:
        for r in web_only[:5]:
            print(f"  - {r['경로당명']} ({r['분회명']}, 회원 {r['회원수']}명)")

    print("\n완료!")


if __name__ == "__main__":
    main()
