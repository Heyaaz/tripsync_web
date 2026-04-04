'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleSlot } from '@/lib/types';

type Props = {
  slots: ScheduleSlot[];
  initialOrderIndex?: number;
  scheduleTitle?: string;
  scheduleSummary?: string;
};

type ScheduleSlotWithCoordinates = ScheduleSlot & {
  place: ScheduleSlot['place'] & {
    latitude: number;
    longitude: number;
  };
};

type KakaoLatLng = {
  getLat?: () => number;
  getLng?: () => number;
};

type KakaoMapInstance = {
  addControl: (control: unknown, position: unknown) => void;
  setCenter: (latLng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void;
  panTo: (latLng: KakaoLatLng) => void;
};

type KakaoLatLngBounds = {
  extend: (latLng: KakaoLatLng) => void;
  getSouthWest: () => KakaoLatLng;
};

type KakaoMarkerInstance = {
  setMap: (map: KakaoMapInstance | null) => void;
};

type KakaoOverlayInstance = {
  setMap: (map: KakaoMapInstance | null) => void;
};

type KakaoMapsApi = {
  maps: {
    load: (callback: () => void) => void;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number }
    ) => KakaoMapInstance;
    LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
    LatLngBounds: new () => KakaoLatLngBounds;
    ZoomControl: new () => unknown;
    Marker: new (options: { position: KakaoLatLng; clickable?: boolean }) => KakaoMarkerInstance;
    CustomOverlay: new (options: { position: KakaoLatLng; yAnchor?: number; content: HTMLElement }) => KakaoOverlayInstance;
    ControlPosition: { RIGHT: unknown };
    event: {
      addListener: (target: KakaoMarkerInstance, eventName: string, handler: () => void) => void;
    };
  };
};

let kakaoMapsSdkPromise: Promise<KakaoMapsApi> | null = null;

function hasCoordinates(slot: ScheduleSlot): slot is ScheduleSlotWithCoordinates {
  return Number.isFinite(slot.place.latitude) && Number.isFinite(slot.place.longitude);
}

function loadKakaoMapsSdk(appKey: string) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps SDK can only load in the browser.'));
  }

  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao as KakaoMapsApi);
  }

  if (kakaoMapsSdkPromise) {
    return kakaoMapsSdkPromise;
  }

  kakaoMapsSdkPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      const kakaoApi = window.kakao as KakaoMapsApi | undefined;
      if (!kakaoApi?.maps?.load) {
        kakaoMapsSdkPromise = null;
        reject(new Error('Kakao Maps SDK did not initialize.'));
        return;
      }
      kakaoApi.maps.load(() => resolve(kakaoApi));
    };

    const existing = document.getElementById('kakao-maps-sdk') as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao?.maps) {
        onReady();
        return;
      }
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => {
        kakaoMapsSdkPromise = null;
        reject(new Error('Failed to load Kakao Maps SDK.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => {
      kakaoMapsSdkPromise = null;
      reject(new Error('Failed to load Kakao Maps SDK.'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return kakaoMapsSdkPromise;
}

function formatSlotTime(slot: ScheduleSlot) {
  const start = slot.startTime ? new Date(slot.startTime) : null;
  const end = slot.endTime ? new Date(slot.endTime) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '세부 시간 조정 예정';
  }
  const toText = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return `${toText(start)} - ${toText(end)}`;
}

function createMarkerBadge(orderIndex: number, selected: boolean, onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = String(orderIndex);
  button.setAttribute('aria-label', `${orderIndex}번 코스 보기`);
  button.onclick = onClick;
  button.style.width = '34px';
  button.style.height = '34px';
  button.style.borderRadius = '9999px';
  button.style.border = selected ? '2px solid #1d4ed8' : '2px solid rgba(255,255,255,0.92)';
  button.style.background = selected ? '#2563eb' : '#ffffff';
  button.style.color = selected ? '#ffffff' : '#1f2937';
  button.style.fontSize = '13px';
  button.style.fontWeight = '700';
  button.style.boxShadow = selected
    ? '0 10px 24px rgba(37,99,235,0.28)'
    : '0 8px 20px rgba(15,23,42,0.14)';
  button.style.cursor = 'pointer';
  button.style.transition = 'all 150ms ease';
  return button;
}

export default function ScheduleMapModalView({
  slots,
  initialOrderIndex,
  scheduleTitle,
  scheduleSummary,
}: Props) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const overlaysRef = useRef<KakaoOverlayInstance[]>([]);
  const hasFitBoundsRef = useRef(false);

  const slotsWithCoords = useMemo(
    () => slots.filter(hasCoordinates),
    [slots],
  );
  const missingCoordsCount = slots.length - slotsWithCoords.length;
  const slotSignature = useMemo(
    () => slots.map((slot) => `${slot.orderIndex}:${slot.place.latitude ?? 'x'}:${slot.place.longitude ?? 'x'}`).join('|'),
    [slots],
  );

  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number | null>(null);
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const fallbackOrderIndex = initialOrderIndex ?? slotsWithCoords[0]?.orderIndex ?? slots[0]?.orderIndex ?? 1;

  useEffect(() => {
    hasFitBoundsRef.current = false;
  }, [slotSignature]);

  const selectedSlot =
    slots.find((slot) => slot.orderIndex === (selectedOrderIndex ?? fallbackOrderIndex))
    ?? slotsWithCoords[0]
    ?? slots[0]
    ?? null;

  useEffect(() => {
    if (!appKey || !mapContainerRef.current || slotsWithCoords.length === 0) {
      return;
    }

    let cancelled = false;

    loadKakaoMapsSdk(appKey)
      .then((kakao) => {
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const selectedCoordinateSlot =
          slotsWithCoords.find((slot) => slot.orderIndex === (selectedOrderIndex ?? fallbackOrderIndex))
          ?? slotsWithCoords[0];

        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(mapContainerRef.current, {
            center: new kakao.maps.LatLng(selectedCoordinateSlot.place.latitude, selectedCoordinateSlot.place.longitude),
            level: 7,
          });
          const zoomControl = new kakao.maps.ZoomControl();
          mapRef.current.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        overlaysRef.current.forEach((overlay) => overlay.setMap(null));
        markersRef.current = [];
        overlaysRef.current = [];

        const bounds = new kakao.maps.LatLngBounds();

        slotsWithCoords.forEach((slot) => {
          const position = new kakao.maps.LatLng(slot.place.latitude, slot.place.longitude);
          bounds.extend(position);

          const marker = new kakao.maps.Marker({
            position,
            clickable: true,
          });

          kakao.maps.event.addListener(marker, 'click', () => {
            setSelectedOrderIndex(slot.orderIndex);
          });

          marker.setMap(mapRef.current);
          markersRef.current.push(marker);

          const overlay = new kakao.maps.CustomOverlay({
            position,
            yAnchor: 1.6,
            content: createMarkerBadge(
              slot.orderIndex,
              slot.orderIndex === selectedCoordinateSlot.orderIndex,
              () => setSelectedOrderIndex(slot.orderIndex),
            ),
          });
          overlay.setMap(mapRef.current);
          overlaysRef.current.push(overlay);
        });

        if (!hasFitBoundsRef.current) {
          if (slotsWithCoords.length === 1) {
            mapRef.current.setCenter(bounds.getSouthWest());
            mapRef.current.setLevel(5);
          } else {
            mapRef.current.setBounds(bounds, 56, 56, 56, 56);
          }
          hasFitBoundsRef.current = true;
        }

        if (selectedCoordinateSlot) {
          mapRef.current.panTo(new kakao.maps.LatLng(selectedCoordinateSlot.place.latitude, selectedCoordinateSlot.place.longitude));
        }

        setMapStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setMapStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appKey, fallbackOrderIndex, selectedOrderIndex, slotsWithCoords]);

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="border-b border-zinc-100 bg-white px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            일정 전체 지도
          </span>
          <span className="text-[12px] font-medium text-zinc-500">
            총 {slots.length}개 코스
          </span>
        </div>
        {scheduleTitle ? <h4 className="text-base font-bold text-zinc-900">{scheduleTitle}</h4> : null}
        {scheduleSummary ? <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">{scheduleSummary}</p> : null}
        {missingCoordsCount > 0 ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            좌표가 없는 코스 {missingCoordsCount}개는 목록에만 표시됩니다.
          </p>
        ) : null}
      </div>

      <div className="relative min-h-[260px] flex-1 bg-zinc-100">
        {!appKey ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-xs rounded-[22px] border border-zinc-200 bg-white px-5 py-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <iconify-icon icon="solar:map-point-wave-bold-duotone" width="22"></iconify-icon>
              </div>
              <h5 className="text-sm font-bold text-zinc-900">카카오 지도 키가 필요해요</h5>
              <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[12px]">NEXT_PUBLIC_KAKAO_MAP_APP_KEY</code>를 설정하면
                일정 전체 지도를 모달 안에서 바로 보여줄 수 있어요.
              </p>
            </div>
          </div>
        ) : slotsWithCoords.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-xs rounded-[22px] border border-zinc-200 bg-white px-5 py-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                <iconify-icon icon="solar:map-linear" width="22"></iconify-icon>
              </div>
              <h5 className="text-sm font-bold text-zinc-900">지도 좌표를 준비 중이에요</h5>
              <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">
                아직 이 일정의 장소 좌표가 없어 지도를 그릴 수 없어요. 좌표가 내려오면 이 모달에서 바로 확인할 수 있습니다.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div ref={mapContainerRef} className="h-full w-full" />
            {mapStatus === 'loading' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/72 backdrop-blur-[2px]">
                <div className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                  지도를 불러오는 중…
                </div>
              </div>
            ) : null}
            {mapStatus === 'error' ? (
              <div className="absolute inset-x-4 top-4 rounded-2xl border border-rose-100 bg-white/95 px-4 py-3 text-sm font-medium text-rose-700 shadow-lg">
                카카오 지도를 불러오지 못했어요. 앱 키와 도메인 설정을 확인해 주세요.
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-zinc-100 bg-white px-4 py-4">
        {selectedSlot ? (
          <div className="mb-3 rounded-[20px] border border-blue-100 bg-blue-50/70 px-4 py-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-[11px] font-bold text-white">
                {selectedSlot.orderIndex}
              </span>
              <p className="text-sm font-bold text-zinc-900">{selectedSlot.place.name}</p>
            </div>
            <p className="text-sm font-normal text-zinc-700">{selectedSlot.place.address}</p>
            <p className="mt-1 text-[12px] font-medium text-zinc-500">{formatSlotTime(selectedSlot)}</p>
          </div>
        ) : null}

        <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
          {slots.map((slot) => {
            const isSelected = slot.orderIndex === selectedOrderIndex;
            const isDisabled = !hasCoordinates(slot);

            return (
              <button
                key={slot.orderIndex}
                type="button"
                disabled={isDisabled}
                onClick={() => setSelectedOrderIndex(slot.orderIndex)}
                className={`flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                  isSelected
                    ? 'border-blue-200 bg-blue-50'
                    : isDisabled
                      ? 'border-zinc-200 bg-zinc-50 opacity-70'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}>
                  {slot.orderIndex}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-900">{slot.place.name}</span>
                  <span className="mt-0.5 block text-sm font-normal leading-relaxed text-zinc-700">{slot.place.address}</span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-zinc-500">
                  {isDisabled ? '좌표 없음' : formatSlotTime(slot)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
