'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AXIS_LABELS } from '@/lib/utils/tpti';
import type { TptiScores } from '@/lib/types';

interface TptiRadarChartProps {
  memberScores: Array<{
    userId: number;
    nickname: string;
    scores: TptiScores;
    color: string;
  }>;
  size?: number;
}

const AXES = ['mobility', 'photo', 'budget', 'theme'] as const;
const MEMBER_COLORS = ['#2563EB', '#7C3AED', '#EA580C', '#059669', '#D97706'];

export function TptiRadarChart({ memberScores, size = 280 }: TptiRadarChartProps) {
  const data = AXES.map((axis) => ({
    axis: AXIS_LABELS[axis],
    ...Object.fromEntries(memberScores.map((m) => [m.nickname, m.scores[axis]])),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid gridType="polygon" stroke="#e4e4e7" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: '#71717a', fontSize: 13, fontFamily: 'Pretendard', fontWeight: 600 }}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'Pretendard',
            color: '#18181b',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        />
        {memberScores.map((member, i) => (
          <Radar
            key={member.userId}
            name={member.nickname}
            dataKey={member.nickname}
            stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
            fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}

export { MEMBER_COLORS };
