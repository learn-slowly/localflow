"use client";

import dynamic from "next/dynamic";

const GyeongnamMap = dynamic(
  () => import("@/components/Map/GyeongnamMap"),
  { ssr: false }
);

export default function Home() {
  return <GyeongnamMap />;
}
