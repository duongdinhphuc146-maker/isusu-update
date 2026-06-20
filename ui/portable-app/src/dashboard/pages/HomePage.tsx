import React, { useEffect, useState } from 'react';
import { Cpu, HardDrive, FileAudio, RefreshCw, Trash2, Sparkles, CheckCircle, ShieldAlert } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useSystemStore } from '../../store/systemStore';

export default function HomePage() {
  const { backendStatus } = useEditorStore();
  const { addToast } = useSystemStore();
  const [generatedFiles, setGeneratedFiles] = useState<any[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [cleaning, setCleaning] = useState(false);

  const fetchGeneratedFiles = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/system/generated-files', {
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedFiles(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/system/info', {
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      if (res.ok) {
        const data = await res.json();
        setSystemInfo(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCleanCache = async () => {
    setCleaning(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/cache/clean', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      if (res.ok) {
        addToast('Đã dọn dẹp bộ nhớ đệm cache thành công (xóa tệp > 7 ngày)', 'success');
        fetchSystemInfo();
        fetchGeneratedFiles();
      } else {
        addToast('Lỗi khi dọn dẹp cache', 'error');
      }
    } catch (err) {
      addToast('Không thể kết nối đến Gateway', 'error');
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    fetchGeneratedFiles();
    fetchSystemInfo();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="panel-title">Bảng Điều Khiển Trung Tâm (CapCut API)</h2>
        <p className="panel-subtitle">Theo dõi trạng thái dịch vụ, dữ liệu bộ nhớ đệm và các tệp tin âm thanh đã tạo.</p>
      </div>

      <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Column: Status and Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* System Status & Storage */}
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Cpu className="w-4 h-4 text-[#00f0ff]" /> Trạng thái hệ thống
            </h3>
            
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Go Backend Gateway</span>
                <span style={{ fontWeight: 600, color: backendStatus === 'running' ? '#00ff66' : '#ff3366', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {backendStatus === 'running' ? <CheckCircle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  {backendStatus === 'running' ? 'Trực tuyến (Port 5000)' : 'Ngoại tuyến'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Dịch vụ TTS & STT</span>
                <span style={{ fontWeight: 600, color: backendStatus === 'running' ? '#00ff66' : '#ff3366' }}>
                  {backendStatus === 'running' ? 'Sẵn sàng' : 'Ngoại tuyến'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Dung lượng bộ nhớ Cache</span>
                <span style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HardDrive className="w-4 h-4 text-[#00f0ff]" /> {systemInfo ? formatBytes(systemInfo.total_storage_bytes) : 'Đang tính...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Số tệp trong cache</span>
                <span style={{ fontWeight: 600, color: 'white' }}>{systemInfo ? `${systemInfo.cache_files} tệp` : '...'}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles className="w-4 h-4 text-[#00f0ff]" /> Thao tác nhanh
            </h3>
            <button
              onClick={handleCleanCache}
              disabled={cleaning || backendStatus !== 'running'}
              className="btn-download"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'rgba(255, 51, 102, 0.1)', border: '1px solid rgba(255, 51, 102, 0.3)', color: '#ff3366' }}
            >
              <Trash2 className="w-4 h-4" />
              <span>{cleaning ? 'Đang dọn dẹp...' : 'Dọn dẹp bộ nhớ đệm cache'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Last Generated Files */}
        <div style={{ padding: '20px', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileAudio className="w-4 h-4 text-[#00f0ff]" /> Tệp tin đã tạo gần đây
            </h3>
            <button onClick={() => { fetchGeneratedFiles(); fetchSystemInfo(); }} className="btn-download" style={{ padding: '6px', borderRadius: '8px' }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {generatedFiles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {generatedFiles.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingBottom: '8px', borderBottom: idx < generatedFiles.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                    <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'white', textDecoration: 'none' }} className="hover:underline">
                      {file.name}
                    </a>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {formatBytes(file.size)}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {new Date(file.last_modified * 1000).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px 0' }}>
              Chưa có tệp tin âm thanh nào được tạo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
