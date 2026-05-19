'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { authApi, roomApi } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth';
import type { Room } from '@/lib/types';
import { formatTripDateRange } from '@/lib/utils/date';
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

function roomEntryLabel(room: Room) {
  if (room.confirmedScheduleId) return '확정 일정으로 이동';
  if (room.hasGeneratedSchedule) return '생성한 일정 이어보기';
  if (room.status === 'completed') return '확정 일정으로 이동';
  if (room.status === 'ready') return '궁합 지도에서 일정 만들기';
  return '방으로 다시 이동';
}

function roomStatusLabel(room: Room) {
  if (room.confirmedScheduleId) return '확정 완료';
  if (room.hasGeneratedSchedule) return '일정 선택 대기';
  if (room.status === 'completed') return '확정 완료';
  if (room.status === 'ready') return '일정 생성 가능';
  return '대기 중';
}

function roomStatusClassName(room: Room) {
  if (room.confirmedScheduleId) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (room.hasGeneratedSchedule) return 'bg-purple-50 text-purple-700 ring-purple-100';
  if (room.status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (room.status === 'ready') return 'bg-blue-50 text-blue-700 ring-blue-100';
  return 'bg-amber-50 text-amber-700 ring-amber-100';
}

function archivedRoomsFrom(rooms: Room[]) {
  return rooms.filter((room) => typeof room.confirmedScheduleId === 'number').slice(0, 3);
}

function albumHref(room: Room) {
  return `/schedules/${room.confirmedScheduleId}/album`;
}


function HomeAuthActions() {
  const { user, clear } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // 서버 세션 정리에 실패해도 홈에서는 로컬 세션을 먼저 비워 재로그인을 가능하게 한다.
    } finally {
      clear();
      setLoggingOut(false);
    }
  }

  if (!user || user.isGuest) {
    return (
      <Link
        href="/rooms/new"
        className="spring flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-800 shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/mypage"
        className="spring hidden max-w-[140px] truncate rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-[13px] font-bold text-blue-700 shadow-[0_2px_8px_rgba(37,99,235,0.08)] sm:inline-flex"
      >
        {user.nickname} · 마이페이지
      </Link>
      <Link
        href="/mypage"
        className="spring inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-[0_2px_8px_rgba(37,99,235,0.08)] sm:hidden"
      >
        마이페이지
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="spring flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-800 shadow-[0_2px_8px_rgba(15,23,42,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loggingOut ? '로그아웃 중' : '로그아웃'}
      </button>
    </div>
  );
}

function MyRoomsPanel() {
  const { user, currentRoom, setCurrentRoom } = useAuthStore();
  const currentRoomRef = useRef<Room | null>(currentRoom);
  const [rooms, setRooms] = useState<Room[]>(() => (currentRoom ? [currentRoom] : []));

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    if (!user || user.isGuest) {
      return;
    }

    let cancelled = false;

    roomApi.getMyRooms()
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data?.rooms;
        const nextRooms = Array.isArray(payload)
          ? payload.filter(isRoomPayload).map((room) => normalizeRoomSummary(room))
          : [];
        setRooms(nextRooms);
        if (nextRooms[0]) setCurrentRoom(nextRooms[0]);
      })
      .catch(() => {
        if (!cancelled) setRooms(currentRoomRef.current ? [currentRoomRef.current] : []);
      });

    return () => {
      cancelled = true;
    };
  }, [setCurrentRoom, user]);

  const allRooms = useMemo(() => {
    const byId = new Map<number, Room>();
    rooms.forEach((room) => byId.set(room.roomId, room));
    if (currentRoom) byId.set(currentRoom.roomId, byId.get(currentRoom.roomId) ?? currentRoom);
    return Array.from(byId.values()).sort((a, b) => b.roomId - a.roomId);
  }, [currentRoom, rooms]);

  const visibleRooms = useMemo(() => allRooms.slice(0, 3), [allRooms]);
  const archivedRooms = useMemo(() => archivedRoomsFrom(allRooms), [allRooms]);

  if ((!user || user.isGuest) && visibleRooms.length === 0) return null;

  return (
    <section className="mb-24 space-y-5">
      {archivedRooms.length > 0 ? (
        <div className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_16px_42px_rgba(16,185,129,0.08)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                <iconify-icon icon="solar:gallery-wide-bold-duotone" width="15"></iconify-icon>
                나의 여행기
              </div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">나의 여행기</h2>
              <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700 break-keep-all">
                다녀온 여행의 사진과 장소별 순간을 홈에서 바로 다시 꺼내볼 수 있습니다.
              </p>
            </div>
            <Link href="/mypage" className="text-sm font-bold text-emerald-700">마이페이지에서 모두 보기</Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {archivedRooms.map((room) => (
              <Link
                key={room.roomId}
                href={albumHref(room)}
                className="spring group overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-[0_8px_22px_rgba(16,185,129,0.06)] hover:border-emerald-200"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
                  <iconify-icon icon="solar:album-bold-duotone" width="23"></iconify-icon>
                </div>
                <h3 className="truncate text-lg font-black text-zinc-900">{room.roomName ?? `${room.destination} 여행`}</h3>
                <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">
                  {formatTripDateRange(room.tripStartDate, room.tripEndDate, room.tripDate)}
                </p>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                  여행기 열기
                  <iconify-icon icon="solar:alt-arrow-right-bold" width="13" className="transition-transform group-hover:translate-x-0.5"></iconify-icon>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_16px_42px_rgba(37,99,235,0.08)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700 ring-1 ring-blue-100">
            <iconify-icon icon="solar:home-smile-angle-bold-duotone" width="15"></iconify-icon>
            내 여행 계획
          </div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900">내 여행 계획으로 다시 이동</h2>
          <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700 break-keep-all">
            홈으로 돌아와도 참여 중인 여행 계획을 바로 이어서 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/mypage" className="spring inline-flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
            전체보기
            <iconify-icon icon="solar:alt-arrow-right-bold" width="13"></iconify-icon>
          </Link>
          <Link href="/rooms/new" className="spring inline-flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(15,23,42,0.18)]">
            새 방 만들기
            <iconify-icon icon="solar:add-circle-bold" width="15"></iconify-icon>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {visibleRooms.map((room) => (
          <Link
            key={room.roomId}
            href={roomEntryHref(room)}
            className="spring group rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] hover:border-blue-200"
            onClick={() => setCurrentRoom(room)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${roomStatusClassName(room)}`}>
                {roomStatusLabel(room)}
              </span>
              <span className="text-xs font-semibold text-zinc-500">{room.memberCount}명</span>
            </div>
            <h3 className="truncate text-lg font-black text-zinc-900">{room.roomName ?? `${room.destination} 여행 계획`}</h3>
            <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">
                {formatTripDateRange(room.tripStartDate, room.tripEndDate, room.tripDate)}
            </p>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-bold text-blue-600">
              {roomEntryLabel(room)}
              <iconify-icon icon="solar:alt-arrow-right-bold" width="13" className="transition-transform group-hover:translate-x-0.5"></iconify-icon>
            </div>
          </Link>
        ))}
      </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.is-visible { opacity: 1; transform: translateY(0); }
        .d1 { transition-delay: 80ms; }
        .d2 { transition-delay: 160ms; }
        .d3 { transition-delay: 240ms; }
        .d4 { transition-delay: 320ms; }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .glow-a { animation: glow-pulse 6s ease-in-out infinite; }
        .glow-b { animation: glow-pulse 8s ease-in-out infinite; animation-delay: -3s; }
        .glow-c { animation: glow-pulse 7s ease-in-out infinite; animation-delay: -5s; }

        .spring {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      background-color 0.2s ease;
        }
        .spring:hover { transform: translateY(-2px); }
        .spring:active { transform: scale(0.97); }

        .card-lift {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 24px 60px -12px rgba(0,0,0,0.1);
        }

        .gradient-text {
          background: linear-gradient(130deg, #2563EB 0%, #7C3AED 55%, #0EA5E9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: saturate(1.05);
        }
      `}</style>

      <div className="min-h-[100dvh] bg-[#f7f8fb] selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">

        {/* Ambient blobs */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <div className="glow-a absolute -top-56 -right-56 w-[680px] h-[680px] rounded-full bg-blue-300/14 blur-[120px]" />
          <div className="glow-b absolute top-1/2 -left-72 w-[540px] h-[540px] rounded-full bg-violet-300/10 blur-[108px]" />
          <div className="glow-c absolute bottom-0 right-1/3 w-[460px] h-[460px] rounded-full bg-sky-300/10 blur-[92px]" />
        </div>

        {/* Nav */}
        <header className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none">
          <nav className="flex items-center gap-5 bg-white px-5 py-2.5 rounded-2xl border border-zinc-200 shadow-[0_8px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.92)] pointer-events-auto transition-shadow duration-300 hover:shadow-[0_10px_34px_rgba(15,23,42,0.1)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.45)]">
              <iconify-icon icon="solar:routing-3-bold" width="16" style={{ color: 'white' }}></iconify-icon>
              </div>
              <span className="font-black text-sm tracking-tight text-zinc-900">TripSync</span>
            </div>
            <div className="w-px h-4 bg-zinc-200" />
            <Link href="/tpti" className="text-[13px] font-medium text-zinc-700 hover:text-zinc-900 transition-colors duration-200">
              여행 MBTI 검사
            </Link>
            <Link
              href="/rooms/new"
              className="spring flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
            >
              여행 시작
              <iconify-icon icon="solar:alt-arrow-right-bold" width="11"></iconify-icon>
            </Link>
            <HomeAuthActions />
          </nav>
        </header>

        <main className="relative z-10 max-w-5xl mx-auto px-6 sm:px-8">

          {/* ── Hero ── */}
          <section className="min-h-[100dvh] flex flex-col items-center justify-center text-center pt-24 pb-24">

            <h1 className="reveal d1 text-[52px] md:text-[68px] lg:text-[80px] font-black tracking-tight leading-[1.04] text-zinc-900 mb-7 break-keep-all">
              그룹과의 여행,<br />
              <span className="gradient-text">취향 조화</span>롭게.
            </h1>

            <p className="reveal d2 text-[17px] md:text-lg text-zinc-700 font-medium max-w-lg mx-auto leading-relaxed mb-10 break-keep-all">
              서로 다른 여행 스타일을 여행 MBTI로 분석하고,<br />
              TripSync가 모두가 만족할 합의 일정을 만들어 드립니다.
            </p>

            <div className="reveal d3 flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-16">
              <Link
                href="/rooms/new"
                className="spring px-8 py-4 rounded-2xl bg-zinc-900 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(0,0,0,0.2)]"
              >
                여행 계획 만들기
              <iconify-icon icon="solar:round-alt-arrow-right-linear" width="17"></iconify-icon>
              </Link>
              <Link
                href="/tpti"
                className="spring px-8 py-4 rounded-2xl bg-white text-zinc-900 font-bold text-[15px] flex items-center justify-center border border-zinc-200 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
              >
                내 여행 성향 알아보기
              </Link>
            </div>

            {/* Feature Pillars - meaningful, not fake stats */}
            <div className="reveal d4 w-full bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
              {[
                { icon: 'solar:compass-bold-duotone', color: '#2563EB', bg: 'bg-blue-50', label: '여행 MBTI 4개 축 분석', desc: '활동성·기록·예산·테마' },
                { icon: 'solar:danger-triangle-bold-duotone', color: '#EA580C', bg: 'bg-orange-50', label: '그룹 궁합 시각화', desc: '취향 차이 한눈에 확인' },
                { icon: 'solar:magic-stick-3-bold-duotone', color: '#7C3AED', bg: 'bg-violet-50', label: 'AI 합의 일정 3종', desc: '모두 만족하는 선택지' },
              ].map((item) => (
                <div key={item.label} className="flex-1 flex items-center gap-3 py-5 px-6">
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <iconify-icon icon={item.icon} width="20" style={{ color: item.color }}></iconify-icon>
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-semibold text-zinc-900">{item.label}</div>
                    <div className="text-[13px] text-zinc-800 font-normal tracking-normal">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <MyRoomsPanel />

          {/* ── How It Works ── */}
          <section className="mb-32">
            <div className="reveal text-center mb-14">
              <div className="text-sm font-medium text-zinc-600 mb-3">이렇게 작동합니다</div>
              <h2 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight break-keep-all">
                3단계로 완성되는<br />그룹 여행 플래너
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  step: '01',
                  icon: 'solar:compass-bold-duotone',
                  color: '#2563EB',
                  bg: 'bg-blue-50',
                  border: 'border-blue-100',
                  title: '여행 MBTI 검사',
                  desc: '8개 질문으로 나의 여행 성향을 분석합니다. 활동성·기록·예산·테마 4개 축으로 정확하게 측정해요.',
                  href: '/tpti',
                  cta: '검사 시작',
                  ctaColor: 'text-blue-600',
                },
                {
                  step: '02',
                  icon: 'solar:danger-triangle-bold-duotone',
                  color: '#EA580C',
                  bg: 'bg-orange-50',
                  border: 'border-orange-100',
                  title: '궁합 확인',
                  desc: '동행자들의 성향을 비교해 서로의 취향 차이를 한눈에 확인합니다. 함께 맞춰가기 쉬워져요.',
                  href: '/rooms/new',
                  cta: '방 만들기',
                  ctaColor: 'text-orange-600',
                },
                {
                  step: '03',
                  icon: 'solar:magic-stick-3-bold-duotone',
                  color: '#7C3AED',
                  bg: 'bg-violet-50',
                  border: 'border-violet-100',
                  title: 'AI 합의 일정 생성',
                  desc: 'AI가 모두의 취향을 고려해 3가지 맞춤 일정을 제안합니다. 다같이 고르기만 하면 끝.',
                  href: '/rooms/new',
                  cta: '일정 만들기',
                  ctaColor: 'text-violet-600',
                },
              ].map((item, i) => (
                <div key={item.step} className="reveal card-lift flex h-full flex-col bg-white rounded-2xl p-7 border border-zinc-200/70 relative overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-25 blur-2xl pointer-events-none" style={{ backgroundColor: item.color }} />
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center border ${item.border}`}>
                      <iconify-icon icon={item.icon} width="22" style={{ color: item.color }}></iconify-icon>
                      </div>
                      <span className="text-[28px] font-black text-zinc-500 leading-none">{item.step}</span>
                    </div>
                    <h3 className="text-lg font-black text-zinc-900 mb-2.5 tracking-tight">{item.title}</h3>
                    <p className="text-zinc-800 text-[14px] leading-relaxed break-keep-all pb-6 font-normal tracking-normal">{item.desc}</p>
                    <Link href={item.href} className={`mt-auto flex items-center gap-1 text-[13px] font-medium ${item.ctaColor}`}>
                      {item.cta}
                    <iconify-icon icon="solar:alt-arrow-right-bold" width="11"></iconify-icon>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Consensus Engine Feature ── */}
          <div className="mb-16">
            <div className="reveal bg-white rounded-[32px] p-8 md:p-14 flex flex-col lg:flex-row items-start gap-12 overflow-hidden relative border border-zinc-200 shadow-[0_14px_42px_rgba(15,23,42,0.06)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(37,99,235,0.04),transparent_50%)] pointer-events-none" />

              <div className="relative z-10 flex-1">
                <div className="inline-flex h-7 items-center px-3 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium uppercase tracking-[0.16em] mb-6 border border-emerald-100">
                  Consensus Engine
                </div>
                <h3 className="text-3xl md:text-[42px] font-black text-zinc-900 mb-5 leading-[1.1] tracking-tight break-keep-all">
                  아무도 소외되지 않는<br />여행 일정을 만듭니다.
                </h3>
                <p className="text-zinc-800 text-[16px] leading-relaxed break-keep-all max-w-md font-normal tracking-normal mb-8">
                  전국 명소 데이터를 기반으로 그룹 구성원의 취향 궁합을 분석해,<br />
                  AI가 3가지 맞춤 여행 코스를 제안합니다.
                </p>
                <Link
                  href="/rooms/new"
                  className="spring inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-colors duration-200"
                >
                  지금 바로 시작
                <iconify-icon icon="solar:alt-arrow-right-bold" width="13"></iconify-icon>
                </Link>
              </div>

              {/* Feature list panel */}
              <div className="relative z-10 w-full lg:w-[280px] flex-shrink-0 space-y-3">
                {[
                  { icon: 'solar:sort-by-time-bold-duotone', label: '취향 슬롯 배분', desc: '취향 차이 기반 슬롯 우선순위 배분', color: '#10B981', bg: '#f0fdf4', border: '#d1fae5' },
                  { icon: 'solar:users-group-rounded-bold-duotone', label: '최저 만족도 최대화', desc: '모두의 만족도 기준 최적화', color: '#2563EB', bg: '#eff6ff', border: '#dbeafe' },
                  { icon: 'solar:diploma-bold-duotone', label: '3종 옵션 생성', desc: '균형형 · 개성형 · 지역 발굴형', color: '#7C3AED', bg: '#f5f3ff', border: '#ede9fe' },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3 rounded-xl p-4 border" style={{ backgroundColor: f.bg, borderColor: f.border }}>
                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                    <iconify-icon icon={f.icon} width="18" style={{ color: f.color }}></iconify-icon>
                    </div>
                    <div>
                      <div className="text-zinc-900 text-[14px] font-semibold mb-0.5">{f.label}</div>
                      <div className="text-zinc-700 text-[14px] leading-relaxed font-normal tracking-normal">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <section
            className="reveal text-center py-12 rounded-[28px] px-8 mb-16 relative overflow-hidden"
            style={{ background: 'linear-gradient(140deg, #1e3a8a 0%, #1d4ed8 45%, #3b82f6 100%)' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(255,255,255,0.07),transparent_55%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-3 break-keep-all">
                여행 계획, 함께 완성해 보세요.
              </h2>
            <p className="text-blue-50/92 text-[15px] font-medium mb-7 break-keep-all">
                여행 계획을 만들고 링크를 공유하면 끝 — 나머지는 TripSync와 함께 하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
                <Link
                  href="/rooms/new"
                  className="spring inline-flex px-6 py-3 items-center justify-center bg-white text-blue-700 rounded-xl font-bold text-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] gap-1.5"
                >
                  여행 계획 만들기
                <iconify-icon icon="solar:alt-arrow-right-bold" width="13"></iconify-icon>
                </Link>
                <Link
                  href="/tpti"
                  className="spring inline-flex px-6 py-3 items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm border border-white/20 transition-colors duration-200"
                >
                  여행 MBTI 먼저 해보기
                </Link>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-10 border-t border-zinc-200/50 flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
              <iconify-icon icon="solar:routing-3-bold" width="13" style={{ color: 'white' }}></iconify-icon>
              </div>
              <span className="font-black text-sm text-zinc-900">TripSync</span>
            </div>
            <p className="text-[13px] font-normal text-zinc-700">© 2026 TripSync</p>
            <div className="flex gap-4 text-zinc-500">
              <iconify-icon icon="solar:figma-bold" width="17" className="cursor-pointer hover:text-zinc-600 transition-colors duration-200"></iconify-icon>
              <iconify-icon icon="solar:github-bold" width="17" className="cursor-pointer hover:text-zinc-600 transition-colors duration-200"></iconify-icon>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
