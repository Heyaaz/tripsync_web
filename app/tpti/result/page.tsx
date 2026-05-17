'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { ScoreBars } from '@/components/tpti/ScoreBars';
import { AXIS_COLORS, AXIS_DESCRIPTIONS, AXIS_LABELS, getCharacter } from '@/lib/utils/tpti';
import { shareWithSystemFallback } from '@/lib/utils/webShare';

const AXIS_ICONS = {
  mobility: 'solar:map-point-wave-bold-duotone',
  photo: 'solar:camera-bold-duotone',
  budget: 'solar:wallet-money-bold-duotone',
  theme: 'solar:stars-bold-duotone',
} as const;

const AXIS_SURFACE = {
  mobility: 'bg-blue-50 text-blue-700 border-blue-100',
  photo: 'bg-violet-50 text-violet-700 border-violet-100',
  budget: 'bg-amber-50 text-amber-700 border-amber-100',
  theme: 'bg-emerald-50 text-emerald-700 border-emerald-100',
} as const;

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-rose-400 to-orange-400',
  'from-violet-500 to-fuchsia-500',
  'from-amber-400 to-orange-500',
  'from-green-400 to-cyan-500',
];

export default function TptiResultPage() {
  const router = useRouter();
  const { tptiResult, currentRoom } = useAuthStore();
  const [shareFeedback, setShareFeedback] = useState('');

  useEffect(() => {
    if (!tptiResult) router.replace('/tpti');
  }, [tptiResult, router]);

  if (!tptiResult) return null;

  const { scores, characterName, characterEmoji } = tptiResult;
  const gradientSeed = scores.mobility + scores.photo + scores.budget + scores.theme;
  const gradientClass = GRADIENTS[gradientSeed % GRADIENTS.length];
  const characterDescription = getCharacter(scores).desc;

  const descriptions = Object.entries(AXIS_LABELS).map(([axis]) => {
    const score = scores[axis as keyof typeof scores];
    const desc = AXIS_DESCRIPTIONS[axis];
    const isHigh = score >= 50;
    return { axis, label: AXIS_LABELS[axis], score, type: isHigh ? desc.high : desc.low };
  });
  const summaryLine = descriptions.map((d) => d.type).join(' · ');
  const shareUrl = typeof window !== 'undefined' && tptiResult.resultId > 0
    ? `${window.location.origin}/share/tpti/${tptiResult.resultId}`
    : '';
  const shareTitle = `${tptiResult.nickname ?? '나'}의 여행 MBTI 결과 · ${characterName}`;
  const shareText = `${characterEmoji} ${characterName}\n${summaryLine}\nTripSync에서 동행자와 여행 성향을 비교해보세요.`;

  function updateShareFeedback(message: string) {
    setShareFeedback(message);
    window.clearTimeout((updateShareFeedback as typeof updateShareFeedback & { timer?: number }).timer);
    (updateShareFeedback as typeof updateShareFeedback & { timer?: number }).timer = window.setTimeout(() => {
      setShareFeedback('');
    }, 2500);
  }

  async function handleSystemShare() {
    if (!shareUrl) {
      updateShareFeedback('공유용 결과를 아직 준비하지 못했어요.');
      return;
    }

    const result = await shareWithSystemFallback({
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    });

    if (result === 'shared') {
      updateShareFeedback('공유 화면을 열었어요.');
    } else if (result === 'copied') {
      updateShareFeedback('공유 링크를 복사했어요.');
    } else if (result === 'failed') {
      updateShareFeedback('공유 링크를 복사하지 못했어요.');
    }
  }

  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.back()} className="app-icon-button" aria-label="이전으로">
          <iconify-icon icon="solar:arrow-left-linear" width="22"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">여행 MBTI 결과</div>
          <div className="app-topbar-meta">나의 여행 취향 요약과 다음 액션을 확인합니다</div>
        </div>
        <div className="w-11 shrink-0" />
      </div>

      <div className="app-content min-h-[100dvh] flex flex-col justify-center pt-24 pb-16 relative">
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />

        <div className="max-w-3xl mx-auto w-full relative z-10 space-y-6">
          {/* Hero Result Card */}
          <div className="card-bezel animate-fadeInUp delay-1">
            <div className="card-bezel-inner relative overflow-hidden bg-white p-6 md:p-8">
              <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-r ${gradientClass} opacity-[0.09]`} />
              <div className="absolute right-10 top-6 h-28 w-28 rounded-full bg-blue-100/60 blur-3xl" />
              <div className="absolute -left-4 bottom-0 h-28 w-28 rounded-full bg-violet-100/45 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="app-kicker">나의 여행 MBTI 결과</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-[13px] font-semibold text-zinc-600">
                    <iconify-icon icon="solar:users-group-rounded-bold-duotone" width="16"></iconify-icon>
                    동행자와 비교할 여행 프로필
                  </span>
                  <div className="ml-auto relative flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSystemShare}
                      aria-label="공유하기"
                      title="공유하기"
                      className="app-link-button min-h-[2.5rem] rounded-full px-4 py-2 text-sm font-bold text-zinc-700"
                    >
                      <iconify-icon icon="solar:share-bold-duotone" width="18"></iconify-icon>
                      공유하기
                    </button>
                  {shareFeedback ? (
                    <div className="basis-full pt-1 text-right text-sm font-medium text-zinc-600">
                      {shareFeedback}
                    </div>
                  ) : null}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-start">
                  <div className="min-w-0 text-left">
                    <div className="flex items-start gap-4 md:gap-5">
                      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-gradient-to-br ${gradientClass} text-5xl shadow-[0_18px_34px_rgba(59,130,246,0.16)] md:h-24 md:w-24 md:text-6xl`}>
                        <span aria-hidden>{characterEmoji}</span>
                      </div>
                      <div className="min-w-0 pt-1">
                        <div className="text-sm font-semibold tracking-tight text-zinc-500">나의 여행 유형</div>
                        <h1 className="mt-2 text-[2.25rem] md:text-[3.15rem] leading-[1.04] font-black tracking-tight text-zinc-950 break-keep">
                          {characterName}
                        </h1>
                      </div>
                    </div>

                    <p className="mt-5 max-w-2xl text-base md:text-lg font-normal leading-relaxed text-zinc-800">
                      {characterDescription}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm md:text-base font-normal leading-relaxed text-zinc-600">
                      {summaryLine}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2.5">
                      {descriptions.map((d) => (
                        <span
                          key={d.axis}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold ${AXIS_SURFACE[d.axis as keyof typeof AXIS_SURFACE]}`}
                        >
                          <iconify-icon icon={AXIS_ICONS[d.axis as keyof typeof AXIS_ICONS]} width="16"></iconify-icon>
                          {d.type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-zinc-100 bg-gradient-to-b from-zinc-50 to-white p-4 md:p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-zinc-900">성향 한눈에 보기</div>
                        <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-600">
                          점수와 키워드로 빠르게 확인해요
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-zinc-500">
                        4 AXES
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      {descriptions.map((d) => (
                        <div
                          key={d.axis}
                          className="rounded-[22px] border border-white bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${AXIS_SURFACE[d.axis as keyof typeof AXIS_SURFACE]}`}>
                                <iconify-icon icon={AXIS_ICONS[d.axis as keyof typeof AXIS_ICONS]} width="18"></iconify-icon>
                              </span>
                              <div>
                                <div className="text-sm font-bold text-zinc-900">{d.label}</div>
                                <div className="mt-0.5 text-xs font-medium text-zinc-500">{d.type}</div>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-bold text-zinc-700">
                              {d.score}
                            </span>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${d.score}%`,
                                background: `linear-gradient(90deg, ${AXIS_COLORS[d.axis]}99, ${AXIS_COLORS[d.axis]})`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Score Bars */}
          <div className="card-app p-6 animate-fadeInUp delay-2">
            <div className="flex items-center gap-2 mb-6">
               <iconify-icon icon="solar:chart-square-bold-duotone" width="24" className="text-blue-500"></iconify-icon>
               <h2 className="text-lg font-bold text-zinc-900">취향 점수 상세</h2>
            </div>
            <ScoreBars scores={scores} />
          </div>

          {/* Analysis breakdown */}
          <div className="card-app p-6 animate-fadeInUp delay-3">
             <div className="flex items-center gap-2 mb-5">
               <iconify-icon icon="solar:target-bold-duotone" width="24" className="text-emerald-500"></iconify-icon>
               <h2 className="text-lg font-bold text-zinc-900">성향 요약</h2>
            </div>
            <div className="flex flex-col gap-3">
              {descriptions.map((d) => (
                <div key={d.axis} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                  <span className="text-sm font-bold text-zinc-700">{d.label}</span>
                  <div className="flex items-center gap-3">
                  <span className={`text-sm px-2.5 py-1 rounded-md font-medium ${d.score >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {d.type}
                  </span>
                    <span className="text-sm font-semibold text-zinc-700 w-8 text-right">{d.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 animate-fadeInUp delay-4">
            {currentRoom ? (
              <button
                className="btn-primary py-4 text-base"
                onClick={() => router.push(`/rooms/${currentRoom.roomId}/conflict`)}
              >
                그룹 궁합 지도 보기 <iconify-icon icon="solar:arrow-right-linear" width="20"></iconify-icon>
              </button>
            ) : (
              <>
                <button
                  className="btn-primary py-4 text-base"
                  onClick={() => router.push('/rooms/new')}
                >
                  <iconify-icon icon="solar:routing-3-bold-duotone" width="22"></iconify-icon>
                  동행자 초대하고 궁합 지도 만들기
                </button>
              </>
            )}
            
            <button
              onClick={() => router.push('/tpti')}
              className="mt-4 text-sm text-zinc-700 font-bold max-w-[240px] mx-auto"
            >
              검사 다시하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
