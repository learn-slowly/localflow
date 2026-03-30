"use client";

import { useEffect, useRef, useState } from "react";

const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject("SSR");
      return;
    }

    if (window.kakao?.maps?.Map) {
      resolve();
      return;
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }

    if (!KAKAO_MAP_KEY) {
      reject("NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수 미설정");
      return;
    }

    const script = document.createElement("script");
    const src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false`;
    script.src = src;
    script.onload = () => {
      if (!window.kakao?.maps) {
        scriptLoading = null;
        reject("SDK 스크립트 로드됐으나 kakao.maps 객체 없음");
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = (e) => {
      scriptLoading = null;
      console.error("카카오맵 SDK 로드 실패:", src, e);
      reject("카카오맵 SDK 로드 실패 — 네트워크 또는 키 오류");
    };
    document.head.appendChild(script);
  });

  return scriptLoading;
}

/** zoom(높을수록 확대) → 카카오 level(낮을수록 확대) 변환 */
export function toKakaoLevel(zoom: number): number {
  return 20 - zoom;
}

export function useKakaoMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: { center: [number, number]; level: number },
) {
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef<kakao.maps.Map | null>(null);

  useEffect(() => {
    loadScript()
      .then(() => setIsLoaded(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return;

    const kakaoMap = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(options.center[0], options.center[1]),
      level: options.level,
    });

    mapRef.current = kakaoMap;
    setMap(kakaoMap);
  }, [isLoaded]);

  return { map, isLoaded };
}
