import type { TptiResult, TptiScores, User } from '../types';
import { getCharacter } from './tpti';

type TptiPayload = {
  resultId?: unknown;
  userId?: unknown;
  nickname?: unknown;
  scores?: unknown;
  characterName?: unknown;
  characterEmoji?: unknown;
  createdAt?: unknown;
};

function isTptiScores(value: unknown): value is TptiScores {
  if (!value || typeof value !== 'object') return false;
  const scores = value as Partial<TptiScores>;
  return (
    typeof scores.mobility === 'number' &&
    typeof scores.photo === 'number' &&
    typeof scores.budget === 'number' &&
    typeof scores.theme === 'number'
  );
}

export function normalizeTptiResultPayload(payload: unknown, fallbackUser?: Pick<User, 'id' | 'nickname'> | null): TptiResult | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as TptiPayload;
  if (typeof data.resultId !== 'number' || data.resultId <= 0 || !isTptiScores(data.scores)) {
    return null;
  }

  const character = getCharacter(data.scores);
  return {
    resultId: data.resultId,
    userId: typeof data.userId === 'number' ? data.userId : fallbackUser?.id ?? 0,
    nickname: typeof data.nickname === 'string' ? data.nickname : fallbackUser?.nickname,
    scores: data.scores,
    characterName: typeof data.characterName === 'string' ? data.characterName : character.name,
    characterEmoji: typeof data.characterEmoji === 'string' ? data.characterEmoji : character.emoji,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
  };
}
