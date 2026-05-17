'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TPTI_QUESTIONS, calculateScores, getCharacter } from '@/lib/utils/tpti';
import { useAuthStore } from '@/lib/store/auth';
import { authApi, tptiApi } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/utils/error';
import type { TptiResult } from '@/lib/types';

type Step = 'intro' | 'questions' | 'submitting';

export default function TptiPage() {
  const router = useRouter();
  const { setTptiResult, setUser, user } = useAuthStore();
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

  async function handleStart() {
    if (!user && nickname.trim().length < 2) {
      setError('닉네임을 2자 이상 입력해주세요');
      return;
    }

    setError('');

    if (!user) {
      try {
        const res = await authApi.guest({ nickname: nickname.trim() });
        const userData = res.data?.data?.user;
        if (!userData) {
          throw new Error('guest_session_missing');
        }
        setUser(userData);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '검사용 게스트 세션을 만들지 못했습니다. 다시 시도해주세요.'));
        return;
      }
    }

    setStep('questions');
  }

  async function handleSubmit(finalAnswers: number[]) {
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
      if (res.data?.data) {
        result.resultId = res.data.data.resultId;
      }
      if (result.resultId <= 0) {
        throw new Error('missing_result_id');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '여행 MBTI 결과를 저장하지 못했습니다. 다시 시도해주세요.'));
      setStep('intro');
      return;
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
      <div className="app-shell app-page items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-pulse-soft">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-200 border-t-blue-500 animate-spin" />
          <p className="body-lg font-bold text-zinc-900">여행 MBTI 데이터를 분석하고 있습니다…</p>
        </div>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="app-shell app-page">
        <div className="app-topbar">
          <button onClick={() => router.push('/')} className="app-icon-button" aria-label="홈으로">
            <iconify-icon icon="solar:arrow-left-linear" width="22"></iconify-icon>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="app-topbar-title">여행 MBTI 검사</div>
            <div className="app-topbar-meta">8개의 질문으로 나의 여행 취향을 빠르게 확인합니다</div>
          </div>
          <div className="w-11 shrink-0" />
        </div>

        <div className="app-content flex flex-col justify-center min-h-[100dvh] py-24">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] items-start">
            <section className="app-hero-panel animate-fadeInUp">
              <span className="app-kicker mb-5">
                <iconify-icon icon="solar:compass-bold-duotone" width="14"></iconify-icon>
                Travel Preference Test
              </span>
              <h1 className="app-section-title mb-4">여행 성향을 먼저 파악하면<br />동행자와 덜 부딪힙니다</h1>
              <p className="app-section-copy mb-8">
                여행 MBTI는 활동성, 기록, 예산, 테마의 네 축으로 여행 취향을 분류해
                동행자와의 갈등 지점을 미리 예상할 수 있게 도와줍니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AXIS_INFO.map((a) => (
                  <div key={a.axis} className="app-info-row">
                    <div className={`app-info-icon ${a.colorClass}`}>
                      <iconify-icon icon={a.icon} width="20"></iconify-icon>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 mb-0.5">{a.axis}</div>
                      <div className="text-sm font-normal text-zinc-700 leading-relaxed">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="card-bezel w-full max-w-xl mx-auto animate-fadeInUp">
              <div className="card-bezel-inner p-8 md:p-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
                  <iconify-icon icon="solar:compass-square-bold-duotone" width="32" style={{ color: '#3B82F6' }}></iconify-icon>
                </div>

                <span className="app-kicker mb-4">Quick Setup</span>
                <h2 className="text-[28px] font-black tracking-tight text-zinc-900 mb-2">30초 안에 시작할 수 있어요</h2>
                <p className="body-md mb-8 text-zinc-700">검사를 완료하면 결과 페이지에서 나의 유형을 보고, 바로 여행 계획 생성까지 이어갈 수 있습니다.</p>

                {!user && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-zinc-700 mb-3">검사에 사용할 닉네임</label>
                    <input
                      className="input-field max-w-sm"
                      placeholder="예: 예민한 탐험가"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={12}
                    />
                  </div>
                )}

                {error && <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>}

                <button
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => {
                    void handleStart();
                  }}
                >
                  검사 시작하기 <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Questions step
  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={handleBack} className="app-icon-button" aria-label="이전 질문">
          <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">질문 {currentQ + 1} / {TPTI_QUESTIONS.length}</div>
          <div className="app-topbar-meta">가장 나다운 여행 스타일에 가깝게 선택해 주세요</div>
        </div>
        <div className="app-chip bg-zinc-100 text-zinc-700 border border-zinc-200">
          {Math.round(progress)}%
        </div>
      </div>

      <div className="app-content relative !pb-0 flex flex-col pt-10 md:pt-14 min-h-[100dvh]">
        <div className="score-bar-track mb-10">
          <div className="score-bar-fill bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress}%` }} />
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
                      isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-500 group-hover:text-zinc-800 group-hover:bg-zinc-200'
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
