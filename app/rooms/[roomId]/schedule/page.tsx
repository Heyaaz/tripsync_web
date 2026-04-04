'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { roomApi, scheduleApi } from '@/lib/api/client';
import type { ScheduleOption, ScheduleSlot, TptiScores } from '@/lib/types';
import { AXIS_LABELS, OPTION_LABELS } from '@/lib/utils/tpti';
import { MEMBER_COLORS } from '@/components/tpti/TptiRadarChart';

// Mock schedule data
const MOCK_OPTIONS: ScheduleOption[] = [
  {
    optionType: 'balanced',
    label: '균형형',
    summary: '모두가 조금씩 타협하는 평화로운 선택',
    groupSatisfaction: 72,
    satisfactionByUser: [
      { userId: 1, nickname: '방장(나)', score: 74 },
      { userId: 2, nickname: '민지', score: 70 },
      { userId: 3, nickname: '준호', score: 71 },
    ],
    slots: [
      { orderIndex: 1, startTime: '2026-05-02T09:00:00+09:00', endTime: '2026-05-02T11:30:00+09:00', slotType: 'personal', targetUserId: 1, targetNickname: '방장(나)', reasonAxis: 'mobility', reason: '활동성 높은 취향 반영', place: { id: 1, name: '공주 공산성', address: '충남 공주시 웅진로 280', isDepopulationArea: false, imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400' } },
      { orderIndex: 2, startTime: '2026-05-02T11:30:00+09:00', endTime: '2026-05-02T13:00:00+09:00', slotType: 'common', reasonAxis: 'common', reason: '공통 지대(식도락) 반영', place: { id: 2, name: '공주 한옥마을 맛집거리', address: '충남 공주시 반죽동', isDepopulationArea: false } },
      { orderIndex: 3, startTime: '2026-05-02T13:00:00+09:00', endTime: '2026-05-02T15:30:00+09:00', slotType: 'personal', targetUserId: 2, targetNickname: '민지', reasonAxis: 'photo', reason: '사진 촬영 취향 존중', place: { id: 3, name: '부여 궁남지', address: '충남 부여군 부여읍 궁남로 52', isDepopulationArea: true, imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400' } },
      { orderIndex: 4, startTime: '2026-05-02T15:30:00+09:00', endTime: '2026-05-02T17:30:00+09:00', slotType: 'personal', targetUserId: 3, targetNickname: '준호', reasonAxis: 'theme', reason: '자연 힐링 테마 반영', place: { id: 4, name: '부여 백마강 황포돛배', address: '충남 부여군 부여읍 나루터로 50', isDepopulationArea: true } },
      { orderIndex: 5, startTime: '2026-05-02T17:30:00+09:00', endTime: '2026-05-02T19:30:00+09:00', slotType: 'common', reasonAxis: 'common', reason: '공통 관심사(역사) 반영', place: { id: 5, name: '부여 정림사지', address: '충남 부여군 부여읍 정림로 83', isDepopulationArea: true } },
    ],
  },
  {
    optionType: 'individual',
    label: '개성 충만형',
    summary: '각자의 확고한 1순위 취향을 번갈아가며 체험',
    groupSatisfaction: 68,
    satisfactionByUser: [
      { userId: 1, nickname: '방장(나)', score: 82 },
      { userId: 2, nickname: '민지', score: 77 },
      { userId: 3, nickname: '준호', score: 61 },
    ],
    slots: [
      { orderIndex: 1, startTime: '2026-05-02T09:00:00+09:00', endTime: '2026-05-02T12:00:00+09:00', slotType: 'personal', targetUserId: 1, targetNickname: '방장(나)', reasonAxis: 'mobility', reason: '극소수파 뚜벅이 코스', place: { id: 6, name: '계룡산 국립공원 ท레킹', address: '충남 공주시 반포면 계룡산로 805-246', isDepopulationArea: false } },
      { orderIndex: 2, startTime: '2026-05-02T12:00:00+09:00', endTime: '2026-05-02T14:00:00+09:00', slotType: 'personal', targetUserId: 2, targetNickname: '민지', reasonAxis: 'budget', reason: '하이엔드 파인다이닝', place: { id: 7, name: '공주 유구 명품 한정식', address: '충남 공주시 유구읍', isDepopulationArea: true } },
      { orderIndex: 3, startTime: '2026-05-02T14:00:00+09:00', endTime: '2026-05-02T16:30:00+09:00', slotType: 'personal', targetUserId: 2, targetNickname: '민지', reasonAxis: 'photo', reason: 'SNS 핫스팟 인증샷', place: { id: 8, name: '태안 꽃지해수욕장', address: '충남 태안군 안면읍 꽃지해안로 400', isDepopulationArea: true, imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' } },
      { orderIndex: 4, startTime: '2026-05-02T16:30:00+09:00', endTime: '2026-05-02T19:00:00+09:00', slotType: 'personal', targetUserId: 3, targetNickname: '준호', reasonAxis: 'theme', reason: '조용한 휴식', place: { id: 9, name: '태안 안면도 자연휴양림', address: '충남 태안군 안면읍 안면대로 1660-24', isDepopulationArea: true } },
    ],
  },
  {
    optionType: 'discovery',
    label: '로컬 발굴형',
    summary: '잘 알려지지 않은 충남의 진짜 매력 탐험',
    groupSatisfaction: 65,
    satisfactionByUser: [
      { userId: 1, nickname: '방장(나)', score: 68 },
      { userId: 2, nickname: '민지', score: 65 },
      { userId: 3, nickname: '준호', score: 71 },
    ],
    slots: [
      { orderIndex: 1, startTime: '2026-05-02T09:00:00+09:00', endTime: '2026-05-02T11:00:00+09:00', slotType: 'common', reasonAxis: 'theme', reason: '인구감소지역 생태 체험', place: { id: 10, name: '서천 국립생태원', address: '충남 서천군 마서면 금강로 1210', isDepopulationArea: true } },
      { orderIndex: 2, startTime: '2026-05-02T11:00:00+09:00', endTime: '2026-05-02T13:00:00+09:00', slotType: 'common', reasonAxis: 'common', reason: '로컬 재료 로컬 푸드', place: { id: 11, name: '서천 장항 로컬 라이프스타일 샵', address: '충남 서천군 장항읍', isDepopulationArea: true } },
      { orderIndex: 3, startTime: '2026-05-02T13:00:00+09:00', endTime: '2026-05-02T15:30:00+09:00', slotType: 'common', reasonAxis: 'theme', reason: '이국적인 서해바다', place: { id: 12, name: '보령 대천해수욕장', address: '충남 보령시 신흑동 대천해수욕장로 97', isDepopulationArea: true, imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' } },
      { orderIndex: 4, startTime: '2026-05-02T15:30:00+09:00', endTime: '2026-05-02T17:30:00+09:00', slotType: 'common', reasonAxis: 'theme', reason: '인구감소지역 재생 공간', place: { id: 13, name: '보령 성주산 자연휴양림', address: '충남 보령시 성주면 성주산로 673', isDepopulationArea: true } },
      { orderIndex: 5, startTime: '2026-05-02T17:30:00+09:00', endTime: '2026-05-02T19:30:00+09:00', slotType: 'common', reasonAxis: 'common', reason: '로컬 야경', place: { id: 14, name: '보령 오천항 일몰 투어', address: '충남 보령시 오천면 오천항리', isDepopulationArea: true } },
    ],
  },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function SatisfactionBar({ score, nickname, color }: { score: number; nickname: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-600 w-12 shrink-0 font-bold truncate">
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

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Number(params.roomId);
  const { currentRoom } = useAuthStore();

  const [phase, setPhase] = useState<'generate' | 'generating' | 'options' | 'confirmed'>('generate');
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ScheduleOption | null>(null);
  const [confirmedOption, setConfirmedOption] = useState<ScheduleOption | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  async function handleGenerate() {
    setPhase('generating');
    try {
      const res = await roomApi.generateSchedule(roomId, {
        destination: currentRoom?.destination ?? '충남',
        tripDate: currentRoom?.tripDate ?? '2026-05-02',
        startTime: '09:00',
        endTime: '21:00',
      });
      const data = res.data?.data;
      if (data?.options) {
        setOptions(data.options);
        setPhase('options');
        return;
      }
    } catch { /* demo fallback */ }

    // Demo: 4 sec delay
    await new Promise((r) => setTimeout(r, 4000));
    setOptions(MOCK_OPTIONS);
    setPhase('options');
  }

  async function handleConfirm() {
    if (!selectedOption) return;
    setLoadingConfirm(true);
    try {
      await roomApi.confirmSchedule(roomId, { optionType: selectedOption.optionType });
    } catch { /* demo */ }
    setConfirmedOption(selectedOption);
    setPhase('confirmed');
    setLoadingConfirm(false);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/share/schedule/demo-${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  // ── PHASE: generate ──────────────────────────────────────
  if (phase === 'generate') {
    return (
      <div className="app-shell">
        <header className="app-header py-4 px-6 flex justify-between items-center">
          <button onClick={() => router.back()} className="hover:opacity-70 transition-opacity">
            <iconify-icon icon="solar:round-alt-arrow-left-bold-duotone" width="28" className="text-zinc-700"></iconify-icon>
          </button>
        </header>

        <div className="app-content pt-12 flex flex-col justify-center min-h-[calc(100dvh-70px)] pb-24">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 relative group">
              <div className="absolute inset-0 bg-blue-50 rounded-full blur-xl group-hover:bg-blue-100 transition-all" />
              <iconify-icon icon="solar:magic-stick-3-bold-duotone" width="40" className="text-blue-500 relative z-10"></iconify-icon>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-zinc-900">AI 일정 매직 셋업</h1>
            <p className="text-zinc-500 text-sm md:text-base mb-2">동행자 전원의 갈등 요소를 완벽히 분석했습니다.</p>
            <p className="text-emerald-600 font-medium text-sm">이제 서로 마음 상하지 않는 타협 일정을 제안해 드릴게요.</p>
          </div>

          <div className="card-glass bg-white border-zinc-200 p-6 mb-8 max-w-sm mx-auto w-full shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <span className="text-xs font-bold text-zinc-500">여행지</span>
                <span className="text-sm font-bold text-zinc-900">{currentRoom?.destination ?? '충남 전역'}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <span className="text-xs font-bold text-zinc-500">일자</span>
                <span className="text-sm font-bold text-zinc-900">{currentRoom?.tripDate ?? '날짜 미정'}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <span className="text-xs font-bold text-zinc-500">활동 시간</span>
                <span className="text-sm font-bold text-zinc-900">09:00 — 21:00</span>
              </div>
            </div>
          </div>

          <div className="max-w-xs mx-auto w-full flex flex-col gap-4">
            <button className="btn-primary py-4 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]" onClick={handleGenerate}>
              일정 생성 시작하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
            </button>
            <button onClick={() => router.push(`/rooms/${roomId}/conflict`)} className="btn-secondary group">
              잠깐, 갈등 지도 다시 볼래요
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: generating ───────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="app-shell items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-purple-500 animate-spin mb-8" />
          <h2 className="text-2xl font-bold mb-8 tracking-tight text-zinc-900">수만 가지 조합을 계산 중...</h2>

          <div className="w-full max-w-xs space-y-3 relative">
            <div className="p-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 font-medium animate-pulse-soft flex gap-3 items-center shadow-sm">
              <iconify-icon icon="solar:round-transfer-diagonal-bold-duotone" className="text-blue-500 text-lg"></iconify-icon>
              서로의 취향 충돌 분해 중
            </div>
            <div className="p-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 font-medium animate-pulse-soft delay-1 flex gap-3 items-center shadow-sm">
              <iconify-icon icon="solar:map-point-bold-duotone" className="text-emerald-500 text-lg"></iconify-icon>
              충남 최적의 장소 필터링
            </div>
            <div className="p-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 font-medium animate-pulse-soft delay-2 flex gap-3 items-center shadow-sm">
              <iconify-icon icon="solar:history-line-duotone" className="text-purple-500 text-lg"></iconify-icon>
              공평한 시간 배분 타임라인 형성
            </div>
            {/* Gradient mask for fade out effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent pointer-events-none" style={{ top: '50%' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: options ───────────────────────────────────────
  if (phase === 'options') {
    return (
      <div className="app-shell">
        <div className="app-header py-4 px-5 border-b border-zinc-200 flex items-center justify-between z-40 bg-white/80 backdrop-blur-xl">
          <button onClick={() => setPhase('generate')} className="hover:text-zinc-500">
            <iconify-icon icon="solar:round-alt-arrow-left-bold-duotone" width="28" className="text-zinc-600"></iconify-icon>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-base tracking-tight text-zinc-900">AI의 제안</h1>
            <p className="text-[10px] font-medium text-emerald-600">가장 마음에 드는 1개를 골라주세요</p>
          </div>
          <div className="w-7" />
        </div>

        <div className="app-content pt-6 pb-32 flex flex-col gap-5 relative">
          {options.map((opt, optIndex) => {
            const meta = OPTION_LABELS[opt.optionType];
            const isSelected = selectedOption?.optionType === opt.optionType;
            const isExpanded = expandedOption === opt.optionType;
            const metaColorStr = meta.color; // e.g. '#10B981'

            return (
              <div
                key={opt.optionType}
                className={`card-app transition-all duration-300 cursor-pointer overflow-hidden border-2 animate-fadeInUp shadow-sm hover:shadow-md ${isSelected ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)] bg-blue-50/50' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
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

                  <p className="text-zinc-600 text-sm font-medium leading-relaxed mb-5 ml-7">
                    {opt.summary}
                  </p>

                  <div className="ml-7 flex flex-col gap-2.5">
                    {opt.satisfactionByUser.map((s, i) => (
                      <SatisfactionBar key={s.userId} score={s.score} nickname={s.nickname ?? `멤버${i + 1}`} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                    ))}
                  </div>

                  <div className="ml-7 mt-5">
                    <button
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setExpandedOption(isExpanded ? null : opt.optionType); }}
                    >
                      {isExpanded ? (
                        <><iconify-icon icon="solar:alt-arrow-up-linear"></iconify-icon> 상세 일정 접기</>
                      ) : (
                        <><iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon> 전체 타임라인 보기</>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && opt.slots && (
                  <div className="px-5 pb-5 border-t border-zinc-200 pt-5 ml-7">
                    <div className="flex flex-col gap-4 relative">
                      <div className="absolute top-4 bottom-4 left-[15px] w-px bg-zinc-200" />
                      {opt.slots.map((slot) => {
                        const isPersonal = slot.slotType === 'personal';
                        const memberIdx = isPersonal ? opt.satisfactionByUser.findIndex((m) => m.userId === slot.targetUserId) : -1;
                        const accentColor = memberIdx >= 0 ? MEMBER_COLORS[memberIdx % MEMBER_COLORS.length] : '#10B981';

                        return (
                          <div key={slot.orderIndex} className="flex gap-4 relative">
                            <div
                              className="w-[30px] h-[30px] rounded-full flex items-center justify-center font-bold text-[10px] z-10 shrink-0 border"
                              style={{ backgroundColor: `${accentColor}20`, borderColor: accentColor, color: accentColor }}
                            >
                              {slot.orderIndex}
                            </div>
                            <div className="flex-1 bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-bold text-sm text-zinc-900">{slot.place.name}</p>
                                  <p className="text-[10px] text-zinc-500 mt-0.5">{slot.place.address}</p>
                                </div>
                                {slot.place.isDepopulationArea && (
                                  <span className="badge-green text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 whitespace-nowrap ml-2">
                                    🌿 로컬 픽
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </span>
                                {isPersonal && slot.targetNickname && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                                    {slot.targetNickname} 취향 반영
                                  </span>
                                )}
                                {!isPersonal && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-600 bg-emerald-50">
                                    전원 공통 지대
                                  </span>
                                )}
                              </div>

                              {slot.reason && (
                                <div className="mt-3 pt-2 border-t border-zinc-100">
                                  <p className="text-[11px] text-zinc-500 flex items-start gap-1 w-full leading-snug">
                                    <iconify-icon icon="solar:info-circle-line-duotone" className="shrink-0 mt-0.5 text-blue-500"></iconify-icon>
                                    {slot.reason}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-50 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
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
      </div>
    );
  }

  // ── PHASE: confirmed ─────────────────────────────────────
  return (
    <div className="app-shell">
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
          <div className="card-glass bg-white border-emerald-200 p-5 relative overflow-hidden group shadow-sm">
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
              <h3 className="font-bold flex items-center gap-2 mb-6 text-base border-b border-zinc-200 pb-4 text-zinc-900">
                <iconify-icon icon="solar:calendar-date-line-duotone" className="text-xl text-blue-500"></iconify-icon>
                확정된 타임라인
              </h3>
              <div className="flex flex-col gap-6">
                {confirmedOption.slots.map((slot) => {
                  const isPersonal = slot.slotType === 'personal';
                  const memberIdx = isPersonal ? confirmedOption.satisfactionByUser.findIndex((m) => m.userId === slot.targetUserId) : -1;
                  const accentColor = memberIdx >= 0 ? MEMBER_COLORS[memberIdx % MEMBER_COLORS.length] : '#10B981';

                  return (
                    <div key={slot.orderIndex} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-200 bg-white group-hover:scale-110 transition-transform shadow-sm"
                          style={{ color: accentColor }}
                        >
                          {slot.orderIndex}
                        </div>
                        <div className="w-[1px] h-full bg-zinc-200 my-2" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-base text-zinc-900">{slot.place.name}</p>
                          {slot.place.isDepopulationArea && (
                            <span className="text-[10px] text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap bg-emerald-50">
                              로컬 픽
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">{slot.place.address}</p>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-zinc-500 tracking-wider">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pb-8">
            <button className="btn-primary py-4 text-base" onClick={copyShareLink}>
              {copyDone ? '✓ 링크가 클립보드에 복사되었습니다!' : '📤 동행자들에게 일정 공유하기'}
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
    </div>
  );
}
