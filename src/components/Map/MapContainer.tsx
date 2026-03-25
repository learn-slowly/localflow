"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_CITY } from "@/config/cities";

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapContainer() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current) return;
      const city = DEFAULT_CITY;
      const options = {
        center: new window.kakao.maps.LatLng(city.center[0], city.center[1]),
        level: 7,
      };
      new window.kakao.maps.Map(mapRef.current, options);
    };

    const waitForKakao = setInterval(() => {
      if (window.kakao?.maps?.load) {
        clearInterval(waitForKakao);
        window.kakao.maps.load(initMap);
      }
    }, 100);

    return () => clearInterval(waitForKakao);
  }, []);

  return <div ref={mapRef} className="h-screen w-full" />;
}
