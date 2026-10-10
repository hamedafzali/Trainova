"use client";

import { create } from "zustand";

/** Whether the global coach panel is open; any page can open it. */
export const useAssistant = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
