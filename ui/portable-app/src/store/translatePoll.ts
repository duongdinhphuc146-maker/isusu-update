const BACKEND_URL = 'http://127.0.0.1:5000';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': 'capcut_local_secret_key_2026',
};

let pollInterval: NodeJS.Timeout | null = null;
let consecutiveErrors = 0;

export const cancelPollLoop = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

export const createPollLoop = (taskId: string, set: any) => {
  if (pollInterval) clearInterval(pollInterval);
  consecutiveErrors = 0;
  pollInterval = setInterval(async () => {
    try {
      const pollRes = await fetch(`${BACKEND_URL}/api/translate/status?task_id=${taskId}`, { headers: HEADERS });
      const progress = await pollRes.json();
      if (!pollRes.ok) throw new Error(progress.error || 'Polling error');

      consecutiveErrors = 0;
      set((state: any) => ({
        translateStatus: progress.status,
        translateProgress: progress.progress,
        completedChunks: progress.completed_chunks,
        totalChunks: progress.total_chunks,
        translateError: progress.error || null,
        translateLogs: progress.logs || [],
        characterMap: (progress.character_map && progress.character_map.characters && progress.character_map.characters.length > 0)
          ? progress.character_map.characters
          : state.characterMap,
        audioUrl: progress.audio_url || null,
      }));

      if (progress.status === 'succeed') {
        if (pollInterval) clearInterval(pollInterval);
        set({
          translatedSRT: progress.translated_srt,
          translateLoading: false,
        });
      } else if (progress.status === 'waiting_voices') {
        if (pollInterval) clearInterval(pollInterval);
        set({
          translateLoading: false,
        });
      } else if (progress.status === 'failed') {
        if (pollInterval) clearInterval(pollInterval);
        set({
          translateError: progress.error || 'Translation failed',
          translateLoading: false,
        });
      }
    } catch (pollErr: any) {
      consecutiveErrors++;
      console.warn(`Polling status warning (attempt ${consecutiveErrors}/5):`, pollErr);
      if (consecutiveErrors >= 5) {
        if (pollInterval) clearInterval(pollInterval);
        set({
          translateError: pollErr.message || 'Error checking task status',
          translateLoading: false,
        });
      }
    }
  }, 1000);
};
