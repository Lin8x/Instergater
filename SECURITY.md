# 🛡️ Security Policy

## 📦 Supported Versions

> Only the latest version of the code in the `main` branch is supported.

</br>

## 🐛 Reporting a Vulnerability
If you find a security vulnerability (e.g., this extension inadvertently exposing user data), please open an Issue immediately or email the maintainer if you prefer privacy.

</br>

## 🔒 Data Privacy
- 🏠 **Local Only**: This extension uses `chrome.storage.sync` and `chrome.storage.local`. No data is sent to any external server owned by the developer.
- 👁️ **Transparency**: You are encouraged to read the code (`content.js`, `background.js`) to verify that no data exfiltration is occurring.

</br>

## ⚠️ Risk Disclaimer
**Use at your own risk.**
This extension modifies the Instagram client-side interface. While we strive to be safe:
1.  We cannot guarantee that Instagram will not detect this extension.
2.  We are not responsible if your Instagram account is flagged, suspended, or banned for using unauthorized third-party tools.
