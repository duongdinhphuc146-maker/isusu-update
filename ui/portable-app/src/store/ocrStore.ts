import { create } from 'zustand';

interface OcrSession {
  provider: string;
  capturedAt: string;
  status: 'valid' | 'expired' | 'unknown';
}

interface OcrState {
  sessions: OcrSession[];
  ocrResult: string;
  loading: boolean;
  capturingProvider: string | null;
  error: string | null;
  fetchSessions: () => Promise<void>;
  startOCRCapture: (provider: string) => Promise<void>;
  stopOCRCapture: () => Promise<void>;
  deleteOCRSession: (provider: string) => Promise<void>;
  performOCR: (provider: string, base64Image: string) => Promise<string>;
  clearResult: () => void;
  setCapturingProvider: (provider: string | null) => void;
}

const API_KEY = 'capcut_local_secret_key_2026';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export const useOcrStore = create<OcrState>((set) => ({
  sessions: [],
  ocrResult: '',
  loading: false,
  capturingProvider: null,
  error: null,

  fetchSessions: async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/ocr/sessions', { headers: HEADERS });
      if (!res.ok) throw new Error('Không thể tải danh sách phiên');
      const data = await res.json();
      const ocrIds = ['baidu-paddleocr', 'z-ai-ocr'];
      const ocrSessions = data.filter((s: any) => ocrIds.includes(s.provider));
      set({ sessions: ocrSessions });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  startOCRCapture: async (provider: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://127.0.0.1:5000/api/ocr/capture/start', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Lỗi bắt đầu capture');
      }
      set({ capturingProvider: provider });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  stopOCRCapture: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://127.0.0.1:5000/api/ocr/capture/stop', {
        method: 'POST',
        headers: HEADERS,
      });
      if (!res.ok) throw new Error('Lỗi dừng capture');
      const data = await res.json();
      if (!data.requestCaptured) {
        throw new Error('Không chụp được request nào chứa file/ảnh. Hãy đảm bảo bạn đã thực hiện OCR thử trên trang web.');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ capturingProvider: null, loading: false });
    }
  },

  deleteOCRSession: async (provider: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://127.0.0.1:5000/api/ocr/sessions/delete', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Không thể xóa phiên');
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.provider === provider ? { ...s, capturedAt: '', status: 'unknown' } : s
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  performOCR: async (provider: string, base64Image: string) => {
    set({ loading: true, error: null, ocrResult: '' });
    try {
      const res = await fetch('http://127.0.0.1:5000/api/ocr', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ provider, image: base64Image }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OCR thất bại: ${errText}`);
      }
      const data = await res.json();
      
      // Parse data.response which is the raw text from the bridge replay
      let ocrText = data.response;
      
      // Attempt to prettify/extract text from common structures
      try {
        const parsed = JSON.parse(ocrText);
        // Handle Baidu PaddleOCR response formats
        if (parsed.result && Array.isArray(parsed.result.ocr_result)) {
          ocrText = parsed.result.ocr_result.map((item: any) => item.text).join('\n');
        } else if (parsed.results || parsed.data) {
          ocrText = JSON.stringify(parsed, null, 2);
        }
      } catch (_) {}

      set({ ocrResult: ocrText });
      return ocrText;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearResult: () => set({ ocrResult: '', error: null }),
  setCapturingProvider: (provider) => set({ capturingProvider: provider }),
}));
