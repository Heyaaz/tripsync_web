import type { Metadata } from 'next';
import Link from 'next/link';

interface Props { params: Promise<{ scheduleId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scheduleId } = await params;
  return {
    title: `그룹 합의 여행 일정 #${scheduleId} | TripSync`,
    description: 'TripSync AI가 만든 우리 그룹의 합의 여행 일정입니다.',
    openGraph: {
      title: '우리 그룹 여행 일정이 확정됐어요! | TripSync',
      description: 'TripSync AI 합의 일정 — 모두가 만족하는 충남 여행 코스를 확인하세요.',
    },
  };
}

export default function ShareSchedulePage() {
  return (
    <div className="app-shell app-page">
      <div className="app-content min-h-[100dvh] flex items-center justify-center py-16">
        <div className="card-bezel w-full max-w-lg">
          <div className="card-bezel-inner p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-6">
              <iconify-icon icon="solar:calendar-date-bold-duotone" width="30" className="text-emerald-500"></iconify-icon>
            </div>
            <span className="app-kicker mb-4 bg-emerald-50 text-emerald-600 border-emerald-100">Shared Schedule</span>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-3">공유된 여행 일정입니다</h1>
            <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-8">
              TripSync 앱에서 일정 옵션 비교, 합의 과정, 방 참여 흐름까지 함께 확인할 수 있습니다.
            </p>
            <Link href="/" className="btn-primary inline-flex w-auto px-6">
              TripSync에서 일정 만들기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
