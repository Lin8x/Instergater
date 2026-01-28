# GitHub Copilot Instructions for ZenBlocker

# ⛔⛔⛔ STOP AND READ THIS ENTIRE FILE BEFORE WRITING ANY CODE ⛔⛔⛔

You have REPEATEDLY failed to fix these issues. The same bugs keep happening because you keep trying the same broken approaches.

---

## � BUG #1: "DOWNLOAD VIDEO" DOWNLOADS WRONG CONTENT OR FAILS
**What the user sees:**
- Click "Download Video" on a video post
- Gets a random IMAGE from somewhere else in the feed
- OR gets "Protected video stream (Blob) resolution failed" error
- OR downloads a file that won't open ("Network issue")

**Why YOUR fixes keep failing:**
1. You keep thinking React scanning works. IT DOES NOT RELIABLY WORK IN FEED VIEW.
2. You keep thinking `/?__a=1&__d=dis` API works. IT IS BLOCKED BY INSTAGRAM.
3. You keep thinking HTML scraping with regex works. THE JSON IS OBFUSCATED/SPLIT.
4. You keep thinking the shortcode matching will fix it. THE DATA ITSELF IS WRONG OR MISSING.

**THE ACTUAL PROBLEM:**
Instagram's Feed View does NOT load full video URLs into the React tree. It uses:
- Blob URLs (MediaSource) for video playback
- Lazy-loaded data that isn't in memoizedProps
- Different data structures than Single Post View

---

## � BUG #2: "DOWNLOAD ALL" ONLY GETS 1-3 ITEMS (NOT ALL 5-10)
**What the user sees:**
- Carousel has 10 images
- "Download All" only downloads 3

**Why YOUR fixes keep failing:**
1. You keep thinking `carousel_media` contains all items. IT ONLY CONTAINS RENDERED ITEMS.
2. You keep thinking traversing "up" the React tree finds the parent. THE PARENT DOESN'T HAVE FULL DATA.
3. You keep adding more paths to `searchInProps`. THE DATA SIMPLY ISN'T THERE.

**THE ACTUAL PROBLEM:**
Instagram only loads ~3 carousel items into the DOM/React at a time. The rest are lazy-loaded as user swipes. The full list DOES NOT EXIST in the client-side React tree.

---

## ❌ METHODS THAT DO NOT WORK (EXPOSED AS OF JAN 2026)

| Method | Why It Fails |
|--------|--------------|
| `/?__a=1&__d=dis` API | **BLOCKED** - Returns empty or login redirect |
| React `memoizedProps` scanning | Only finds ~3 carousel items, videos have blob URLs |
| `window._sharedData` | **REMOVED** from Instagram in 2024 |
| `window.__additionalDataLoaded` | Only present on initial page load, not SPA navigation |
| HTML regex for `video_versions` | JSON is fragmented across script tags, often fails |
| `performance.getEntriesByType('resource')` | Gets DASH segments (.m4s) not full videos |
| Direct blob URL download | Chrome extension isolation prevents access |
| Anchor tag click with blob href | Fails silently or corrupts file |

---

## ✅ THE ONLY WORKING APPROACH (AS OF JAN 2026)

### For Videos:
**SINGLE POST VIEW (`/p/CODE/`) is the ONLY reliable way to get video URLs.**
- User must open the post in a new tab
- On Single Post View, the full `video_versions` array IS available in React props
- This is the ONLY context where video downloads work reliably

### For Carousels:
**SINGLE POST VIEW is the ONLY way to get ALL carousel items.**
- Same reason - full `carousel_media` or `edge_sidecar_to_children` only exists there

### Recommended UX:
When video download fails in Feed View:
1. Show clear message: "Video downloads only work in Single Post View"
2. Offer to open the post in a new tab: `window.open('/p/' + shortcode + '/', '_blank')`
3. Let user download from there

---

## 🎯 Project Goals
1. **Zen Mode:** Hide distractions (feeds, numbers) - ✅ Working
2. **Media Downloader:** 
   - Images in Feed: ✅ Works (DOM scraping)
   - Videos in Feed: ❌ DOES NOT WORK - Redirect to Single View
   - All Carousel Items: ❌ DOES NOT WORK - Redirect to Single View

---

## 📂 Key Files
- `manifest.json`: Configuration
- `content.js`: Isolated world (DOM access, UI)
- `inject.js`: Main world (React access) - LIMITED USEFULNESS IN FEED
- `background.js`: Download handler

---

## 🛠️ WHAT TO DO WHEN USER REPORTS THESE BUGS

1. **DO NOT** try another React scanning approach
2. **DO NOT** try another API endpoint  
3. **DO NOT** try another regex pattern
4. **DO** acknowledge that Feed View downloads are fundamentally broken
5. **DO** implement "Open in Single View" as the primary solution
6. **DO** update this file if you discover something new that ACTUALLY works