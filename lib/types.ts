// ============================================================
// TripSync 공통 타입 정의
// ============================================================

export interface User {
  id: number;
  nickname: string;
  email?: string;
  isGuest: boolean;
  authProvider: 'local' | 'google' | 'kakao' | 'guest';
  profileImageUrl?: string;
}

// ─── TPTI ─────────────────────────────────────────────────
export interface TptiScores {
  mobility: number;  // 0~100 (0=Stay, 100=Walker)
  photo: number;     // 0~100 (0=Eyes, 100=Artist)
  budget: number;    // 0~100 (0=Cost-effective, 100=Luxury)
  theme: number;     // 0~100 (0=Nature, 100=City)
}

export interface TptiQuestion {
  id: number;
  axis: 'mobility' | 'photo' | 'budget' | 'theme';
  reverseScored: boolean;
  text: string;
  optionHigh: string;
  optionLow: string;
}

export interface TptiResult {
  resultId: number;
  userId: number;
  nickname?: string;
  scores: TptiScores;
  characterName: string;
  characterEmoji: string;
  createdAt?: string;
}

// ─── 여행 방 ──────────────────────────────────────────────
export type RoomStatus = 'waiting' | 'ready' | 'completed';

export interface Room {
  roomId: number;
  roomName?: string;
  destination: string;
  tripDate: string;
  tripStartDate?: string;
  tripEndDate?: string;
  shareCode: string;
  status: RoomStatus;
  hostUserId: number;
  memberCount: number;
  createdAt: string;
  hasGeneratedSchedule?: boolean;
  confirmedScheduleId?: number | null;
  latestScheduleVersion?: number | null;
  scheduleState?: {
    status: 'empty' | 'generated' | 'confirmed';
    confirmedSchedule?: Schedule | null;
    options?: Schedule[];
  };
}

export interface RoomMember {
  userId: number;
  nickname: string;
  role: 'host' | 'member';
  tptiCompleted: boolean;
  scores?: TptiScores;
  characterName?: string;
}

// ─── 갈등 지도 ────────────────────────────────────────────
export type ConflictSeverity = 'none' | 'minor' | 'moderate' | 'critical';

export interface ConflictAxis {
  axis: 'mobility' | 'photo' | 'budget' | 'theme';
  gap: number;
  severity: ConflictSeverity;
  min?: number;
  max?: number;
  members?: { userId: number; score: number; nickname: string }[];
}

export interface ConflictMap {
  roomId: number;
  commonAxes: string[];
  conflictAxes: ConflictAxis[];
  summaryText: string;
  members: Array<{
    userId: number;
    nickname: string;
    scores: TptiScores;
    characterName?: string;
  }>;
}

export interface ConflictMapApiResponse {
  roomId: number;
  conflictMapId: number;
  commonAxes: Array<'mobility' | 'photo' | 'budget' | 'theme'>;
  conflictAxes: Array<{
    axis: 'mobility' | 'photo' | 'budget' | 'theme';
    gap: number;
    severity: ConflictSeverity;
  }>;
  summaryText: string;
  members: Array<{
    userId: number;
    nickname: string;
    scores: TptiScores;
  }>;
}

// ─── 일정 ─────────────────────────────────────────────────
export interface Place {
  id: number;
  name: string;
  address: string;
  imageUrl?: string;
  description?: string;
  category?: string;
  isDepopulationArea?: boolean;
  latitude?: number;
  longitude?: number;
  alreadyAdded?: boolean;
}

export type SlotType = 'common' | 'personal';
export type ReasonAxis = 'mobility' | 'photo' | 'budget' | 'theme' | 'common';

export interface ScheduleSlot {
  slotId?: number | null;
  orderIndex: number;
  startTime: string;
  endTime: string;
  slotType: SlotType;
  targetUserId?: number;
  targetNickname?: string;
  reasonAxis: ReasonAxis;
  reason?: string;
  place: Place;
}

export type OptionType = 'balanced' | 'individual' | 'discovery' | 'manual';

export interface PersonaValidation {
  source: 'synthetic_research';
  dataset: string;
  summary?: string;
  personaAcceptanceScore: number;
  matchedPersonaCount: number;
  matchedPersonas?: Array<{
    matchedUserId: number;
    similarity: number;
    personaSummary?: string | null;
    scores: {
      mobility: number;
      photo: number;
      budget: number;
      theme: number;
    };
  }>;
  topPositiveSignals: string[];
  objectionReasons: string[];
  persuasionPoints: string[];
}

export interface ScheduleOption {
  scheduleId?: number;
  optionType: OptionType;
  label: string;
  summary: string;
  groupSatisfaction: number;
  personaValidation?: PersonaValidation | null;
  satisfactionByUser: Array<{ userId: number; nickname?: string; score: number }>;
  slots?: ScheduleSlot[];
}

export interface Schedule {
  id: number;
  roomId: number;
  destination?: string;
  tripDate?: string;
  version: number;
  groupSatisfaction: number;
  summary: string;
  personaValidation?: PersonaValidation | null;
  slots: ScheduleSlot[];
  satisfactionByUser: Array<{ userId: number; nickname?: string; score: number }>;
  optionType?: OptionType;
  isConfirmed?: boolean;
  label?: string;
}

export interface PublicShareSchedule {
  scheduleId: number;
  destination: string;
  tripDate: string;
  optionType: OptionType;
  summary: string;
  groupSatisfaction: number;
  personaValidation?: PersonaValidation | null;
  slots: Array<{
    orderIndex: number;
    startTime: string;
    endTime: string;
    placeName: string;
    place: Place;
  }>;
}


// ─── 공유 사진첩 ─────────────────────────────────────────
export type TripPhotoStatus = 'active' | 'hidden' | 'deleted';

export interface TripPhoto {
  photoId: number;
  scheduleId: number;
  scheduleSlotId: number;
  placeId: number;
  uploaderUserId: number;
  uploaderNickname: string;
  caption?: string | null;
  contentType: string;
  sizeBytes: number;
  status: TripPhotoStatus;
  imageUrl?: string;
  contentUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TripPhotoAlbumSlot {
  scheduleSlotId: number;
  orderIndex: number;
  startTime?: string;
  endTime?: string;
  place: Place;
  photos: TripPhoto[];
}

export interface TripPhotoAlbum {
  scheduleId: number;
  roomId: number;
  destination?: string;
  tripDate?: string;
  isConfirmed: boolean;
  totalPhotoCount: number;
  slots: TripPhotoAlbumSlot[];
}

// ─── API 공통 응답 ────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  meta?: {
    requestId: string;
  };
}
