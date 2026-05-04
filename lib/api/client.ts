import axios from 'axios';
import type { TptiScores } from '../types';

// Next.js rewrites(/api → Spring)를 활용하므로 동일 오리진 /api 사용
// 덕분에 CORS 없이 HttpOnly 쿠키가 자동 전달됨
const BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080');

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── 인증 API ─────────────────────────────────────────────
export const authApi = {
  register: (data: { nickname: string; email: string; password: string }) =>
    apiClient.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),

  me: () => apiClient.get('/auth/me'),

  logout: () => apiClient.post('/auth/logout'),

  guest: (data: { nickname: string; shareCode?: string }) =>
    apiClient.post('/auth/guest', data),

  getOAuthStartUrl: (provider: 'google' | 'kakao', redirectPath = '/rooms/new') =>
    `/api/auth/${provider}?redirectPath=${encodeURIComponent(redirectPath)}`,
};

// ─── TPTI API ─────────────────────────────────────────────
export const tptiApi = {
  getQuestions: () => apiClient.get('/tpti/questions'),

  submit: (data: { answers: number[]; manualAdjustments?: Partial<TptiScores> }) =>
    apiClient.post('/tpti/submit', data),

  getResult: (userId: number) => apiClient.get(`/tpti/result/${userId}`),

  getShareResult: (resultId: number) => apiClient.get(`/share/tpti/${resultId}`),
};

// ─── Room API ─────────────────────────────────────────────
export const roomApi = {
  create: (data: { destination: string; tripDate: string; tripStartDate?: string; tripEndDate?: string }) =>
    apiClient.post('/rooms', data),

  getById: (id: number) => apiClient.get(`/rooms/${id}`),

  getByShareCode: (shareCode: string) => apiClient.get(`/rooms/share/${shareCode}`),

  join: (shareCode: string, data: { tptiResultId?: number }) =>
    apiClient.post(`/rooms/${shareCode}/join`, data),

  getMembers: (id: number) => apiClient.get(`/rooms/${id}/members`),

  getConflictMap: (id: number) => apiClient.get(`/rooms/${id}/conflict-map`),

  generateSchedule: (id: number, data: { destination: string; tripDate: string; startTime: string; endTime: string; tripStartDate?: string; tripEndDate?: string }) =>
    apiClient.post(`/rooms/${id}/generate-schedule`, data),

  confirmSchedule: (id: number, data: { optionType: string }) =>
    apiClient.post(`/rooms/${id}/confirm-schedule`, data),
};

// ─── Schedule API ──────────────────────────────────────────
export const scheduleApi = {
  getById: (id: number) => apiClient.get(`/schedules/${id}`),
  getShareSchedule: (scheduleId: number) => apiClient.get(`/share/schedules/${scheduleId}`),
  regenerate: (id: number, data: { destination: string; tripDate: string; startTime: string; endTime: string; tripStartDate?: string; tripEndDate?: string }) =>
    apiClient.post(`/schedules/${id}/regenerate`, data),
};
