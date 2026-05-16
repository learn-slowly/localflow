"use client";

import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("@/components/Map/MapContainer"),
  { ssr: false }
);

export default function MapPage() {
  return (
    <main className="h-dvh w-full overflow-hidden">
      <MapContainer />
    </main>
  );
}
