'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi, roomApi } from '@/lib/api/client';

export default function RoomsNewPage() {
  const router = useRouter();
  const { user, tptiResult, setUser, setCurrentRoom } = useAuthStore();
  const [step, setStep] = useState<'auth' | 'form'>(user ? 'form' : 'auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // Room form
  const [tripDate, setTripDate] = useState('');
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
    if (!tripDate) { setError('여행 날짜를 선택해주세요'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await roomApi.create({ destination, tripDate });
      const roomData = res.data?.data;
      if (roomData) {
        setCurrentRoom({
          roomId: roomData.roomId,
          destination,
          tripDate,
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
        tripDate,
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

  return (
    <div className="app-shell">
      <div className="app-content flex flex-col justify-center min-h-[100dvh]">
        <div className="card-bezel w-full max-w-md mx-auto animate-fadeInUp">
          <div className="card-bezel-inner p-8 md:p-10">
            {/* Header */}
            <div className="flex items-center mb-8">
              <button onClick={() => router.back()} className="opacity-60 hover:opacity-100 transition-opacity">
                <iconify-icon icon="solar:arrow-left-linear" width="28"></iconify-icon>
              </button>
            </div>

            {step === 'auth' ? (
              <div className="animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
                  <iconify-icon icon="solar:user-circle-bold-duotone" width="28" style={{ color: '#3B82F6' }}></iconify-icon>
                </div>
                <h1 className="heading-md mb-2 text-zinc-900">
                  {authMode === 'login' ? '방장 로그인' : '방장 회원가입'}
                </h1>
                <p className="body-md mb-8 text-zinc-700">동행자는 가입 없이 링크로 참여할 수 있어요.</p>

                <form onSubmit={handleAuth} className="flex flex-col gap-5">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-sm font-bold text-zinc-600 mb-2">닉네임</label>
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
                    <label className="block text-sm font-bold text-zinc-600 mb-2">이메일</label>
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
                    <label className="block text-sm font-bold text-zinc-600 mb-2">비밀번호</label>
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
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-red-500 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button className="btn-primary mt-2" type="submit" disabled={loading}>
                    {loading ? '처리 중...' : authMode === 'login' ? '로그인' : '가입하기'}
                  </button>
                </form>

                <div className="mt-6">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/google?redirectPath=/rooms/new`}
                    className="btn-secondary flex gap-3 w-full"
                  >
                    <iconify-icon icon="logos:google-icon" width="20"></iconify-icon>
                    Google로 시작하기
                  </a>
                </div>

                <div className="flex flex-col gap-4 mt-8">
                  <button
                    onClick={() => setAuthMode((m) => m === 'login' ? 'register' : 'login')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    {authMode === 'login' ? '새로운 계정 만들기' : '이미 계정이 있으신가요?'}
                  </button>

                  <button
                    onClick={() => {
                      setUser({ id: 1, nickname: '방장', email: 'demo@tripsync.app', isGuest: false, authProvider: 'local' });
                      setStep('form');
                    }}
                    className="text-xs text-zinc-700 hover:text-zinc-800 transition-colors"
                  >
                    데모 모드로 건너뛰기
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
                  <iconify-icon icon="solar:home-smile-angle-bold-duotone" width="28" style={{ color: '#10B981' }}></iconify-icon>
                </div>
                <h1 className="heading-md mb-2 text-zinc-900">여행 방 만들기</h1>
                <p className="body-md mb-8 text-zinc-700">방을 만들면 공유 링크가 생성됩니다.</p>

                <form onSubmit={handleCreateRoom} className="flex flex-col gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2">여행 지역</label>
                    <div className="input-field flex items-center justify-between bg-zinc-50 opacity-80 cursor-not-allowed">
                      <div className="flex items-center gap-2">
                        <iconify-icon icon="solar:map-point-bold" className="text-emerald-500"></iconify-icon>
                        <span className="font-bold text-zinc-900">충청남도</span>
                      </div>
                      <span className="text-xs text-zinc-700 border border-zinc-200 px-2 py-1 rounded bg-white">MVP 한정</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-600 mb-2">여행 날짜</label>
                    <input
                      className="input-field"
                      type="date"
                      min={minDate}
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      required
                    />
                  </div>

                  {!tptiResult && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl mb-2">
                      <div className="flex gap-3 mb-3">
                        <iconify-icon icon="solar:info-circle-bold" className="text-orange-500 shrink-0 text-xl"></iconify-icon>
                        <div>
                          <p className="text-sm font-bold text-orange-600 mb-1">TPTI 검사가 필요합니다</p>
                          <p className="text-xs text-orange-700/80">방장도 TPTI 결과를 가지고 있어야 갈등 조율 일정을 만들 수 있습니다.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/tpti')}
                        className="btn-primary w-full !bg-orange-500 hover:!bg-orange-600 !text-white !shadow-none !border-none"
                      >
                         내 TPTI 검사하기
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-red-500 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button className="btn-primary" type="submit" disabled={loading || !tripDate}>
                    {loading ? '생성 중...' : '방 생성 완료'} <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
