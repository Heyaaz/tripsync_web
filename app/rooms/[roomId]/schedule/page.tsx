'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import ScheduleMapModalView from '@/components/schedule/ScheduleMapModalView';
import { shareWithSystemFallback } from '@/lib/utils/webShare';
import { useAuthStore } from '@/lib/store/auth';
import { roomApi, scheduleApi } from '@/lib/api/client';
import type { Place, Room, Schedule, ScheduleOption, ScheduleSlot } from '@/lib/types';
import { OPTION_LABELS } from '@/lib/utils/tpti';
import { formatTripDateRange } from '@/lib/utils/date';
import { getApiErrorMessage } from '@/lib/utils/error';
import { MEMBER_COLORS } from '@/components/tpti/TptiRadarChart';
import { normalizeRoomSummary } from '@/lib/utils/room';


function getProposalStepLabel(index: number) {
  const labels = ['첫 코스', '두 번째 코스', '세 번째 코스', '네 번째 코스', '다섯 번째 코스'];
  return labels[index] ?? `${index + 1}번째 코스`;
}

const GENERATING_MESSAGES = [
  '서로의 취향을 맞춰보는 중…',
  '충남 여행 코스를 정리하는 중…',
  '사진·예산 취향을 반영하는 중…',
  '동행자가 함께 만족할 일정을 고르는 중…',
];

function cleanDisplayText(text?: string | null) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== '.')
    .join(' ')
    .replace(/([.!?。])로\s*/g, '$1 ')
    .replace(/개인적 취향에 맞음/g, '개인 취향에 맞습니다')
    .replace(/개인 취향을 반영하여 갈등을 최소화했습니다[.。]?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

function SatisfactionBar({ score, nickname, color }: { score: number; nickname: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-700 w-12 shrink-0 font-medium truncate">
        {nickname}
      </span>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-black w-8 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

type DetailModalState = {
  slot: ScheduleSlot;
  accentColor: string;
  isLocal: boolean;
  scheduleTitle: string;
  scheduleSummary: string;
  scheduleSlots: ScheduleSlot[];
};

type PlaceSearchResponse = {
  places?: Place[];
  query?: string;
};

function buildShareScheduleUrl(scheduleId?: number | null) {
  if (!scheduleId || typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/share/schedule/${scheduleId}`;
}

function normalizeConfirmedSchedule(schedule: Schedule): ScheduleOption {
  const optionType = schedule.optionType ?? 'balanced';
  return {
    scheduleId: schedule.id,
    optionType,
    label: OPTION_LABELS[optionType]?.label ?? '확정 일정',
    summary: schedule.summary,
    groupSatisfaction: schedule.groupSatisfaction,
    personaValidation: schedule.personaValidation,
    satisfactionByUser: schedule.satisfactionByUser,
    slots: schedule.slots,
  };
}

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Number(params.roomId);
  const { currentRoom, setCurrentRoom } = useAuthStore();

  const [roomContext, setRoomContext] = useState<Room | null>(currentRoom?.roomId === roomId ? currentRoom : null);
  const [phase, setPhase] = useState<'loading' | 'generate' | 'generating' | 'options' | 'confirmed'>('loading');
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ScheduleOption | null>(null);
  const [confirmedOption, setConfirmedOption] = useState<ScheduleOption | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [shareScheduleId, setShareScheduleId] = useState<number | null>(null);
  const [detailModalSlot, setDetailModalSlot] = useState<DetailModalState | null>(null);
  const [modalView, setModalView] = useState<'detail' | 'map'>('detail');
  const [mapScope, setMapScope] = useState<'slot' | 'all'>('slot');
  const [addSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeCandidates, setPlaceCandidates] = useState<Place[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState<number | null>(null);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);

  useEffect(() => {
    if (!detailModalSlot && !addSlotModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscrollBehavior;
    };
  }, [detailModalSlot, addSlotModalOpen]);

  const hydrateRoomContext = useCallback(async () => {
    const roomRes = await roomApi.getById(roomId);
    const roomData = roomRes.data?.data;

    if (!roomData) {
      throw new Error('room_not_found');
    }

    const normalizedRoom = normalizeRoomSummary(roomData);
    setRoomContext(normalizedRoom);
    setCurrentRoom(normalizedRoom);
    return normalizedRoom;
  }, [roomId, setCurrentRoom]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateInitialScheduleState() {
      try {
        const activeRoom = await hydrateRoomContext();
        const scheduleState = activeRoom.scheduleState;
        if (!isMounted) return;

        if (scheduleState?.status === 'confirmed' && scheduleState.confirmedSchedule) {
          setConfirmedOption(normalizeConfirmedSchedule(scheduleState.confirmedSchedule));
          setShareScheduleId(scheduleState.confirmedSchedule.id);
          setPhase('confirmed');
          return;
        }

        if (scheduleState?.status === 'generated' && scheduleState.options?.length) {
          const generatedOptions = scheduleState.options.map(normalizeConfirmedSchedule);
          setOptions(generatedOptions);
          setSelectedOption(generatedOptions[0] ?? null);
          setExpandedOption(generatedOptions[0]?.optionType ?? null);
          setPhase('options');
          return;
        }
      } catch {
        // 초기 조회가 실패하면 사용자가 다시 생성/조회할 수 있도록 기본 진입 화면을 보여준다.
      }

      if (isMounted) setPhase('generate');
    }

    void hydrateInitialScheduleState();

    return () => {
      isMounted = false;
    };
  }, [hydrateRoomContext, roomId]);

  useEffect(() => {
    if (phase !== 'generating') {
      setGeneratingMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setGeneratingMessageIndex((current) => (current + 1) % GENERATING_MESSAGES.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [phase]);

  async function handleGenerate() {
    setPhase('generating');
    setError(null);
    try {
      const activeRoom = roomContext ?? await hydrateRoomContext();
      const res = await roomApi.generateSchedule(roomId, {
        destination: activeRoom.destination,
        tripDate: activeRoom.tripStartDate ?? activeRoom.tripDate,
        tripStartDate: activeRoom.tripStartDate,
        tripEndDate: activeRoom.tripEndDate,
        startTime: '09:00',
        endTime: '21:00',
      });
      const data = res.data?.data;
      if (!data?.options) throw new Error('empty');
      setOptions(data.options);
      setPhase('options');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '일정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
      setPhase('generate');
    }
  }

  async function handleConfirm() {
    if (!selectedOption) return;
    setLoadingConfirm(true);
    setError(null);
    try {
      const res = await roomApi.confirmSchedule(roomId, { optionType: selectedOption.optionType });
      const confirmedScheduleId = res.data?.data?.scheduleId as number | undefined;
      setShareScheduleId(confirmedScheduleId ?? selectedOption.scheduleId ?? null);

      if (confirmedScheduleId) {
        const confirmedScheduleRes = await scheduleApi.getById(confirmedScheduleId);
        const confirmedSchedule = confirmedScheduleRes.data?.data as Schedule | undefined;
        if (confirmedSchedule) {
          setConfirmedOption(normalizeConfirmedSchedule(confirmedSchedule));
          setPhase('confirmed');
          return;
        }
      }
      throw new Error('no schedule');
    } catch {
      setError('일정 확정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoadingConfirm(false);
    }
  }

  function showShareCopiedFeedback() {
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 2000);
  }

  async function shareSchedule() {
    const url = buildShareScheduleUrl(shareScheduleId ?? confirmedOption?.scheduleId ?? selectedOption?.scheduleId);
    if (!url) {
      return;
    }

    const destination = roomContext?.destination ? `${roomContext.destination} ` : '';
    const result = await shareWithSystemFallback({
      title: `${destination}TripSync 확정 일정`,
      text: '동행자와 함께 확정한 TripSync 여행 일정을 확인해 보세요.',
      url,
    });

    if (result === 'copied') {
      showShareCopiedFeedback();
    } else if (result === 'failed') {
      setError('공유 링크를 복사하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  function openDetailModal({
    slot,
    accentColor,
    scheduleTitle,
    scheduleSummary,
    scheduleSlots,
  }: {
    slot: ScheduleSlot;
    accentColor: string;
    scheduleTitle: string;
    scheduleSummary: string;
    scheduleSlots: ScheduleSlot[];
  }) {
    setDetailModalSlot({
      slot,
      accentColor,
      isLocal: !!slot.place.isDepopulationArea,
      scheduleTitle,
      scheduleSummary: cleanDisplayText(scheduleSummary),
      scheduleSlots,
    });
    setModalView('detail');
    setMapScope('slot');
  }

  function openScheduleMap(option: ScheduleOption, scheduleTitle: string) {
    const firstSlot = option.slots?.[0];
    if (!firstSlot || !option.slots) return;

    setDetailModalSlot({
      slot: firstSlot,
      accentColor: '#2563EB',
      isLocal: !!firstSlot.place.isDepopulationArea,
      scheduleTitle,
      scheduleSummary: cleanDisplayText(option.summary),
      scheduleSlots: option.slots,
    });
    setModalView('map');
    setMapScope('all');
  }

  function applyConfirmedSlotOrderLocally(nextSlots: ScheduleSlot[]) {
    setConfirmedOption((current) => current ? { ...current, slots: nextSlots } : current);
    setSelectedOption((current) => current ? { ...current, slots: nextSlots } : current);
    setDetailModalSlot((current) => {
      if (!current) return current;
      const nextCurrentSlot = nextSlots.find((slot) => slot.orderIndex === current.slot.orderIndex) ?? current.slot;
      return {
        ...current,
        slot: nextCurrentSlot,
        scheduleSlots: nextSlots,
      };
    });
  }

  function handleConfirmedSlotReorder(nextSlots: ScheduleSlot[]) {
    applyConfirmedSlotOrderLocally(nextSlots);

    const scheduleId = confirmedOption?.scheduleId ?? shareScheduleId;
    const slotIds = nextSlots.map((slot) => slot.slotId).filter((slotId): slotId is number => typeof slotId === 'number');
    if (!scheduleId || slotIds.length !== nextSlots.length) {
      setError('순서 저장에 필요한 일정 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    void scheduleApi.reorderSlots(scheduleId, { slotIds })
      .then((res) => {
        const updated = res.data?.data as Schedule | undefined;
        if (updated) {
          const normalized = normalizeConfirmedSchedule(updated);
          const normalizedSlots = normalized.slots ?? nextSlots;
          setConfirmedOption(normalized);
          setSelectedOption(normalized);
          setDetailModalSlot((current) => current ? {
            ...current,
            slot: normalizedSlots.find((slot) => slot.slotId === current.slot.slotId) ?? current.slot,
            scheduleSlots: normalizedSlots,
          } : current);
        }
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, '순서 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
      });
  }

  const existingPlaceIds = new Set((confirmedOption?.slots ?? []).map((slot) => slot.place.id));

  async function searchPlaces(query = placeSearchQuery) {
    const scheduleId = confirmedOption?.scheduleId ?? shareScheduleId;
    if (!scheduleId) {
      setError('장소 검색에 필요한 일정 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    setPlaceSearchLoading(true);
    try {
      const res = await scheduleApi.searchPlaces(scheduleId, query);
      const data = res.data?.data as PlaceSearchResponse | undefined;
      setPlaceCandidates(data?.places ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, '장소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setPlaceSearchLoading(false);
    }
  }

  function openAddSlotModal() {
    setAddSlotModalOpen(true);
    setPlaceSearchQuery('');
    setPlaceCandidates([]);
    void searchPlaces('');
  }

  async function handlePlaceSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await searchPlaces(placeSearchQuery);
  }

  async function addPlaceToSchedule(place: Place) {
    const scheduleId = confirmedOption?.scheduleId ?? shareScheduleId;
    if (!scheduleId) {
      setError('일정 추가에 필요한 일정 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    setAddingPlaceId(place.id);
    setError(null);
    try {
      const res = await scheduleApi.addSlot(scheduleId, { placeId: place.id });
      const updated = res.data?.data as Schedule | undefined;
      if (!updated) {
        throw new Error('empty');
      }
      const normalized = normalizeConfirmedSchedule(updated);
      setConfirmedOption(normalized);
      setSelectedOption(normalized);
      setShareScheduleId(normalized.scheduleId ?? scheduleId);
      setAddSlotModalOpen(false);
      setPlaceCandidates([]);
      setPlaceSearchQuery('');
    } catch (err) {
      setError(getApiErrorMessage(err, '일정 추가 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setAddingPlaceId(null);
    }
  }

  // ── PHASE: loading ───────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="app-shell app-page items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">일정 상태를 확인하는 중…</h1>
          <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">확정된 여행 일정이 있으면 바로 불러올게요.</p>
        </div>
      </div>
    );
  }

  // ── PHASE: generate ──────────────────────────────────────
  if (phase === 'generate') {
    return (
      <div className="app-shell app-page">
        <div className="app-topbar">
          <button onClick={() => router.back()} className="app-icon-button" aria-label="이전으로">
            <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="app-topbar-title">AI 합의 일정</div>
            <div className="app-topbar-meta">궁합 지도를 바탕으로 3가지 일정 옵션을 생성합니다</div>
          </div>
          <div className="w-11 shrink-0" />
        </div>

        <div className="app-content pt-20 flex flex-col justify-center min-h-[calc(100dvh-70px)] pb-24">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 relative group">
              <div className="absolute inset-0 bg-blue-50 rounded-full blur-xl group-hover:bg-blue-100 transition-all" />
              <iconify-icon icon="solar:magic-stick-3-bold-duotone" width="40" className="text-blue-500 relative z-10"></iconify-icon>
            </div>
            <span className="app-kicker mb-4">Consensus Engine</span>
            <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-zinc-900">AI 일정 매직 셋업</h1>
            <p className="text-zinc-700 text-sm md:text-base mb-2 font-normal">동행자 전원의 취향 차이를 바탕으로 참고할 제안 흐름을 정리했습니다.</p>
            <p className="text-emerald-700 font-normal text-sm">이제 서로 마음 상하지 않는 타협 일정을 제안해 드릴게요.</p>
          </div>

          <div className="card-glass p-6 mb-8 max-w-sm mx-auto w-full">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <span className="text-sm font-medium text-zinc-700">방 이름</span>
                <span className="text-sm font-bold text-zinc-900">{roomContext?.roomName ?? roomContext?.destination ?? '여행지 확인 중'}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <span className="text-sm font-medium text-zinc-700">일자</span>
                <span className="text-sm font-bold text-zinc-900">{formatTripDateRange(roomContext?.tripStartDate, roomContext?.tripEndDate, roomContext?.tripDate)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="app-alert app-alert-danger max-w-xs mx-auto w-full mb-2">
              {error}
            </div>
          )}

          <div className="max-w-xs mx-auto w-full flex flex-col gap-4">
            <button className="btn-primary py-4 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]" onClick={handleGenerate}>
              일정 생성 시작하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
            </button>
            <button
              onClick={() => router.push(`/rooms/${roomId}/conflict`)}
              className="w-full rounded-[18px] border border-zinc-300 bg-white text-zinc-700 text-sm font-medium py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900"
            >
              잠깐, 궁합 지도 다시 볼래요
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: generating ───────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="app-shell app-page items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-purple-500 animate-spin mb-8" />
          <h2 className="text-2xl font-bold mb-8 tracking-tight text-zinc-900">
            {GENERATING_MESSAGES[generatingMessageIndex]}
          </h2>

          <div className="w-full max-w-sm space-y-3">
            <div className="p-4 bg-white border border-zinc-200 rounded-[20px] text-sm text-zinc-700 font-normal flex gap-3 items-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <iconify-icon icon="solar:round-transfer-diagonal-bold-duotone" className="text-blue-500" width="18"></iconify-icon>
              </div>
              서로의 취향 충돌 분해 중
            </div>
            <div className="p-4 bg-white border border-zinc-200 rounded-[20px] text-sm text-zinc-700 font-normal flex gap-3 items-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <iconify-icon icon="solar:map-point-bold-duotone" className="text-emerald-500" width="18"></iconify-icon>
              </div>
              충남 최적의 장소 필터링
            </div>
            <div className="p-4 bg-white border border-zinc-200 rounded-[20px] text-sm text-zinc-700 font-normal flex gap-3 items-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <iconify-icon icon="solar:history-line-duotone" className="text-purple-500" width="18"></iconify-icon>
              </div>
              공평한 시간 배분 타임라인 형성
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: options ───────────────────────────────────────
  if (phase === 'options') {
    return (
      <div className="app-shell app-page">
        <div className="app-topbar">
          <button onClick={() => setPhase('generate')} className="app-icon-button" aria-label="이전으로">
            <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-600"></iconify-icon>
          </button>
          <div className="text-center flex-1">
            <div className="app-topbar-title">TripSync의 제안</div>
            <div className="app-topbar-meta">가장 마음에 드는 1개를 골라주세요</div>
          </div>
          <div className="w-11" />
        </div>

        <div className="app-content pt-10 pb-48 flex flex-col gap-5 relative">
          {options.map((opt, optIndex) => {
            const meta = OPTION_LABELS[opt.optionType];
            const isSelected = selectedOption?.optionType === opt.optionType;
            const isExpanded = expandedOption === opt.optionType;
            const metaColorStr = meta.color; // e.g. '#10B981'

            return (
              <div
                key={opt.optionType}
                className={`card-app transition-all duration-300 cursor-pointer overflow-hidden border-2 animate-fadeInUp hover:shadow-md ${isSelected ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)] bg-blue-50/50' : 'hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                style={{ animationDelay: `${optIndex * 0.15}s` }}
                onClick={() => {
                  setSelectedOption(opt);
                  if (!isSelected) setExpandedOption(opt.optionType);
                }}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">✓</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-zinc-300 bg-white shrink-0" />
                      )}
                      <span className="text-sm font-black tracking-tight" style={{ color: metaColorStr }}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-black ${opt.groupSatisfaction >= 70 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {opt.groupSatisfaction}<span className="text-xs ml-0.5">%</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-700 text-sm font-normal leading-relaxed mb-5 ml-7">
                    {cleanDisplayText(opt.summary)}
                  </p>

                  {opt.personaValidation && (
                    <div className="ml-7 mb-5">
                      <div className="bg-blue-50 border border-blue-200 rounded-[16px] px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <iconify-icon icon="solar:users-group-rounded-bold-duotone" className="text-blue-500" width="18"></iconify-icon>
                          <span className="text-sm font-bold text-blue-700">
                            비슷한 여행자 참고군 {opt.personaValidation.matchedPersonaCount}명
                          </span>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            {opt.personaValidation.personaAcceptanceScore}점
                          </span>
                        </div>

                        {opt.personaValidation.topPositiveSignals.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {opt.personaValidation.topPositiveSignals.map((signal, idx) => (
                              <span key={idx} className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                                ✓ {signal}
                              </span>
                            ))}
                          </div>
                        )}

                        {opt.personaValidation.objectionReasons.length > 0 && (
                          <div className="space-y-1">
                            {opt.personaValidation.objectionReasons.map((reason, idx) => (
                              <p key={idx} className="text-xs text-amber-700 flex items-start gap-1">
                                <span className="shrink-0">⚠</span>
                                {reason}
                              </p>
                            ))}
                          </div>
                        )}

                        {opt.personaValidation.persuasionPoints.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                            {opt.personaValidation.persuasionPoints.map((point, idx) => (
                              <p key={idx} className="text-xs text-blue-600 flex items-start gap-1">
                                <span className="shrink-0">💡</span>
                                {cleanDisplayText(point)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="ml-7 flex flex-col gap-2.5">
                    {opt.satisfactionByUser.map((s, i) => (
                      <SatisfactionBar key={s.userId} score={s.score} nickname={s.nickname ?? `멤버${i + 1}`} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                    ))}
                  </div>

                  <div className="ml-7 mt-5">
                    <button
                      className="text-sm font-normal text-zinc-700 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setExpandedOption(isExpanded ? null : opt.optionType); }}
                    >
                      {isExpanded ? (
                        <><iconify-icon icon="solar:alt-arrow-up-linear"></iconify-icon> 제안 구성 접기</>
                      ) : (
                        <><iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon> 제안 구성 보기</>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && opt.slots && (
                  <div className="border-t border-zinc-200 px-5 pb-5 pt-5">
                    <div className="mb-4 rounded-[18px] bg-zinc-50 border border-zinc-200 px-4 py-3">
                      <p className="text-sm font-normal text-zinc-700 leading-relaxed">
                        이 옵션은 확정 전 비교용 제안안입니다. 아래 코스 흐름을 보고 마음에 드는 일정을 선택해 주세요.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {opt.slots.map((slot, index) => {
                        const isPersonal = slot.slotType === 'personal';
                        const memberIdx = isPersonal ? opt.satisfactionByUser.findIndex((m) => m.userId === slot.targetUserId) : -1;
                        const accentColor = memberIdx >= 0 ? MEMBER_COLORS[memberIdx % MEMBER_COLORS.length] : '#10B981';

                        return (
                          <div 
                            key={slot.slotId ?? `${slot.orderIndex}-${slot.place.id}`} 
                            className="bg-white border border-zinc-200 rounded-[20px] p-4 shadow-sm transition-all cursor-pointer hover:border-zinc-300 hover:shadow-md"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              openDetailModal({
                                slot,
                                accentColor,
                                scheduleTitle: meta.label,
                                scheduleSummary: opt.summary,
                                scheduleSlots: opt.slots ?? [],
                              });
                            }}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[12px] font-medium border"
                                  style={{ backgroundColor: `${accentColor}14`, borderColor: `${accentColor}45`, color: accentColor }}
                                >
                                  {getProposalStepLabel(index)}
                                </span>
                                {slot.place.isDepopulationArea && (
                                  <span className="text-[12px] font-normal text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full bg-emerald-50">
                                    로컬 픽
                                  </span>
                                )}
                              </div>
                              <div className="text-zinc-400 pl-4">
                                <iconify-icon icon="solar:maximize-square-linear" width="18"></iconify-icon>
                              </div>
                            </div>

                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-sm text-zinc-900">{slot.place.name}</p>
                                <p className="text-sm text-zinc-700 mt-0.5">{slot.place.address}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              {isPersonal && slot.targetNickname && (
                                <span className="text-[12px] font-normal px-2 py-1 rounded-full border" style={{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}10` }}>
                                  {slot.targetNickname} 취향 반영
                                </span>
                              )}
                              {!isPersonal && (
                                <span className="text-[12px] font-normal px-2 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50">
                                  전원 공통 지대
                                </span>
                              )}
                            </div>

                            {slot.reason && (
                              <div className="mt-3 pt-3 border-t border-zinc-100">
                                <p className="text-sm text-zinc-700 flex items-start gap-1.5 w-full leading-snug">
                                  <iconify-icon icon="solar:info-circle-line-duotone" className="shrink-0 mt-0.5 text-blue-500"></iconify-icon>
                                  {slot.reason}
                                </p>
                              </div>
                            )}
                            </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                      <div className="flex items-start gap-2">
                        <iconify-icon icon="solar:pen-new-square-line-duotone" width="18" className="text-zinc-500 mt-0.5"></iconify-icon>
                        <div>
                          <p className="text-sm font-medium text-zinc-800">제안안은 비교용으로만 확인해 주세요</p>
                          <p className="mt-1 text-sm font-normal text-zinc-700 leading-relaxed">
                            코스 추가와 순서 조정은 일정을 확정한 뒤 최종 타임라인에서 확인해 주세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spacer so last option doesn't get hidden behind the sticky footer */}
        <div className="h-32" />

        {/* Sticky Action Footer */}
        <div className="app-sticky-cta pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-2">
            {error && (
              <div className="app-alert app-alert-danger">
                {error}
              </div>
            )}
            <button
              className="btn-primary w-full py-4 text-base shadow-[0_0_40px_rgba(59,130,246,0.3)] transition-all data-[disabled=true]:shadow-none data-[disabled=true]:opacity-30"
              onClick={handleConfirm}
              disabled={!selectedOption || loadingConfirm}
              data-disabled={!selectedOption || loadingConfirm}
            >
              {loadingConfirm
                ? '일정 확정 처리 중...'
                : selectedOption
                  ? `[${OPTION_LABELS[selectedOption.optionType].label}] 일정으로 확정하기`
                  : '위에서 원하는 일정을 선택하세요'
              }
            </button>
          </div>
        </div>

        {/* Detail Modal */}
        {detailModalSlot && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center">
            <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setDetailModalSlot(null)} />
            <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-y-auto rounded-[24px] bg-white shadow-2xl animate-fadeInUp">
              
              <button 
                onClick={() => setDetailModalSlot(null)}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 transition-colors z-20 text-lg font-light leading-none"
              >
                ✕
              </button>

              {modalView === 'detail' ? (
                <>
                  {detailModalSlot.slot.place.imageUrl && (
                    <div className="relative w-full aspect-video bg-zinc-100">
                      <Image
                        src={detailModalSlot.slot.place.imageUrl}
                        alt={detailModalSlot.slot.place.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 384px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </div>
                  )}

                  <div className={`p-6 ${detailModalSlot.slot.place.imageUrl ? '-mt-6 relative z-10 bg-white rounded-t-[24px]' : 'pt-10'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      {detailModalSlot.isLocal && (
                        <span className="text-[11px] font-normal text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full bg-emerald-50">
                          로컬 픽
                        </span>
                      )}
                      {detailModalSlot.slot.slotType === 'personal' && detailModalSlot.slot.targetNickname && (
                        <span className="text-[11px] font-normal px-2.5 py-1 rounded-full border" style={{ borderColor: `${detailModalSlot.accentColor}40`, color: detailModalSlot.accentColor, backgroundColor: `${detailModalSlot.accentColor}10` }}>
                          {detailModalSlot.slot.targetNickname} 취향 반영
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-zinc-900 mb-1">{detailModalSlot.slot.place.name}</h3>
                    <p className="text-sm text-zinc-600 mb-5">{detailModalSlot.slot.place.address}</p>

                    {detailModalSlot.slot.reason && (
                      <div className="bg-zinc-50 rounded-xl p-4 mb-6 border border-zinc-100">
                        <p className="text-sm text-zinc-700 flex items-start gap-2 leading-relaxed">
                          <iconify-icon icon="solar:info-circle-bold-duotone" className="shrink-0 mt-0.5 text-blue-500 text-lg"></iconify-icon>
                          {detailModalSlot.slot.reason}
                        </p>
                      </div>
                    )}

                    {detailModalSlot.slot.place.description ? (
                      <div className="text-[14px] text-zinc-700 leading-relaxed font-normal mb-8 whitespace-pre-wrap break-keep-all">
                        {detailModalSlot.slot.place.description}
                      </div>
                    ) : null}

                    <div className="mb-6 overflow-hidden rounded-[20px] border border-zinc-200 bg-zinc-50">
                      <div className="h-[360px] overflow-hidden">
                        <ScheduleMapModalView
                          key={`detail-map:${detailModalSlot.slot.orderIndex}:${detailModalSlot.slot.place.id}`}
                          slots={[detailModalSlot.slot]}
                          initialOrderIndex={detailModalSlot.slot.orderIndex}
                          scheduleTitle={`${detailModalSlot.scheduleTitle} → ${detailModalSlot.slot.place.name}`}
                          scheduleSummary={detailModalSlot.slot.place.address}
                        />
                      </div>
                      <div className="border-t border-zinc-100 bg-white px-4 py-3">
                        <a
                          href={`https://map.kakao.com/link/search/${encodeURIComponent(detailModalSlot.slot.place.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-bold text-blue-700 transition hover:bg-blue-100"
                        >
                          <iconify-icon icon="solar:map-point-wave-bold-duotone" width="15"></iconify-icon>
                          카카오맵에서 열기
                        </a>
                      </div>
                    </div>

                    <button onClick={() => setDetailModalSlot(null)} className="w-full py-3.5 text-sm font-bold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors shadow-[0_4px_14px_rgba(0,0,0,0.15)] focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900">
                      확인
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-[calc(100dvh-2rem)] max-h-[640px] min-h-0 flex-col sm:h-[560px]">
                  <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-zinc-100 bg-white p-4">
                    <button onClick={() => setModalView('detail')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors">
                      <iconify-icon icon="solar:arrow-left-linear" width="20"></iconify-icon>
                    </button>
                    <div className="flex-1 overflow-hidden pr-8">
                      <h3 className="text-base font-bold text-zinc-900 truncate">{detailModalSlot.scheduleTitle}</h3>
                      <p className="text-xs text-zinc-500 truncate">{detailModalSlot.scheduleSummary}</p>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1 bg-zinc-100">
                    <ScheduleMapModalView
                      key={`${mapScope}:${detailModalSlot.scheduleSlots.map((slot) => slot.orderIndex).join('-')}:${detailModalSlot.slot.orderIndex}`}
                      slots={mapScope === 'slot' ? [detailModalSlot.slot] : detailModalSlot.scheduleSlots}
                      initialOrderIndex={detailModalSlot.slot.orderIndex}
                      scheduleTitle={detailModalSlot.scheduleTitle}
                      scheduleSummary={detailModalSlot.scheduleSummary}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PHASE: confirmed ─────────────────────────────────────
  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.push('/')} className="app-icon-button" aria-label="홈으로 돌아가기">
          <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">확정된 일정</div>
          <div className="app-topbar-meta">동행자에게 공유할 최종 타임라인입니다</div>
        </div>
        <button onClick={shareSchedule} className="app-link-button px-3 py-2 text-sm" type="button">
          <iconify-icon icon="solar:share-bold-duotone" width="18"></iconify-icon>
          {copyDone ? '복사됨' : '공유'}
        </button>
      </div>

      <div className="app-content pt-10 min-h-[100dvh]">
        {/* Confirmed Hero */}
        <div className="text-center mb-10 pt-10 relative">
          <div className="absolute inset-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-50 blur-[80px] rounded-full pointer-events-none" />
          <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 relative hover:scale-110 transition-transform cursor-default">
            <iconify-icon icon="solar:confetti-line-duotone" width="40" className="text-emerald-500"></iconify-icon>
          </div>
          <h1 className="text-3xl font-black mb-3 text-zinc-900">여행 일정이<br />확정되었습니다!</h1>

          {confirmedOption && (
            <div className="inline-flex items-center gap-2 badge-green border-emerald-200 text-emerald-700 px-3 py-1 text-sm bg-emerald-50">
              <span className="font-bold">{OPTION_LABELS[confirmedOption.optionType].label}</span>
              <span className="opacity-50">|</span>
              <span>만족도 <span className="font-black">{confirmedOption.groupSatisfaction}%</span></span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Impact Metric */}
          <div className="card-glass border-emerald-200 p-5 relative overflow-hidden group">
            <div className="absolute right-0 top-0 -mt-8 -mr-8 w-32 h-32 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors" />
            <h3 className="font-bold text-emerald-600 flex items-center gap-2 mb-2">
              <iconify-icon icon="solar:leaf-line-duotone" className="text-lg"></iconify-icon>
              지역 경제 기여
            </h3>
            {confirmedOption && (
              <p className="text-sm text-zinc-700 font-medium leading-relaxed relative z-10">
                이 일정은 충남 인구감소지역 내 숨은 명소 <strong>{confirmedOption.slots?.filter((s) => s.place.isDepopulationArea).length ?? 0}곳</strong> 방문을 포함합니다. 뜻깊은 기여에 감사드립니다.
              </p>
            )}
          </div>

          {/* Confirmed Schedule List */}
          {confirmedOption?.slots && (
            <div className="card-app p-5 text-left mb-6">
              <div className="mb-6 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                <h3 className="font-bold flex items-center gap-2 text-base text-zinc-900">
                  <iconify-icon icon="solar:calendar-date-line-duotone" className="text-xl text-blue-500"></iconify-icon>
                  확정된 타임라인
                </h3>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={openAddSlotModal}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <iconify-icon icon="solar:add-circle-bold-duotone" width="15"></iconify-icon>
                    일정 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => openScheduleMap(confirmedOption, '확정 일정')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    <iconify-icon icon="solar:map-point-wave-bold-duotone" width="15"></iconify-icon>
                    전체 지도 보기
                  </button>
                </div>
              </div>
              <div className="relative flex flex-col gap-6 before:absolute before:left-4 before:bottom-4 before:top-4 before:w-px before:bg-zinc-200">
                {confirmedOption.slots.map((slot, index) => {
                  const isPersonal = slot.slotType === 'personal';
                  const memberIdx = isPersonal ? confirmedOption.satisfactionByUser.findIndex((m) => m.userId === slot.targetUserId) : -1;
                  const accentColor = memberIdx >= 0 ? MEMBER_COLORS[memberIdx % MEMBER_COLORS.length] : '#10B981';

                  return (
                    <button
                      key={slot.slotId ?? `${slot.orderIndex}-${slot.place.id}`}
                      type="button"
                      className="group relative z-10 grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-4 rounded-[22px] border border-transparent px-0 py-1 text-left transition hover:border-zinc-200 hover:bg-zinc-50"
                      onClick={() => openDetailModal({
                        slot,
                        accentColor,
                        scheduleTitle: '확정 일정',
                        scheduleSummary: confirmedOption.summary,
                        scheduleSlots: confirmedOption.slots ?? [],
                      })}
                    >
                      <div className="flex justify-center pt-0.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-bold shadow-sm transition-transform group-hover:scale-110"
                          style={{ color: accentColor }}
                        >
                          {index + 1}
                        </div>
                      </div>
                      <div className="min-w-0 pb-4 pr-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-base text-zinc-900">{slot.place.name}</p>
                          <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-1">
                            {slot.reason === '직접 추가한 장소입니다.' && (
                              <span className="text-[10px] text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap bg-blue-50">
                                직접 추가
                              </span>
                            )}
                            {slot.place.isDepopulationArea && (
                              <span className="text-[10px] text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap bg-emerald-50">
                                로컬 픽
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-700">{slot.place.address}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pb-8">
            <button
              className="btn-primary py-4 text-base !bg-emerald-600 hover:!bg-emerald-700"
              onClick={() => {
                const scheduleId = confirmedOption?.scheduleId ?? shareScheduleId;
                if (!scheduleId) {
                  setError('사진첩을 열기 위한 일정 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
                  return;
                }
                router.push(`/schedules/${scheduleId}/album`);
              }}
            >
              <iconify-icon icon="solar:gallery-wide-bold-duotone" width="19"></iconify-icon>
              장소별 공유 사진첩 열기
            </button>
            <button className="btn-secondary py-4 text-base" onClick={shareSchedule}>
              {copyDone ? '링크가 클립보드에 복사되었습니다!' : '동행자들에게 일정 공유하기'}
            </button>
            <button
              className="btn-secondary py-4 text-sm"
              onClick={() => setPhase('options')}
            >
              다른 옵션으로 다시 선택하기
            </button>
          </div>
        </div>
      </div>

      {addSlotModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setAddSlotModalOpen(false)} />
          <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl animate-fadeInUp">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-5">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">일정 추가</h3>
                <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">충남 장소를 검색해서 확정 타임라인 끝에 추가합니다. 추가 후 전체 지도에서 순서를 바꿀 수 있어요.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddSlotModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
                aria-label="일정 추가 닫기"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <form onSubmit={handlePlaceSearchSubmit} className="mb-4 flex gap-2">
                <input
                  value={placeSearchQuery}
                  onChange={(event) => setPlaceSearchQuery(event.target.value)}
                  placeholder="장소명, 지역, 카테고리 검색"
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
                <button
                  type="submit"
                  disabled={placeSearchLoading}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {placeSearchLoading ? '검색 중' : '검색'}
                </button>
              </form>

              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-900">{placeSearchQuery.trim() ? '검색 결과' : '추천 장소'}</h4>
                <span className="text-xs font-medium text-zinc-500">{placeCandidates.length}개</span>
              </div>

              {placeSearchLoading && placeCandidates.length === 0 ? (
                <div className="rounded-[20px] border border-zinc-100 bg-zinc-50 px-4 py-8 text-center text-sm font-medium text-zinc-600">장소를 불러오는 중입니다.</div>
              ) : placeCandidates.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm font-normal leading-relaxed text-zinc-700">검색 결과가 없습니다. 다른 키워드로 다시 검색해 주세요.</div>
              ) : (
                <div className="space-y-2">
                  {placeCandidates.map((place) => {
                    const alreadyAdded = place.alreadyAdded || existingPlaceIds.has(place.id);
                    const isAdding = addingPlaceId === place.id;

                    return (
                      <div key={place.id} className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-zinc-900">{place.name}</p>
                              {place.isDepopulationArea ? (
                                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">로컬 픽</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">{place.address}</p>
                            {place.category ? <p className="mt-1 text-xs font-medium text-zinc-500">{place.category}</p> : null}
                          </div>
                          <button
                            type="button"
                            disabled={alreadyAdded || addingPlaceId !== null}
                            onClick={() => addPlaceToSchedule(place)}
                            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${
                              alreadyAdded
                                ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400'
                                : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60'
                            }`}
                          >
                            {alreadyAdded ? '추가됨' : isAdding ? '추가 중' : '추가'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {detailModalSlot ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setDetailModalSlot(null)} />
          <div className={`relative my-auto flex w-full max-w-md flex-col rounded-[24px] bg-white shadow-2xl animate-fadeInUp ${
            modalView === 'map'
              ? 'h-[calc(100dvh-2rem)] max-h-[640px] overflow-hidden sm:h-[560px]'
              : 'max-h-[calc(100dvh-2rem)] overflow-y-auto'
          }`}>
            <button
              onClick={() => setDetailModalSlot(null)}
              className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-lg font-light leading-none text-zinc-600 transition-colors hover:bg-zinc-300 hover:text-zinc-900"
              aria-label="모달 닫기"
            >
              ✕
            </button>
            {modalView === 'detail' ? (
              <div className="p-6 pt-10">
                <div className="mb-3 flex items-center gap-2">
                  {detailModalSlot.isLocal && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-normal text-emerald-700">
                      로컬 픽
                    </span>
                  )}
                  {detailModalSlot.slot.slotType === 'personal' && detailModalSlot.slot.targetNickname && (
                    <span
                      className="rounded-full border px-2.5 py-1 text-[11px] font-normal"
                      style={{
                        borderColor: `${detailModalSlot.accentColor}40`,
                        color: detailModalSlot.accentColor,
                        backgroundColor: `${detailModalSlot.accentColor}10`,
                      }}
                    >
                      {detailModalSlot.slot.targetNickname} 취향 반영
                    </span>
                  )}
                </div>
                <h3 className="mb-1 text-xl font-bold text-zinc-900">{detailModalSlot.slot.place.name}</h3>
                <p className="mb-5 text-sm text-zinc-600">{detailModalSlot.slot.place.address}</p>

                {detailModalSlot.slot.reason ? (
                  <div className="mb-6 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-700">
                      <iconify-icon icon="solar:info-circle-bold-duotone" className="mt-0.5 shrink-0 text-lg text-blue-500"></iconify-icon>
                      {cleanDisplayText(detailModalSlot.slot.reason)}
                    </p>
                  </div>
                ) : null}

                {detailModalSlot.slot.place.description ? (
                  <div className="mb-8 whitespace-pre-wrap break-keep-all text-[14px] font-normal leading-relaxed text-zinc-700">
                    {cleanDisplayText(detailModalSlot.slot.place.description)}
                  </div>
                ) : null}

                <div className="mb-6 overflow-hidden rounded-[20px] border border-zinc-200 bg-zinc-50">
                  <div className="h-[360px] overflow-hidden">
                    <ScheduleMapModalView
                      key={`detail-map:${detailModalSlot.slot.orderIndex}:${detailModalSlot.slot.place.id}`}
                      slots={[detailModalSlot.slot]}
                      initialOrderIndex={detailModalSlot.slot.orderIndex}
                      scheduleTitle={`${detailModalSlot.scheduleTitle} → ${detailModalSlot.slot.place.name}`}
                      scheduleSummary={detailModalSlot.slot.place.address}
                    />
                  </div>
                  <div className="border-t border-zinc-100 bg-white px-4 py-3">
                    <a
                      href={`https://map.kakao.com/link/search/${encodeURIComponent(detailModalSlot.slot.place.name)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      <iconify-icon icon="solar:map-point-wave-bold-duotone" width="15"></iconify-icon>
                      카카오맵에서 열기
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => setDetailModalSlot(null)}
                  className="w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition-colors hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-zinc-100 bg-white p-4">
                  <button
                    onClick={() => {
                      if (mapScope === 'slot') {
                        setModalView('detail');
                      } else {
                        setDetailModalSlot(null);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100"
                    aria-label="뒤로"
                  >
                    <iconify-icon icon="solar:arrow-left-linear" width="20"></iconify-icon>
                  </button>
                  <div className="min-w-0 flex-1 pr-8">
                    <h3 className="truncate text-base font-bold text-zinc-900">{detailModalSlot.scheduleTitle}</h3>
                    <p className="truncate text-xs text-zinc-500">{detailModalSlot.scheduleSummary}</p>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 bg-zinc-100">
                  <ScheduleMapModalView
                    key={`${mapScope}:${detailModalSlot.scheduleSlots.map((slot) => slot.orderIndex).join('-')}:${detailModalSlot.slot.orderIndex}`}
                    slots={mapScope === 'slot' ? [detailModalSlot.slot] : detailModalSlot.scheduleSlots}
                    initialOrderIndex={detailModalSlot.slot.orderIndex}
                    scheduleTitle={detailModalSlot.scheduleTitle}
                    scheduleSummary={detailModalSlot.scheduleSummary}
                    onReorder={mapScope === 'all' && phase === 'confirmed' ? handleConfirmedSlotReorder : undefined}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
