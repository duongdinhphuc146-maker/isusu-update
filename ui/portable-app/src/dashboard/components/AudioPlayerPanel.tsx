import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Volume2, Music } from 'lucide-react';

interface AudioPlayerPanelProps {
  audioUrl: string | null;
}

export default function AudioPlayerPanel({ audioUrl }: AudioPlayerPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
  }, [audioUrl]);

  if (!audioUrl) return null;

  const fullUrl = `http://127.0.0.1:5000${audioUrl}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(formatTime(current));
    if (dur > 0) {
      setProgress((current / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(formatTime(audioRef.current.duration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
  };

  return (
    <div className="settings-section" style={{
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      marginTop: '1.25rem',
      padding: '1.25rem',
      borderRadius: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'var(--gradient-neon)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.4)'
          }}>
            <Music className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="panel-title" style={{ fontSize: '0.95rem', margin: 0 }}>Kết quả lồng tiếng (Final Timeline Mix)</h3>
            <p className="panel-subtitle" style={{ margin: 0 }}>Tệp âm thanh hoàn chỉnh được đồng bộ hóa với phụ đề.</p>
          </div>
        </div>
        <a href={fullUrl} download="final_timeline_mix.mp3" className="btn-download" style={{
          padding: '6px 12px',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Download className="w-3.5 h-3.5" />
          <span>Tải tệp MP3</span>
        </a>
      </div>

      <audio
        ref={audioRef}
        src={fullUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0, 0, 0, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
        <button onClick={togglePlay} style={{
          background: 'var(--color-cyan)',
          border: 'none',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'black',
          transition: 'transform 0.1s'
        }}>
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" style={{ marginLeft: '2px' }} />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            <span>{currentTime}</span>
            <span>{duration}</span>
          </div>
          <div
            onClick={handleProgressClick}
            style={{
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--gradient-neon)',
              borderRadius: '3px',
              boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
          <Volume2 className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
