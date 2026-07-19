import React, { useEffect, useState, useRef } from 'react';
import { Camera, Chrome, StopCircle, Loader2, AlertCircle, Copy, Check, UploadCloud, FileText, Download, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { useOcrStore } from '../../store/ocrStore';
import { exportToWord } from '../utils/wordExport';

interface ProgressInfo {
  status: string;
  current: number;
  total: number;
  message: string;
  log: string[];
}

export default function OCRPage() {
  const {
    sessions, ocrResult, loading, error, capturingProvider,
    fetchSessions, startOCRCapture, stopOCRCapture, deleteOCRSession,
    performOCR, clearResult
  } = useOcrStore();

  const [selectedProvider, setSelectedProvider] = useState('baidu-paddleocr');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    let intervalId: any;
    if (loading) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch('http://127.0.0.1:5001/ocr/progress');
          if (res.ok) {
            const data = await res.json();
            setProgress(data);
          }
        } catch (_) {}
      }, 800);
    } else {
      setProgress(null);
    }
    return () => clearInterval(intervalId);
  }, [loading]);

  useEffect(() => {
    if (showLog && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress?.log, showLog]);

  const activeSession = sessions.find(s => s.provider === selectedProvider);
  const hasSession = activeSession && activeSession.status === 'valid';
  const isCapturingThis = capturingProvider === selectedProvider;

  const limits = selectedProvider === 'baidu-paddleocr' ? {
    formats: 'PDF, PNG, JPG, BMP, CIF',
    desc: 'Tệp đơn ≤ 200MB / 1000 trang | Ảnh đơn ≤ 10MB | Hàng loạt ≤ 20 mục'
  } : {
    formats: 'PNG, JPG, JPEG, PDF',
    desc: 'Ảnh tối đa 10MB | PDF tối đa 50MB'
  };

  const handleStartCapture = async () => {
    try {
      await startOCRCapture(selectedProvider);
    } catch (_) {}
  };

  const handleStopCapture = async () => {
    try {
      await stopOCRCapture();
      fetchSessions();
    } catch (_) {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' });
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(file.type.includes('pdf') ? 'pdf' : (reader.result as string));
      setBase64Image((reader.result as string).split(',')[1]);
      clearResult();
    };
    reader.readAsDataURL(file);
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(ocrResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBaseName = () => selectedFile ? selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) : 'ocr_result';
  const handleWordExport = () => ocrResult && exportToWord(ocrResult, `${getBaseName()}_ocr.doc`);

  const handleExport = (type: 'md' | 'json', mime: string) => {
    if (!ocrResult) return;
    let content = ocrResult;
    if (type === 'json') {
      try {
        content = JSON.stringify(JSON.parse(ocrResult), null, 2);
      } catch (_) {
        content = JSON.stringify({ provider: selectedProvider, file: selectedFile?.name, result: ocrResult }, null, 2);
      }
    }
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getBaseName()}_ocr.${type}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="panel-title">Trích xuất văn bản từ hình ảnh & PDF (AI OCR)</h2>
        <p className="panel-subtitle">Nhận diện ngầm trực tiếp qua session mà không cần mở lại trình duyệt.</p>
      </div>

      <div className="editor-grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', display: 'grid', gap: '1.5rem' }}>
        {/* Left Panel */}
        <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Chrome className="w-4 h-4 text-cyan-400" /> Cấu hình & Phiên Đăng Nhập
          </h3>
          <div>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="select-item" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', color: 'white' }}>
              <option value="baidu-paddleocr" style={{ backgroundColor: '#12131a', color: 'white' }}>Baidu PaddleOCR (aistudio.baidu.com)</option>
              <option value="z-ai-ocr" style={{ backgroundColor: '#12131a', color: 'white' }}>Z.ai OCR (ocr.z.ai)</option>
            </select>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', fontSize: '0.7rem' }}>
            <span style={{ display: 'block', color: 'var(--color-cyan)', fontWeight: 600 }}>Định dạng: {limits.formats}</span>
            <span style={{ display: 'block', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{limits.desc}</span>
          </div>
          {error && <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ff6b6b', fontSize: '0.75rem' }}><AlertCircle className="w-4 h-4 inline mr-1" /> {error}</div>}
          {capturingProvider ? (
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(0, 240, 255, 0.05)', border: '1px dashed var(--color-cyan)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white' }}><Loader2 className="w-4 h-4 text-cyan-400 animate-spin inline mr-2" /> Đang ghi phiên: {capturingProvider}</span>
              {isCapturingThis && <button onClick={handleStopCapture} className="btn-primary" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.75rem' }}><StopCircle className="w-4 h-4" /> Dừng Ghi & Lưu Phiên</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}><span style={{ color: 'var(--color-text-secondary)' }}>Trạng thái:</span><span style={{ fontWeight: 600, color: hasSession ? '#10b981' : '#f59e0b' }}>{hasSession ? 'Đã kích hoạt' : 'Chưa có phiên'}</span></div>
              <button onClick={handleStartCapture} disabled={loading} className="btn-primary" style={{ padding: '8px 12px' }}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />} {hasSession ? 'Cập nhật / Đăng nhập lại' : 'Đăng Nhập Lấy Session'}</button>
              {hasSession && <button onClick={() => deleteOCRSession(selectedProvider).then(clearResult)} className="btn-download" style={{ borderColor: '#ef4444', color: '#ff6b6b', padding: '6px 12px', fontSize: '0.75rem' }}>Xóa Phiên</button>}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}><Camera className="w-4 h-4 text-cyan-400" /> Tải Lên & Chạy Nhận Diện</h3>
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', position: 'relative' }}>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <UploadCloud className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <span style={{ fontSize: '0.8rem', color: 'white', display: 'block', fontWeight: 500 }}>Nhập hoặc kéo thả file ảnh/PDF vào đây</span>
          </div>
          {imagePreview && selectedFile && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--color-bg-dark)', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              {imagePreview === 'pdf' ? <div style={{ width: '80px', height: '60px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', fontSize: '0.8rem', fontWeight: 600 }}>PDF</div> : <img src={imagePreview} alt="Preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', color: 'white', display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block' }}>Size: {selectedFile.size}</span>
                <button onClick={performOCR.bind(null, selectedProvider, base64Image || '')} disabled={loading || !hasSession} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem', marginTop: '6px' }}>{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} Nhận diện văn bản</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress & Log area */}
      {loading && progress && (
        <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>{progress.message || 'Đang xử lý nhận dạng OCR...'}</span>
            <button onClick={() => setShowLog(!showLog)} className="btn-download" style={{ padding: '3px 8px', fontSize: '0.65rem', display: 'flex', gap: '4px' }}><Terminal className="w-3.5 h-3.5" /> {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Logs</button>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-dark)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ width: `${progress.current}%`, height: '100%', backgroundColor: 'var(--color-cyan)', transition: 'width 0.4s ease' }} />
          </div>
          {showLog && (
            <div style={{ padding: '12px', backgroundColor: '#0a0b10', border: '1px solid var(--color-border)', borderRadius: '8px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.7rem', maxHeight: '150px', overflowY: 'auto' }}>
              {progress.log.map((l, idx) => <div key={idx}>{l}</div>)}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Result area */}
      {ocrResult && (
        <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>Kết quả nhận diện:</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={handleWordExport} className="btn-download" style={{ padding: '4px 8px', fontSize: '0.65rem', display: 'flex', gap: '4px', borderColor: '#10b981', color: '#34d399' }}><FileText className="w-3 h-3" /> Word (.doc)</button>
              <button onClick={() => handleExport('md', 'text/markdown')} className="btn-download" style={{ padding: '4px 8px', fontSize: '0.65rem', display: 'flex', gap: '4px', borderColor: '#00f0ff', color: '#00f0ff' }}><Download className="w-3 h-3" /> Markdown (.md)</button>
              <button onClick={() => handleExport('json', 'application/json')} className="btn-download" style={{ padding: '4px 8px', fontSize: '0.65rem', display: 'flex', gap: '4px' }}><Download className="w-3 h-3" /> JSON</button>
              <button onClick={handleCopyResult} className="btn-download" style={{ padding: '4px 8px', fontSize: '0.65rem', display: 'flex', gap: '4px' }}>{copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Đã sao chép' : 'Sao chép'}</button>
            </div>
          </div>
          <pre style={{ margin: 0, padding: '16px', backgroundColor: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', borderRadius: '8px', color: '#e5e7eb', fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: '550px', overflowY: 'auto', fontFamily: 'monospace' }}>{ocrResult}</pre>
        </div>
      )}
    </div>
  );
}
