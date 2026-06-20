export interface Voice {
  lan: string;
  lang: string;
  voice_type: string;
  display_name: string;
  resource_id: string;
}

export interface SRTSegment {
  index: number;
  start: string;
  end: string;
  duration_ms: number;
  text: string;
  audio_url?: string;
}

export const defaultVoices: Voice[] = [
  { lan: "vi", lang: "vi-VN", voice_type: "BV074_streaming", display_name: "Cô Gái Hoạt Ngôn", resource_id: "7102355709945188865" },
  { lan: "vi", lang: "vi-VN", voice_type: "vi_female_huong", display_name: "Giọng Nữ Phổ Thông", resource_id: "7264854897953083905" },
  { lan: "vi", lang: "vi-VN", voice_type: "BV074_streaming_dsp", display_name: "Giọng Bé", resource_id: "7550087831092251920" },
  { lan: "vi", lang: "vi-VN", voice_type: "BV075_streaming_vibrato_dsp", display_name: "Việt Méo", resource_id: "7569450639810465040" },
  { lan: "vi", lang: "vi-VN", voice_type: "multi_female_richgirl_uranus_bigtts", display_name: "Review Phim (Premium)", resource_id: "7637460351541447956" },
  { lan: "vi", lang: "vi-VN", voice_type: "multi_male_felipe_uranus_bigtts", display_name: "Giọng Nam Trầm", resource_id: "7637456729696996628" }
];

export interface TranslateProvider {
  id: string;
  name: string;
  available: boolean;
  has_session: boolean;
}

export interface TranslatedSegment {
  index: number;
  start: string;
  end: string;
  original: string;
  translated: string;
}

export interface CapturedSession {
  provider: string;
  capturedAt: string;
  status: 'valid' | 'expired' | 'unknown';
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'th', name: 'Thai' },
  { code: 'de', name: 'German' },
  { code: 'vi', name: 'Vietnamese' },
];

export interface TranslateState {
  providers: TranslateProvider[];
  selectedProvider: string;
  targetLang: string;
  srtInput: string;
  translatedSRT: string;
  translateTaskId: string | null;
  translateStatus: string;
  translateProgress: number;
  totalChunks: number;
  completedChunks: number;
  translateError: string | null;
  translateLoading: boolean;
  sessions: CapturedSession[];
  translateLogs: string[];

  setSrtInput: (srt: string) => void;
  setSelectedProvider: (provider: string) => void;
  setTargetLang: (lang: string) => void;
  setTranslatedSRT: (srt: string) => void;

  fetchProviders: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  startCaptureSession: (provider: string) => Promise<void>;
  stopCaptureSession: () => Promise<void>;
  deleteSession: (provider: string) => Promise<void>;
  startTranslation: () => Promise<void>;
  cancelTranslation: () => void;
  resumeTranslationPolling: () => void;
}
