import React, { useState } from 'react';
import { Volume2, FileText, Upload, Sparkles, Cpu, LayoutDashboard, Languages, RotateCcw, RefreshCw } from 'lucide-react';
import { useSystemStore } from '../../store/systemStore';
import { useEditorStore } from '../../store/editorStore';

interface DashboardLayoutProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  backendStatus: string;
  children: React.ReactNode;
}

export default function DashboardLayout({ activeTab, setActiveTab, backendStatus, children }: DashboardLayoutProps) {
  const { addToast } = useSystemStore();
  const { setBackendStatus, setVoices } = useEditorStore();
  const [restarting, setRestarting] = useState(false);

  const handleReloadUI = () => {
    addToast('Đang tải lại giao diện...', 'warning');
    setTimeout(() => {
      const isElectron = !!(window as any).electronAPI?.isElectron;
      if (isElectron) {
        (window as any).electronAPI.reloadWindow();
      } else {
        window.location.reload();
      }
    }, 500);
  };

  const handleReconnect = async () => {
    addToast('Đang thử kết nối lại với backend...', 'warning');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/voices', {
        headers: {
          'X-API-Key': 'capcut_local_secret_key_2026'
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        setBackendStatus('running');
        setVoices(data);
        addToast('Đã kết nối lại thành công với Go Backend!', 'success');
      } else {
        addToast('Không thể kết nối. Server phản hồi lỗi.', 'error');
      }
    } catch {
      addToast('Không thể kết nối. Tiến trình server có thể đang tắt.', 'error');
    }
  };

  const handleRestartServer = async () => {
    if (restarting) return;
    setRestarting(true);
    addToast('Đang dừng và khởi động lại dịch vụ backend...', 'warning');
    try {
      await (window as any).electronAPI.restartBackend();
      addToast('Dịch vụ backend đã được khởi động lại!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Khởi động lại thất bại hoặc không ở trong môi trường Electron.', 'error');
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="brand-title">
              CAPCUT STUDIO <span className="brand-badge">PORTABLE</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Giải pháp biên tập video nhẹ &amp; chạy ngay không cần cài đặt
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="header-status">
            <span className={`status-dot ${backendStatus === 'running' ? 'active' : 'offline'}`} />
            <span>
              Dịch vụ Go Backend: {backendStatus === 'running' ? 'Đang hoạt động (Port 5000)' : 'Ngoại tuyến'}
            </span>
          </div>

          {backendStatus === 'offline' && (
            <button
              onClick={handleReconnect}
              className="btn-download"
              style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ff6b6b' }}
              title="Thử kết nối lại với Go Backend"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Kết Nối Lại</span>
            </button>
          )}

          <button
            onClick={handleReloadUI}
            className="btn-download"
            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            title="Tải lại giao diện hiển thị"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải Lại UI</span>
          </button>

          {!!(window as any).electronAPI?.isElectron && (
            <button
              onClick={handleRestartServer}
              disabled={restarting}
              className="btn-download"
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                borderColor: restarting ? 'var(--color-border)' : 'rgba(0, 240, 255, 0.4)', 
                color: restarting ? 'var(--color-text-muted)' : 'var(--color-cyan)', 
                cursor: restarting ? 'not-allowed' : 'pointer' 
              }}
              title="Khởi động lại toàn bộ tiến trình Go Backend & AI Translate Bridge"
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ animation: restarting ? 'spin 1s linear infinite' : 'none' }} />
              <span>{restarting ? 'Đang khởi động lại...' : 'Khởi Động Lại Server'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-layout">
        {/* Navigation Sidebar */}
        <aside className="sidebar-nav">
          <button 
            onClick={() => setActiveTab('home')}
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Bảng điều khiển</span>
          </button>

          <button 
            onClick={() => setActiveTab('tts')}
            className={`nav-btn ${activeTab === 'tts' ? 'active' : ''}`}
          >
            <Volume2 className="w-5 h-5" />
            <span>CapCut TTS Generator</span>
          </button>

          <button 
            onClick={() => setActiveTab('srt')}
            className={`nav-btn ${activeTab === 'srt' ? 'active' : ''}`}
          >
            <FileText className="w-5 h-5" />
            <span>SRT to Speak</span>
          </button>

          <button 
            onClick={() => setActiveTab('stt')}
            className={`nav-btn ${activeTab === 'stt' ? 'active' : ''}`}
          >
            <Upload className="w-5 h-5" />
            <span>CapCut STT</span>
          </button>

          <button 
            onClick={() => setActiveTab('translate')}
            className={`nav-btn ${activeTab === 'translate' ? 'active' : ''}`}
          >
            <Languages className="w-5 h-5" />
            <span>AI Translate</span>
          </button>

          <button 
            onClick={() => setActiveTab('system')}
            className={`nav-btn ${activeTab === 'system' ? 'active' : ''}`}
          >
            <Cpu className="w-5 h-5" />
            <span>Hệ Thống &amp; Kiến Trúc</span>
          </button>
        </aside>

        {/* Content Area */}
        <section className="content-panel">
          {children}
        </section>
      </main>
    </div>
  );
}
