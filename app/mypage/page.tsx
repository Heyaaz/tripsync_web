'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { authApi, roomApi } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth';
import type { Room } from '@/lib/types';
import { formatTripDateRange } from '@/lib/utils/date';
import { getApiErrorMessage } from '@/lib/utils/error';
import { normalizeRoomSummary } from '@/lib/utils/room';

type RoomPayload = {
  roomId: number;
  roomName?: string;
  destination: string;
  tripDate: string;
  tripStartDate?: string;
  tripEndDate?: string;
  shareCode: string;
  status: Room['status'];
  hostUserId: number;
  memberCount: number;
  createdAt: string;
  hasGeneratedSchedule?: boolean;
  confirmedScheduleId?: number | null;
  latestScheduleVersion?: number | null;
};

function isRoomPayload(value: unknown): value is RoomPayload {
  if (!value || typeof value !== 'object') return false;
  const room = value as Partial<RoomPayload>;
  return (
    typeof room.roomId === 'number' &&
    (room.roomName === undefined || typeof room.roomName === 'string') &&
    typeof room.destination === 'string' &&
    typeof room.tripDate === 'string' &&
    typeof room.shareCode === 'string' &&
    typeof room.status === 'string' &&
    typeof room.hostUserId === 'number' &&
    typeof room.memberCount === 'number' &&
    typeof room.createdAt === 'string' &&
    (room.hasGeneratedSchedule === undefined || typeof room.hasGeneratedSchedule === 'boolean') &&
    (room.confirmedScheduleId === undefined || room.confirmedScheduleId === null || typeof room.confirmedScheduleId === 'number') &&
    (room.latestScheduleVersion === undefined || room.latestScheduleVersion === null || typeof room.latestScheduleVersion === 'number')
  );
}

function roomEntryHref(room: Room) {
  return room.status === 'completed' || room.hasGeneratedSchedule ? `/rooms/${room.roomId}/schedule` : `/rooms/${room.roomId}/conflict`;
}

function roomStatusLabel(room: Room) {
  if (room.confirmedScheduleId || room.status === 'completed') return '확정 완료';
  if (room.hasGeneratedSchedule) return '일정 선택 대기';
  if (room.status === 'ready') return '일정 생성 가능';
  return '대기 중';
}

function roomStatusClassName(room: Room) {
  if (room.confirmedScheduleId || room.status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (room.hasGeneratedSchedule) return 'bg-purple-50 text-purple-700 ring-purple-100';
  if (room.status === 'ready') return 'bg-blue-50 text-blue-700 ring-blue-100';
  return 'bg-amber-50 text-amber-700 ring-amber-100';
}

function archivedRoomsFrom(rooms: Room[]) {
  return rooms.filter((room) => typeof room.confirmedScheduleId === 'number');
}

function albumHref(room: Room) {
  return `/schedules/${room.confirmedScheduleId}/album`;
}

export default function MyPage() {
  const router = useRouter();
  const { user, setUser, clear, setCurrentRoom } = useAuthStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthSyncing, setOauthSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      const params = new URLSearchParams(window.location.search);
      const isOAuthReturn = params.get('login') === 'success';
      if (isOAuthReturn) setOauthSyncing(true);

      try {
        const res = await authApi.me();
        const serverUser = res.data?.data?.user;
        if (cancelled) return;
        if (serverUser && !serverUser.isGuest) {
          setUser(serverUser);
          if (isOAuthReturn) router.replace('/mypage');
          return;
        }
        setUser(null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setOauthSyncing(false);
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, [router, setUser]);

  useEffect(() => {
    if (!user || user.isGuest) {
      setRooms([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    roomApi.getMyRooms()
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data?.rooms;
        const nextRooms = Array.isArray(payload)
          ? payload.filter(isRoomPayload).map((room) => normalizeRoomSummary(room))
          : [];
        setRooms(nextRooms);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, '내 여행 계획을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setError('');

    try {
      const res = authMode === 'register'
        ? await authApi.register({ nickname: nickname.trim(), email, password })
        : await authApi.login({ email, password });
      const userData = res.data?.data?.user;
      if (!userData || userData.isGuest) {
        setUser(null);
        setError('마이페이지는 로그인한 계정으로만 사용할 수 있습니다.');
        return;
      }
      setUser(userData);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '인증에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // 로컬 세션은 항상 비워 재로그인을 가능하게 한다.
    } finally {
      clear();
      setRooms([]);
      setLoggingOut(false);
    }
  }

  const needsAuth = !user || user.isGuest;
  const archivedRooms = archivedRoomsFrom(rooms);

  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.back()} className="app-icon-button" aria-label="이전으로">
          <iconify-icon icon="solar:arrow-left-linear" width="22"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">마이페이지</div>
          <div className="app-topbar-meta">내 프로필과 참여 중인 여행 계획</div>
        </div>
        <div className="w-11 shrink-0" />
      </div>

      <div className="app-content py-24">
        {needsAuth ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] items-start">
            <section className="app-hero-panel animate-fadeInUp">
              <span className="app-kicker mb-5 bg-blue-50 text-blue-600 border-blue-100">
                <iconify-icon icon="solar:user-id-bold-duotone" width="14"></iconify-icon>
                Account
              </span>
              <h1 className="app-section-title mb-4">계정으로 로그인하면<br />여행 계획을 다시 찾을 수 있어요</h1>
              <p className="app-section-copy mb-8">
                초대 링크로 참여한 여행과 직접 만든 방을 한 곳에서 확인합니다. 소셜 로그인 후에도 이 페이지로 돌아옵니다.
              </p>
            </section>

            <div className="card-bezel w-full max-w-xl mx-auto animate-fadeInUp">
              <div className="card-bezel-inner p-8 md:p-10">
                <span className="app-kicker mb-4">{authMode === 'login' ? 'Login' : 'Signup'}</span>
                <h2 className="text-[28px] font-black tracking-tight text-zinc-900 mb-2">
                  {authMode === 'login' ? '로그인하고 마이페이지 보기' : '계정 만들고 시작하기'}
                </h2>
                <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-8">게스트 세션은 마이페이지를 사용할 수 없습니다.</p>

                <form onSubmit={handleAuth} className="flex flex-col gap-5">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">닉네임</label>
                      <input className="input-field" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} required />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">이메일</label>
                    <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">비밀번호</label>
                    <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                  </div>

                  {error && <div className="app-alert app-alert-danger"><p className="text-sm font-medium">{error}</p></div>}
                  {oauthSyncing && <div className="app-alert app-alert-warning"><p className="text-sm font-medium">소셜 로그인 세션을 확인하고 있습니다…</p></div>}

                  <button className="btn-primary" type="submit" disabled={authLoading || oauthSyncing}>
                    {authLoading ? '처리 중…' : authMode === 'login' ? '로그인' : '회원가입'}
                  </button>
                </form>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a href={authApi.getOAuthStartUrl('google', '/mypage')} className="btn-secondary justify-center gap-2">
                    <iconify-icon icon="logos:google-icon" width="20"></iconify-icon>
                    <span>Google</span>
                  </a>
                  <a href={authApi.getOAuthStartUrl('kakao', '/mypage')} className="btn-secondary justify-center gap-2">
                    <Image src="/icons/kakaotalk.svg" alt="" width={20} height={20} className="rounded-md" />
                    <span>Kakao</span>
                  </a>
                </div>

                <button type="button" className="mt-6 w-full text-sm font-semibold text-blue-600" onClick={() => { setError(''); setAuthMode((m) => m === 'login' ? 'register' : 'login'); }}>
                  {authMode === 'login' ? '새로운 계정 만들기' : '이미 계정이 있으신가요? 로그인'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_16px_42px_rgba(37,99,235,0.08)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="app-kicker mb-3 bg-blue-50 text-blue-600 border-blue-100">Profile</span>
                  <h1 className="text-3xl font-black tracking-tight text-zinc-900">{user.nickname}님</h1>
                  <p className="mt-2 text-sm font-normal text-zinc-700">{user.email ?? user.authProvider} 계정으로 로그인 중</p>
                </div>
                <button className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" type="button" onClick={handleLogout} disabled={loggingOut}>
                  {loggingOut ? '로그아웃 중…' : '로그아웃'}
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_16px_42px_rgba(16,185,129,0.08)]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                    <iconify-icon icon="solar:gallery-wide-bold-duotone" width="15"></iconify-icon>
                    나의 여행기
                  </span>
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900">나의 여행기</h2>
                  <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700 break-keep-all">
                    다녀온 여행의 확정 일정과 장소별 사진을 한 곳에 모아 여행기로 남깁니다. 사진을 올릴수록 우리만의 기록이 완성됩니다.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
                  <p className="text-sm font-normal text-zinc-700">기록된 여행</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{archivedRooms.length}</p>
                </div>
              </div>

              {loading ? (
                <p className="text-sm font-normal text-zinc-700">아카이브를 불러오는 중입니다…</p>
              ) : archivedRooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
                    <iconify-icon icon="solar:album-bold-duotone" width="24"></iconify-icon>
                  </div>
                  <p className="font-bold text-zinc-900">아직 남겨진 여행기가 없습니다.</p>
                  <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">일정을 확정한 뒤 장소별 사진을 올리면 이곳에 여행기가 쌓입니다.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {archivedRooms.map((room) => (
                    <Link key={room.roomId} href={albumHref(room)} className="spring group overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-[0_8px_22px_rgba(16,185,129,0.06)] hover:border-emerald-200">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
                          <iconify-icon icon="solar:album-bold-duotone" width="23"></iconify-icon>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">여행기</span>
                      </div>
                      <h3 className="truncate text-lg font-black text-zinc-900">{room.roomName ?? `${room.destination} 여행`}</h3>
                      <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">{formatTripDateRange(room.tripStartDate, room.tripEndDate, room.tripDate)}</p>
                      <div className="mt-5 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                        추억 여행기 열기
                        <iconify-icon icon="solar:alt-arrow-right-bold" width="13" className="transition-transform group-hover:translate-x-0.5"></iconify-icon>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700 ring-1 ring-blue-100">
                    <iconify-icon icon="solar:home-smile-angle-bold-duotone" width="15"></iconify-icon>
                    내 여행 계획
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900">내 여행 계획</h2>
                  <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">내가 만들었거나 참여 중인 방을 다시 열 수 있습니다.</p>
                </div>
                <Link href="/rooms/new" className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 sm:w-auto">새 방 만들기</Link>
              </div>

              {error && <div className="app-alert app-alert-danger mb-4"><p className="text-sm font-medium">{error}</p></div>}
              {loading ? (
                <p className="text-sm font-normal text-zinc-700">여행 계획을 불러오는 중입니다…</p>
              ) : rooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                  <p className="font-bold text-zinc-900">아직 참여 중인 여행 계획이 없습니다.</p>
                  <p className="mt-2 text-sm font-normal text-zinc-700">새 방을 만들거나 초대 링크로 참여해 보세요.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {rooms.map((room) => (
                    <Link key={room.roomId} href={roomEntryHref(room)} onClick={() => setCurrentRoom(room)} className="spring rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] hover:border-blue-200">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${roomStatusClassName(room)}`}>{roomStatusLabel(room)}</span>
                        <span className="text-xs font-semibold text-zinc-500">{room.memberCount}명</span>
                      </div>
                      <h3 className="truncate text-lg font-black text-zinc-900">{room.roomName ?? `${room.destination} 여행 계획`}</h3>
                      <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">{formatTripDateRange(room.tripStartDate, room.tripEndDate, room.tripDate)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
