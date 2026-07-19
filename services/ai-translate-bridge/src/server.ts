import express from 'express';
import cors from 'cors';
import { PROVIDERS } from './providers/configs';
import { getCapturedSessionInfo, deleteCapturedSession } from './session-manager';
import { startCapture, stopCapture } from './request-capture';
import { replayRequest } from './request-replay';
import { replayOCRRequest } from './ocr-replay';

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

export let ocrProgress = {
  status: 'idle',
  current: 0,
  total: 0,
  message: '',
  log: [] as string[]
};

export function updateOcrProgress(message: string, current = 0, total = 0, status = 'processing') {
  ocrProgress.status = status;
  ocrProgress.current = current;
  ocrProgress.total = total;
  ocrProgress.message = message;
  if (message) {
    ocrProgress.log.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  }
}

export function clearOcrProgressLog() {
  ocrProgress.status = 'idle';
  ocrProgress.current = 0;
  ocrProgress.total = 0;
  ocrProgress.message = '';
  ocrProgress.log = [];
}

app.get('/ocr/progress', (req, res) => {
  res.json(ocrProgress);
});

app.post('/capture/start', async (req, res, next) => {
  const { provider } = req.body;
  if (!provider) {
    res.status(400).json({ error: 'Provider is required' });
    return;
  }
  try {
    console.log(`[SERVER] Starting capture for: ${provider}`);
    await startCapture(provider);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post('/capture/stop', async (req, res, next) => {
  try {
    console.log('[SERVER] Stopping capture...');
    const result = await stopCapture();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/replay', async (req, res, next) => {
  const { provider, prompt } = req.body;
  if (!provider || !prompt) {
    res.status(400).json({ error: 'Provider and prompt are required' });
    return;
  }
  try {
    console.log(`[SERVER] Replaying request for ${provider}...`);
    const resultText = await replayRequest(provider, prompt);
    res.json({ response: resultText });
  } catch (err) {
    next(err);
  }
});

app.post('/ocr/replay', async (req, res, next) => {
  const { provider, image } = req.body;
  if (!provider || !image) {
    res.status(400).json({ error: 'Provider and image are required' });
    return;
  }
  try {
    console.log(`[SERVER] Replaying OCR request for ${provider}...`);
    const imageBuffer = Buffer.from(image, 'base64');
    const resultText = await replayOCRRequest(provider, imageBuffer);
    res.json({ response: resultText });
  } catch (err) {
    next(err);
  }
});

app.get('/sessions', (req, res) => {
  const sessionsInfo = PROVIDERS.map(p => {
    const info = getCapturedSessionInfo(p.id);
    return info ? info : { provider: p.id, capturedAt: '', status: 'unknown' };
  });
  res.json(sessionsInfo);
});

app.delete('/sessions/:provider', (req, res) => {
  const { provider } = req.params;
  try {
    console.log(`[SERVER] Deleting session for provider: ${provider}`);
    deleteCapturedSession(provider);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`[SERVER] AI Translation Bridge running on port ${port}`);
});
