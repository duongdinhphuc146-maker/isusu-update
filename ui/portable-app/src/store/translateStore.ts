import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TranslateState, SUPPORTED_LANGUAGES } from '../dashboard/types';
import { createPollLoop, cancelPollLoop } from './translatePoll';

const BACKEND_URL = 'http://127.0.0.1:5000';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': 'capcut_local_secret_key_2026',
};

export const useTranslateStore = create<TranslateState>()(
  persist(
    (set, get) => ({
      providers: [],
      selectedProvider: 'gemini-api',
      targetLang: 'en',
      srtInput: '',
      translatedSRT: '',
      translateTaskId: null,
      translateStatus: 'idle',
      translateProgress: 0,
      totalChunks: 0,
      completedChunks: 0,
      translateError: null,
      translateLoading: false,
      sessions: [],
      translateLogs: [],
      voices: [],
      audioUrl: null,
      dialogueMode: false,
      characterMap: [],
      pipelineSteps: [
        { name: 'Profile', status: 'idle' },
        { name: 'Translate', status: 'idle' },
        { name: 'Merge', status: 'idle' },
        { name: 'TTS', status: 'idle' },
        { name: 'Split', status: 'idle' },
        { name: 'Render', status: 'idle' },
      ],

      setSrtInput: (srtInput) => set({ srtInput }),
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setTargetLang: (targetLang) => set({ targetLang }),
      setTranslatedSRT: (translatedSRT) => set({ translatedSRT }),
      setDialogueMode: (dialogueMode) => set({ dialogueMode }),
      updateCharacterVoice: (id, voiceType, resourceId) => {
        const { characterMap } = get();
        const updated = characterMap.map(c => c.id === id ? { ...c, voice_type: voiceType, resource_id: resourceId } : c);
        set({ characterMap: updated });
      },

      fetchProviders: async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/translate/providers`, { headers: HEADERS });
          const data = await res.json();
          if (Array.isArray(data)) set({ providers: data });
        } catch (e) {
          console.error('Failed to fetch providers', e);
        }
      },

      fetchVoices: async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/voices`, { headers: HEADERS });
          const data = await res.json();
          if (Array.isArray(data)) set({ voices: data });
        } catch (e) {
          console.error('Failed to fetch voices', e);
        }
      },

      fetchSessions: async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/translate/sessions`, { headers: HEADERS });
          const data = await res.json();
          if (Array.isArray(data)) set({ sessions: data });
        } catch (e) {
          console.error('Failed to fetch sessions', e);
        }
      },

      startCaptureSession: async (provider) => {
        const res = await fetch(`${BACKEND_URL}/api/translate/capture/start`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start capture');
        await get().fetchSessions();
        await get().fetchProviders();
      },

      stopCaptureSession: async () => {
        const res = await fetch(`${BACKEND_URL}/api/translate/capture/stop`, {
          method: 'POST',
          headers: HEADERS,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to stop capture');
        await get().fetchSessions();
        await get().fetchProviders();
      },

      deleteSession: async (provider) => {
        const res = await fetch(`${BACKEND_URL}/api/translate/sessions/delete`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete session');
        await get().fetchSessions();
        await get().fetchProviders();
      },

      startTranslation: async (stage?: 'profile' | 'dub') => {
        const { srtInput, targetLang, selectedProvider, translateTaskId, characterMap } = get();
        if (!srtInput) return;

        set({
          translateLoading: true,
          translateError: null,
          translatedSRT: '',
          translateStatus: 'pending',
          translateProgress: 0,
          totalChunks: 0,
          completedChunks: 0,
          translateLogs: [],
          audioUrl: null,
        });

        // Map target language code to full name for the translation prompt
        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
        const targetLangName = langObj ? langObj.name : targetLang;

        try {
          const body: any = {
            srt_text: srtInput,
            target_lang: targetLangName,
            provider: selectedProvider,
            dialogue_mode: get().dialogueMode,
          };
          if (stage) {
            body.stage = stage;
          }
          if (stage === 'dub' && translateTaskId) {
            body.task_id = translateTaskId;
            body.character_voices = characterMap.map(c => ({
              id: c.id,
              voice_type: c.voice_type || '',
              resource_id: c.resource_id || ''
            }));
          }

          const res = await fetch(`${BACKEND_URL}/api/translate`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Failed to submit translation task');

          set({ translateTaskId: data.task_id });
          createPollLoop(data.task_id, set);
        } catch (err: any) {
          set({
            translateError: err.message || 'Failed to start translation',
            translateLoading: false,
          });
        }
      },

      cancelTranslation: () => {
        cancelPollLoop();
        set({
          translateLoading: false,
          translateStatus: 'cancelled',
          translateTaskId: null,
        });
      },

      resumeTranslationPolling: () => {
        const { translateTaskId, translateStatus } = get();
        if (translateTaskId && (translateStatus === 'processing' || translateStatus === 'pending')) {
          set({ translateLoading: true });
          createPollLoop(translateTaskId, set);
        }
      },
    }),
    {
      name: 'capcut-translate-store',
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        targetLang: state.targetLang,
        srtInput: state.srtInput,
        translatedSRT: state.translatedSRT,
        translateTaskId: state.translateTaskId,
        translateStatus: state.translateStatus,
        translateLogs: state.translateLogs,
      }),
    }
  )
);
