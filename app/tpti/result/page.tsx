'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { ScoreBars } from '@/components/tpti/ScoreBars';
import { AXIS_DESCRIPTIONS, AXIS_LABELS } from '@/lib/utils/tpti';

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

  useEffect(() => {
    if (!tptiResult) router.replace('/tpti');
  }, [tptiResult, router]);

  if (!tptiResult) return null;

  const { scores, characterName, characterEmoji } = tptiResult;
  const gradientClass = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

  const descriptions = Object.entries(AXIS_LABELS).map(([axis]) => {
    const score = scores[axis as keyof typeof scores];
    const desc = AXIS_DESCRIPTIONS[axis];
    const isHigh = score >= 50;
    return { axis, label: AXIS_LABELS[axis], score, type: isHigh ? desc.high : desc.low };
  });

  return (
    <div className="app-shell">
      <div className="app-content min-h-[100dvh] flex flex-col justify-center pt-8 pb-16 relative">
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />
        
        <div className="max-w-md mx-auto w-full relative z-10 space-y-6">
          {/* Hero Result Card */}
          <div className="card-bezel animate-fadeInUp delay-1">
            <div className={`card-bezel-inner relative overflow-hidden bg-gradient-to-br ${gradientClass} p-10 flex flex-col items-center text-center`}>
              <div className="absolute inset-0 bg-black/5" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="text-7xl mb-6 drop-shadow-2xl">{characterEmoji}</div>
                <div className="badge bg-white/20 text-white border-white/30 backdrop-blur-md mb-4 px-4 py-1.5 font-bold">
                  나의 여행 유형
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-lg">
                  {characterName}
                </h1>
                <p className="text-white/90 text-sm md:text-base font-medium max-w-[240px] leading-relaxed drop-shadow">
                  {descriptions.map((d) => d.type).join(' · ')}
                </p>
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
                    <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${d.score >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {d.type}
                    </span>
                    <span className="text-sm font-black text-zinc-500 w-8 text-right">{d.score}</span>
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
                그룹 트롤은 누구? 갈등 지도 보기 <iconify-icon icon="solar:arrow-right-linear" width="20"></iconify-icon>
              </button>
            ) : (
              <>
                <button
                  className="btn-primary py-4 text-base"
                  onClick={() => router.push('/rooms/new')}
                >
                  <iconify-icon icon="solar:routing-3-bold-duotone" width="22"></iconify-icon>
                  동행자 초대하고 갈등 지도 만들기
                </button>
                <button
                  className="btn-secondary py-4 text-base"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `나의 여행 유형: ${characterName}`,
                        text: `TPTI 검사 결과: ${characterEmoji} ${characterName}\n활동성 ${scores.mobility} · 기록 ${scores.photo} · 예산 ${scores.budget} · 테마 ${scores.theme}\n\nTripSync에서 갈등 없는 여행을 계획해보세요!`,
                        url: window.location.origin,
                      }).catch(() => {});
                    }
                  }}
                >
                  <iconify-icon icon="solar:share-bold-duotone" width="20"></iconify-icon>
                  내 결과 공유하기
                </button>
              </>
            )}
            
            <button
              onClick={() => router.push('/tpti')}
              className="mt-4 text-sm text-zinc-700 font-bold max-w-[240px]"
            >
              검사 다시하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
