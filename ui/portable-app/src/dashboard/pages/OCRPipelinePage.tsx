import React, { useEffect, useState, useRef } from 'react';
import { Camera, Play, StopCircle, Loader2, AlertCircle, Copy, Check, Download, Terminal, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useVideoOCRStore } from '../../store/videoOCRStore';
import { useOcrStore } from '../../store/ocrStore'; // lấy danh sách providers/sessions hiện tại

export default function OCRPipelinePage() {
  const { projectId, frames, videoInfo } = useVideoStore();
  const { progress, isRunning, error, startOCRPipeline, fetchOCRStatus, resetPipeline } = useVideoOCRStore();
  const { sessions, fetchSessions } = useOcrStore();

  const [selectedProvider, setSelectedProvider] = useState('z-ai-session');
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  // Polling tiến độ
  useEffect(() => {
    let intervalId: any;
    if (isRunning && projectId) {
      intervalId = setInterval(async () => {
        const finished = await fetchOCRStatus(projectId);
        if (finished) {
          clearInterval(intervalId);
        }
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRunning, projectId]);

  // Tự động scroll log terminal xuống cuối
  useEffect(() => {
    if (showLog && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress?.logs, showLog]);

  const handleStartOCR = async () => {
    if (!projectId) return;
    await startOCRPipeline(projectId, selectedProvider);
  };

  const handleCopyText = () => {
    if (!progress?.srt_result) return;
    navigator.clipboard.writeText(progress.srt_result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSRT = () => {
    if (!progress?.srt_result) return;
    const blob = new Blob([progress.srt_result], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_subtitle.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Lọc chỉ lấy các session hợp lệ của browser bridge để trích xuất OCR
  const availableSessions = sessions.filter(s => s.status === 'valid');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page Header */}
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Camera size={24} style={{ color: 'var(--accent)' }} />
          Hard-Sub OCR Pipeline
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Tự động nhận dạng phụ đề cứng từ các frame đã cắt của video
        </p>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: 13, flex: 1 }}>{error}</span>
        </div>
      )}

      {!projectId ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          Vui lòng tải video và trích xuất frame tại tab <strong>Video Manager</strong> trước khi thực hiện OCR.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          {/* Cột trái: Tiến trình & Kết quả */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Progress Logs */}
            {progress && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Trạng thái tiến trình: {progress.status === 'processing' ? 'Đang chạy' : progress.status}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                    {progress.progress_percent}%
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ width: `${progress.progress_percent}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>

                {/* Log Terminal toggle */}
                <button
                  onClick={() => setShowLog(!showLog)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  <Terminal size={14} />
                  {showLog ? 'Ẩn nhật ký chi tiết' : 'Hiện nhật ký chi tiết'}
                </button>

                {showLog && (
                  <div style={{
                    background: '#050508',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    maxHeight: 180,
                    overflowY: 'auto',
                    color: '#00ff66',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}>
                    {progress.logs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* SRT Subtitle Results */}
            {progress?.srt_result && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} style={{ color: 'var(--accent)' }} />
                    Kết quả SRT Phụ Đề
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleCopyText} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {copied ? <Check size={14} style={{ color: '#00ff66' }} /> : <Copy size={14} />}
                      {copied ? 'Đã copy' : 'Copy'}
                    </button>
                    <button onClick={handleDownloadSRT} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Download size={14} />
                      Tải xuống
                    </button>
                  </div>
                </div>

                <textarea
                  readOnly
                  value={progress.srt_result}
                  style={{
                    width: '100%',
                    height: 300,
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    resize: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Cột phải: Settings & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                Cấu Hình Nhận Diện
              </h3>

              {/* Provider Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Chọn Session OCR
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  <option value="z-ai-session">Z.ai OCR Session (Mặc định)</option>
                  {availableSessions.map(s => (
                    <option key={s.provider} value={`${s.provider}-session`}>
                      {s.provider.toUpperCase()} Browser Session
                    </option>
                  ))}
                </select>
              </div>

              {/* General Statistics */}
              <div style={{ background: 'var(--bg-hover)', padding: 12, borderRadius: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tổng số frame:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{frames.length}</span>
                </div>
                {videoInfo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Thời lượng video:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Math.round(videoInfo.duration)}s</span>
                  </div>
                )}
              </div>

              {/* Start/Reset Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleStartOCR}
                  disabled={isRunning || frames.length === 0}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Đang xử lý OCR...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Chạy OCR Pipeline
                    </>
                  )}
                </button>

                {progress && (
                  <button
                    className="btn btn-secondary"
                    onClick={resetPipeline}
                    disabled={isRunning}
                    style={{ width: '100%' }}
                  >
                    Đặt lại Pipeline
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
