// Minimal background script helper 
(() => {
    'use strict';

    let bgSettings = {};

    // Load settings initially and keep in sync
    chrome.storage.sync.get(null, (data) => {
        bgSettings = data || {};
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
            Object.keys(changes).forEach(key => {
                bgSettings[key] = changes[key].newValue;
            });
        }
    });

    chrome.runtime.onInstalled.addListener(() => {
        console.log('Instagram Zen Installed');
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'download') {
            // Validate URL to prevent arbitrary downloads if expanded later
            if (!request.url || typeof request.url !== 'string') {
                console.error("ZenBlocker: Invalid URL provided for download.");
                sendResponse({ success: false, error: 'Invalid URL' });
                return true;
            }

            console.log("ZenBlocker: Download request received:", request.url.substring(0, 100));

            // CRITICAL: Check if it's a blob URL - these CANNOT be downloaded via chrome.downloads
            if (request.url.startsWith('blob:')) {
                console.error("ZenBlocker: Cannot download blob URLs directly. URL:", request.url);
                sendResponse({ success: false, error: 'Blob URLs cannot be downloaded' });
                return true;
            }

            // Determine filename extension
            let ext = 'jpg';
            if (request.url.includes('.mp4') || request.url.includes('video') || request.url.includes('/v/')) ext = 'mp4';
            else if (request.url.includes('.webp')) ext = 'webp';
            else if (request.url.includes('.png')) ext = 'png';
            
            const filename = `zen_download_${Date.now()}.${ext}`;

            // Try to fetch and download to bypass potential CORS/referrer issues
            fetch(request.url, {
                method: 'GET',
                headers: {
                    'Accept': '*/*'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Create object URL from blob and download
                const objectUrl = URL.createObjectURL(blob);
                chrome.downloads.download({
                    url: objectUrl,
                    filename: filename
                }, (downloadId) => {
                    // Clean up object URL after download starts
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
                    
                    if (chrome.runtime.lastError) {
                        console.error("ZenBlocker: Download failed:", chrome.runtime.lastError.message);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log("ZenBlocker: Download started:", downloadId);
                        sendResponse({ success: true, downloadId: downloadId });
                    }
                });
            })
            .catch(err => {
                console.error("ZenBlocker: Fetch failed, trying direct download:", err.message);
                // Fallback to direct download
                chrome.downloads.download({
                    url: request.url,
                    filename: filename
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error("ZenBlocker: Direct download also failed:", chrome.runtime.lastError.message);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log("ZenBlocker: Direct download started:", downloadId);
                        sendResponse({ success: true, downloadId: downloadId });
                    }
                });
            });
            
            // Return true to indicate async response
            return true; 
        }
    });

    function isInstagramVideoUrl(url) {
        try {
            const u = new URL(url);
            const isInstagram = /(^|\.)instagram\.com$/.test(u.hostname);
            const path = u.pathname || '';
            const looksLikePostOrReel = /\/(p|reel|reels)\//.test(path);
            return isInstagram && looksLikePostOrReel;
        } catch (e) {
            return false;
        }
    }

    // Close tabs opened by video clicks when enabled
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!bgSettings.blockVideoTabs) return;
        if (!changeInfo.url) return;
        // Only act on tabs that were opened from another tab (e.g., via click)
        if (tab && tab.openerTabId && isInstagramVideoUrl(changeInfo.url)) {
            chrome.tabs.remove(tabId);
        }
    });
})();
