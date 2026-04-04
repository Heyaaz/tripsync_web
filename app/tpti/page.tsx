'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TPTI_QUESTIONS, calculateScores, getCharacter } from '@/lib/utils/tpti';
import { useAuthStore } from '@/lib/store/auth';
import { tptiApi } from '@/lib/api/client';
import type { TptiResult } from '@/lib/types';

type Step = 'intro' | 'questions' | 'submitting';

export default function TptiPage() {
  const router = useRouter();
  const { user, setTptiResult } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(8).fill(0));
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const progress = ((currentQ) / TPTI_QUESTIONS.length) * 100;
  const q = TPTI_QUESTIONS[currentQ];

  function handleAnswer(value: number) {
    const newAnswers = [...answers];
    newAnswers[currentQ] = value;
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentQ < TPTI_QUESTIONS.length - 1) {
        setCurrentQ((prev) => prev + 1);
      } else {
        handleSubmit(newAnswers);
      }
    }, 400);
  }

  async function handleSubmit(finalAnswers: number[]) {
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
      if (res.data?.data) {
        result.resultId = res.data.data.resultId;
      }
    } catch {
      // 로컬 fallback
    }

    setTptiResult(result);
    router.push('/tpti/result');
  }

  function handleBack() {
    if (currentQ > 0) {
      setCurrentQ((prev) => prev - 1);
    } else {
      setStep('intro');
    }
  }

  if (step === 'submitting') {
    return (
      <div className="app-shell items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-pulse-soft">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-blue-500 animate-spin" />
          <p className="body-lg font-bold text-zinc-900">TPTI 데이터를 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="app-shell">
        <div className="app-content flex flex-col justify-center min-h-[100dvh]">
          <div className="card-bezel w-full animate-fadeInUp">
            <div className="card-bezel-inner p-8 md:p-12">
              <button onClick={() => router.push('/')} className="mb-8 opacity-60 hover:opacity-100 transition-opacity">
                <iconify-icon icon="solar:arrow-left-linear" width="28" className="text-zinc-700"></iconify-icon>
              </button>
              
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
                <iconify-icon icon="solar:compass-square-bold-duotone" width="32" style={{ color: '#3B82F6' }}></iconify-icon>
              </div>

              <h1 className="heading-lg mb-4 text-zinc-900">TPTI 여행 유형 검사</h1>
              <p className="body-lg mb-10 text-zinc-500">나의 여행 취향을 4가지 핵심 축으로 분류하여, 동행자와의 갈등 지점을 미리 예측합니다. 단 8개의 문항, 30초면 충분합니다.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                {AXIS_INFO.map((a) => (
                  <div key={a.axis} className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center gap-4 shadow-sm">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-opacity-30 ${a.colorClass}`}>
                      <iconify-icon icon={a.icon} width="20"></iconify-icon>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 mb-0.5">{a.axis}</div>
                      <div className="text-[13px] text-zinc-700 font-medium">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {!user && (
                <div className="mb-8">
                  <label className="block text-sm font-bold text-zinc-600 mb-3">검사에 사용할 닉네임</label>
                  <input
                    className="input-field max-w-sm"
                    placeholder="예: 예민한 탐험가"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={12}
                  />
                  {error && <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>}
                </div>
              )}

              <button
                className="btn-primary w-full sm:w-auto"
                onClick={() => {
                  if (!user && nickname.trim().length < 2) {
                    setError('닉네임을 2자 이상 입력해주세요');
                    return;
                  }
                  setStep('questions');
                }}
              >
                검사 시작하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Questions step
  return (
    <div className="app-shell">
      <div className="app-content relative !pb-0 flex flex-col pt-6 md:pt-12 min-h-[100dvh]">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 z-20">
          <button onClick={handleBack} className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
            <iconify-icon icon="solar:arrow-left-linear" width="24" className="text-zinc-700"></iconify-icon>
          </button>
          <div className="badge badge-zinc">
            {currentQ + 1} / {TPTI_QUESTIONS.length}
          </div>
          <div className="w-10" />
        </div>

        {/* Progress bar */}
        <div className="score-bar-track mb-12">
          <div className="score-bar-fill bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress}%` }} />
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
                          : 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm'
                      }`}
                    >
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-500 group-hover:text-zinc-800 group-hover:bg-zinc-200'
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

const AXIS_INFO = [
  { axis: '활동성', icon: 'solar:running-bold-duotone', desc: '뚜벅이 탐험형 ↔ 호캉스 휴식형', colorClass: 'bg-blue-100 text-blue-700 border-none' },
  { axis: '기록', icon: 'solar:camera-minimalistic-bold-duotone', desc: '인생샷 SNS형 ↔ 눈으로 담는 실속형', colorClass: 'bg-orange-100 text-orange-700 border-none' },
  { axis: '예산', icon: 'solar:dollar-minimalistic-bold-duotone', desc: '가심비 플렉스형 ↔ 가성비 절약형', colorClass: 'bg-yellow-100 text-yellow-700 border-none' },
  { axis: '테마', icon: 'solar:map-bold-duotone', desc: '도심 핫플형 ↔ 자연 힐링형', colorClass: 'bg-emerald-100 text-emerald-700 border-none' },
];

const LIKERT_OPTIONS = [
  { value: 5, label: '매우 그렇다', sublabel: (q: typeof TPTI_QUESTIONS[0]) => q.optionHigh },
  { value: 4, label: '어느 정도 그렇다', sublabel: () => '' },
  { value: 3, label: '보통이다', sublabel: () => '상황에 따라 다르다' },
  { value: 2, label: '별로 그렇지 않다', sublabel: () => '' },
  { value: 1, label: '전혀 그렇지 않다', sublabel: (q: typeof TPTI_QUESTIONS[0]) => q.optionLow },
];
