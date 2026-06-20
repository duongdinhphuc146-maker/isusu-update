import express from 'express';
import cors from 'cors';
import { PROVIDERS } from './providers/configs';
import { getCapturedSessionInfo, deleteCapturedSession } from './session-manager';
import { startCapture, stopCapture } from './request-capture';
import { replayRequest } from './request-replay';

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Start capturing requests for a provider
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

// Stop capturing and save the template
app.post('/capture/stop', async (req, res, next) => {
  try {
    console.log('[SERVER] Stopping capture...');
    const result = await stopCapture();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Replay a captured request with a new prompt
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

// List all active sessions
app.get('/sessions', (req, res) => {
  const sessionsInfo = PROVIDERS.map(p => {
    const info = getCapturedSessionInfo(p.id);
    if (info) return info;
    return { provider: p.id, capturedAt: '', status: 'unknown' };
  });
  res.json(sessionsInfo);
});

// Delete a provider's captured session
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`[SERVER] AI Translation Bridge running on port ${port}`);
});
