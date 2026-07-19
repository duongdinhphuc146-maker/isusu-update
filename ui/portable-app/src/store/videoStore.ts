import { create } from 'zustand';

const API_BASE = 'http://127.0.0.1:5000';
const API_KEY = 'capcut_local_secret_key_2026';

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: string;
  codec: string;
  audio_codec: string;
  file_size: number;
}

interface FrameResult {
  index: number;
  path: string;
  timestamp: number;
}

interface ProjectEntry {
  id: string;
  video_file: string;
  created_at: string;
}

interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VideoState {
  projectId: string | null;
  videoPath: string | null;
  videoInfo: VideoInfo | null;
  frames: FrameResult[];
  projects: ProjectEntry[];
  previewPath: string | null;
  cropRegion: CropRegion | null;
  uploading: boolean;
  extracting: boolean;
  error: string | null;

  uploadVideo: (file: File) => Promise<void>;
  fetchVideoInfo: (projectId: string) => Promise<void>;
  extractFrames: (mode: string, interval?: number) => Promise<void>;
  fetchPreview: (timestamp?: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  setCropRegion: (region: CropRegion | null) => void;
  setProjectId: (id: string) => void;
  clearError: () => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  projectId: null,
  videoPath: null,
  videoInfo: null,
  frames: [],
  projects: [],
  previewPath: null,
  cropRegion: null,
  uploading: false,
  extracting: false,
  error: null,

  uploadVideo: async (file: File) => {
    set({ uploading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('video', file);
      const res = await fetch(`${API_BASE}/api/video/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set({
        projectId: data.project_id,
        videoPath: data.video_path,
        uploading: false,
      });
      // Auto-fetch video info after upload
      await get().fetchVideoInfo(data.project_id);
      await get().fetchPreview();
    } catch (e: any) {
      set({ uploading: false, error: e.message });
    }
  },

  fetchVideoInfo: async (projectId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/video/info?project_id=${projectId}`,
        { headers: { 'X-API-Key': API_KEY } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ videoInfo: data });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  extractFrames: async (mode: string, interval = 5) => {
    const { projectId, cropRegion } = get();
    if (!projectId) return;
    set({ extracting: true, error: null });
    try {
      const body: any = {
        project_id: projectId,
        mode,
        interval,
        max_frames: 200,
      };
      if (cropRegion) {
        body.crop_x = cropRegion.x;
        body.crop_y = cropRegion.y;
        body.crop_w = cropRegion.w;
        body.crop_h = cropRegion.h;
      }
      const res = await fetch(`${API_BASE}/api/video/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ frames: data.frames || [], extracting: false });
    } catch (e: any) {
      set({ extracting: false, error: e.message });
    }
  },

  fetchPreview: async (timestamp?: string) => {
    const { projectId } = get();
    if (!projectId) return;
    try {
      let url = `${API_BASE}/api/video/preview?project_id=${projectId}`;
      if (timestamp) url += `&timestamp=${timestamp}`;
      const res = await fetch(url, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      if (data.success) {
        set({ previewPath: `${API_BASE}${data.path}?t=${Date.now()}` });
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchProjects: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/video/list`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      set({ projects: data || [] });
    } catch (_) {}
  },

  setCropRegion: (region) => set({ cropRegion: region }),
  setProjectId: (id) => set({ projectId: id }),
  clearError: () => set({ error: null }),
}));
