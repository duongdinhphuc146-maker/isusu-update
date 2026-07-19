import React, { useEffect, useState, useRef } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle, Terminal, ArrowRight, Settings2 } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { usePipelineStore } from '../../store/pipelineStore';
import { useOcrStore } from '../../store/ocrStore';
import { useEditorStore } from '../../store/editorStore';

export default function PipelineWizard() {
  const { projectId, videoInfo, previewPath } = useVideoStore();
  const { progress, isRunning, error, startPipeline, fetchPipelineStatus, resetPipeline } = usePipelineStore();
  const { sessions, fetchSessions } = useOcrStore();
  const { voices } = useEditorStore();

  const [selectedProvider, setSelectedProvider] = useState('z-ai-session');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [targetLang, setTargetLang] = useState('vi');
  const [activeStageLogs, setActiveStageLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (voices && voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].voice_type);
    }
  }, [voices]);

  // Polling check status
  useEffect(() => {
    let intervalId: any;
    if (isRunning && projectId) {
      intervalId = setInterval(async () => {
        const finished = await fetchPipelineStatus(projectId);
        if (finished) {
          clearInterval(intervalId);
        }
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRunning, projectId]);

  // Tổng hợp logs từ stage đang chạy để hiển thị
  useEffect(() => {
    if (progress?.stages) {
      const activeStage = Object.values(progress.stages).find(s => s.status === 'processing');
      if (activeStage) {
        setActiveStageLogs(activeStage.logs);
      } else {
        const succeedStages = Object.values(progress.stages).filter(s => s.status === 'succeed');
        if (succeedStages.length > 0) {
          setActiveStageLogs(succeedStages[succeedStages.length - 1].logs);
        }
      }
    }
  }, [progress]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeStageLogs]);

  const handleStart = async () => {
    if (!projectId) return;
    const voice = voices.find(v => v.voice_type === selectedVoice);
    const resourceId = voice?.resource_id || '';
    const voiceType = voice?.voice_type || '';
    
    await startPipeline(projectId, selectedProvider, targetLang, voiceType, resourceId);
  };

  const availableSessions = sessions.filter(s => s.status === 'valid');

  const stageKeys = ['extract_frames', 'ocr', 'translate', 'dubbing', 'render'];
  const stageLabels: Record<string, string> = {
    extract_frames: '1. Cắt Frames',
    ocr: '2. OCR Phụ đề',
    translate: '3. Dịch Thuật',
    dubbing: '4. Lồng Tiếng',
    render: '5. Mux Xuất bản',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings2 size={24} style={{ color: 'var(--accent)' }} />
          One-Click Automation
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Tự động hóa toàn bộ quy trình: Trích xuất frame → OCR → Dịch thuật → Lồng tiếng → Render video.
        </p>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: 13 }}>Lỗi: {error}</span>
        </div>
      )}

      {!projectId ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          Vui lòng tải video lên ở tab <strong>Video Manager</strong> trước khi thực hiện quy trình tự động.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
          
          {/* Cột trái: Stage Pipeline Flow & logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Visual Pipeline Flow */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Luồng Tiến Trình</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, overflowX: 'auto', padding: '10px 0' }}>
                {stageKeys.map((key, idx) => {
                  const stage = progress?.stages[key];
                  let bg = 'var(--bg-card)';
                  let color = 'var(--text-muted)';
                  let border = '1px solid var(--border)';
                  
                  if (stage) {
                    if (stage.status === 'processing') {
                      bg = 'rgba(0,212,255,0.1)';
                      color = 'var(--accent)';
                      border = '1px solid var(--accent)';
                    } else if (stage.status === 'succeed') {
                      bg = 'rgba(0,255,102,0.1)';
                      color = '#00ff66';
                      border = '1px solid #00ff66';
                    } else if (stage.status === 'failed') {
                      bg = 'rgba(239,68,68,0.1)';
                      color = '#ef4444';
                      border = '1px solid #ef4444';
                    }
                  }

                  return (
                    <React.Fragment key={key}>
                      <div style={{
                        padding: '10px 14px',
                        background: bg,
                        color: color,
                        border: border,
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                        minWidth: 100,
                        whiteSpace: 'nowrap',
                      }}>
                        {stageLabels[key]}
                        {stage?.status === 'processing' && <Loader2 size={12} className="spin" style={{ marginLeft: 6, display: 'inline' }} />}
                      </div>
                      {idx < stageKeys.length - 1 && <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Live Logs Terminal */}
            {progress && (
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>Nhật Ký Chạy Hệ Thống</h3>
                <div style={{
                  background: '#050508',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#00ff66',
                  height: 240,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {activeStageLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cấu Hình Tự Động Hóa</h3>

              {/* OCR Provider */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Chọn Session OCR</label>
                <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} style={{ width: '100%', padding: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                  <option value="z-ai-session">Z.ai OCR Session</option>
                  {availableSessions.map(s => (
                    <option key={s.provider} value={`${s.provider}-session`}>{s.provider.toUpperCase()} Session</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Ngôn ngữ đích</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={{ width: '100%', padding: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                  <option value="vi">Tiếng Việt (vi-VN)</option>
                  <option value="en">Tiếng Anh (en-US)</option>
                </select>
              </div>

              {/* Voices Selector */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Giọng đọc lồng tiếng (TTS)</label>
                <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} style={{ width: '100%', padding: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                  {voices.map(v => (
                    <option key={v.voice_type} value={v.voice_type}>{v.display_name} ({v.lan})</option>
                  ))}
                </select>
              </div>

              {/* Start Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={isRunning}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isRunning ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                  Bắt Đầu Quy Trình
                </button>
                {progress && (
                  <button className="btn btn-secondary" onClick={resetPipeline} disabled={isRunning}>
                    Đặt Lại Thiết Lập
                  </button>
                )}
              </div>
            </div>

            {progress?.status === 'succeed' && (
              <div className="card" style={{ background: 'rgba(0,255,102,0.08)', borderColor: 'rgba(0,255,102,0.3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00ff66', fontWeight: 600, fontSize: 13 }}>
                  <CheckCircle size={16} />
                  Video đã sẵn sàng!
                </div>
                <a
                  href={`http://127.0.0.1:5000/projects/${projectId}/exports/output.mp4`}
                  download
                  className="btn btn-primary"
                  style={{ textAlign: 'center', textDecoration: 'none', fontSize: 12, padding: '8px 12px' }}
                >
                  Tải Xuống Video Thành Phẩm
                </a>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
