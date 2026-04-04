import type { TptiScores } from '../types';

// ─── TPTI 8문항 정의 ──────────────────────────────────────
export const TPTI_QUESTIONS = [
  {
    id: 1,
    axis: 'mobility' as const,
    reverseScored: false,
    text: '여행 첫날, 숙소 도착 후 당신은?',
    optionHigh: '바로 근처 마을 탐방 나선다',
    optionLow: '숙소에서 쉬며 내일을 아낀다',
  },
  {
    id: 2,
    axis: 'mobility' as const,
    reverseScored: false,
    text: '여행 중 예상치 못한 골목을 발견했다면?',
    optionHigh: '무조건 들어가 본다',
    optionLow: '일정대로 가는 게 편하다',
  },
  {
    id: 3,
    axis: 'photo' as const,
    reverseScored: false,
    text: '멋진 풍경을 마주쳤을 때 당신은?',
    optionHigh: '인생샷 찍으려 자리 잡는다',
    optionLow: '그냥 눈으로 담는다',
  },
  {
    id: 4,
    axis: 'photo' as const,
    reverseScored: false,
    text: '여행 끝나고 SNS에 올릴 사진은?',
    optionHigh: '최대한 많이 찍어둔다',
    optionLow: '한두 장만 찍으면 충분하다',
  },
  {
    id: 5,
    axis: 'budget' as const,
    reverseScored: false,
    text: '맛집 vs 가성비 식당, 선택은?',
    optionHigh: '비싸도 유명 맛집을 간다',
    optionLow: '저렴하고 든든한 곳이 좋다',
  },
  {
    id: 6,
    axis: 'budget' as const,
    reverseScored: false,
    text: '여행 기념품을 고를 때 당신은?',
    optionHigh: '좋으면 망설임 없이 산다',
    optionLow: '실용적인 것만, 최대한 아낀다',
  },
  {
    id: 7,
    axis: 'theme' as const,
    reverseScored: false,
    text: '여행지에서 더 끌리는 테마는?',
    optionHigh: '역사·문화 탐방 (유적지, 박물관)',
    optionLow: '자연·힐링 (해변, 산, 공원)',
  },
  {
    id: 8,
    axis: 'theme' as const,
    reverseScored: false,
    text: '하루 일정의 분위기는?',
    optionHigh: '카페·맛집·핫플 위주 도심형',
    optionLow: '걷기·경치·자연 위주 힐링형',
  },
];

// ─── 리커트 응답값 → 점수(0~100) ─────────────────────────
// 선택지 1=완전 저점, 5=완전 고점 (정규화)
export function likertToScore(value: number): number {
  return Math.round(((value - 1) / 4) * 100);
}

// ─── 축 점수 계산 ─────────────────────────────────────────
export function calculateScores(answers: number[]): TptiScores {
  const axisMaps: Record<string, number[]> = {
    mobility: [0, 1],    // Q1, Q2
    photo: [2, 3],       // Q3, Q4
    budget: [4, 5],      // Q5, Q6
    theme: [6, 7],       // Q7, Q8
  };

  const result: TptiScores = { mobility: 0, photo: 0, budget: 0, theme: 0 };

  for (const [axis, indices] of Object.entries(axisMaps)) {
    const scores = indices.map((i) => {
      const q = TPTI_QUESTIONS[i];
      const raw = q.reverseScored ? 6 - answers[i] : answers[i];
      return likertToScore(raw);
    });
    result[axis as keyof TptiScores] = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
  }

  return result;
}

// ─── 캐릭터 별명 매핑 ────────────────────────────────────
const CHARACTER_MAP: Record<string, { name: string; emoji: string; desc: string; gradient: number }> = {
  'WALC': { name: '감성 플렉서', emoji: '🏙️', desc: '도심 핫플에서 인생샷, 돈 아끼지 않는 감성 여행자', gradient: 1 },
  'WALN': { name: '자연 아티스트', emoji: '🌿', desc: '자연 속 인생샷, 좋은 곳엔 아낌없이 투자', gradient: 4 },
  'WACC': { name: '도심 사진작가', emoji: '📸', desc: '가성비 핫플에서 인생샷 건지는 알뜰 감성러', gradient: 3 },
  'WACN': { name: '뚜벅이 탐험가', emoji: '🥾', desc: '자연 속 알뜰 여행, 걸으며 사진 찍는 탐험가', gradient: 4 },
  'WELC': { name: '도심 체험러', emoji: '🎯', desc: '핫한 곳 직접 경험, 사진보다 기억이 중요', gradient: 1 },
  'WELN': { name: '자연 힐링러', emoji: '🌲', desc: '자연 속 고급 휴식, 눈으로 담는 여유', gradient: 4 },
  'WECC': { name: '알뜰 도시 여행자', emoji: '🚶', desc: '돈 아끼며 도심 구석구석 탐방', gradient: 8 },
  'WECN': { name: '자연 탐방가', emoji: '🌾', desc: '가성비 자연 여행, 걷기 좋아하는 실속파', gradient: 4 },
  'SALC': { name: '럭셔리 인플루언서', emoji: '✨', desc: '고급 도심 숙소에서 인생샷, 여행=콘텐츠', gradient: 5 },
  'SALN': { name: '프리미엄 감성 캠퍼', emoji: '🏕️', desc: '자연 속 고급 글램핑, SNS 감성 충전', gradient: 6 },
  'SACC': { name: '알뜰 콘텐츠 크리에이터', emoji: '📱', desc: '가성비 숙소에서도 인생샷 건지는 SNS러', gradient: 2 },
  'SACN': { name: '자연 감성 사진가', emoji: '🌅', desc: '자연 속 여유로운 인생샷, 알뜰하게', gradient: 4 },
  'SELC': { name: '도심 호캉스 귀족', emoji: '👑', desc: '고급 도심 호텔에서 완전 휴식, 사진은 패스', gradient: 7 },
  'SELN': { name: '프리미엄 자연 힐러', emoji: '🧘', desc: '자연 속 고급 리조트에서 진짜 힐링', gradient: 4 },
  'SECC': { name: '가성비 도심 휴식러', emoji: '🛋️', desc: '저렴하게 도심 숙소에서 충전하는 현실파', gradient: 3 },
  'SECN': { name: '자연 속 은둔자', emoji: '🌙', desc: '저렴한 자연 속 숙소에서 조용히 쉬는 내향인', gradient: 6 },
};

export function getCharacter(scores: TptiScores) {
  const m = scores.mobility >= 50 ? 'W' : 'S';
  const p = scores.photo >= 50 ? 'A' : 'E';
  const b = scores.budget >= 50 ? 'L' : 'C';
  const t = scores.theme >= 50 ? 'C' : 'N';
  const key = `${m}${p}${b}${t}`;
  return {
    ...(CHARACTER_MAP[key] || { name: '자유로운 여행자', emoji: '🗺️', desc: '나만의 스타일로 여행하는 자유인', gradient: 1 }),
    key,
  };
}

// ─── 축 한글 이름 ─────────────────────────────────────────
export const AXIS_LABELS: Record<string, string> = {
  mobility: '활동성',
  photo: '기록',
  budget: '예산',
  theme: '테마',
};

export const AXIS_DESCRIPTIONS: Record<string, { high: string; low: string }> = {
  mobility: { high: '뚜벅이 탐험형', low: '호캉스 휴식형' },
  photo: { high: '인생샷 SNS형', low: '눈으로 담는 실속형' },
  budget: { high: '가심비 플렉스형', low: '가성비 절약형' },
  theme: { high: '도심 핫플형', low: '자연 힐링형' },
};

export const AXIS_COLORS: Record<string, string> = {
  mobility: '#3B82F6',
  photo: '#8B5CF6',
  budget: '#F59E0B',
  theme: '#10B981',
};

// ─── 갈등 심각도 판정 ─────────────────────────────────────
export function getSeverity(gap: number): 'none' | 'minor' | 'moderate' | 'critical' {
  if (gap <= 20) return 'none';
  if (gap <= 40) return 'minor';
  if (gap <= 60) return 'moderate';
  return 'critical';
}

export const SEVERITY_LABELS: Record<string, string> = {
  none: '공통 지대',
  minor: '경미한 차이',
  moderate: '조율 필요',
  critical: '심각한 충돌',
};

export const SEVERITY_COLORS: Record<string, string> = {
  none: '#10B981',
  minor: '#F59E0B',
  moderate: '#F97316',
  critical: '#EF4444',
};

export const SEVERITY_BG: Record<string, string> = {
  none: '#ECFDF5',
  minor: '#FFFBEB',
  moderate: '#FFF7ED',
  critical: '#FEF2F2',
};

export const SEVERITY_ICONS: Record<string, string> = {
  none: '🟢',
  minor: '🟡',
  moderate: '🟠',
  critical: '🔴',
};

// ─── 일정 옵션 라벨 ──────────────────────────────────────
export const OPTION_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  balanced: { label: '균형형', emoji: '⚖️', color: '#3B82F6' },
  individual: { label: '개성형', emoji: '🎭', color: '#8B5CF6' },
  discovery: { label: '지역 발굴형', emoji: '🗺️', color: '#10B981' },
};
