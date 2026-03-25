"use client";

import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("@/components/Map/MapContainer"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="h-screen w-full">
      <MapContainer />
    </main>
  );
}
