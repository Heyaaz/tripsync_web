'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { roomApi } from '@/lib/api/client';
import { TptiRadarChart, MEMBER_COLORS } from '@/components/tpti/TptiRadarChart';
import {
  AXIS_LABELS, SEVERITY_COLORS, SEVERITY_BG, SEVERITY_ICONS, SEVERITY_LABELS, getSeverity,
} from '@/lib/utils/tpti';
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

  useEffect(() => { loadData(); }, [roomId]);

  async function loadData() {
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
  }

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
      <div className="app-shell items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-200 border-t-orange-500 animate-spin" />
        <p className="mt-4 font-bold text-orange-600">데이터를 분석하고 있습니다...</p>
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
    <div className="app-shell">
      {/* App Header */}
      <header className="app-header py-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="hover:opacity-70 transition-opacity">
            <iconify-icon icon="solar:round-alt-arrow-left-bold-duotone" width="28" className="text-zinc-700"></iconify-icon>
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">그룹 갈등 지도</h1>
            {currentRoom && (
              <p className="text-xs font-semibold text-zinc-600">
                {currentRoom.destination} · {currentRoom.tripDate} · 참여 {members.length}명
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="app-content pt-6 flex flex-col gap-6">
        {/* Members Status Card */}
        <div className="card-app p-5 animate-fadeInUp">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold flex items-center gap-2">
              <iconify-icon icon="solar:users-group-rounded-bold-duotone" className="text-blue-400 text-xl"></iconify-icon>
              동행자 현황
            </h2>
            <button
              onClick={copyShareLink}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${
                copyDone 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {copyDone ? '✓ 링크 복사됨' : '🔗 초대 링크 복사'}
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {members.map((m, i) => {
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <div key={m.userId} className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-xl shadow-sm hover:border-zinc-300 transition-colors">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2"
                    style={{ backgroundColor: `${color}20`, color: color, borderColor: `${color}50` }}
                  >
                    {m.nickname[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm flex items-center gap-2">
                      {m.nickname}
                      {m.role === 'host' && <span className="bg-blue-50 text-blue-700 text-[10px] py-0.5 px-2 rounded-full font-bold border border-blue-100">방장</span>}
                    </p>
                    <p className="text-[11px] text-zinc-600 font-medium truncate">{m.characterName || '유형 분석 전'}</p>
                  </div>
                  <div>
                    {m.tptiCompleted ? (
                      <span className="badge-green text-[10px]">완료</span>
                    ) : (
                      <span className="badge-orange text-[10px]">대기 중</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {pendingMembers.length > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg flex gap-2">
              <iconify-icon icon="solar:hourglass-bold-duotone" className="text-orange-500 mt-0.5"></iconify-icon>
              <p className="text-xs font-medium text-orange-800">
                {pendingMembers.map((m) => m.nickname).join(', ')}님이 아직 검사 중입니다. 전원이 완료해야 정확한 지도가 완성됩니다.
              </p>
            </div>
          )}
        </div>

        {/* TPTI Radar Chart */}
        {isReady && conflictMap && (
          <div className="card-app p-5 animate-fadeInUp delay-1">
            <h2 className="text-base font-bold flex items-center gap-2 mb-2">
               <iconify-icon icon="solar:pie-chart-3-bold-duotone" className="text-purple-600 text-xl"></iconify-icon>
               취향 레이더
            </h2>
            <p className="text-xs text-zinc-600 font-medium mb-4">그래프가 겹칠수록 해당 축의 취향이 비슷합니다.</p>

            <div className="flex flex-wrap gap-3 mb-4">
              {chartData.map((m, i) => (
                <div key={m.userId} className="flex items-center gap-1.5">
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
          <div className="card-app p-5 animate-fadeInUp delay-2 mb-10">
            <h2 className="text-base font-bold flex items-center gap-2 mb-4">
               <iconify-icon icon="solar:danger-triangle-bold-duotone" className="text-red-500 text-xl"></iconify-icon>
               충돌 심층 분석
            </h2>

            {conflictMap.summaryText && (
              <div className="p-4 bg-orange-50 border-l-4 border-l-orange-500 rounded-r-xl mb-5">
                <p className="text-sm font-medium leading-relaxed text-zinc-900">{conflictMap.summaryText}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {conflictMap.conflictAxes.map((ca) => {
                const isConflict = ca.severity !== 'none';
                return (
                  <div key={ca.axis} className={`p-4 rounded-xl border ${isConflict ? 'bg-red-50 border-red-100' : 'bg-white border-zinc-200 shadow-sm'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SEVERITY_ICONS[ca.severity]}</span>
                        <span className="font-bold text-sm">{AXIS_LABELS[ca.axis]}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${ca.severity === 'critical' ? 'bg-red-500 text-white' : ca.severity === 'moderate' ? 'bg-orange-500 text-white' : ca.severity === 'minor' ? 'bg-yellow-500 text-black' : 'bg-emerald-500 text-white'}`}>
                          {SEVERITY_LABELS[ca.severity]}
                        </span>
                        <span className="text-xs font-black text-zinc-600 tracking-wider">±{ca.gap}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {ca.members.map((mem, i) => (
                        <div key={mem.userId} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-zinc-700 w-12 truncate">{mem.nickname}</span>
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ 
                                width: `${mem.score}%`, 
                                backgroundColor: MEMBER_COLORS[chartData.findIndex(c => c.userId === mem.userId) % MEMBER_COLORS.length]
                              }} 
                            />
                          </div>
                          <span className="text-[11px] font-black text-zinc-700 w-6 text-right">{mem.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {conflictMap.commonAxes.length > 0 && (
              <div className="mt-5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <iconify-icon icon="solar:shield-check-bold" className="text-emerald-500 text-lg"></iconify-icon>
                  <p className="text-sm font-bold text-emerald-700">공통 안전 지대</p>
                </div>
                <p className="text-xs font-medium text-emerald-800/80 pl-6">
                  {conflictMap.commonAxes.map((a) => AXIS_LABELS[a]).join(' · ')}에서 모두 의견이 비슷합니다. 일정의 기본 베이스캠프로 활용됩니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Not ready state */}
        {!isReady && (
          <div className="card-glass bg-white border-zinc-200 p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mb-6">
              <iconify-icon icon="solar:user-plus-bold-duotone" width="40" className="text-blue-500"></iconify-icon>
            </div>
            <h3 className="heading-sm font-bold mb-2 text-zinc-900">동행자를 기다리고 있어요</h3>
            <p className="body-sm text-zinc-600 font-medium mb-8 max-w-[240px]">최소 2명이 검사를 완료해야 서로의 취향 차이를 보여주는 지도가 만들어집니다.</p>
            <button onClick={copyShareLink} className="btn-primary w-full max-w-[200px]">
              {copyDone ? '✓ 링크 복사 완료!' : '🔗 초대 링크 복사'}
            </button>
          </div>
        )}

        {/* Create Schedule CTA */}
        {isReady && isHost && (
           <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-30 pointer-events-none">
             <div className="max-w-md mx-auto pointer-events-auto">
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
          <div className="p-5 text-center bg-zinc-50 border border-zinc-200 rounded-xl mb-6 shadow-sm">
            <p className="text-sm font-bold text-zinc-700 mb-1">방장이 AI 일정을 만들 수 있어요</p>
            <p className="text-xs text-zinc-500">생성이 완료되면 공유받은 링크에서 확인할 수 있습니다.</p>
          </div>
        )}
        
        {/* Adds bottom padding so CTA doesn't cover content */}
        {isReady && isHost && <div className="h-20 shrink-0" />}
      </div>
    </div>
  );
}
