import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIChatMessage } from '../api/ai.api';

interface UIState {
  aiChatOpen: boolean;
  aiChatMinimised: boolean;
  aiMessages: AIChatMessage[];
  setAiChatOpen: (open: boolean) => void;
  setAiChatMinimised: (minimised: boolean) => void;
  addAiMessage: (msg: AIChatMessage) => void;
  setAiMessages: (messages: AIChatMessage[]) => void;
  clearAiChat: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      aiChatOpen: false,
      aiChatMinimised: false,
      aiMessages: [],
      setAiChatOpen: (aiChatOpen) => set({ aiChatOpen }),
      setAiChatMinimised: (aiChatMinimised) => set({ aiChatMinimised }),
      addAiMessage: (msg) => set((state) => ({ aiMessages: [...state.aiMessages, msg] })),
      setAiMessages: (aiMessages) => set({ aiMessages }),
      clearAiChat: () => set({ aiMessages: [], aiChatOpen: false, aiChatMinimised: false }),
    }),
    {
      name: 'iga-ui-state',
      partialize: (state) => ({
        aiChatOpen: state.aiChatOpen,
        aiChatMinimised: state.aiChatMinimised,
        aiMessages: state.aiMessages,
      }),
    }
  )
);
