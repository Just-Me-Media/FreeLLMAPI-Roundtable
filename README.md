# Roundtable — One Conversation for Your AI Models

**Bring your local models, cloud models, and [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) models into one conversation.**

Choose your models, give them different roles, and ask once. They take turns in the same shared conversation, seeing the earlier replies and building on each other's work. No switching between separate model chats or stitching answers together yourself.

Roundtable streams replies as they arrive, can route through local engines such as Ollama and LM Studio, direct cloud providers, or FreeLLMAPI, and can extract a synthesizer's response as an artifact. Because models respond in sequence, total response time still depends on the models and providers you choose.

![A chat where models deliberate in sequence and collaborate on artifacts](docs/chat.png)

---

## Key Features

- **One Shared Conversation**: Models take turns in your chosen order, see prior replies, and contribute under assigned roles (`draft` → `critique` → `synthesize`).
- **Live Artifact & Evolving Previews**: Models tagged with the `synthesizer` role produce documents, code, or web apps rendered live in a side panel (Markdown, HTML/CSS/JS sandbox, or code fences).
- **In-Memory Version History & Diff**: Step back through revisions (`v1`, `v2`, ...) with an on-demand line differ (`🔀 Diff`).
- **Local, Cloud & FreeLLMAPI Models**: Combine local Ollama (`:11434`) and LM Studio (`:1234`) models with FreeLLMAPI models or supported direct cloud providers in the same lineup.
- **Quota & Cost Transparency**: Calculates exact `models × rounds` request volume before dispatching.
- **Read-Only Consensus Gauge**: Real-time keyword overlap tracking (`🟢 High agreement`, `🟡 Partial agreement`, `🔴 Diverging`) to gauge convergence.
- **Multimodal Ready**: Drag-and-drop, upload, or paste (`Cmd+V` / `Ctrl+V`) images directly into prompts for vision-enabled models.
- **Privacy-First**: Zero tracking, 127.0.0.1-only local proxy, and optional session-only key storage.

---

## 📥 Download Installers

### macOS
**Download the latest macOS installer (Apple Silicon):**
- [Roundtable_0.2.0_aarch64.dmg](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v0.2.0/Roundtable_0.2.0_aarch64.dmg) (Native DMG, 6.1 MB)

**System Requirements:** macOS 12+, FreeLLMAPI running on localhost:31415

### Windows
**Download the latest Windows installer:**
- [Roundtable-Windows-x64-v0.2.0.exe](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v0.2.0/Roundtable-Windows-x64-v0.2.0.exe) (NSIS Installer)
- [Roundtable-Windows-x64-v0.2.0.msi](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v0.2.0/Roundtable-Windows-x64-v0.2.0.msi) (Windows Installer)

**System Requirements:** Windows 10/11 64-bit, FreeLLMAPI running on localhost:31415

### Linux
**Download the latest Linux installer:**
- [Roundtable-Linux-x64-v0.2.0.AppImage](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v0.2.0/Roundtable-Linux-x64-v0.2.0.AppImage)

**System Requirements:** Linux x64 with glibc 2.31+, FreeLLMAPI running on localhost:31415

---

## Choose Your Setup

| Distribution | Best For | How to Run |
| :--- | :--- | :--- |
| **macOS Native App (`.dmg`)** | macOS users (Apple Silicon) wanting a native, zero-setup desktop app | Download the `.dmg` from [Releases](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases) |
| **Windows Native App (`.exe`/`.msi`)** | Windows 10/11 users wanting a standalone installer | Download from [Releases](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases) or see Download Installers above |
| **Web Server (`Node.js`)** | Headless systems, servers, or local browsers | `npm start` (zero third-party dependencies) |

---

## Quick Start (Web Server)

Requires [Node.js](https://nodejs.org) 18 or newer and a running FreeLLMAPI instance or local engine (Ollama/LM-Studio).

```bash
git clone https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable.git
cd FreeLLMAPI-Roundtable
npm install
npm start
```

Open <http://localhost:5173>. On initial launch, the **Setup** drawer opens:

1. **Choose model sources**: Detect local Ollama or LM Studio models, load models through FreeLLMAPI, or configure a supported direct provider.
2. **Build your lineup**: Set the order and assign roles such as `Drafting`, `Critique`, and `Synthesizer`.
3. **Start one conversation**: Send a prompt once. Each model takes its turn in the shared thread and can build on earlier replies.
4. **Review the result**: Follow streamed responses in the conversation and view synthesized artifacts in the preview pane.

Models respond one after another, not simultaneously. Roundtable removes the need to switch between separate model chats; it does not eliminate each model's generation time.

---

## How It Works

Each participant takes a turn in the same conversation:

- **Shared context**: Every model receives the conversation, shared instructions, and its assigned role.
- **Replies build on replies**: Earlier model responses are included with their names, so later participants can critique, extend, or synthesize the work.
- **One place to follow along**: Responses stream into the same conversation instead of requiring a separate chat or screen for each model.
- **Graceful Fallbacks**: If a provider rate-limits (429) or experiences downtime, Roundtable automatically re-routes via your designated fallback model with full provenance tagging.
- **Session History**: Save, search, and recall past conversations with the built-in **Saved Chats** drawer.

---

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5173` | Local HTTP port |
| `FREELLMAPI_URL` | Auto-detected (`:31415` or `:3001`) | Upstream FreeLLMAPI gateway endpoint |
| `FREELLMAPI_KEY` | None | Optional environment-level default key |

```bash
FREELLMAPI_URL=http://127.0.0.1:31415 PORT=5173 npm start
```

---

## Building Desktop Apps Locally

### macOS (.app & .dmg)
Requires Rust and the Tauri CLI:
```bash
# Build .app and install directly to /Applications/Roundtable.app:
npm run build:install

# Build standalone macOS .dmg disk image:
npm run build:mac

# Verify local installation, binary freshness, and FreeLLMAPI connectivity:
npm run verify

# Or to build, sign, and notarize:
./scripts/build-and-notarize.sh
```

### Windows (.exe / .msi)
Built natively on your Windows machine (ThinkCentre). The one-step builder syncs the
frontend, runs the Tauri build, and lists the produced installers:

```powershell
# From the repo root:
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

After the build, launch the app with its dependencies (FreeLLMAPI + local proxy):

```powershell
# Double-click, or:
powershell -ExecutionPolicy Bypass -File .\Roundtable-Windows-Start.bat
```

**Prerequisites on the Windows machine:** Rust toolchain (`cargo`), Node.js 18+,
`cargo-tauri` (`cargo install tauri-cli`), and FreeLLMAPI running on `localhost:31415`.

---

## Security & Privacy

- The local proxy binds strictly to `127.0.0.1`.
- API credentials are stored only on the client side (in-memory by default, or opt-in `localStorage`).
- Zero telemetries, external analytics, or remote logging.

---

## Support

Roundtable is free, open source (MIT), and built and maintained by one person. If it saves you time, you can [buy me a coffee](https://buymeacoffee.com/justmemedia) to help me keep building.

Need help, want to report a bug, or have a feature idea? Use one of these:

- [Open a GitHub issue](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/issues)
- [Start a GitHub discussion](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/discussions)
- [Report a security issue privately](https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/security/advisories/new)

Roundtable is an unofficial companion to [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi). Support here goes to Roundtable, not to the FreeLLMAPI project.

* * *

## License

[MIT](LICENSE) © Just Me Media. Unofficial companion project for FreeLLMAPI.
