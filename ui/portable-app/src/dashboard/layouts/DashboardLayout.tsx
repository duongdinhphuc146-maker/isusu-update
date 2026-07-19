import React, { useState } from 'react';
import { Volume2, FileText, Upload, Cpu, LayoutDashboard, Languages, MessageSquare, Camera, Film } from 'lucide-react';
import { useSystemStore } from '../../store/systemStore';
import { useEditorStore } from '../../store/editorStore';
import Header from '../components/Header';
import SystemMonitor from '../pages/components/SystemMonitor';

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
      <Header
        backendStatus={backendStatus}
        restarting={restarting}
        handleReconnect={handleReconnect}
        handleReloadUI={handleReloadUI}
        handleRestartServer={handleRestartServer}
      />

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
            onClick={() => setActiveTab('vieneu-tts')}
            className={`nav-btn ${activeTab === 'vieneu-tts' ? 'active' : ''}`}
          >
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <span>VieNeu-TTS (Local/API)</span>
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
            onClick={() => setActiveTab('dialogue')}
            className={`nav-btn ${activeTab === 'dialogue' ? 'active' : ''}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Dialogue Mode</span>
          </button>

          <button 
            onClick={() => setActiveTab('ocr')}
            className={`nav-btn ${activeTab === 'ocr' ? 'active' : ''}`}
          >
            <Camera className="w-5 h-5" />
            <span>AI OCR</span>
          </button>

          <button 
            onClick={() => setActiveTab('video')}
            className={`nav-btn ${activeTab === 'video' ? 'active' : ''}`}
          >
            <Film className="w-5 h-5" />
            <span>Video Manager</span>
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
          <SystemMonitor />
          {children}
        </section>
      </main>
    </div>
  );
}
