import React, { useEffect, useState } from 'react';
import { Play, Loader2, AlertCircle, Layers, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useBatchStore } from '../../store/batchStore';
import { useOcrStore } from '../../store/ocrStore';
import { useEditorStore } from '../../store/editorStore';

export default function BatchPage() {
  const { projects, fetchProjects } = useVideoStore();
  const { queue, isRunning, error, addBatch, fetchBatchStatus } = useBatchStore();
  const { sessions, fetchSessions } = useOcrStore();
  const { voices } = useEditorStore();

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('z-ai-session');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [targetLang, setTargetLang] = useState('vi');

  useEffect(() => {
    fetchProjects();
    fetchSessions();
    fetchBatchStatus();
    
    const interval = setInterval(() => {
      fetchBatchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (voices && voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].voice_type);
    }
  }, [voices]);

  const handleToggleProject = (id: string) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRunBatch = async () => {
    if (selectedProjects.length === 0) return;
    const voice = voices.find(v => v.voice_type === selectedVoice);
    const resourceId = voice?.resource_id || '';
    const voiceType = voice?.voice_type || '';
    
    await addBatch(selectedProjects, selectedProvider, targetLang, voiceType, resourceId);
    setSelectedProjects([]);
  };

  const availableSessions = sessions.filter(s => s.status === 'valid');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={24} style={{ color: 'var(--accent)' }} />
          Batch Processing
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Xử lý lồng tiếng và dịch thuật hàng loạt cho nhiều dự án song song.
        </p>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: 13 }}>Lỗi: {error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        
        {/* Left: Queue and Projects Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Projects Selector */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Chọn Dự Án Chạy Hàng Loạt</h3>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chưa có dự án nào được tạo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {projects.map(p => {
                  const isChecked = selectedProjects.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: isChecked ? 'var(--bg-hover)' : 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleProject(p.id)}
                      />
                      <span style={{ flex: 1 }}>{p.video_file || p.id}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {new Date(p.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Queue Status */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Hàng Đợi Xử Lý</span>
              <button onClick={fetchBatchStatus} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <RefreshCw size={12} /> Cập nhật
              </button>
            </h3>
            {!queue || queue.tasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Hàng đợi hiện đang trống.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {queue.tasks.map((task, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{task.project_id}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {task.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Đang chờ</span>}
                      {task.status === 'processing' && (
                        <>
                          <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />
                          <span style={{ color: 'var(--accent)', fontSize: 12 }}>Đang xử lý</span>
                        </>
                      )}
                      {task.status === 'succeed' && (
                        <>
                          <CheckCircle2 size={14} style={{ color: '#00ff66' }} />
                          <span style={{ color: '#00ff66', fontSize: 12 }}>Thành công</span>
                        </>
                      )}
                      {task.status === 'failed' && (
                        <>
                          <XCircle size={14} style={{ color: '#ef4444' }} />
                          <span style={{ color: '#ef4444', fontSize: 12 }} title={task.error}>Thất bại</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right: Setup Batch Processing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Thiết Lập Chung</h3>

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

            {/* Run Button */}
            <button
              className="btn btn-primary"
              onClick={handleRunBatch}
              disabled={selectedProjects.length === 0 || isRunning}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}
            >
              {isRunning ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              Chạy hàng loạt ({selectedProjects.length} dự án)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
