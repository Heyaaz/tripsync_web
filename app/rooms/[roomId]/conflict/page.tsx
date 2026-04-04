'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { roomApi } from '@/lib/api/client';
import { TptiRadarChart, MEMBER_COLORS } from '@/components/tpti/TptiRadarChart';
import {
  AXIS_LABELS, SEVERITY_ICONS, SEVERITY_LABELS, getSeverity,
} from '@/lib/utils/tpti';
import { formatTripDateRange } from '@/lib/utils/date';
import type { ConflictMap, RoomMember, TptiScores } from '@/lib/types';

// Mock data generation for demo
function makeMockConflict(members: RoomMember[]): ConflictMap {
  const axes = ['mobility', 'photo', 'budget', 'theme'] as const;
  const conflictAxes = axes.map((axis) => {
    const scores = members.filter((m) => m.scores).map((m) => ({
      userId: m.userId,
      nickname: m.nickname,
      score: m.scores![axis as keyof TptiScores],
    }));
    const vals = scores.map((s) => s.score);
    const gap = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
    return { axis, gap, severity: getSeverity(gap), min: Math.min(...vals), max: Math.max(...vals), members: scores };
  });
  const commonAxes = conflictAxes.filter((a) => a.severity === 'none').map((a) => a.axis);
  const lines = conflictAxes
    .filter((a) => a.severity !== 'none')
    .map((a) => {
      const sorted = [...a.members].sort((x, y) => y.score - x.score);
      return `${sorted[0].nickname}님과 ${sorted[sorted.length - 1].nickname}님은 ${AXIS_LABELS[a.axis]}에서 ${a.gap}점 차이로 ${SEVERITY_LABELS[a.severity]}합니다.`;
    });
  return {
    roomId: 0,
    commonAxes,
    conflictAxes,
    summaryText: lines.join(' '),
    members: members.filter((m) => m.scores).map((m) => ({
      userId: m.userId,
      nickname: m.nickname,
      scores: m.scores!,
      characterName: m.characterName ?? '여행자',
    })),
  };
}

const MOCK_MEMBERS: RoomMember[] = [
  { userId: 1, nickname: '방장(나)', role: 'host', tptiCompleted: true, scores: { mobility: 85, photo: 70, budget: 30, theme: 40 }, characterName: '뚜벅이 탐험가' },
  { userId: 2, nickname: '민지', role: 'member', tptiCompleted: true, scores: { mobility: 20, photo: 80, budget: 75, theme: 65 }, characterName: '럭셔리 인플루언서' },
  { userId: 3, nickname: '준호', role: 'member', tptiCompleted: true, scores: { mobility: 55, photo: 40, budget: 45, theme: 30 }, characterName: '자연 탐방가' },
];

export default function ConflictPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Number(params.roomId);
  const { currentRoom, user, tptiResult } = useAuthStore();

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [conflictMap, setConflictMap] = useState<ConflictMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyDone, setCopyDone] = useState(false);

  const loadData = useEffectEvent(async () => {
    setLoading(true);
    try {
      const [memberRes, conflictRes] = await Promise.all([
        roomApi.getMembers(roomId),
        roomApi.getConflictMap(roomId),
      ]);
      setMembers(memberRes.data?.data?.members ?? []);
      setConflictMap(conflictRes.data?.data ?? null);
    } catch {
      // Demo fallback
      const mems = [...MOCK_MEMBERS];
      if (tptiResult && user) {
        mems[0] = {
          userId: user.id,
          nickname: user.nickname,
          role: 'host',
          tptiCompleted: true,
          scores: tptiResult.scores,
          characterName: tptiResult.characterName,
        };
      }
      setMembers(mems);
      setConflictMap(makeMockConflict(mems));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [roomId]);

  function copyShareLink() {
    const code = currentRoom?.shareCode ?? 'DEMO001';
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="app-shell app-page items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-200 border-t-orange-500 animate-spin" />
        <p className="mt-4 font-bold text-orange-600">데이터를 분석하고 있습니다…</p>
      </div>
    );
  }

  const completedMembers = members.filter((m) => m.tptiCompleted && m.scores);
  const pendingMembers = members.filter((m) => !m.tptiCompleted);
  const isReady = completedMembers.length >= 2;
  const isHost = user ? members.find((m) => m.userId === user.id)?.role === 'host' : false;

  const chartData = completedMembers.map((m, i) => ({
    userId: m.userId,
    nickname: m.nickname,
    scores: m.scores!,
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
  }));

  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.push('/')} className="app-icon-button" aria-label="홈으로">
          <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">그룹 갈등 지도</div>
          {currentRoom && (
            <div className="app-topbar-meta">{currentRoom.destination} · {formatTripDateRange(currentRoom.tripStartDate, currentRoom.tripEndDate, currentRoom.tripDate)} · 참여 {members.length}명</div>
          )}
        </div>
        <button onClick={copyShareLink} className="app-link-button px-4 py-2 text-sm shrink-0" type="button">
          <iconify-icon icon="solar:share-bold-duotone" width="18"></iconify-icon>
          {copyDone ? '복사됨' : '초대 링크'}
        </button>
      </div>

      <div className="app-content pt-14 flex flex-col gap-6">
        {/* Members Status Card */}
        <div className="card-app p-6 md:p-7 animate-fadeInUp">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2.5">
              <iconify-icon icon="solar:users-group-rounded-bold-duotone" className="text-blue-500 text-[22px]"></iconify-icon>
              동행자 현황
            </h2>
            <span className="app-chip bg-zinc-100 text-zinc-700 border border-zinc-200">{members.length}명</span>
          </div>
          
          <div className="flex flex-col gap-4">
            {members.map((m, i) => {
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <div key={m.userId} className="flex items-center gap-4 p-4 md:p-5 bg-white border border-zinc-100 rounded-[24px] shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-colors">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base shrink-0 border-2"
                    style={{ backgroundColor: `${color}18`, color: color, borderColor: `${color}55` }}
                  >
                    {m.nickname[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-[15px] text-zinc-900 flex items-center gap-2">
                      {m.nickname}
                      {m.role === 'host' && <span className="bg-blue-50 text-blue-700 text-[11px] py-1 px-2.5 rounded-full font-bold border border-blue-100">방장</span>}
                    </p>
                    <p className="text-sm text-zinc-700 font-normal mt-0.5 truncate">{m.characterName || '유형 분석 전'}</p>
                  </div>
                  <div className="shrink-0">
                    {m.tptiCompleted ? (
                      <span className="app-status-pill success">완료</span>
                    ) : (
                      <span className="app-status-pill waiting">대기 중</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {pendingMembers.length > 0 && (
            <div className="app-alert app-alert-warning mt-4">
              <iconify-icon icon="solar:hourglass-bold-duotone" className="text-orange-500 mt-0.5"></iconify-icon>
              <p className="text-xs font-medium text-orange-800">
                {pendingMembers.map((m) => m.nickname).join(', ')}님이 아직 검사 중입니다. 전원이 완료해야 정확한 지도가 완성됩니다.
              </p>
            </div>
          )}
        </div>

        {/* TPTI Radar Chart */}
        {isReady && conflictMap && (
          <div className="card-app p-6 md:p-7 animate-fadeInUp delay-1">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2 mb-2">
               <iconify-icon icon="solar:pie-chart-3-bold-duotone" className="text-purple-600 text-[22px]"></iconify-icon>
               취향 레이더
            </h2>
            <p className="text-sm text-zinc-700 font-normal mb-5">그래프가 겹칠수록 해당 축의 취향이 비슷합니다.</p>

            <div className="flex flex-wrap gap-3 mb-5">
              {chartData.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 border border-zinc-100 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                  <div className="w-3 h-3 rounded-full" style={{ background: m.color }} />
                  <span className="text-xs font-bold text-zinc-700">{m.nickname}</span>
                </div>
              ))}
            </div>

            <div className="-mx-4">
              <TptiRadarChart memberScores={chartData} size={280} />
            </div>
          </div>
        )}

        {/* Conflict Analysis */}
        {isReady && conflictMap && (
          <div className="card-app p-6 md:p-7 animate-fadeInUp delay-2 mb-10">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2 mb-4">
               <iconify-icon icon="solar:danger-triangle-bold-duotone" className="text-red-500 text-[22px]"></iconify-icon>
               충돌 심층 분석
            </h2>

            {conflictMap.summaryText && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-[20px] mb-5">
                <p className="text-sm font-medium leading-relaxed text-zinc-900">{conflictMap.summaryText}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {conflictMap.conflictAxes.map((ca) => {
                const isConflict = ca.severity !== 'none';
                return (
                  <div key={ca.axis} className={`p-5 rounded-[22px] border ${isConflict ? 'bg-[#fff7f5] border-[#ffd7cf]' : 'bg-white border-zinc-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)]'}`}>
                    <div className="flex justify-between items-center mb-5 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[20px]">{SEVERITY_ICONS[ca.severity]}</span>
                        <span className="font-black text-[16px] text-zinc-900">{AXIS_LABELS[ca.axis]}</span>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-black ${ca.severity === 'critical' ? 'bg-red-500 text-white' : ca.severity === 'moderate' ? 'bg-orange-500 text-white' : ca.severity === 'minor' ? 'bg-yellow-400 text-zinc-900' : 'bg-emerald-500 text-white'}`}>
                          {SEVERITY_LABELS[ca.severity]}
                        </span>
                        <span className="text-sm font-black text-zinc-600 tracking-tight">±{ca.gap}</span>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {ca.members.map((mem) => (
                        <div key={mem.userId} className="flex items-center gap-3">
                          <span className="text-[13px] font-bold text-zinc-700 w-14 truncate">{mem.nickname}</span>
                          <div className="flex-1 h-[10px] bg-white border border-black/5 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]">
                            <div 
                              className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ 
                                width: `${mem.score}%`, 
                                backgroundColor: MEMBER_COLORS[chartData.findIndex(c => c.userId === mem.userId) % MEMBER_COLORS.length]
                              }} 
                            />
                          </div>
                          <span className="text-[13px] font-black text-zinc-700 w-7 text-right">{mem.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {conflictMap.commonAxes.length > 0 && (
              <div className="mt-5 p-4 bg-emerald-50 border border-emerald-100 rounded-[20px]">
                <div className="flex items-center gap-2 mb-1">
                  <iconify-icon icon="solar:shield-check-bold" className="text-emerald-500 text-lg"></iconify-icon>
                  <p className="text-sm font-bold text-emerald-700">공통 안전 지대</p>
                </div>
                <p className="text-sm font-normal text-emerald-800 pl-6">
                  {conflictMap.commonAxes.map((a) => AXIS_LABELS[a]).join(' · ')}에서 모두 의견이 비슷합니다. 일정의 기본 베이스캠프로 활용됩니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Not ready state */}
        {!isReady && (
          <div className="card-glass p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mb-6">
              <iconify-icon icon="solar:user-plus-bold-duotone" width="40" className="text-blue-500"></iconify-icon>
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-2 text-zinc-900">동행자를 기다리고 있어요</h3>
            <p className="text-sm text-zinc-700 font-normal leading-relaxed mb-8 max-w-[260px]">최소 2명이 검사를 완료해야 서로의 취향 차이를 보여주는 지도가 만들어집니다.</p>
            <button onClick={copyShareLink} className="btn-primary w-full max-w-[200px]">
              {copyDone ? '링크 복사 완료!' : '초대 링크 복사'}
            </button>
          </div>
        )}

        {/* Create Schedule CTA */}
        {isReady && isHost && (
           <div className="app-sticky-cta pointer-events-none">
             <div className="pointer-events-auto">
               <button
                 className="btn-pill w-full justify-center py-4 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl border border-blue-400 group"
                 onClick={() => router.push(`/rooms/${roomId}/schedule`)}
               >
                 <iconify-icon icon="solar:magic-stick-3-bold-duotone" className="group-hover:rotate-12 transition-transform" width="22"></iconify-icon>
                 AI 합의 일정 3종 생성하기
               </button>
             </div>
           </div>
        )}

        {isReady && !isHost && (
          <div className="p-5 text-center bg-zinc-50 border border-zinc-200 rounded-[20px] mb-6 shadow-sm">
            <p className="text-sm font-bold text-zinc-700 mb-1">방장이 AI 일정을 만들 수 있어요</p>
            <p className="text-sm font-normal text-zinc-700">생성이 완료되면 공유받은 링크에서 확인할 수 있습니다.</p>
          </div>
        )}
        
        {/* Adds bottom padding so CTA doesn't cover content */}
        {isReady && isHost && <div className="h-20 shrink-0" />}
      </div>
    </div>
  );
}
