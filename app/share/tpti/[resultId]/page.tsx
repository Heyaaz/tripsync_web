import type { Metadata } from 'next';
import Link from 'next/link';
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
          description: 'TripSync 여행 MBTI 검사로 여행 취향을 알아보세요!',
        },
      };
    }
  } catch { /* fallback */ }
  return { title: '여행 MBTI 여행 유형 결과 | TripSync' };
}

export default function ShareTptiPage() {
  return (
    <div className="app-shell app-page">
      <div className="app-content min-h-[100dvh] flex items-center justify-center py-16">
        <div className="card-bezel w-full max-w-lg">
          <div className="card-bezel-inner p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
              <iconify-icon icon="solar:compass-bold-duotone" width="30" className="text-blue-500"></iconify-icon>
            </div>
            <span className="app-kicker mb-4">Shared Result</span>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-3">공유된 여행 MBTI 결과입니다</h1>
            <p className="text-sm font-normal text-zinc-700 leading-relaxed mb-8">
              더 자세한 결과 해석과 여행 계획 연결은 TripSync 앱 화면에서 확인할 수 있습니다.
            </p>
            <Link href="/" className="btn-primary inline-flex w-auto px-6">
              TripSync 홈으로 이동
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
