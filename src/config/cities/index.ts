import { CityConfig } from "./types";
import { JINJU } from "./jinju";

export type { CityConfig };
export { JINJU };

export const cities: Record<string, CityConfig> = {
  jinju: JINJU,
};

export const DEFAULT_CITY = JINJU;
