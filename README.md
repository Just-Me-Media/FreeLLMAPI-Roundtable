# Roundtable for FreeLLMAPI

**A collaborative group chat UI for your local and cloud LLMs via [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi), Ollama, and LM-Studio.**

Pick who sits at the table, set their order, and let models build on each other's work in real-time. Deliberation happens in one shared thread with streaming responses, live artifact generation, diff tracking, and automatic fallback.

![A chat where models deliberate in sequence and collaborate on artifacts](docs/chat.png)

---

## Key Features

- **Sequential & Collaborative Deliberation**: Models see peer replies in order (`Model 1 drafts` → `Model 2 critiques` → `Model 3 synthesizes`).
- **Live Artifact & Evolving Previews**: Models tagged with the `synthesizer` role produce documents, code, or web apps rendered live in a side panel (Markdown, HTML/CSS/JS sandbox, or code fences).
- **In-Memory Version History & Diff**: Step back through revisions (`v1`, `v2`, ...) with an on-demand line differ (`🔀 Diff`).
- **Local & Cloud Model Hybrid**: Auto-detects local Ollama (`:11434`) and LM-Studio (`:1234`) instances alongside your FreeLLMAPI cloud models.
- **Quota & Cost Transparency**: Calculates exact `models × rounds` request volume before dispatching.
- **Read-Only Consensus Gauge**: Real-time keyword overlap tracking (`🟢 High agreement`, `🟡 Partial agreement`, `🔴 Diverging`) to gauge convergence.
- **Multimodal Ready**: Drag-and-drop, upload, or paste (`Cmd+V` / `Ctrl+V`) images directly into prompts for vision-enabled models.
- **Privacy-First**: Zero tracking, 127.0.0.1-only local proxy, and optional session-only key storage.

---

## Auto-Update Feature

Both the Windows and macOS desktop apps include an automatic updater — no more manual downloads.

- **Platform isolation**: Windows users only receive Windows installers; Mac users only receive Mac DMGs. The updater resolves the correct `{os}-{arch}` target at runtime (e.g. `darwin-aarch64`, `windows-x86_64`) and never cross-feeds platforms.
- **Cryptographic verification**: Updates are signed with ed25519 and verified against the public key before installation.
- **Version matching**: Only users on the same major version receive updates (e.g., v0.2.x users get v0.2.y updates).
- **Update prompts**: Users can choose to install immediately or defer to the next launch.
- **In-app trigger**: Click `🔄 Update` in the toolbar to check for updates at any time.

---

## Download

| Platform | Download |
|:---------|:---------|
| **macOS** (Apple Silicon, signed and notarized) | [Roundtable-macOS-AppleSilicon.dmg](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest/download/Roundtable-macOS-AppleSilicon.dmg) |
| **Windows 11** | [Roundtable Windows Installer](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest) |
| **Web server** (any OS with Node.js 18+) | See [Quick Start](#quick-start-web-server) |

All versions and release notes: [Releases](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases)

* * *

## Choose Your Setup

| Distribution | Best For | How to Run |
|:---|:---|:---|
| **macOS Desktop App** | Native experience on Apple Silicon | Download the `.dmg`, drag to Applications |
| **Windows Desktop App** | Native experience on Windows 11 | Download the `.msi` or `.exe` from Releases |
| **Web Server** | Any OS with Node.js 18+ | `npm start` (see below) |

### Quick Start: Web Server

```bash
npm install
npm start
```

Then open <http://localhost:5173>. The server auto-detects your FreeLLMAPI instance on `:3001` or `:31415`, or you can set `FREELLMAPI_URL` explicitly.

### Quick Start: Desktop

Download the installer for your platform from [Releases](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases), run it, and open Roundtable from your Applications or Start menu. The app auto-detects local models and FreeLLMAPI on startup.

---

## Security & Privacy

- The local proxy binds strictly to `127.0.0.1`.
- API credentials are stored only on the client side (in-memory by default, or opt-in `localStorage`).
- Zero telemetries, external analytics, or remote logging.

---

## Support

Roundtable is free, open source (MIT), and built and maintained by one person. If it saves you time, you can [buy me a coffee](https://buymeacoffee.com/justmemedia) to help me keep building. Bug reports, ideas, and stars on GitHub help just as much.

Roundtable is an unofficial companion to [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi). Support here goes to Roundtable, not to the FreeLLMAPI project.

* * *

## License

[MIT](LICENSE) © Just Me Media. Unofficial companion project for FreeLLMAPI.