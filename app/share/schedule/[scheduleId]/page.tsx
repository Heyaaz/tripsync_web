import type { Metadata } from 'next';

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
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 16, color: '#64748B' }}>공유된 일정 페이지입니다.</p>
      <a href="/" style={{ color: '#3B82F6', fontWeight: 600 }}>TripSync에서 나만의 일정 만들기 →</a>
    </div>
  );
}
