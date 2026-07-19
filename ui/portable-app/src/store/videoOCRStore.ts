import { create } from 'zustand';

const API_BASE = 'http://127.0.0.1:5000';
const API_KEY = 'capcut_local_secret_key_2026';

interface OCRPipelineProgress {
  status: 'not_started' | 'pending' | 'processing' | 'succeed' | 'failed';
  progress_percent: number;
  logs: string[];
  srt_result: string;
  error?: string;
}

interface OCRPipelineStore {
  progress: OCRPipelineProgress | null;
  isRunning: boolean;
  error: string | null;

  startOCRPipeline: (projectId: string, provider: string) => Promise<void>;
  fetchOCRStatus: (projectId: string) => Promise<boolean>; // trả về true nếu đã hoàn thành/failed
  resetPipeline: () => void;
}

export const useVideoOCRStore = create<OCRPipelineStore>((set, get) => ({
  progress: null,
  isRunning: false,
  error: null,

  startOCRPipeline: async (projectId: string, provider: string) => {
    set({ isRunning: true, error: null, progress: { status: 'pending', progress_percent: 0, logs: ['Đang kết nối API...'], srt_result: '' } });
    try {
      const res = await fetch(`${API_BASE}/api/video/ocr-pipeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ project_id: projectId, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể bắt đầu OCR');
    } catch (e: any) {
      set({ isRunning: false, error: e.message });
    }
  },

  fetchOCRStatus: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/video/ocr-status?project_id=${projectId}`, {
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
