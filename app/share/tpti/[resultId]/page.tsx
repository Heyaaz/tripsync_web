import type { Metadata } from 'next';
import { tptiApi } from '@/lib/api/client';

interface Props { params: Promise<{ resultId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resultId } = await params;
  try {
    const res = await tptiApi.getShareResult(Number(resultId));
    const data = res.data?.data;
    if (data) {
      return {
        title: `${data.nickname}의 여행 유형 — ${data.characterName} | TripSync`,
        description: `활동성 ${data.scores.mobility} · 기록 ${data.scores.photo} · 예산 ${data.scores.budget} · 테마 ${data.scores.theme}`,
        openGraph: {
          title: `나의 여행 유형은? ${data.characterName}`,
          description: 'TripSync TPTI 검사로 여행 취향을 알아보세요!',
        },
      };
    }
  } catch { /* fallback */ }
  return { title: 'TPTI 여행 유형 결과 | TripSync' };
}

export default function ShareTptiPage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 16, color: '#64748B' }}>공유 페이지는 앱에서 확인하세요.</p>
      <a href="/" style={{ color: '#3B82F6', fontWeight: 600 }}>TripSync 홈으로 →</a>
    </div>
  );
}
