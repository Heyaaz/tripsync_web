'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi, roomApi } from '@/lib/api/client';
import { formatTripDateRange, isValidDateRange } from '@/lib/utils/date';

export default function RoomsNewPage() {
  const router = useRouter();
  const { user, tptiResult, setUser, setCurrentRoom } = useAuthStore();
  const [step, setStep] = useState<'auth' | 'form'>(user ? 'form' : 'auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [oauthSyncing, setOauthSyncing] = useState(false);
  const [error, setError] = useState('');

  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // Room form
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [destination] = useState('충남');

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (authMode === 'register') {
        res = await authApi.register({ nickname, email, password });
      } else {
        res = await authApi.login({ email, password });
      }
      const userData = res.data?.data?.user;
      if (userData) {
        setUser(userData);
        setStep('form');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || '인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!tripStartDate || !tripEndDate) { setError('여행 기간을 선택해주세요'); return; }
    if (!isValidDateRange(tripStartDate, tripEndDate)) { setError('종료일은 시작일보다 빠를 수 없습니다'); return; }
    setLoading(true);
    setError('');
    const tripDateLabel = formatTripDateRange(tripStartDate, tripEndDate);
    try {
      const res = await roomApi.create({ destination, tripDate: tripStartDate, tripStartDate, tripEndDate });
      const roomData = res.data?.data;
      if (roomData) {
        setCurrentRoom({
          roomId: roomData.roomId,
          destination,
          tripDate: tripDateLabel,
          tripStartDate,
          tripEndDate,
          shareCode: roomData.shareCode,
          status: roomData.status,
          hostUserId: user!.id,
          memberCount: 1,
          createdAt: new Date().toISOString(),
        });
        router.push(`/rooms/${roomData.roomId}/conflict`);
      }
    } catch {
      // Demo mode
      const mockShareCode = `CNAM${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const mockRoom = {
        roomId: Date.now(),
        destination,
        tripDate: tripDateLabel,
        tripStartDate,
        tripEndDate,
        shareCode: mockShareCode,
        status: 'waiting' as const,
        hostUserId: user?.id ?? 1,
        memberCount: 1,
        createdAt: new Date().toISOString(),
      };
      setCurrentRoom(mockRoom);
      router.push(`/rooms/${mockRoom.roomId}/conflict`);
    } finally {
      setLoading(false);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    setStep(user ? 'form' : 'auth');
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function syncOAuthSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') !== 'success') {
        return;
      }

      const oauthProvider = params.get('provider');
      setOauthSyncing(true);
      setError('');

      try {
        const res = await authApi.me();
        const userData = res.data?.data?.user;

        if (!cancelled && userData) {
          setUser(userData);
          setStep('form');
          router.replace('/rooms/new');
          return;
        }

        if (!cancelled) {
          setError('소셜 로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.');
        }
      } catch {
        if (!cancelled) {
          const providerLabel = oauthProvider === 'kakao' ? '카카오' : oauthProvider === 'google' ? 'Google' : '소셜';
          setError(`${providerLabel} 로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.`);
        }
      } finally {
        if (!cancelled) {
          setOauthSyncing(false);
        }
      }
    }

    void syncOAuthSession();

    return () => {
      cancelled = true;
    };
  }, [router, setUser]);

  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.back()} className="app-icon-button" aria-label="이전으로">
          <iconify-icon icon="solar:arrow-left-linear" width="22"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">여행방 시작하기</div>
          <div className="app-topbar-meta">방장 인증부터 일정 생성 준비까지 한 번에 진행합니다</div>
        </div>
        <div className="w-11 shrink-0" />
      </div>

      <div className="app-content flex flex-col justify-center min-h-[100dvh] py-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] items-start">
          <section className="app-hero-panel animate-fadeInUp">
            <span className="app-kicker mb-5">
              <iconify-icon icon="solar:routing-3-bold-duotone" width="14"></iconify-icon>
              Room Setup
            </span>
            <h1 className="app-section-title mb-4 break-keep-all">
              동행자와 갈등 없이<br />
              여행을 시작하는 첫 단계
            </h1>
            <p className="app-section-copy mb-8">
              방장은 계정을 만들고, 여행 날짜를 정한 뒤, TPTI 결과를 바탕으로
              동행자들과 공유할 합의형 여행방을 엽니다.
            </p>

            <div className="space-y-3">
              {[
                {
                  icon: 'solar:shield-user-bold-duotone',
                  title: '방장 계정으로 관리',
                  copy: '초대 링크와 최종 일정 확정을 한 곳에서 관리합니다.',
                  tint: 'bg-blue-50 text-blue-600',
                },
                {
                  icon: 'solar:calendar-date-bold-duotone',
                  title: '여행 날짜 먼저 고정',
                  copy: '기본 날짜를 기준으로 갈등 지도와 일정 옵션이 생성됩니다.',
                  tint: 'bg-emerald-50 text-emerald-600',
                },
                {
                  icon: 'solar:compass-bold-duotone',
                  title: 'TPTI 결과로 조율 시작',
                  copy: '방장도 자신의 여행 성향 결과를 가지고 있어야 더 정확한 합의가 가능합니다.',
                  tint: 'bg-violet-50 text-violet-600',
                },
              ].map((item) => (
                <div key={item.title} className="app-info-row">
                  <div className={`app-info-icon ${item.tint}`}>
                    <iconify-icon icon={item.icon} width="20"></iconify-icon>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 mb-1">{item.title}</div>
                    <div className="text-sm font-normal text-zinc-700 leading-relaxed">{item.copy}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="card-bezel w-full max-w-xl mx-auto animate-fadeInUp">
            <div className="card-bezel-inner p-8 md:p-10">
              {step === 'auth' ? (
                <div className="animate-fadeIn">
                  <div className="w-14 h-14 rounded-[18px] bg-blue-50 border border-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] flex items-center justify-center mb-6">
                    <iconify-icon icon="solar:shield-user-bold-duotone" width="28" style={{ color: '#3B82F6' }}></iconify-icon>
                  </div>
                  <span className="app-kicker mb-4">
                    {authMode === 'login' ? 'Host Login' : 'Host Signup'}
                  </span>
                  <h2 className="text-[28px] font-black tracking-tight text-zinc-900 mb-2">
                    {authMode === 'login' ? '방장 로그인' : '방장 회원가입'}
                  </h2>
                  <p className="body-md mb-8 text-zinc-700">동행자는 가입 없이 공유 링크로 바로 참여할 수 있습니다.</p>

                  <form onSubmit={handleAuth} className="flex flex-col gap-5">
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">닉네임</label>
                        <input
                          className="input-field"
                          placeholder="2~12자"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          maxLength={12}
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">이메일</label>
                      <input
                        className="input-field"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">비밀번호</label>
                      <input
                        className="input-field"
                        type="password"
                        placeholder="8자 이상 영문+숫자"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>

                    {error && (
                      <div className="app-alert app-alert-danger">
                        <iconify-icon icon="solar:danger-triangle-bold-duotone" width="20" className="shrink-0 mt-0.5"></iconify-icon>
                        <p className="text-sm font-medium">{error}</p>
                      </div>
                    )}

                    {oauthSyncing && (
                      <div className="app-alert app-alert-warning">
                        <iconify-icon icon="solar:shield-check-bold-duotone" width="20" className="shrink-0 mt-0.5"></iconify-icon>
                        <p className="text-sm font-medium">소셜 로그인 세션을 확인하고 있습니다…</p>
                      </div>
                    )}

                    <button className="btn-primary mt-2" type="submit" disabled={loading || oauthSyncing}>
                      {loading ? '처리 중…' : authMode === 'login' ? '로그인하고 계속하기' : '가입하고 계속하기'}
                    </button>
                  </form>

                  <div className="mt-4 space-y-3">
                    <a
                      href={authApi.getOAuthStartUrl('google', '/rooms/new')}
                      className="btn-secondary flex gap-3 w-full"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <iconify-icon icon="logos:google-icon" width="20"></iconify-icon>
                      </span>
                      <span>Google로 시작하기</span>
                    </a>

                    <a
                      href={authApi.getOAuthStartUrl('kakao', '/rooms/new')}
                      className="btn-kakao"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <iconify-icon icon="solar:chat-round-bold" width="19" style={{ color: '#191600' }}></iconify-icon>
                      </span>
                      <span>카카오로 시작하기</span>
                    </a>
                  </div>

                  <div className="flex flex-col gap-4 mt-8">
                    <button
                      onClick={() => setAuthMode((m) => m === 'login' ? 'register' : 'login')}
                      className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                    >
                      {authMode === 'login' ? '새로운 계정 만들기' : '이미 계정이 있으신가요?'}
                    </button>

                    <button
                      onClick={() => {
                        setUser({ id: 1, nickname: '방장', email: 'demo@tripsync.app', isGuest: false, authProvider: 'local' });
                        setStep('form');
                      }}
                      className="text-sm font-normal text-zinc-700 hover:text-zinc-900 transition-colors"
                    >
                      데모 모드로 건너뛰기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
                    <iconify-icon icon="solar:home-smile-angle-bold-duotone" width="30" style={{ color: '#10B981' }}></iconify-icon>
                  </div>
                  <span className="app-kicker mb-4 bg-emerald-50 text-emerald-600 border-emerald-100">
                    Room Form
                  </span>
                  <h2 className="text-[28px] font-black tracking-tight text-zinc-900 mb-2">여행 방 만들기</h2>
                  <p className="body-md mb-8 text-zinc-700">방을 만들면 공유 링크가 생성되고, 동행자가 검사 후 바로 합류할 수 있습니다.</p>

                  <form onSubmit={handleCreateRoom} className="flex flex-col gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">여행 지역</label>
                      <div className="input-field flex items-center justify-between bg-zinc-50/80 opacity-90 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <iconify-icon icon="solar:map-point-bold" className="text-emerald-500"></iconify-icon>
                          <span className="font-bold text-zinc-900">충청남도</span>
                        </div>
                        <span className="text-sm font-normal text-zinc-700 border border-zinc-200 px-2 py-1 rounded-full bg-white">MVP 한정</span>
                      </div>
                    </div>

                    <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">여행 기간</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className="input-field"
                        type="date"
                        min={minDate}
                        value={tripStartDate}
                        onChange={(e) => setTripStartDate(e.target.value)}
                        required
                      />
                      <input
                        className="input-field"
                        type="date"
                        min={tripStartDate || minDate}
                        value={tripEndDate}
                        onChange={(e) => setTripEndDate(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-sm font-normal text-zinc-700 mt-3">하루 일정부터 여러 날 여행까지 기간을 직접 지정할 수 있습니다.</p>
                  </div>

                    {!tptiResult && (
                      <div className="app-alert app-alert-warning">
                        <iconify-icon icon="solar:info-circle-bold-duotone" width="20" className="shrink-0 mt-0.5"></iconify-icon>
                        <div className="w-full">
                          <p className="text-sm font-bold mb-1">TPTI 검사가 필요합니다</p>
                          <p className="text-sm font-normal leading-relaxed mb-3">방장도 TPTI 결과를 가지고 있어야 갈등 조율 일정을 더 정확하게 만들 수 있습니다.</p>
                          <button
                            type="button"
                            onClick={() => router.push('/tpti')}
                            className="btn-primary w-full !bg-orange-500 hover:!bg-orange-600 !text-white !shadow-none"
                          >
                            내 TPTI 검사하기
                          </button>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="app-alert app-alert-danger">
                        <iconify-icon icon="solar:danger-triangle-bold-duotone" width="20" className="shrink-0 mt-0.5"></iconify-icon>
                        <p className="text-sm font-medium">{error}</p>
                      </div>
                    )}

                    <button className="btn-primary" type="submit" disabled={loading || !tripStartDate || !tripEndDate}>
                      {loading ? '방 생성 중…' : '여행방 만들기'}
                      <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
