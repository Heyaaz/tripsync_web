'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, TptiResult, Room } from '../types';

interface AuthStore {
  user: User | null;
  tptiResult: TptiResult | null;
  currentRoom: Room | null;
  setUser: (user: User | null) => void;
  setTptiResult: (result: TptiResult | null) => void;
  setCurrentRoom: (room: Room | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      tptiResult: null,
      currentRoom: null,
      setUser: (user) => set({ user }),
      setTptiResult: (tptiResult) => set({ tptiResult }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      clear: () => set({ user: null, tptiResult: null, currentRoom: null }),
    }),
    {
      name: 'tripsync-auth',
    }
  )
);
