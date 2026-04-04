'use client';

import { AXIS_LABELS, AXIS_COLORS } from '@/lib/utils/tpti';
import type { TptiScores } from '@/lib/types';

interface ScoreBarsProps {
  scores: TptiScores;
  animated?: boolean;
}

const AXES = ['mobility', 'photo', 'budget', 'theme'] as const;

export function ScoreBars({ scores, animated = true }: ScoreBarsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {AXES.map((axis) => {
        const score = scores[axis];
        const color = AXIS_COLORS[axis];
        return (
          <div key={axis}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="text-zinc-700 font-bold text-sm">
                {AXIS_LABELS[axis]}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color }}>
                {score}
              </span>
            </div>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: animated ? `${score}%` : `${score}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
