'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi, tptiApi, roomApi } from '@/lib/api/client';
import { TPTI_QUESTIONS, calculateScores, getCharacter } from '@/lib/utils/tpti';
import { formatTripDateRange } from '@/lib/utils/date';
import { getApiErrorMessage } from '@/lib/utils/error';
import { normalizeRoomSummary } from '@/lib/utils/room';
import type { Room, TptiResult } from '@/lib/types';

type Step = 'loading' | 'intro' | 'tpti' | 'submitting' | 'done';
type JoinRoomInfo = Pick<
  Room,
  'roomId' | 'destination' | 'tripDate' | 'tripStartDate' | 'tripEndDate' | 'memberCount'
> & {
  hostNickname: string;
};

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
  const [roomInfo, setRoomInfo] = useState<JoinRoomInfo | null>(null);
  const [nickname, setNickname] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(8).fill(0));
  const [error, setError] = useState('');
  const autoJoinAttemptRef = useRef<string | null>(null);

  async function retryJoinWithSavedResult(resultId: number) {
    setError('');
    setStep('submitting');

    try {
      await roomApi.join(shareCode, { tptiResultId: resultId });
      setStep('done');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '여행 방 합류에 실패했습니다. 다시 시도해주세요.'));
      setStep('intro');
    }
  }

  const loadRoom = useEffectEvent(async () => {
    setError('');

    try {
      const res = await roomApi.getByShareCode(shareCode);
      const data = res.data?.data;
      if (data) {
        const normalizedRoom = normalizeRoomSummary({
          roomId: data.roomId,
          destination: data.destination,
          tripDate: data.tripDate,
          tripStartDate: data.tripStartDate,
          tripEndDate: data.tripEndDate,
          shareCode,
          status: data.status,
          hostUserId: 0,
          memberCount: data.memberCount,
          createdAt: new Date().toISOString(),
        });
        setRoomInfo({
          ...data,
          tripStartDate: normalizedRoom.tripStartDate,
          tripEndDate: normalizedRoom.tripEndDate,
        });
        setCurrentRoom({
          ...normalizedRoom,
          tripDate: formatTripDateRange(
            normalizedRoom.tripStartDate,
            normalizedRoom.tripEndDate,
            normalizedRoom.tripDate,
          ),
        });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '여행 방 정보를 불러오지 못했습니다. 링크를 다시 확인해주세요.'));
      setStep('intro');
      return;
    }

    if (user && tptiResult?.resultId) {
      const joinKey = `${shareCode}:${user.id}:${tptiResult.resultId}`;
      if (autoJoinAttemptRef.current !== joinKey) {
        autoJoinAttemptRef.current = joinKey;
        setStep('submitting');
        try {
          await roomApi.join(shareCode, { tptiResultId: tptiResult.resultId });
        } catch (err: unknown) {
          setError(getApiErrorMessage(err, '저장된 결과로 다시 합류하지 못했습니다. 한 번 더 시도해주세요.'));
          setStep('intro');
          return;
        }
      }
      setStep('done');
    } else if (user) {
      setStep('tpti');
    } else {
      setStep('intro');
    }
  });

  useEffect(() => {
    loadRoom();
  }, [shareCode]);

  async function handleNicknameSubmit() {
    if (nickname.trim().length < 2) { setError('닉네임을 2자 이상 입력해주세요'); return; }
    setError('');
    try {
      const res = await authApi.guest({ nickname: nickname.trim(), shareCode });
      const userData = res.data?.data?.user;
      if (userData) setUser(userData);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '참여 처리 중 오류가 발생했습니다. 다시 시도해주세요.'));
      return;
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
    setError('');
    const scores = calculateScores(finalAnswers);
    const char = getCharacter(scores);
    const result: TptiResult = {
      resultId: 0,
      userId: user?.id ?? 0,
      nickname: user?.nickname ?? nickname,
      scores,
      characterName: char.name,
      characterEmoji: char.emoji,
    };
    try {
      const res = await tptiApi.submit({ answers: finalAnswers });
      if (res.data?.data) result.resultId = res.data.data.resultId;
      if (result.resultId <= 0) {
        throw new Error('missing_result_id');
      }
      setTptiResult(result);
      await roomApi.join(shareCode, { tptiResultId: result.resultId });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '검사 결과를 저장하거나 방에 합류하지 못했습니다. 다시 시도해주세요.'));
      setStep('intro');
      return;
    }
    setStep('done');
  }

  if (step === 'loading') {
    return (
      <div className="app-shell app-page items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="app-shell app-page">
        <div className="app-content flex flex-col justify-center min-h-[100dvh] py-24">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] items-start">
            <section className="app-hero-panel animate-fadeInUp">
              <span className="app-kicker mb-5 bg-emerald-50 text-emerald-600 border-emerald-100">
                <iconify-icon icon="solar:letter-opened-bold-duotone" width="14"></iconify-icon>
                Invite
              </span>
              <h1 className="app-section-title mb-4">초대 링크로 들어오면<br />검사 후 바로 합류할 수 있어요</h1>
              <p className="app-section-copy mb-8">
                TripSync는 동행자가 별도 가입 없이도 닉네임과 여행 MBTI 검사만으로
                여행 계획에 자연스럽게 참여할 수 있도록 설계되어 있습니다.
              </p>

              {roomInfo && (
                <div className="space-y-3">
                  <div className="app-info-row">
                    <div className="app-info-icon bg-emerald-50 text-emerald-600">
                      <iconify-icon icon="solar:user-hand-up-bold-duotone" width="20"></iconify-icon>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 mb-1">초대한 사람</div>
                      <div className="text-sm font-normal text-zinc-700"><span className="font-semibold text-emerald-600">{roomInfo.hostNickname}</span>님이 합류를 기다리고 있습니다.</div>
                    </div>
                  </div>
                  <div className="app-info-row">
                    <div className="app-info-icon bg-blue-50 text-blue-600">
                      <iconify-icon icon="solar:calendar-date-bold-duotone" width="20"></iconify-icon>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 mb-1">{roomInfo.destination}</div>
                      <div className="text-sm font-normal text-zinc-700">{formatTripDateRange(roomInfo.tripStartDate, roomInfo.tripEndDate, roomInfo.tripDate)} · 현재 {roomInfo.memberCount}명 참여 중</div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="card-bezel w-full max-w-xl mx-auto animate-fadeInUp">
              <div className="card-bezel-inner p-8 md:p-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <iconify-icon icon="solar:letter-opened-bold-duotone" width="32" className="text-emerald-500"></iconify-icon>
                  </div>
                  <h2 className="text-[28px] font-black tracking-tight text-zinc-900 mb-2">여행 초대 도착!</h2>
                  <p className="text-sm font-normal text-zinc-700">가입 없이 닉네임을 정하고 여행 MBTI 검사만 마치면 바로 방에 합류합니다.</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <iconify-icon icon="solar:user-rounded-bold-duotone" className="text-zinc-500"></iconify-icon>
                    <label className="text-sm font-medium text-zinc-700">{user ? '현재 참여 상태' : '내 닉네임 설정'}</label>
                  </div>
                  {user ? (
                    <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                      <p className="text-sm font-medium text-zinc-900">{user.nickname}님으로 합류 상태를 다시 확인할 수 있어요.</p>
                      <p className="mt-2 text-sm font-normal text-zinc-700 leading-relaxed">
                        {tptiResult?.resultId
                          ? '저장된 여행 MBTI 결과를 사용해 방 참여를 다시 시도합니다.'
                          : '저장된 여행 MBTI 결과가 없어 검사를 다시 진행해야 합니다.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-normal text-zinc-700 mb-3">동행자가 알아볼 수 있는 이름으로 입력해 주세요.</p>
                      <input
                        className="input-field"
                        placeholder="동행자가 알아볼 수 있는 닉네임"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={12}
                        onKeyDown={(e) => e.key === 'Enter' && handleNicknameSubmit()}
                      />
                    </>
                  )}
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>

                {user ? (
                  <button
                    className="btn-primary w-full"
                    onClick={() => {
                      if (tptiResult?.resultId) {
                        void retryJoinWithSavedResult(tptiResult.resultId);
                        return;
                      }
                      setError('');
                      setStep('tpti');
                    }}
                  >
                    {tptiResult?.resultId ? '저장된 결과로 다시 합류하기' : '여행 MBTI 검사 다시 진행하기'} <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                  </button>
                ) : (
                  <button className="btn-primary w-full" onClick={handleNicknameSubmit}>
                    여행 MBTI 검사하고 방 합류하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                  </button>
                )}
              </div>
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
      <div className="app-shell app-page">
        <div className="app-topbar">
          <button onClick={() => setCurrentQ(p => p > 0 ? p - 1 : 0)} className="app-icon-button" aria-label="이전 질문">
            <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="app-topbar-title">합류 전 여행 MBTI 검사</div>
            <div className="app-topbar-meta">{currentQ + 1} / {TPTI_QUESTIONS.length} 질문</div>
          </div>
          <div className="app-chip bg-zinc-100 text-zinc-700 border border-zinc-200">
            {Math.round(progress)}%
          </div>
        </div>

        <div className="app-content relative !pb-0 flex flex-col pt-10 md:pt-14 min-h-[100dvh]">
          <div className="score-bar-track mb-12">
            <div className="score-bar-fill bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex-1 flex flex-col justify-center pb-24 z-10" key={currentQ}>
            <div className="card-glass p-6 md:p-8 animate-slideInRight">
                <div className="mb-6">
                  <span className={`badge ${AXIS_COLOR[q.axis]}`}>
                    <iconify-icon icon={AXIS_ICON[q.axis]} className="mr-1"></iconify-icon>
                    {AXIS_KR[q.axis]}
                  </span>
                </div>
                
                <h2 className="text-[28px] md:text-[38px] font-black tracking-tight mb-10 leading-snug text-zinc-900">
                  {q.text}
                </h2>

                {error && (
                  <div className="mb-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {LIKERT_OPTIONS.map((opt) => {
                    const isSelected = answers[currentQ] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswer(opt.value)}
                        className={`group relative w-full text-left p-4 md:p-5 rounded-[20px] border flex items-center gap-4 transition-all duration-300 ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-400 shadow-[0_16px_32px_rgba(59,130,246,0.12)]' 
                            : 'bg-white/86 border-white/90 hover:bg-zinc-50 hover:border-zinc-200 shadow-[0_6px_20px_rgba(15,23,42,0.04)]'
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
                            <div className={`text-sm truncate ${isSelected ? 'text-blue-700/90' : 'text-zinc-700'}`}>
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
      <div className="app-shell app-page items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-pulse-soft">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-emerald-500 animate-spin" />
          <p className="body-lg font-bold text-emerald-600">여행 방에 참여하는 중…</p>
        </div>
      </div>
    );
  }

  // Done
  return (
    <div className="app-shell app-page">
       <div className="app-content min-h-[100dvh] flex flex-col justify-center relative py-24">
          <div className="card-bezel max-w-xl mx-auto w-full animate-fadeInUp">
            <div className="card-bezel-inner p-10 flex flex-col items-center text-center">
               <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
                 <iconify-icon icon="solar:confetti-bold-duotone" width="40" className="text-emerald-500"></iconify-icon>
               </div>
               <span className="app-kicker mb-4 bg-emerald-50 text-emerald-600 border-emerald-100">Welcome Aboard</span>
               <h1 className="text-3xl font-black tracking-tight mb-3 text-zinc-900">여행 방 합류 완료!</h1>
               <p className="text-sm font-normal text-zinc-700 max-w-sm leading-relaxed">검사 결과를 기반으로 이제 궁합 지도와 일정 제안을 함께 확인할 수 있습니다.</p>
               
               {tptiResult && (
                 <div className="bg-zinc-50 border border-zinc-200 rounded-[20px] w-full p-4 mb-6 mt-6">
                   <div className="text-4xl mb-3">{tptiResult.characterEmoji}</div>
                   <div className="font-bold text-zinc-900">{tptiResult.characterName}</div>
                   <div className="text-sm font-normal text-zinc-700 mt-1">이 유형으로 방에 입장했습니다</div>
                 </div>
               )}

               <button
                 className="btn-primary w-full shadow-[0_0_30px_rgba(16,185,129,0.2)] bg-emerald-600 hover:bg-emerald-500"
                 onClick={() => router.push(`/rooms/${roomInfo?.roomId}/conflict`)}
               >
                 그룹 궁합 지도 확인하러 가기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
               </button>
            </div>
          </div>
       </div>
    </div>
  );
}
