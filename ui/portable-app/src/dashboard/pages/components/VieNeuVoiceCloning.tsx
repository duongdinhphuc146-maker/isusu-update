import React, { useState, useRef } from 'react';
import { Volume2, Smile, AlertCircle, Play, Download, Upload } from 'lucide-react';

const EMOTIONS = [
  { tag: "[cười]", label: "Cười 😊" },
  { tag: "[thở dài]", label: "Thở dài 💨" },
  { tag: "[hắng giọng]", label: "Hắng giọng 🗣️" },
  { tag: "[khóc]", label: "Khóc 😢" },
  { tag: "[ngáp]", label: "Ngáp 🥱" },
  { tag: "[nhai]", label: "Nhai 🍎" },
  { tag: "[ho]", label: "Ho 😷" },
  { tag: "[thì thầm]", label: "Thì thầm 🤫" },
  { tag: "[la hét]", label: "La hét 😱" },
  { tag: "[thở dốc]", label: "Thở dốc 🥵" },
  { tag: "[e hèm]", label: "E hèm 🤨" },
  { tag: "[chậc]", label: "Chậc 👅" }
];

interface VoiceCloningProps {
  mode: 'local' | 'remote';
  apiBase: string;
  device: 'auto' | 'cpu' | 'cuda';
}

export default function VieNeuVoiceCloning({ mode, apiBase, device }: VoiceCloningProps) {
  const [text, setText] = useState('Chào bạn, đây là mẫu giọng nói đã được nhân bản của tôi.');
  const [cloneAudio, setCloneAudio] = useState<File | null>(null);
  const [readingStyle, setReadingStyle] = useState('tu_nhien');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextText = text.substring(0, start) + tag + text.substring(end);
    setText(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleGenerate = async () => {
    if (!cloneAudio) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    const formData = new FormData();
    formData.append('text', text);
    formData.append('mode', mode);
    formData.append('api_base', apiBase);
    formData.append('clone_audio', cloneAudio);
    formData.append('style', readingStyle);
    formData.append('device', device);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/vieneu/tts', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' },
        body: formData
      });
      const data = await res.json();
      if (data.success) setAudioUrl(data.audio_url);
      else setError(data.error || 'Lỗi nhân bản giọng nói.');
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editor-grid-layout" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        <div className="form-group">
          <label className="form-label">Văn bản cần đọc (Sử dụng giọng clone)</label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="form-textarea"
            placeholder="Nhập nội dung văn bản..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Chèn Cảm Xúc</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {EMOTIONS.map(e => (
              <button
                key={e.tag}
                type="button"
                onClick={() => insertTag(e.tag)}
                style={{
                  backgroundColor: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Smile className="w-3.5 h-3.5" style={{ color: 'var(--color-cyan)' }} />
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">File giọng nói mẫu (Reference Audio)</label>
          <div style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px dashed var(--color-border)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Upload className="w-8 h-8 text-slate-400" />
            <input
              type="file"
              accept=".mp3,.wav"
              onChange={(e) => setCloneAudio(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
              id="clone-uploader-file"
            />
            <label htmlFor="clone-uploader-file" style={{ cursor: 'pointer', color: 'var(--color-cyan)', fontSize: '0.85rem', fontWeight: 600 }}>
              {cloneAudio ? `📁 ${cloneAudio.name}` : "Tải lên file âm thanh (3-8s)"}
            </label>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Hỗ trợ tệp wav hoặc mp3</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Phong cách đọc (Reading Style)</label>
          <select value={readingStyle} onChange={(e) => setReadingStyle(e.target.value)} className="form-select">
            <option value="tu_nhien">Tự nhiên / Trò chuyện (tu_nhien)</option>
            <option value="tin_tuc">Đọc tin tức / Báo chí (tin_tuc)</option>
            <option value="doc_truyen">Kể chuyện / Đọc truyện (doc_truyen)</option>
          </select>
        </div>

        <button onClick={handleGenerate} disabled={loading || !cloneAudio || !text} className="btn-primary" style={{ width: '100%', marginTop: 'auto' }}>
          <Volume2 className="w-5 h-5" />
          {loading ? "Đang nhân bản..." : "Bắt đầu nhân bản"}
        </button>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-red)', color: 'var(--color-red)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {audioUrl && (
          <div className="result-card" style={{ padding: '1rem', marginTop: '0.5rem' }}>
            <audio src={audioUrl} controls style={{ width: '100%', marginBottom: '8px' }} />
            <a href={audioUrl} download="cloned_voice.wav" className="btn-download" style={{ width: '100%' }}>
              <Download className="w-4 h-4" /> Tải về giọng Clone
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
