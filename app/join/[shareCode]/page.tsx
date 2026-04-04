'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi, tptiApi, roomApi } from '@/lib/api/client';
import { TPTI_QUESTIONS, calculateScores, getCharacter } from '@/lib/utils/tpti';
import type { TptiResult } from '@/lib/types';

type Step = 'loading' | 'intro' | 'nickname' | 'tpti' | 'submitting' | 'done';

const AXIS_KR: Record<string, string> = { mobility: '활동성', photo: '기록', budget: '예산', theme: '테마' };
const AXIS_ICON: Record<string, string> = { 
  mobility: 'solar:running-bold-duotone', photo: 'solar:camera-minimalistic-bold-duotone', 
  budget: 'solar:dollar-minimalistic-bold-duotone', theme: 'solar:map-bold-duotone' 
};
const AXIS_COLOR: Record<string, string> = {
  mobility: 'bg-blue-100 text-blue-700 border border-blue-200', 
  photo: 'bg-orange-100 text-orange-700 border border-orange-200', 
  budget: 'bg-red-100 text-red-700 border border-red-200', 
  theme: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
};

const LIKERT_OPTIONS = [
  { value: 5, label: '매우 그렇다', sublabel: (q: typeof TPTI_QUESTIONS[0]) => q.optionHigh },
  { value: 4, label: '어느 정도 그렇다', sublabel: () => '' },
  { value: 3, label: '보통이다', sublabel: () => '상황에 따라 다르다' },
  { value: 2, label: '별로 그렇지 않다', sublabel: () => '' },
  { value: 1, label: '전혀 그렇지 않다', sublabel: (q: typeof TPTI_QUESTIONS[0]) => q.optionLow },
];

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const shareCode = params.shareCode as string;
  const { user, tptiResult, setUser, setTptiResult, setCurrentRoom } = useAuthStore();

  const [step, setStep] = useState<Step>('loading');
  const [roomInfo, setRoomInfo] = useState<{
    roomId: number; destination: string; tripDate: string; hostNickname: string; memberCount: number;
  } | null>(null);
  const [nickname, setNickname] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(8).fill(0));
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoom();
  }, [shareCode]);

  async function loadRoom() {
    try {
      const res = await roomApi.getByShareCode(shareCode);
      const data = res.data?.data;
      if (data) {
        setRoomInfo(data);
        setCurrentRoom({
          roomId: data.roomId,
          destination: data.destination,
          tripDate: data.tripDate,
          shareCode,
          status: data.status,
          hostUserId: 0,
          memberCount: data.memberCount,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // Demo: create mock room
      setRoomInfo({
        roomId: 101, destination: '충남', tripDate: '2026-05-10',
        hostNickname: '지훈', memberCount: 1,
      });
      setCurrentRoom({
        roomId: 101, destination: '충남', tripDate: '2026-05-10',
        shareCode, status: 'waiting', hostUserId: 1, memberCount: 1,
        createdAt: new Date().toISOString(),
      });
    }

    if (user && tptiResult) {
      setStep('done');
    } else if (user) {
      setStep('tpti');
    } else {
      setStep('intro');
    }
  }

  async function handleNicknameSubmit() {
    if (nickname.trim().length < 2) { setError('닉네임을 2자 이상 입력해주세요'); return; }
    setError('');
    try {
      const res = await authApi.guest({ nickname: nickname.trim(), shareCode });
      const userData = res.data?.data?.user;
      if (userData) setUser(userData);
    } catch {
      setUser({ id: Date.now(), nickname: nickname.trim(), isGuest: true, authProvider: 'guest' });
    }
    setStep('tpti');
  }

  function handleAnswer(value: number) {
    const newAnswers = [...answers];
    newAnswers[currentQ] = value;
    setAnswers(newAnswers);
    setTimeout(() => {
      if (currentQ < TPTI_QUESTIONS.length - 1) {
        setCurrentQ((p) => p + 1);
      } else {
        handleTptiSubmit(newAnswers);
      }
    }, 400);
  }

  async function handleTptiSubmit(finalAnswers: number[]) {
    setStep('submitting');
    const scores = calculateScores(finalAnswers);
    const char = getCharacter(scores);
    const result: TptiResult = {
      resultId: Date.now(),
      userId: user?.id ?? 0,
      nickname: user?.nickname ?? nickname,
      scores,
      characterName: char.name,
      characterEmoji: char.emoji,
    };
    try {
      const res = await tptiApi.submit({ answers: finalAnswers });
      if (res.data?.data) result.resultId = res.data.data.resultId;
      // Join room
      await roomApi.join(shareCode, { tptiResultId: result.resultId });
    } catch {
      // local demo
    }
    setTptiResult(result);
    setStep('done');
  }

  if (step === 'loading') {
    return (
      <div className="app-shell items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (step === 'intro' || step === 'nickname') {
    return (
      <div className="app-shell">
        <div className="app-content flex flex-col justify-center min-h-[100dvh]">
          <div className="card-bezel w-full max-w-md mx-auto animate-fadeInUp">
            <div className="card-bezel-inner p-8">
               <div className="text-center mb-10">
                 <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <iconify-icon icon="solar:letter-opened-bold-duotone" width="32" className="text-emerald-500"></iconify-icon>
                 </div>
                 <h1 className="heading-md text-zinc-900 mb-2">여행 초대 도착!</h1>
                 {roomInfo && (
                   <p className="text-zinc-700 font-medium text-sm">
                     <span className="font-bold text-emerald-600">{roomInfo.hostNickname}</span>님이 여행 그룹에 초대했습니다.
                   </p>
                 )}
               </div>

               {roomInfo && (
                 <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 mb-8 flex items-center gap-4">
                   <div className="w-12 h-12 rounded-lg bg-white border border-zinc-100 flex flex-col items-center justify-center shrink-0">
                     <span className="text-[10px] font-bold text-zinc-500 mb-0.5">MAY</span>
                     <span className="text-lg font-bold text-zinc-900">10</span>
                   </div>
                   <div>
                     <p className="font-bold text-base text-zinc-900 mb-1">{roomInfo.destination}</p>
                     <p className="text-xs text-zinc-500">{roomInfo.tripDate} · 현재 {roomInfo.memberCount}명 참여 중</p>
                   </div>
                 </div>
               )}

               <div className="mb-8">
                 <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="solar:user-rounded-bold-duotone" className="text-zinc-500"></iconify-icon>
                    <label className="text-sm font-bold text-zinc-700">내 닉네임 설정</label>
                 </div>
                 <p className="text-xs text-zinc-500 mb-3">가입 없이 닉네임만 입력하고 바로 시작하세요.</p>
                 <input
                   className="input-field"
                   placeholder="동행자가 알아볼 수 있는 닉네임"
                   value={nickname}
                   onChange={(e) => setNickname(e.target.value)}
                   maxLength={12}
                   onKeyDown={(e) => e.key === 'Enter' && handleNicknameSubmit()}
                 />
                 {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
               </div>

               <button className="btn-primary w-full" onClick={handleNicknameSubmit}>
                 TPTI 검사하고 방 합류하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'tpti') {
    const q = TPTI_QUESTIONS[currentQ];
    const progress = ((currentQ) / TPTI_QUESTIONS.length) * 100;
    return (
      <div className="app-shell">
        <div className="app-content relative !pb-0 flex flex-col pt-6 md:pt-12 min-h-[100dvh]">
          {/* Top Header */}
          <div className="flex items-center justify-between mb-8 z-20">
            <button onClick={() => setCurrentQ(p => p > 0 ? p - 1 : 0)} className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
              <iconify-icon icon="solar:arrow-left-linear" width="24" className="text-zinc-700"></iconify-icon>
            </button>
            <div className="badge badge-zinc">
              {currentQ + 1} / {TPTI_QUESTIONS.length}
            </div>
            <div className="w-10" />
          </div>

          {/* Progress bar */}
          <div className="score-bar-track mb-12">
            <div className="score-bar-fill bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Question Area */}
          <div className="flex-1 flex flex-col justify-center pb-24 z-10" key={currentQ}>
            <div className="animate-slideInRight">
                <div className="mb-6">
                  <span className={`badge ${AXIS_COLOR[q.axis]}`}>
                    <iconify-icon icon={AXIS_ICON[q.axis]} className="mr-1"></iconify-icon>
                    {AXIS_KR[q.axis]}
                  </span>
                </div>
                
                <h2 className="heading-md md:heading-lg mb-10 leading-snug text-zinc-900">
                  {q.text}
                </h2>

                <div className="flex flex-col gap-3">
                  {LIKERT_OPTIONS.map((opt) => {
                    const isSelected = answers[currentQ] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswer(opt.value)}
                        className={`group relative w-full text-left p-4 md:p-5 rounded-xl border flex items-center gap-4 transition-all duration-300 ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-500 shadow-sm' 
                            : 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                        }`}
                      >
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-400 group-hover:text-zinc-600 group-hover:bg-zinc-200'
                        }`}>
                          <span className="font-bold text-sm md:text-base">{opt.value}</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className={`font-bold text-base md:text-lg mb-1 ${isSelected ? 'text-blue-900' : 'text-zinc-700'}`}>
                            {opt.label}
                          </div>
                          {opt.sublabel(q) && (
                            <div className={`text-xs md:text-sm truncate ${isSelected ? 'text-blue-600/80' : 'text-zinc-500'}`}>
                              {opt.sublabel(q)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'submitting') {
    return (
      <div className="app-shell items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-pulse-soft">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-emerald-500 animate-spin" />
          <p className="body-lg font-bold text-emerald-600">여행 방에 참여하는 중...</p>
        </div>
      </div>
    );
  }

  // Done
  return (
    <div className="app-shell">
       <div className="app-content min-h-[100dvh] flex flex-col justify-center relative">
          <div className="card-bezel max-w-md mx-auto w-full animate-fadeInUp">
            <div className="card-bezel-inner p-10 flex flex-col items-center text-center">
               <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
                 <iconify-icon icon="solar:confetti-bold-duotone" width="40" className="text-emerald-500"></iconify-icon>
               </div>
               <h1 className="text-2xl font-bold mb-3 text-zinc-900">여행 방 합류 완료!</h1>
               
               {tptiResult && (
                 <div className="bg-zinc-50 border border-zinc-200 rounded-xl w-full p-4 mb-6 mt-4">
                   <div className="text-4xl mb-3">{tptiResult.characterEmoji}</div>
                   <div className="font-bold text-zinc-900">{tptiResult.characterName}</div>
                   <div className="text-xs text-zinc-500 mt-1">이 유형으로 방에 입장했습니다</div>
                 </div>
               )}

               <button
                 className="btn-primary w-full shadow-[0_0_30px_rgba(16,185,129,0.2)] bg-emerald-600 hover:bg-emerald-500"
                 onClick={() => router.push(`/rooms/${roomInfo?.roomId}/conflict`)}
               >
                 그룹 갈등 지도 확인하러 가기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
               </button>
            </div>
          </div>
       </div>
    </div>
  );
}
