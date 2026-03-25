import { CityConfig } from "./types";
import { JINJU } from "./jinju";
import {
  CHANGWON_UICHANG,
  CHANGWON_SEONGSAN,
  CHANGWON_MASANHAPPO,
  CHANGWON_MASANHOEWON,
  CHANGWON_JINHAE,
  TONGYEONG,
  SACHEON,
  GIMHAE,
  MIRYANG,
  GEOJE,
  YANGSAN,
  UIRYEONG,
  HAMAN,
  CHANGNYEONG,
  GOSEONG,
  NAMHAE,
  HADONG,
  SANCHEONG,
  HAMYANG,
  GEOCHANG,
  HAPCHEON,
} from "./gyeongnam";

export type { CityConfig };
export { JINJU };

export const cities: Record<string, CityConfig> = {
  jinju: JINJU,
  "changwon-uichang": CHANGWON_UICHANG,
  "changwon-seongsan": CHANGWON_SEONGSAN,
  "changwon-masanhappo": CHANGWON_MASANHAPPO,
  "changwon-masanhoewon": CHANGWON_MASANHOEWON,
  "changwon-jinhae": CHANGWON_JINHAE,
  tongyeong: TONGYEONG,
  sacheon: SACHEON,
  gimhae: GIMHAE,
  miryang: MIRYANG,
  geoje: GEOJE,
  yangsan: YANGSAN,
  uiryeong: UIRYEONG,
  haman: HAMAN,
  changnyeong: CHANGNYEONG,
  goseong: GOSEONG,
  namhae: NAMHAE,
  hadong: HADONG,
  sancheong: SANCHEONG,
  hamyang: HAMYANG,
  geochang: GEOCHANG,
  hapcheon: HAPCHEON,
};

export const DEFAULT_CITY = JINJU;

// 경남 전체 보기용 설정
export const GYEONGNAM_VIEW = {
  center: [35.25, 128.45] as [number, number],
  zoom: 9,
};
