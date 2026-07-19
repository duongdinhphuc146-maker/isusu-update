import { create } from 'zustand';

const API_BASE = 'http://127.0.0.1:5000';
const API_KEY = 'capcut_local_secret_key_2026';

interface BatchTask {
  project_id: string;
  status: 'pending' | 'processing' | 'succeed' | 'failed';
  error?: string;
}

interface BatchQueue {
  tasks: BatchTask[];
}

interface BatchStore {
  queue: BatchQueue | null;
  isRunning: boolean;
  error: string | null;

  addBatch: (projectIds: string[], provider: string, targetLang: string, voiceId: string, resourceId: string) => Promise<void>;
  fetchBatchStatus: () => Promise<void>;
}

export const useBatchStore = create<BatchStore>((set) => ({
  queue: null,
  isRunning: false,
  error: null,

  addBatch: async (projectIds, provider, targetLang, voiceId, resourceId) => {
    set({ isRunning: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/batch/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          project_ids: projectIds,
          provider,
          target_lang: targetLang,
          voice_id: voiceId,
          resource_id: resourceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể thêm tác vụ xử lý hàng loạt');
      
      // Fetch status immediately
      const statusRes = await fetch(`${API_BASE}/api/batch/status`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const statusData = await statusRes.json();
      set({ queue: statusData, isRunning: false });
    } catch (e: any) {
      set({ error: e.message, isRunning: false });
    }
  },

  fetchBatchStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/batch/status`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      set({ queue: data });
    } catch (_) {}
  },
}));
