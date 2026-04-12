import type { Room } from '../types';
import { parseTripDateRange } from './date';

type RoomSummaryInput = Pick<
  Room,
  'roomId' | 'destination' | 'tripDate' | 'shareCode' | 'status' | 'hostUserId' | 'memberCount' | 'createdAt'
> & Partial<Pick<Room, 'tripStartDate' | 'tripEndDate'>>;

export function normalizeRoomSummary(input: RoomSummaryInput): Room {
  const parsedRange = parseTripDateRange(input.tripDate);

  return {
    ...input,
    tripStartDate: input.tripStartDate ?? parsedRange.tripStartDate,
    tripEndDate: input.tripEndDate ?? parsedRange.tripEndDate,
  };
}
