import React, { useState, useRef } from 'react';
import { Play, Volume2, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { Voice, SRTSegment } from '../types';
import { useEditorStore } from '../../store/editorStore';
import SubtitleSelector from '../components/SubtitleSelector';

interface SubtitlePageProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  backendStatus: string;
}

export default function SubtitlePage({ voices, selectedVoice, setSelectedVoice, backendStatus }: SubtitlePageProps) {
  const {
    srtText, setSrtText,
    srtSegments, setSrtSegments,
    srtLoading, setSrtLoading,
    srtError: error, setSrtError: setError
  } = useEditorStore();

  const [selectedLang, setSelectedLang] = useState<string>(selectedVoice.lan || 'vi');
  const [rate, setRate] = useState<number>(1.0);
  const [progressVal, setProgressVal] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setSrtText(content);
    };
    reader.readAsText(file);
  };

  const handleGenerateSRT = async () => {
    setSrtLoading(true);
    setError(null);
    setSrtSegments([]);
    setProgressVal(0);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('http://127.0.0.1:5000/api/srt-to-speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'capcut_local_secret_key_2026'
        },
        body: JSON.stringify({
          srt_text: srtText,
          voice: selectedVoice.voice_type,
          resource_id: selectedVoice.resource_id,
          rate: rate.toFixed(1)
        }),
        signal: controller.signal
      });

      const data = await response.json();
      if (!data.success || !data.task_id) {
        throw new Error(data.error || 'Không thể tạo tác vụ lồng tiếng.');
      }

      const taskId = data.task_id;
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://127.0.0.1:5000/api/srt-to-speak/status?task_id=${taskId}`, {
            headers: { 'X-API-Key': 'capcut_local_secret_key_2026' },
            signal: controller.signal
          });
          const statusData = await statusRes.json();
          if (statusData.segments) {
            setSrtSegments(statusData.segments);
          }
          setProgressVal(statusData.progress || 0);

          if (statusData.status === 'succeed') {
            clearInterval(pollIntervalRef.current);
            setSrtLoading(false);
            const failed = statusData.segments.filter((s: SRTSegment) => !s.audio_url).length;
            if (failed > 0) {
              setError(`Hoàn thành. Có ${failed} phân đoạn lỗi do giới hạn tần suất.`);
            }
          } else if (statusData.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setSrtLoading(false);
            setError(statusData.error || 'Lỗi xử lý file phụ đề SRT.');
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            clearInterval(pollIntervalRef.current);
            setSrtLoading(false);
            setError('Lỗi kết nối khi kiểm tra trạng thái.');
          }
        }
      }, 1500);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Không thể kết nối đến backend.');
        setSrtLoading(false);
      }
    }
  };

  const handleCancelSRT = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setSrtLoading(false);
    setError('Đã hủy yêu cầu lồng tiếng phụ đề.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="panel-title">Chuyển Phụ đề SRT thành Giọng Nói (SRT to Speak)</h2>
        <p className="panel-subtitle">Hệ thống tự động phân tách các phân đoạn phụ đề và lồng tiếng tự động khớp khớp thời gian.</p>
      </div>

      <div className="editor-grid-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Nội dung tệp SRT</label>
              <label htmlFor="srt-file-upload" className="btn-download" style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                Tải tệp .srt
              </label>
              <input id="srt-file-upload" type="file" accept=".srt" onChange={handleFileUpload} style={{ display: 'none' }} />
            </div>
            <textarea 
              value={srtText} onChange={(e) => setSrtText(e.target.value)} rows={6} className="form-textarea" style={{ fontFamily: 'monospace' }}
              placeholder="Chọn tải tệp .srt hoặc dán nội dung phụ đề vào đây..."
            />
          </div>

          <SubtitleSelector
            voices={voices} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
            selectedLang={selectedLang} setSelectedLang={setSelectedLang} rate={rate} setRate={setRate}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleGenerateSRT} disabled={srtLoading || backendStatus !== 'running'} className="btn-primary" style={{ flex: 1 }}>
              {srtLoading ? (
                <>
                  <RefreshCw className="w-5 h-5" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang xử lý ({progressVal}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" style={{ fill: 'currentColor' }} />
                  <span>Chạy Lồng Tiếng Phụ Đề</span>
                </>
              )}
            </button>
            {srtLoading && (
              <button onClick={handleCancelSRT} className="btn-download" style={{ backgroundColor: 'var(--color-red)', color: 'white', border: 'none', padding: '0 16px', borderRadius: '12px' }}>
                Hủy
              </button>
            )}
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: '#2d1212', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-red)' }}>
              <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="result-card" style={{ overflowY: 'auto', maxHeight: '420px', display: 'block' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <Volume2 className="w-4 h-4 text-[#00f0ff]" style={{ marginRight: '8px' }} /> Phân đoạn lồng tiếng ({srtSegments.length})
          </h3>

          {srtSegments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {srtSegments.map((seg, idx) => (
                <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'between', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                    <span>#{seg.index}</span>
                    <span style={{ marginLeft: 'auto' }}>{seg.start} - {seg.end}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'white', marginBottom: '8px' }}>{seg.text}</p>
                  {seg.audio_url ? (
                    <audio src={seg.audio_url} controls style={{ width: '100%', height: '28px' }} />
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--color-red)' }}>Đang tạo âm thanh...</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <FileText className="w-12 h-12" style={{ color: 'var(--color-border)', margin: '0 auto' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '12px' }}>Chưa có kết quả.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
