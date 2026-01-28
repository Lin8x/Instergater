# Project: ZenBlocker (Instagram Blocker & Downloader)

## Status: Active Development
**Current Date:** January 27, 2026
**OS:** Windows

## Project Goal
To create a "Zen" mode for Instagram Web that allows the user to:
1.  **Block distractions**: Hide feeds, metrics, likes, and comments based on configurable settings.
2.  **Download Media (Priority)**: reliably download high-quality Images and Videos (including Carousels) from the Feed, Stories, and Reels.
    *   **Constraint:** Must handle "Protected" Blob URLs (MediaSource Extensions) which cannot be simply downloaded via `<a>` tags or `fetch()`.
    *   **Constraint:** Must work seamlessly without opening new tabs if possible ("Download All" feature).

## User Preferences & Guidelines
*   **Ask for help:** If stuck, stop and ask the user for clarification or manual steps (e.g. "Can you inspect element?").
*   **Documentation:** Maintain this file to track attempted solutions.
*   **Research:** Use the internet to find current (2025/2026) methods.

## Failed/Attempted Methods (Media Extraction)
### 1. Direct Blob Download
*   **Method:** `fetch(blobUrl).then(b => URL.createObjectURL(b))`
*   **Result:** `TypeError: Failed to fetch`.
*   **Reason:** Instagram uses opaque origins or CORS policies that block content scripts from fetching blob resources created by the page script.

### 2. Anchor Tag Click
*   **Method:** `a.href = blobUrl; a.download = '...'; a.click();`
*   **Result:** Silent failure.
*   **Reason:** Browser security prevents downloading `blob:` URLs that were not created by the extension itself (context isolation).

### 3. Basic React Fiber Scanning (Partial Failure)
*   **Method:** Traversing `__reactFiber` keys on the element looking for `props.media` or `props.post`.
*   **Result:** Inconsistent. Sometimes finds data, sometimes returns null, especially in "Feed" vs "Modal" views.

### 4. Legacy API Query (`/?__a=1`)
*   **Method:** `fetch('https://www.instagram.com/p/SHORTCODE/?__a=1&__d=dis')`
*   **Result:** "Resolution failed" or 401/302 Redirect to Login.
*   **Reason:** Instagram aggressively rate-limits or blocks this endpoint for unverified automated requests (even with cookies).

## Next Steps
*   Investigate **Network Request Interception** (background script capturing GraphQL responses).
*   Investigate **Script Injection** to read `window._sharedData` or `window.__additionalData` from the page context (bypassing content script isolation).
