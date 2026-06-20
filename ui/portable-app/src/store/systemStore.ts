import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  duration?: number;
}

interface SystemState {
  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'warning', duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }]
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, duration);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}));
