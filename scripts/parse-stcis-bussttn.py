"""stcis 버스정류장 데이터를 읍면동별로 집계하여 저장"""
import json
from collections import Counter

# 이 데이터는 브라우저에서 stcis.go.kr/openapi/bussttn.json?apikey=...&sggCd=48170 호출 결과
# 프론트에서 직접 호출하도록 할 수도 있지만, 정적 집계가 더 효율적
INPUT = "src/data/stcis-bussttn-raw.json"
OUTPUT = "src/data/jinju-bus-density.json"

# 법정동코드(10자리) → 행정동 매핑이 필요
# stcis emdCd는 법정동코드 10자리
LEGAL_TO_ADMIN = {
    "4817010100": "천전동",  # 망경동
    "4817010200": "천전동",  # 주약동
    "4817010300": "천전동",  # 강남동
    "4817010400": "천전동",  # 칠암동
    "4817010500": "성북동",  # 본성동
    "4817010600": "성북동",  # 동성동
    "4817010700": "성북동",  # 남성동
    "4817010800": "성북동",  # 인사동
    "4817010900": "중앙동",  # 대안동
    "4817011000": "중앙동",  # 평안동
    "4817011100": "중앙동",  # 중안동
    "4817011200": "중앙동",  # 계동
    "4817011300": "성북동",  # 봉곡동
    "4817011400": "상봉동",  # 상봉동
    "4817011500": "중앙동",  # 봉래동
    "4817011600": "중앙동",  # 수정동
    "4817011700": "중앙동",  # 장대동
    "4817011800": "중앙동",  # 옥봉동
    "4817011900": "상대동",  # 상대동
    "4817012000": "하대동",  # 하대동
    "4817012100": "상평동",  # 상평동
    "4817012200": "초장동",  # 초전동
    "4817012300": "초장동",  # 장재동
    "4817012400": "이현동",  # 하촌동
    "4817012500": "신안동",  # 신안동
    "4817012600": "평거동",  # 평거동
    "4817012700": "이현동",  # 이현동(유곡동)
    "4817012800": "판문동",  # 판문동(귀곡동)
    "4817012900": "판문동",  # 판문동
    "4817013000": "판문동",  # 귀곡동
    "4817013100": "가호동",  # 가좌동
    "4817013200": "가호동",  # 호탄동
    "4817013700": "충무공동",  # 충무공동
}

def main():
    with open(INPUT) as f:
        data = json.load(f)

    stations = data if isinstance(data, list) else data.get("result", [])
    print(f"Total stations: {len(stations)}")

    # 읍면동별 집계
    emd_count = Counter()
    admin_count = Counter()

    for st in stations:
        emd_cd = st.get("emdCd", "")
        emd_count[emd_cd] += 1

        # 법정동 → 행정동 매핑
        # emdCd의 앞 10자리
        admin = LEGAL_TO_ADMIN.get(emd_cd[:10])
        if not admin:
            # 면 지역은 앞 7자리로 매핑
            prefix = emd_cd[:7]
            admin_map = {
                "4817025": "문산읍",
                "4817031": "내동면",
                "4817032": "정촌면",
                "4817033": "금곡면",
                "4817035": "진성면",
                "4817036": "일반성면",
                "4817037": "이반성면",
                "4817038": "사봉면",
                "4817039": "지수면",
                "4817040": "대곡면",
                "4817041": "금산면",
                "4817042": "집현면",
                "4817043": "미천면",
                "4817044": "명석면",
                "4817045": "대평면",
                "4817046": "수곡면",
            }
            admin = admin_map.get(prefix, "기타")

        admin_count[admin] += 1

    print(f"\n행정동별 정류장 수:")
    for dong, count in admin_count.most_common():
        print(f"  {dong}: {count}개")

    # 저장
    result = dict(admin_count)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {OUTPUT}")

if __name__ == "__main__":
    main()
