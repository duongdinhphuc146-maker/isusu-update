import React, { useState } from 'react';
import { Upload, RefreshCw, CheckCircle, X, FileVideo, FileAudio } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useSystemStore } from '../../store/systemStore';
import STTResultCard from '../components/STTResultCard';

const LANGUAGES = [
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en-US', name: 'Tiếng Anh', flag: '🇺🇸' },
  { code: 'ja-JP', name: 'Tiếng Nhật', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Tiếng Trung', flag: '🇨🇳' },
  { code: 'ko-KR', name: 'Tiếng Hàn', flag: '🇰🇷' },
];

export default function STTPage() {
  const {
    sttAudioFile: audioFile,
    setSttAudioFile: setAudioFile,
    sttResult,
    setSttResult,
    sttSrt,
    setSttSrt,
    sttLoading,
    setSttLoading,
    sttError: error,
    setSttError: setError
  } = useEditorStore();

  const { addToast } = useSystemStore();
  const [sourceLang, setSourceLang] = useState('vi-VN');
  const [progressVal, setProgressVal] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const handleGenerateSTT = async () => {
    if (!audioFile) return;
    setSttLoading(true);
    setError(null);
    setSttResult(null);
    setSttSrt(null);
    setProgressVal(0);
    setLogs(["[" + new Date().toLocaleTimeString('vi-VN') + "] Đang khởi tạo tiến trình nhận dạng..."]);

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('lang', sourceLang);
    formData.append('trans_lang', '');

    try {
      const response = await fetch('http://127.0.0.1:5000/api/stt', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' },
        body: formData
      });
      const data = await response.json();
      if (!data.success || !data.task_id) {
        setError(data.error || 'Yêu cầu thất bại');
        setSttLoading(false);
        setLogs(prev => [...prev, `[LỖI] Yêu cầu thất bại: ${data.error || 'Unknown error'}`]);
        return;
      }
      setLogs(prev => [...prev, `[INFO] Đã tạo task trên server (Task ID: ${data.task_id}). Đang chờ xử lý...`]);

      const poll = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:5000/api/stt?task_id=${data.task_id}`, {
            headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
          });
          const status = await res.json();
          if (status.progress !== undefined) {
            setProgressVal(status.progress);
          }
          if (status.logs) {
            setLogs(status.logs);
          }

          if (status.status === 'succeed') {
            clearInterval(poll);
            setSttResult(status.text);
            if (status.srt) setSttSrt(status.srt);
            addToast('Nhận dạng thành công!', 'success');
            setSttLoading(false);
          } else if (status.status === 'failed') {
            clearInterval(poll);
            setError(status.error || 'Nhận dạng thất bại');
            setSttLoading(false);
          }
        } catch {
          clearInterval(poll);
          setError('Lỗi kết nối khi kiểm tra trạng thái.');
          setSttLoading(false);
        }
      }, 1000);
    } catch {
      setError('Không thể kết nối đến backend.');
      setSttLoading(false);
    }
  };

  const handleCopy = () => {
    if (!sttResult) return;
    navigator.clipboard.writeText(sttResult);
    addToast('Đã sao chép văn bản vào clipboard', 'success');
  };

  const handleDownloadTxt = () => {
    if (!sttResult) return;
    const blob = new Blob(["\ufeff", sttResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transcript.txt';
    link.click();
    URL.revokeObjectURL(url);
    addToast('Đã xuất file transcript.txt', 'success');
  };

  const handleDownloadSrt = () => {
    if (!sttSrt) {
      addToast('Không có dữ liệu phụ đề SRT', 'error');
      return;
    }
    const blob = new Blob(["\ufeff", sttSrt], { type: 'text/srt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subtitles.srt';
    link.click();
    URL.revokeObjectURL(url);
    addToast('Đã xuất file subtitles.srt', 'success');
  };

  const handleClear = () => {
    setSttResult(null);
    setSttSrt(null);
    setError(null);
    setProgressVal(0);
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="panel-title">Chuyển đổi Giọng Nói thành Văn Bản (STT)</h2>
        <p className="panel-subtitle">Nhận dạng giọng nói tự động và trích xuất phụ đề cực nhanh.</p>
      </div>

      <div className="editor-grid-layout">
        {/* Left Column: Form Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <div className="form-group">
            <label className="form-label">Tải lên tệp đa phương tiện</label>
            {!audioFile ? (
              <div style={{ border: '2px dashed var(--color-border)', padding: '2.5rem 1.5rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--color-surface-card)', transition: 'all 0.2s' }}>
                <input 
                  type="file" 
                  accept="audio/*,video/*,.ts,.mkv,.mov,.avi,.flv,.webm" 
                  onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                  style={{ display: 'none' }} 
                  id="audio-uploader"
                />
                <label htmlFor="audio-uploader" style={{ cursor: 'pointer', display: 'block' }}>
                  <Upload className="w-10 h-10" style={{ color: 'var(--color-cyan)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>Nhấp để chọn tệp âm thanh hoặc video</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>Hỗ trợ MP3, WAV, MP4, TS, MKV, MOV...</p>
                </label>
              </div>
            ) : (
              <div style={{ padding: '1.25rem', borderRadius: '16px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {(audioFile.type && audioFile.type.startsWith('video/')) || audioFile.name.endsWith('.ts') || audioFile.name.endsWith('.mkv') ? (
                  <FileVideo className="w-8 h-8 text-cyan-400" style={{ flexShrink: 0 }} />
                ) : (
                  <FileAudio className="w-8 h-8 text-cyan-400" style={{ flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{audioFile.name}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button onClick={() => setAudioFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <X className="w-4 h-4 text-red-400 hover:text-red-300" />
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '8px' }}>Chọn ngôn ngữ trong tệp</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {LANGUAGES.map((lang) => (
                <button
                   key={lang.code}
                   onClick={() => setSourceLang(lang.code)}
                   style={{
                     padding: '8px 12px',
                     borderRadius: '10px',
                     fontSize: '0.75rem',
                     fontWeight: 600,
                     cursor: 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     gap: '6px',
                     transition: 'all 0.2s',
                     border: '1px solid ' + (sourceLang === lang.code ? 'var(--color-cyan)' : 'var(--color-border)'),
                     backgroundColor: sourceLang === lang.code ? 'rgba(0, 240, 255, 0.1)' : 'var(--color-surface)',
                     color: sourceLang === lang.code ? 'var(--color-cyan)' : 'white'
                   }}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateSTT}
            disabled={sttLoading || !audioFile}
            className="btn-primary"
            style={{ marginTop: '0.5rem' }}
          >
            {sttLoading ? (
              <>
                <RefreshCw className="w-5 h-5" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Đang nhận dạng âm thanh...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Bắt Đầu Nhận Dạng</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Real-time Status & Console Logs */}
        <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, justifyContent: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <RefreshCw className="w-4 h-4 text-[#00f0ff]" style={{ marginRight: '8px', animation: sttLoading ? 'spin 2s linear infinite' : 'none' }} /> 
              Tiến độ &amp; Nhật ký Real-time
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Theo dõi quá trình nhận dạng và giao tiếp API CapCut.
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ backgroundColor: 'var(--color-surface)', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
              <span>Tiến độ tổng quát</span>
              <span style={{ color: 'var(--color-cyan)' }}>{progressVal}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${progressVal}%`, height: '100%', background: 'var(--gradient-neon)', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Log Window */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '180px' }}>
            <span className="form-label" style={{ marginBottom: '6px' }}>Console Logs</span>
            <div 
              style={{ 
                flex: 1, 
                backgroundColor: '#05070a', 
                border: '1px solid var(--color-border)', 
                borderRadius: '12px', 
                padding: '12px', 
                fontFamily: 'monospace', 
                fontSize: '0.7rem', 
                color: '#10b981', // green terminal color
                overflowY: 'auto', 
                maxHeight: '220px',
                lineHeight: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              {logs.length > 0 ? (
                logs.map((log, idx) => (
                  <div key={idx} style={{ wordBreak: 'break-all' }}>{log}</div>
                ))
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Chưa có tiến trình hoạt động. Bấm 'Bắt đầu nhận dạng' để chạy...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transcription Results Card at the bottom */}
      <STTResultCard 
        sttResult={sttResult}
        sttSrt={sttSrt}
        error={error}
        handleCopy={handleCopy}
        handleDownloadTxt={handleDownloadTxt}
        handleDownloadSrt={handleDownloadSrt}
        handleClear={handleClear}
      />
    </div>
  );
}
