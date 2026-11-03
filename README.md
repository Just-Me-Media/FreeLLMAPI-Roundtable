## Auto-Update Feature

The Windows desktop app now includes an automatic updater with comprehensive safety controls:

- **Platform isolation**: Windows users only receive Windows installers; Mac users use their separate update flow
- **Cryptographic verification**: Updates are signed with ed25519 and verified before installation
- **Version matching**: Only users on the same major version receive updates (e.g., v0.2.x users get v0.2.y updates)
- **Background download**: Installers download silently without disrupting the app
- **Graceful replacement**: New version launches only after successful verification and download
- **Update prompts**: Users can choose to install immediately or defer to the next launch

This architecture ensures Windows users never accidentally receive Mac builds, and vice versa. The updater only downloads assets matching the current platform's architecture and OS.