import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRoomSummary } from '../../lib/utils/room';

test('normalizeRoomSummary parses a tripDate range when explicit dates are missing', () => {
  const result = normalizeRoomSummary({
    roomId: 1,
    destination: '충남',
    tripDate: '2026-04-14 ~ 2026-04-16',
    shareCode: 'ABC123',
    status: 'waiting',
    hostUserId: 10,
    memberCount: 3,
    createdAt: '2026-04-01T00:00:00.000Z',
  });

  assert.equal(result.tripStartDate, '2026-04-14');
  assert.equal(result.tripEndDate, '2026-04-16');
});

test('normalizeRoomSummary preserves explicit tripStartDate and tripEndDate', () => {
  const result = normalizeRoomSummary({
    roomId: 2,
    destination: '전주',
    tripDate: '2026-05-01 ~ 2026-05-03',
    tripStartDate: '2026-05-02',
    tripEndDate: '2026-05-04',
    shareCode: 'DEF456',
    status: 'ready',
    hostUserId: 12,
    memberCount: 4,
    createdAt: '2026-04-02T00:00:00.000Z',
  });

  assert.equal(result.tripStartDate, '2026-05-02');
  assert.equal(result.tripEndDate, '2026-05-04');
});

test('normalizeRoomSummary handles a single-day tripDate', () => {
  const result = normalizeRoomSummary({
    roomId: 3,
    destination: '대전',
    tripDate: '2026-06-10',
    shareCode: 'GHI789',
    status: 'completed',
    hostUserId: 14,
    memberCount: 2,
    createdAt: '2026-04-03T00:00:00.000Z',
  });

  assert.equal(result.tripStartDate, '2026-06-10');
  assert.equal(result.tripEndDate, '2026-06-10');
});
