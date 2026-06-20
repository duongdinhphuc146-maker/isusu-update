# PERSONAL CAPCUT STUDIO - Architecture & Roadmap

## Production Architecture & Implementation Roadmap
### Optimized For Personal Development + Mid-Range PCs

Version: 2.0

---

## 1. Project Vision

Create a professional desktop video editing suite that combines:
* SubtitleAI
* CapCut AI Features
* WannaCut Timeline
* Clypra Asset Management
* html-video Rendering
* C++ Processing Engine
* Go Service Layer

while remaining:
* Portable
* Lightweight
* Offline-capable
* Mid-range PC friendly
* Single developer maintainable

### Target Hardware:
* **CPU**: Intel i5 / Ryzen 5
* **RAM**: 8GB-16GB
* **GPU**: Integrated GPU supported
* **Storage**: SSD Recommended

---

## 2. Production Directory Structure

```
Capcut Tool/
├── docs/                       # Project documentation & design specs
│   └── architecture.md
├── services/                   # Background services & core engines
│   ├── go-backend/             # Go orchestrator (Port: 5000)
│   ├── capcut-tts-api/         # CapCut TTS API logic
│   ├── cpp-engine/             # High performance C++ processing core
│   └── html-video/             # Programmatic video preview generator
├── ui/                         # User interfaces
│   ├── portable-app/           # Main portal Dashboard & launcher UI (Port: 3000)
│   ├── clypra-ui/              # Clypra asset browser interface (Port: 5173)
│   └── wannacut-ui/            # WannaCut editing timeline interface (Port: 5174)
├── shared/                     # Common components & structures
├── projects/                   # Saved user editing projects
├── cache/                      # Subtitle & media cache
├── user_data/                  # Configuration & settings
└── build/                      # Build outputs
```

---

## 3. UI Strategy (Reusing Mature UIs)

### WannaCut (Timeline UX)
* Timeline
* Toolbar
* Playback Controls
* Clip Editing & Shortcuts

### Clypra (Media Library)
* Asset Browser
* Project Browser
* Media Management & File Organization

### Portable App (Application Framework)
* Main Shell
* Sidebar & Navigation
* Dashboard & AI Tools

---

## 4. Key Orchestrators & Core Responsibilities

* **Go Backend (Port 5000)**: Project management, Timeline Storage, TTS/STT Orchestration, Job Scheduling, and Cache Management.
* **CPP Engine**: High Performance Video Processing (Frame filtering, transitions, thumbnailing).
* **HTML Video**: Subtitle previewing, Live Canvas compositing, and Live Timeline syncing.

---

## 5. Implementation Roadmap (Phases)

* **Phase 1**: Architecture Consolidation (Repo unification, event bus, store).
* **Phase 2**: Asset Library (Clypra integration).
* **Phase 3**: Timeline (WannaCut integration, playback).
* **Phase 4**: Preview Engine (html-video canvas previews).
* **Phase 5**: SubtitleAI Integration (Auto Caption, translation, voiceovers).
* **Phase 6**: Effects Engine (C++ filters, transitions).
* **Phase 7**: Export Engine (Render graph, hardware acceleration).
* **Phase 8**: Polish & Launch (Auto recovery, keyframes).
