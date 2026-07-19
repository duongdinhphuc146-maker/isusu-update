import React from 'react';
import { Film, Clock, Monitor, HardDrive } from 'lucide-react';

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: string;
  codec: string;
  audio_codec: string;
  file_size: number;
}

interface VideoPreviewProps {
  previewPath: string | null;
  videoInfo: VideoInfo | null;
  onSeek?: (timestamp: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

export default function VideoPreview({ previewPath, videoInfo, onSeek }: VideoPreviewProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Preview Image Canvas */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: videoInfo ? `${videoInfo.width}/${videoInfo.height}` : '16/9',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
      }}>
        {previewPath ? (
          <img
            src={previewPath}
            alt="Video Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-muted)',
          }}>
            <Film size={48} strokeWidth={1} />
            <span>Chưa có video</span>
          </div>
        )}
      </div>

      {/* Video Info Bar */}
      {videoInfo && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--border)',
        }}>
          <InfoCell
            icon={<Clock size={14} />}
            label="Thời lượng"
            value={formatDuration(videoInfo.duration)}
          />
          <InfoCell
            icon={<Monitor size={14} />}
            label="Độ phân giải"
            value={`${videoInfo.width}×${videoInfo.height}`}
          />
          <InfoCell
            icon={<Film size={14} />}
            label="Codec"
            value={`${videoInfo.codec} / ${videoInfo.audio_codec}`}
          />
          <InfoCell
            icon={<HardDrive size={14} />}
            label="Kích thước"
            value={formatFileSize(videoInfo.file_size)}
          />
        </div>
      )}
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-muted)',
        fontSize: 11,
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        color: 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
      }}>
        {value}
      </div>
    </div>
  );
}
