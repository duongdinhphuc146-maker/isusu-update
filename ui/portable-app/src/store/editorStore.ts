import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Voice, SRTSegment, defaultVoices } from '../dashboard/types';

interface EditorSettings {
  autoSave: boolean;
  theme: string;
}

interface EditorState {
  activeTab: 'home' | 'tts' | 'srt' | 'stt' | 'system' | 'translate' | 'dialogue' | 'ocr' | 'video' | 'ocr-pipeline' | 'pipeline-wizard' | 'batch' | 'vieneu-tts';
  selectedVoice: Voice;
  voices: Voice[];
  backendStatus: 'checking' | 'running' | 'offline';
  editorSettings: EditorSettings;
  
  // TTS Page State
  ttsText: string;
  ttsRate: number;
  ttsAudioUrl: string | null;
  ttsLoading: boolean;
  ttsError: string | null;

  // SRT Page State
  srtText: string;
  srtSegments: SRTSegment[];
  srtLoading: boolean;
  srtError: string | null;

  // STT Page State
  sttAudioFile: File | null;
  sttResult: string | null;
  sttSrt: string | null;
  sttLoading: boolean;
  sttError: string | null;

  // Actions
  setActiveTab: (tab: 'home' | 'tts' | 'srt' | 'stt' | 'system' | 'translate' | 'dialogue' | 'ocr' | 'video' | 'ocr-pipeline' | 'pipeline-wizard' | 'batch' | 'vieneu-tts') => void;
  setSelectedVoice: (voice: Voice) => void;
  setVoices: (voices: Voice[]) => void;
  setBackendStatus: (status: 'checking' | 'running' | 'offline') => void;
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  
  setTtsText: (text: string) => void;
  setTtsRate: (rate: number) => void;
  setTtsAudioUrl: (url: string | null) => void;
  setTtsLoading: (loading: boolean) => void;
  setTtsError: (error: string | null) => void;

  setSrtText: (text: string) => void;
  setSrtSegments: (segments: SRTSegment[]) => void;
  setSrtLoading: (loading: boolean) => void;
  setSrtError: (error: string | null) => void;

  setSttAudioFile: (file: File | null) => void;
  setSttResult: (result: string | null) => void;
  setSttSrt: (srt: string | null) => void;
  setSttLoading: (loading: boolean) => void;
  setSttError: (error: string | null) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      activeTab: 'home',
      selectedVoice: defaultVoices[0],
      voices: defaultVoices,
      backendStatus: 'checking',
      editorSettings: {
        autoSave: true,
        theme: 'dark'
      },

      ttsText: 'Chào mừng bạn đến với ứng dụng CapCut Studio Portable! Hệ thống đã được tích hợp thành công.',
      ttsRate: 1.0,
      ttsAudioUrl: null,
      ttsLoading: false,
      ttsError: null,

      srtText: `1\n00:00:01,000 --> 00:00:03,500\nXin chào các bạn.\n\n2\n00:00:04,000 --> 00:00:07,000\nChúc các bạn một ngày tốt lành.`,
      srtSegments: [],
      srtLoading: false,
      srtError: null,

      sttAudioFile: null,
      sttResult: null,
      sttSrt: null,
      sttLoading: false,
      sttError: null,

      setActiveTab: (activeTab) => set({ activeTab }),
      setSelectedVoice: (selectedVoice) => set({ selectedVoice }),
      setVoices: (voices) => set({ voices }),
      setBackendStatus: (backendStatus) => set({ backendStatus }),
      setEditorSettings: (settings) => set((state) => ({ editorSettings: { ...state.editorSettings, ...settings } })),

      setTtsText: (ttsText) => set({ ttsText }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setTtsAudioUrl: (ttsAudioUrl) => set({ ttsAudioUrl }),
      setTtsLoading: (ttsLoading) => set({ ttsLoading }),
      setTtsError: (ttsError) => set({ ttsError }),

      setSrtText: (srtText) => set({ srtText }),
      setSrtSegments: (srtSegments) => set({ srtSegments }),
      setSrtLoading: (srtLoading) => set({ srtLoading }),
      setSrtError: (srtError) => set({ srtError }),

      setSttAudioFile: (sttAudioFile) => set({ sttAudioFile }),
      setSttResult: (sttResult) => set({ sttResult }),
      setSttSrt: (sttSrt) => set({ sttSrt }),
      setSttLoading: (sttLoading) => set({ sttLoading }),
      setSttError: (sttError) => set({ sttError })
    }),
    {
      name: 'capcut-editor-store',
      // Persist these fields across reloads
      partialize: (state) => ({
        activeTab: state.activeTab,
        selectedVoice: state.selectedVoice,
        editorSettings: state.editorSettings,
        ttsText: state.ttsText,
        ttsRate: state.ttsRate,
        ttsAudioUrl: state.ttsAudioUrl,
        srtText: state.srtText,
        srtSegments: state.srtSegments,
        sttResult: state.sttResult,
        sttSrt: state.sttSrt
      })
    }
  )
);
