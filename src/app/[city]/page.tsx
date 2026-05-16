"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { notFound, useParams, useRouter } from "next/navigation";
import { cities } from "@/config/cities";

const MapContainer = dynamic(
  () => import("@/components/Map/MapContainer"),
  { ssr: false }
);

export default function CityPage() {
  const params = useParams<{ city: string }>();
  const router = useRouter();
  const cityKey = params.city;
  const city = cities[cityKey];

  // 드롭다운 변경 시 URL을 진실원천으로 두기 위해 라우터로 이동.
  // "경남 전체"(빈 키)는 /map으로 (현행 단일 페이지 보기).
  // useCallback으로 감싸 매 렌더 새 함수 생성을 막고, MapContainer
  // useEffect의 deps에 안정적으로 포함시킨다.
  const handleCityKeyChange = useCallback(
    (nextKey: string | null) => {
      if (!nextKey) {
        router.push("/map");
        return;
      }
      if (nextKey === cityKey) return;
      router.push(`/${nextKey}`);
    },
    [router, cityKey],
  );

  if (!city) {
    notFound();
  }

  return (
    <main className="h-dvh w-full overflow-hidden">
      <MapContainer cityCode={city.code} onCityKeyChange={handleCityKeyChange} />
    </main>
  );
}
