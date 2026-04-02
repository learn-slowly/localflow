"use client";

import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("@/components/Map/MapContainer"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="h-dvh w-full">
      <MapContainer />
    </main>
  );
}
