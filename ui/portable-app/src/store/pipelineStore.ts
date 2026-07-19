import { create } from 'zustand';

const API_BASE = 'http://127.0.0.1:5000';
const API_KEY = 'capcut_local_secret_key_2026';

interface StageProgress {
  stage: string;
  status: 'pending' | 'processing' | 'succeed' | 'failed';
  progress_percent: number;
  logs: string[];
  error?: string;
}

interface PipelineProgress {
  project_id: string;
  status: 'pending' | 'processing' | 'succeed' | 'failed';
  stages: Record<string, StageProgress>;
}

interface PipelineStore {
  progress: PipelineProgress | null;
  isRunning: boolean;
  error: string | null;

  startPipeline: (projectId: string, provider: string, targetLang: string, voiceId: string, resourceId: string) => Promise<void>;
  fetchPipelineStatus: (projectId: string) => Promise<boolean>; // trả về true nếu đã hoàn thành hoặc thất bại
  resetPipeline: () => void;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  progress: null,
  isRunning: false,
  error: null,

  startPipeline: async (projectId: string, provider: string, targetLang: string, voiceId: string, resourceId: string) => {
    set({ isRunning: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          project_id: projectId,
          provider,
          target_lang: targetLang,
          voice_id: voiceId,
          resource_id: resourceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể khởi động automation pipeline');
    } catch (e: any) {
      set({ error: e.message, isRunning: false });
    }
  },

  fetchPipelineStatus: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/status?project_id=${projectId}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      set({ progress: data });
      const finished = data.status === 'succeed' || data.status === 'failed';
      if (finished) {
        set({ isRunning: false });
      }
      return finished;
    } catch (e: any) {
      set({ error: e.message, isRunning: false });
      return true;
    }
  },

  resetPipeline: () => set({ progress: null, isRunning: false, error: null }),
}));
