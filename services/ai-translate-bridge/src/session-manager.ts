import path from 'path';
import fs from 'fs';

const USER_DATA_DIR = path.resolve(process.cwd(), '../../user_data/ai-sessions');

export function getSessionProfilePath(provider: string): string {
  const dir = path.join(USER_DATA_DIR, `${provider}-profile`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getCapturedTemplatePath(provider: string): string {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  return path.join(USER_DATA_DIR, `${provider}_captured.json`);
}

export function hasCapturedSession(provider: string): boolean {
  const templatePath = getCapturedTemplatePath(provider);
  return fs.existsSync(templatePath);
}

export function getCapturedSessionInfo(provider: string) {
  const templatePath = getCapturedTemplatePath(provider);
  if (!fs.existsSync(templatePath)) return null;
  const stats = fs.statSync(templatePath);
  try {
    const data = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    return {
      provider,
      capturedAt: stats.mtime.toISOString(),
      status: data.url ? 'valid' : 'unknown'
    };
  } catch {
    return {
      provider,
      capturedAt: stats.mtime.toISOString(),
      status: 'expired'
    };
  }
}

export function deleteCapturedSession(provider: string) {
  const templatePath = getCapturedTemplatePath(provider);
  if (fs.existsSync(templatePath)) {
    fs.unlinkSync(templatePath);
  }
  const profileDir = path.join(USER_DATA_DIR, `${provider}-profile`);
  if (fs.existsSync(profileDir)) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete profile dir for ${provider}`, e);
    }
  }
}
