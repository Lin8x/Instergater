# Distribution & Installation Guide

## Cross-Browser Support
Instergater supports both **Chrome/Chromium** (Manifest V3) and **Firefox** (Manifest V2).

### Quick Build
Run the build script to create platform-specific packages:
```bash
./build.sh
```
This creates:
- `build/instergater-chrome.zip` - For Chrome Web Store / Edge Add-ons
- `build/instergater-firefox.zip` - For Firefox Add-ons

## 1. Unpacked (Development)

### Chrome/Chromium
1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the project folder (or `build/chrome` after running build.sh)

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `build/firefox/manifest.json` (or rename `manifest.firefox.json` → `manifest.json` in project root)

**Pros:** Free, easy updates (just edit code and reload).
**Cons:** Chrome may prompt "Disable developer mode extensions" on startup. Firefox temporary add-ons don't persist across restarts.

## 2. Packed Extension (.crx)
This creates a single installable file, but modern Chrome is strict about these.

### How to Create:
1. Go to `chrome://extensions`.
2. Click **Pack extension**.
3. **Extension root directory**: Browse to your project folder (`d:\JavascriptProjects\InstagramBlocker`).
4. **Private key**: Leave blank for the first time.
5. Click **Pack Extension**.
6. Chrome will create two files one level up from your project:
   - `InstagramBlocker.crx` ( The installer)
   - `InstagramBlocker.pem` (Your private key - **KEEP THIS SAFE**)

### How to Install:
1. Go to `chrome://extensions` in the browser.
2. Drag and drop the `.crx` file onto the page.
3. Accept the prompt.

**Warning:** Modern versions of Chrome (Windows/Mac) **block** identifying packed extensions that do not come from the Web Store. If you install a `.crx` locally, Chrome may disable it automatically after you restart the browser for security reasons.

## 3. Browser Extension Stores (Recommended for Sharing)

### Chrome Web Store
1. Create a developer account at the [Chrome Web Store Dashboard](https://chrome.google.com/webstore/dev/dashboard) ($5 fee).
2. Use `build/instergater-chrome.zip` or zip the project folder (excluding `.git`, `node_modules`, `.vscode`, `build/`, `manifest.firefox.json`, `.editorconfig`, `jsconfig.json`, `.pem`, etc).
3. Upload the Zip.
4. Publish (Public, Unlisted, or Private).

### Firefox Add-ons (AMO)
1. Create a developer account at [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/).
2. Use `build/instergater-firefox.zip`.
3. Upload and submit for review.

**Pros:** Permanent installation, automatic updates for users, no security warnings.
