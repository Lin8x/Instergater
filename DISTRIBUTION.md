# Distribution & Installation Guide

## 1. Unpacked (Current Method)
This is the standard way to run local extensions.
1. Go to `chrome://extensions`
2. Enable **Developer Mode**.
3. Click **Load Unpacked**.
4. Select this project folder.

**Pros:** Free, easy updates (just edit code and reload).
**Cons:** Chrome may prompt "Disable developer mode extensions" on startup.

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

## 3. Chrome Web Store (Recommended for Sharing)
If you want to share this with friends or use it without "Developer Mode":
1. Create a developer account at the [Chrome Web Store Dashboard](https://chrome.google.com/webstore/dev/dashboard) ($5 fee).
2. Zip your project folder (excluding `.git`, `node_modules`, `.vscode`, `.editorconfig`, `jsconfig.json`, `.pem`, etc).
3. Upload the Zip.
4. Publish (Public, Unlisted, or Private).

**Pros:** Permanent installation, automatic updates for users, no security warnings.
