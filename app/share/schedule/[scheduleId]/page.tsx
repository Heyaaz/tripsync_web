import type { Metadata } from 'next';
import Link from 'next/link';
import { OPTION_LABELS } from '@/lib/utils/tpti';
import type { ApiResponse, PublicShareSchedule } from '@/lib/types';

interface Props {
  params: Promise<{ scheduleId: string }>;
}

export const dynamic = 'force-dynamic';

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

async function fetchPublicSchedule(scheduleId: string) {
  const res = await fetch(`${getApiBaseUrl()}/api/share/schedules/${scheduleId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const payload = await res.json() as ApiResponse<PublicShareSchedule>;
  return payload.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scheduleId } = await params;
  const schedule = await fetchPublicSchedule(scheduleId).catch(() => null);
  const optionLabel = schedule ? OPTION_LABELS[schedule.optionType]?.label ?? '합의 일정' : '합의 일정';

  return {
    title: schedule
      ? `${schedule.destination} ${optionLabel} | TripSync`
      : `그룹 합의 여행 일정 #${scheduleId} | TripSync`,
    description: schedule
      ? `${schedule.destination} · ${schedule.tripDate} · TripSync가 만든 그룹 합의 일정`
      : 'TripSync AI가 만든 우리 그룹의 합의 여행 일정입니다.',
    openGraph: {
      title: schedule
        ? `${schedule.destination} ${optionLabel} 일정 | TripSync`
        : '우리 그룹 여행 일정이 확정됐어요! | TripSync',
      description: schedule
        ? `${schedule.summary} · ${schedule.tripDate}`
        : 'TripSync AI 합의 일정 — 모두가 만족하는 충남 여행 코스를 확인하세요.',
    },
  };
}

export default async function ShareSchedulePage({ params }: Props) {
  const { scheduleId } = await params;
  const schedule = await fetchPublicSchedule(scheduleId).catch(() => null);
  const optionMeta = schedule ? OPTION_LABELS[schedule.optionType] : null;

  if (!schedule) {
    return (
      <div className="app-shell app-page">
        <div className="app-content min-h-[100dvh] flex items-center justify-center py-16">
          <div className="card-bezel w-full max-w-lg">
            <div className="card-bezel-inner p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
                <iconify-icon icon="solar:danger-triangle-bold-duotone" width="30" className="text-red-500"></iconify-icon>
              </div>
              <span className="app-kicker mb-4 bg-red-50 text-red-600 border-red-100">Shared Schedule</span>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-3">공유 일정을 찾지 못했어요</h1>
              <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-8">
                링크가 만료되었거나 잘못되었을 수 있습니다. TripSync 앱에서 다시 공유 링크를 받아 주세요.
              </p>
              <Link href="/" className="btn-primary inline-flex w-auto px-6">
                TripSync 홈으로 가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell app-page">
      <div className="app-content min-h-[100dvh] py-14 md:py-20">
        <div className="max-w-3xl mx-auto space-y-6">
          <section className="card-bezel">
            <div className="card-bezel-inner p-7 md:p-9">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="app-kicker bg-emerald-50 text-emerald-600 border-emerald-100">
                  Shared Schedule
                </span>
                {optionMeta ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold"
                    style={{
                      color: optionMeta.color,
                      borderColor: `${optionMeta.color}33`,
                      backgroundColor: `${optionMeta.color}12`,
                    }}
                  >
                    {optionMeta.emoji} {optionMeta.label}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-semibold text-zinc-600">
                  그룹 만족도 {schedule.groupSatisfaction}%
                </span>
              </div>

              <h1 className="text-[30px] md:text-[36px] font-black tracking-tight text-zinc-900 break-keep-all mb-3">
                {schedule.destination} 합의 일정
              </h1>
              <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-6">
                {schedule.tripDate} · TripSync가 그룹 취향을 조율해 만든 읽기 전용 일정입니다.
              </p>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5">
                <p className="text-base font-semibold text-zinc-900 break-keep-all">{schedule.summary}</p>
                <p className="mt-2 text-sm font-normal text-zinc-700 leading-relaxed">
                  확정된 일정만 공유되며, 제안 단계의 참고안과는 구분되는 최종 버전입니다.
                </p>
              </div>
            </div>
          </section>

          <section className="card-app p-6 md:p-7">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-zinc-900">확정된 코스</h2>
                <p className="mt-1 text-sm font-normal text-zinc-700">공유 링크에서는 최종 선택된 흐름만 보여줍니다.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700 border border-blue-100">
                총 {schedule.slots.length}개 코스
              </span>
            </div>

            <div className="space-y-4">
              {schedule.slots.map((slot) => (
                <article
                  key={slot.orderIndex}
                  className="rounded-[24px] border border-zinc-200 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-700">
                        {slot.orderIndex}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-zinc-900">{slot.placeName || slot.place.name}</h3>
                        <p className="text-sm font-normal text-zinc-700 leading-relaxed">{slot.place.address}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {slot.place.isDepopulationArea ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                          로컬 픽
                        </span>
                      ) : null}
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] font-semibold text-zinc-600">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm font-normal text-zinc-700">
                    {typeof slot.place.latitude === 'number' && typeof slot.place.longitude === 'number' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1.5 border border-zinc-200">
                        <iconify-icon icon="solar:map-point-wave-bold-duotone" width="16"></iconify-icon>
                        좌표 포함
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1.5 border border-zinc-200">
                      <iconify-icon icon="solar:calendar-date-bold-duotone" width="16"></iconify-icon>
                      읽기 전용 공유 일정
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card-app p-6 md:p-7 text-center">
            <h2 className="text-lg font-black tracking-tight text-zinc-900 mb-2">TripSync에서 여행방을 만들어 보세요</h2>
            <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-6">
              TPTI 검사부터 갈등 지도, AI 합의 일정 제안까지 같은 흐름으로 바로 시작할 수 있습니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="btn-primary inline-flex w-auto px-6">
                TripSync 홈으로 가기
              </Link>
              <Link href="/rooms/new" className="btn-secondary inline-flex w-auto px-6">
                여행방 만들기
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
