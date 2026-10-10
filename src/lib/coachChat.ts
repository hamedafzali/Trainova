"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { TrainerAction } from "@/domain/trainer";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  notice?: string | null;
  actions?: TrainerAction[];
  /** Index-aligned with `actions`: already applied to the plan. */
  applied?: boolean[];
  error?: boolean;
}

const MAX_MESSAGES = 40;

const memoryStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

interface ChatState {
  messages: ChatMessage[];
  add: (m: Omit<ChatMessage, "id" | "at">) => string;
  markApplied: (messageId: string, index: number) => void;
  remove: (messageId: string) => void;
  clear: () => void;
}

/** Coach conversation, kept on this device only (separate from synced training data). */
export const useCoachChat = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      add: (m) => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        set((s) => ({ messages: [...s.messages, { ...m, id, at: new Date().toISOString() }].slice(-MAX_MESSAGES) }));
        return id;
      },
      markApplied: (messageId, index) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const applied = [...(m.applied ?? (m.actions ?? []).map(() => false))];
            applied[index] = true;
            return { ...m, applied };
          }),
        })),
      remove: (messageId) => set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) })),
      clear: () => set({ messages: [] }),
    }),
    {
      name: "trainova-coach-chat",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : memoryStorage)),
    },
  ),
);

export function clearCoachChat(): void {
  useCoachChat.getState().clear();
}
