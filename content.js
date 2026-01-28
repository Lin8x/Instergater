// State variables
(() => {
    'use strict';
    
    let settings = {};
    let postCount = 0;
    const processedPosts = new WeakSet();

    // Load settings and initialize
    chrome.storage.sync.get(null, (data) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        settings = data;
        // We also need local storage for the persistent counter
        chrome.storage.local.get(['zenPostCount', 'zenLastReset'], (localData) => {
             if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            init(localData);
        });
    });

    // START Global functions hoisting fix - define dependencies before usage in handleDomUpdates
    
    // Promisified helper to ask the Page Context for data
    function askPageContextForMedia(shortcode) {
        return new Promise((resolve) => {
            const handleMessage = (event) => {
                if (event.source !== window || !event.data || event.data.source !== 'ZEN_BLOCKER_PAGE') return;
                
                if (event.data.type === 'MEDIA_FOUND' && (!shortcode || event.data.data.shortcode === shortcode)) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data.data);
                } else if (event.data.type === 'MEDIA_NOT_FOUND' && event.data.shortcode === shortcode) {
                    window.removeEventListener('message', handleMessage);
                    resolve(null);
                }
            };
            
            // Timeout after 2s
            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                resolve(null);
            }, 2000);

            window.addEventListener('message', handleMessage);
            window.postMessage({
                source: 'ZEN_BLOCKER_CS',
                type: 'FIND_REACT_DATA',
                shortcode: shortcode
            }, '*');
        });
    }

    // Initialize logic
    function init(localData) {
        if (settings.enableDelay) {
            showDelayOverlay();
        }

        if (settings.enableStatusCheck) {
            showStatusIndicator();
        }
        
        // Initialize Limit Logic
        handleCounterLogic(localData);

        // Start observing DOM changes for posts
        const observer = new MutationObserver(handleMutations);
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Create initial pass
        handleDomUpdates();
        
        // Add scroll listener for limit
        if (settings.enableScrollLimit) {
            window.addEventListener('scroll', checkScrollLimit);
        }

        applyGlobalStyles();
    }

    function handleCounterLogic(localData) {
        const now = Date.now();
        const lastReset = localData.zenLastReset || 0;
        const intervalHours = parseFloat(settings.resetInterval) || 24; // Default to 24h if unset
        const intervalMs = intervalHours * 3600 * 1000;

        if (now - lastReset > intervalMs) {
            // Time to reset
            console.log('ZenBlocker: Resetting post limit counter');
            postCount = 0;
            chrome.storage.local.set({
                zenPostCount: 0,
                zenLastReset: now
            });
        } else {
            // Continue from last session
            postCount = localData.zenPostCount || 0;
            console.log('ZenBlocker: Resuming post count:', postCount);
        }
    }

    function updateCounter() {
        postCount++;
        chrome.storage.local.set({ zenPostCount: postCount });
    }

function showDelayOverlay() {
    const duration = parseInt(settings.blockFeedDuration) || 3;
    const overlay = document.createElement('div');
    overlay.id = 'zen-delay-overlay';
    overlay.innerHTML = `
        <h1>Take a breath</h1>
        <p>Opening Instagram in <span id="zen-countdown">${duration}</span>...</p>
    `;
    document.body.appendChild(overlay);

    let count = duration;
    const interval = setInterval(() => {
        count--;
        const span = document.getElementById('zen-countdown');
        if (span) span.innerText = count;
        
        if (count <= 0) {
            clearInterval(interval);
            overlay.remove();
        }
    }, 1000);
}    function showStatusIndicator() {
        // Create indicator
        const statusDiv = document.createElement('div');
        statusDiv.innerText = 'Instergater Active';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); 
            color: #fff;
            padding: 8px 16px;
            border-radius: 24px;
            font-size: 13px;
            font-weight: 600;
            z-index: 99999;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        `;
        document.body.appendChild(statusDiv);

        // Animate in
        requestAnimationFrame(() => {
            statusDiv.style.opacity = '1';
            statusDiv.style.transform = 'translateY(0)';
        });

        // Remove after 3 seconds
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            statusDiv.style.transform = 'translateY(10px)';
            setTimeout(() => statusDiv.remove(), 400);
        }, 3000);
    }

    function handleMutations(mutations) {
        let shouldUpdate = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) shouldUpdate = true;
        }
        if (shouldUpdate) handleDomUpdates();
    }

    // STORIES VIEW: Dedicated handler for Instagram Stories
    function handleStoriesView() {
        if (!settings.enableDownload) return;
        
        // Stories already have our button?
        if (document.querySelector('.zen-stories-download-btn')) return;
        
        console.log('ZenBlocker: Stories View detected, adding download button');
        
        // Stories have a unique structure - we need to find the story container
        // The story viewer typically has a section with the media (image/video)
        // and navigation buttons on the sides
        
        // Try multiple selectors for the stories container
        const storyContainer = 
            document.querySelector('section[role="presentation"]') ||
            document.querySelector('div[role="dialog"]') ||
            document.querySelector('main section') ||
            document.body; // Last resort fallback
        
        if (!storyContainer) {
            console.warn('ZenBlocker: Could not find story container');
            return;
        }
        
        // Create a floating download button for stories
        const btn = document.createElement('div');
        btn.className = 'zen-stories-download-btn zen-download-btn';
        btn.title = 'Download Story';
        btn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 12px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transition: transform 0.2s, background 0.2s;
        `;
        btn.innerHTML = `
            <svg fill="currentColor" height="24" width="24" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        
        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Find media in the current story
            const media = findStoryMedia();
            
            if (media.url) {
                console.log('ZenBlocker: Downloading story media:', media.type, media.url);
                
                if (media.url.startsWith('blob:')) {
                    alert('This story uses a protected video stream that cannot be downloaded directly.');
                } else {
                    handleDownload(media.url, null, null);
                    
                    // Visual feedback
                    btn.style.background = '#00c853';
                    setTimeout(() => btn.style.background = 'rgba(0, 0, 0, 0.7)', 500);
                }
            } else {
                alert('No media found in this story. Try waiting for it to load.');
            }
        };
        
        document.body.appendChild(btn);
    }
    
    // Find media (video/image) in the current story view
    function findStoryMedia() {
        // METHOD 1: Network Resource Sniffing (Most Reliable!)
        // Instagram loads videos/images from CDN URLs that we can capture
        const networkMedia = sniffNetworkResources();
        if (networkMedia.videos.length > 0) {
            // Return the most recent/relevant video
            return { type: 'video', url: networkMedia.videos[networkMedia.videos.length - 1] };
        }
        if (networkMedia.images.length > 0) {
            // Return the largest/most recent image
            return { type: 'image', url: networkMedia.images[networkMedia.images.length - 1] };
        }
        
        // METHOD 2: DOM Fallback - Video element
        const video = document.querySelector('video[playsinline]') || document.querySelector('section video') || document.querySelector('video');
        if (video) {
            let src = video.src;
            if (!src) {
                const source = video.querySelector('source');
                if (source) src = source.src;
            }
            if (src && !src.startsWith('blob:')) {
                return { type: 'video', url: src };
            }
        }
        
        // METHOD 3: DOM Fallback - Images
        const images = Array.from(document.querySelectorAll('img'));
        const storyImages = images.filter(img => {
            const src = img.src || '';
            const isInstagramCDN = src.includes('cdninstagram.com') || src.includes('fbcdn.net');
            const width = img.naturalWidth || img.width || img.clientWidth || 0;
            return isInstagramCDN && width > 200;
        });
        
        if (storyImages.length > 0) {
            const best = storyImages.sort((a, b) => {
                const aSize = (a.naturalWidth || a.width) * (a.naturalHeight || a.height);
                const bSize = (b.naturalWidth || b.width) * (b.naturalHeight || b.height);
                return bSize - aSize;
            })[0];
            
            let url = best.src;
            if (best.srcset) {
                const sources = best.srcset.split(',').map(s => s.trim());
                const lastSource = sources[sources.length - 1];
                if (lastSource) {
                    const urlPart = lastSource.split(' ')[0];
                    if (urlPart) url = urlPart;
                }
            }
            
            return { type: 'image', url: url };
        }
        
        return { type: null, url: null };
    }
    
    // Sniff network resources that have been loaded (videos and images from Instagram CDN)
    function sniffNetworkResources() {
        const videos = [];
        const images = [];
        
        try {
            const entries = performance.getEntriesByType('resource');
            
            for (const entry of entries) {
                const url = entry.name;
                
                // Instagram CDN patterns for media
                const isInstagramCDN = url.includes('cdninstagram.com') || url.includes('fbcdn.net');
                if (!isInstagramCDN) continue;
                
                // Video patterns
                if (url.includes('.mp4') || url.includes('video') || entry.initiatorType === 'video') {
                    // Filter out tiny segments, get full videos
                    if (!url.includes('.m4s') && !url.includes('_dash_')) {
                        videos.push(url);
                    }
                }
                // Image patterns (usually have specific paths)
                else if ((url.includes('.jpg') || url.includes('.webp') || url.includes('/v/')) && 
                         (entry.initiatorType === 'img' || entry.initiatorType === 'css' || entry.initiatorType === 'fetch')) {
                    // Filter to likely content images (not tiny thumbnails)
                    // Instagram image URLs typically contain dimensions like 1080x1080
                    if (url.includes('1080') || url.includes('750') || url.includes('640') || url.includes('_n.')) {
                        images.push(url);
                    }
                }
            }
        } catch (e) {
            console.warn('ZenBlocker: Network sniffing failed', e);
        }
        
        console.log('ZenBlocker: Network sniff found', videos.length, 'videos,', images.length, 'images');
        return { videos, images };
    }
    
    // Floating download button for Single Post View (fallback when action row not found)
    function addFloatingDownloadButton() {
        if (document.querySelector('.zen-single-view-download-btn')) return;
        
        console.log('ZenBlocker: Adding floating download button for Single Post View');
        
        const btn = document.createElement('div');
        btn.className = 'zen-single-view-download-btn zen-download-btn';
        btn.title = 'Download Media';
        btn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            color: white;
            padding: 12px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        btn.innerHTML = `
            <svg fill="currentColor" height="24" width="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        };
        
        // Dropdown for the floating button
        const dropdown = document.createElement('div');
        dropdown.className = 'zen-download-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 8px;
            min-width: 200px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
            overflow: hidden;
        `;
        btn.appendChild(dropdown);
        
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = dropdown.style.display === 'block';
            if (isActive) {
                dropdown.style.display = 'none';
                return;
            }
            
            dropdown.style.display = 'block';
            dropdown.innerHTML = '<div style="padding: 12px; color: #666;">Scanning...</div>';
            
            // Get shortcode from URL
            let shortcode = null;
            const pathMatch = window.location.pathname.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/);
            if (pathMatch) shortcode = pathMatch[2];
            
            // Scan for media
            const resources = await scanSinglePostMedia(shortcode);
            
            // Separate downloadable and blob resources
            const downloadable = resources.filter(r => !r.isBlob);
            const blobs = resources.filter(r => r.isBlob);
            
            // Render dropdown
            dropdown.innerHTML = '';
            
            if (resources.length > 0) {
                // Header
                const header = document.createElement('div');
                header.style.cssText = 'padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #efefef; background: #fafafa;';
                
                if (downloadable.length > 0) {
                    header.innerText = `Found ${downloadable.length} item(s)`;
                } else if (blobs.length > 0) {
                    header.innerHTML = `<span style="color: #ed4956;">⚠️ ${blobs.length} protected video(s)</span>`;
                }
                dropdown.appendChild(header);
                
                // Download All button if multiple downloadable
                if (downloadable.length > 1) {
                    const btnAll = document.createElement('div');
                    btnAll.className = 'zen-download-item';
                    btnAll.style.cssText = 'padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #efefef;';
                    btnAll.innerText = `⬇️ Download All (${downloadable.length})`;
                    btnAll.onmouseenter = () => btnAll.style.background = '#f5f5f5';
                    btnAll.onmouseleave = () => btnAll.style.background = 'transparent';
                    btnAll.onclick = (ev) => {
                        ev.stopPropagation();
                        downloadable.forEach((r, i) => handleDownload(r.url, shortcode, i + 1));
                        dropdown.style.display = 'none';
                    };
                    dropdown.appendChild(btnAll);
                }
                
                // Individual downloadable items
                downloadable.forEach((res, idx) => {
                    const item = document.createElement('div');
                    item.className = 'zen-download-item';
                    item.style.cssText = 'padding: 10px 12px; cursor: pointer;';
                    const label = res.type === 'video' ? '🎬 Video' : '🖼️ Image';
                    item.innerText = `${label} #${idx + 1}`;
                    item.onmouseenter = () => item.style.background = '#f5f5f5';
                    item.onmouseleave = () => item.style.background = 'transparent';
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        handleDownload(res.url, shortcode, idx + 1);
                        dropdown.style.display = 'none';
                    };
                    dropdown.appendChild(item);
                });
                
                // Show blob warning if videos are protected
                if (blobs.length > 0 && downloadable.length === 0) {
                    const blobNote = document.createElement('div');
                    blobNote.style.cssText = 'padding: 10px 12px; color: #666; font-size: 12px; line-height: 1.4;';
                    blobNote.innerHTML = `This video uses a protected stream (Blob URL) that cannot be downloaded directly.<br><br>Try a screen recording tool instead.`;
                    dropdown.appendChild(blobNote);
                } else if (blobs.length > 0) {
                    const blobNote = document.createElement('div');
                    blobNote.style.cssText = 'padding: 8px 12px; color: #999; font-size: 11px; border-top: 1px solid #efefef;';
                    blobNote.innerText = `+ ${blobs.length} protected video(s) cannot be downloaded`;
                    dropdown.appendChild(blobNote);
                }
            } else {
                dropdown.innerHTML = '<div style="padding: 12px; color: #999; font-style: italic;">No media found. Wait for page to load.</div>';
            }
        };
        
        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        document.body.appendChild(btn);
    }
    
    // Scan media from Single Post View (more reliable than Feed)
    async function scanSinglePostMedia(shortcode) {
        const resources = [];
        const uniqueUrls = new Set();
        
        console.log('ZenBlocker: Scanning Single Post View for media, shortcode:', shortcode);
        
        // METHOD 1: Network Resource Sniffing (MOST RELIABLE!)
        // This captures actual CDN URLs that have been loaded by the browser
        const networkMedia = sniffNetworkResources();
        console.log('ZenBlocker: Network sniff results:', networkMedia);
        
        // Add videos from network
        networkMedia.videos.forEach((url, idx) => {
            if (!uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                resources.push({ type: 'video', url: url, index: idx + 1 });
            }
        });
        
        // Add images from network (if no videos found, or add all for carousels)
        networkMedia.images.forEach((url, idx) => {
            if (!uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                resources.push({ type: 'image', url: url, index: resources.length + 1 });
            }
        });
        
        // METHOD 2: Try inject.js (MAIN world) for React data
        if (resources.length === 0 && shortcode) {
            try {
                const pageData = await askPageContextForMedia(shortcode);
                console.log('ZenBlocker: Page context returned:', pageData);
                if (pageData) {
                    // Carousel
                    if (pageData.carousel && pageData.carousel.length > 0) {
                        pageData.carousel.forEach((c, idx) => {
                            if (c.url && !uniqueUrls.has(c.url)) {
                                uniqueUrls.add(c.url);
                                resources.push({ type: c.type, url: c.url, index: idx + 1 });
                            }
                        });
                    }
                    // Single Video
                    else if (pageData.video_url && !uniqueUrls.has(pageData.video_url)) {
                        uniqueUrls.add(pageData.video_url);
                        resources.push({ type: 'video', url: pageData.video_url, index: 1 });
                    }
                }
            } catch (err) {
                console.warn('ZenBlocker: Page context scan failed', err);
            }
        }
        
        // METHOD 3: DOM scanning fallback
        if (resources.length === 0) {
            console.log('ZenBlocker: Falling back to DOM scanning...');
            
            // Videos - check all video elements
            const videos = document.querySelectorAll('video');
            console.log('ZenBlocker: Found', videos.length, 'video elements');
            
            videos.forEach((video, idx) => {
                let src = video.src;
                if (!src) {
                    const source = video.querySelector('source');
                    if (source) src = source.src;
                }
                
                console.log('ZenBlocker: Video', idx, 'src:', src ? src.substring(0, 50) + '...' : 'none');
                
                // For Single Post View, we include blob URLs but mark them
                if (src && !uniqueUrls.has(src)) {
                    uniqueUrls.add(src);
                    if (src.startsWith('blob:')) {
                        // Blob URLs - we'll show a message but still list them
                        resources.push({ type: 'video', url: src, index: idx + 1, isBlob: true });
                    } else {
                        resources.push({ type: 'video', url: src, index: idx + 1 });
                    }
                }
            });
            
            // Images - find the main post image(s)
            const images = document.querySelectorAll('img');
            console.log('ZenBlocker: Found', images.length, 'img elements');
            
            // Filter to main content images (not profile pics, icons, etc.)
            const contentImages = Array.from(images).filter(img => {
                const width = img.naturalWidth || img.width || img.clientWidth || 0;
                const height = img.naturalHeight || img.height || img.clientHeight || 0;
                const src = img.src || '';
                const isInstagramCDN = src.includes('cdninstagram.com') || src.includes('fbcdn.net');
                const isLargeEnough = (width > 200 && height > 200) || (width === 0 && isInstagramCDN);
                const isNotProfilePic = !(img.alt && img.alt.includes('profile picture'));
                return isInstagramCDN && isLargeEnough && isNotProfilePic;
            });
            
            console.log('ZenBlocker: Filtered to', contentImages.length, 'content images');
            
            contentImages.forEach((img, idx) => {
                let src = img.src;
                if (img.srcset) {
                    const sources = img.srcset.split(',').map(s => s.trim());
                    const lastSource = sources[sources.length - 1];
                    if (lastSource) {
                        const urlPart = lastSource.split(' ')[0];
                        if (urlPart) src = urlPart;
                    }
                }
                
                if (src && !uniqueUrls.has(src)) {
                    uniqueUrls.add(src);
                    resources.push({ type: 'image', url: src, index: resources.length + 1 });
                    console.log('ZenBlocker: Added image:', src.substring(0, 60) + '...');
                }
            });
        }
        
        console.log('ZenBlocker: Total resources found:', resources.length);
        return resources;
    }

    function handleDomUpdates() {
        // Check what view we're in
        const isInSinglePostView = window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/');
        const isInStoriesView = window.location.pathname.includes('/stories/');
        
        // CLEANUP: Remove floating buttons if we navigated away from their respective views
        if (!isInStoriesView) {
            const storyBtn = document.querySelector('.zen-stories-download-btn');
            if (storyBtn) storyBtn.remove();
        }
        if (!isInSinglePostView) {
            const singleViewBtn = document.querySelector('.zen-single-view-download-btn');
            if (singleViewBtn) singleViewBtn.remove();
        }
        
        // STORIES VIEW: Handle separately with dedicated logic
        if (isInStoriesView) {
            handleStoriesView();
            return;
        }

        // Global UI Hides
        applyNavHide('hideReels', 'selectorReelsNav', [
            'a[href*="/reels"]',
            'a[href*="/reel"]',
            'a[aria-label="Reels"]',
            'svg[aria-label="Reels"]',
            'div[role="tab"][aria-label*="Reels"]'
        ]);

        applyNavHide('hideExplore', 'selectorExploreNav', [
            'a[aria-label="Explore"]',
            'a[href="/explore/"]',
            'svg[aria-label="Explore"]'
        ]);

        applyNavHide('hideExplorer', 'selectorExplorerNav', [
            'a[aria-label="Search"]',
            'button[aria-label="Search"]',
            'svg[aria-label="Search"]'
        ]);

        applyNavHide('hideNotifications', 'selectorNotificationsNav', [
            'a[aria-label="Notifications"]',
            'a[href="/accounts/activity/"]',
            'svg[aria-label="Notifications"]'
        ]);

        applyNavHide('hideMessages', 'selectorMessagesNav', [
            'a[aria-label*="Message"]',
            'a[href="/direct/inbox/"]',
            'svg[aria-label*="Messenger"]',
            'svg[aria-label*="Direct"]'
        ]);

        applyNavHide('hideMoreNav', 'selectorMoreNav', [
            'button[aria-label="More"]',
            'svg[aria-label="More"]',
            'div[aria-label="More"]',
            'div[role="button"][aria-label="More"]'
        ]);

        if (settings.customHideSelectors && settings.customHideSelectors.trim()) {
            hideCustomSelectors(settings.customHideSelectors);
        }
        
        // Select all potential post articles
        // Refined selector to avoid grabbing the entire feed container 'main'
        // 'article' is standard for feed posts.
        
        const defaultPostSelector = 'article';
        let postSelector = (settings.selectorPost && settings.selectorPost.trim()) 
                           ? settings.selectorPost 
                           : defaultPostSelector;

        let articles = Array.from(document.querySelectorAll(postSelector));
        
        // For Single Post View: find articles OR fallback to main section with the media
        if (isInSinglePostView && articles.length === 0 && !settings.selectorPost) {
            // Try multiple selectors for Single Post View
            // The post content is often in a section element or a div with specific structure
            const singleViewContainer = 
                document.querySelector('main[role="main"] section') || 
                document.querySelector('main[role="main"]') ||
                document.querySelector('div[role="dialog"]'); // For modal view
            
            if (singleViewContainer) {
                articles = [singleViewContainer];
            }
        }
        
        // Debug: Log what we found in Single Post View
        if (isInSinglePostView) {
            console.log('ZenBlocker: Single Post View detected, found', articles.length, 'article(s)');
        }
        
        const maxPosts = parseInt(settings.maxPosts) || 20;

        articles.forEach(article => {
            if (processedPosts.has(article)) return;

            // Mark as processed immediately so we don't re-run expensive logic
            processedPosts.add(article);
            
            // Only count posts in the FEED, not in Single Post View
            // Single Post View = user opened a specific post, not scrolling feed
            const shouldCountPost = !isInSinglePostView;
            
            // Strict Scroll Limit Enforcement (only for feed)
            if (shouldCountPost && settings.enableScrollLimit && postCount >= maxPosts) {
                article.style.display = 'none';
                checkScrollLimit();
                return;
            }

            // Increment counter only for feed posts
            if (shouldCountPost) {
                updateCounter();
            }

            // 1. Keyword Blocking (still applies to single post view)
            if (settings.enableKeywordBlock && settings.keywords) {
                const keywords = settings.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                if (keywords.length > 0) {
                    const textContent = article.innerText.toLowerCase();
                    const found = keywords.some(keyword => textContent.includes(keyword));
                    if (found) {
                        article.style.display = 'none';
                        console.log('ZenBlocker: Blocked post containing keywords');
                        return; // Stop processing this article
                    }
                }
            }

            // 2. Hide UI Elements
            // Note: Selectors here are based on common aria-labels or SVG paths which are more stable than obfuscated class names
            if (settings.hideLikes) {
                // Find Like button by aria-label
                const defaultLikeSelector = 'svg[aria-label="Like"], svg[aria-label="Unlike"]';
                const likeSelector = (settings.selectorLike && settings.selectorLike.trim()) 
                                   ? settings.selectorLike 
                                   : defaultLikeSelector;

                const heartSvg = article.querySelector(likeSelector);
                if (heartSvg) {
                    // Traverse up to the main button/link container for the like action
                    // Usually enclosed in a role="button" or an anchor tag nearby
                    const btn = heartSvg.closest('[role="button"]') || heartSvg.closest('button');
                    if (btn) btn.style.display = 'none';
                }
                
                // Hide "Liked by..." text
                const likeTextLinks = article.querySelectorAll('a[href*="/liked_by/"]');
                likeTextLinks.forEach(a => {
                    // Hide the container holding "Liked by X and others"
                    // Safe check for closest element
                    const container = a.closest('div[style*="flex-direction: row"]'); 
                    if (container) container.style.display = 'none';
                    else a.style.display = 'none'; // Fallback
                });
            }

            if (settings.hideShare) {
                const defaultShareSelector = 'svg[aria-label="Share Post"], svg[aria-label="Share"]';
                const shareSelector = (settings.selectorShare && settings.selectorShare.trim()) 
                                    ? settings.selectorShare 
                                    : defaultShareSelector;

                const shareSvg = article.querySelector(shareSelector);
                if (shareSvg) {
                    const btn = shareSvg.closest('[role="button"]') || shareSvg.closest('button');
                    if (btn) btn.style.display = 'none';
                }
            }

            if (settings.hideComments) {
                const defaultCommentSelector = 'svg[aria-label="Comment"]';
                const commentSelector = (settings.selectorComment && settings.selectorComment.trim()) 
                                      ? settings.selectorComment 
                                      : defaultCommentSelector;

                const commentSvg = article.querySelector(commentSelector);
                if (commentSvg) {
                   const btn = commentSvg.closest('[role="button"]') || commentSvg.closest('button');
                   if (btn) btn.style.display = 'none';
                }
                // Hide the comment section text inputs
                const commentForm = article.querySelector('form');
                if(commentForm) commentForm.style.display = 'none';
            }

            if (settings.hideSave) {
                const defaultSaveSelector = 'svg[aria-label="Save"], svg[aria-label="Remove"]';
                const saveSelector = (settings.selectorSave && settings.selectorSave.trim()) 
                                    ? settings.selectorSave 
                                    : defaultSaveSelector;

                const saveSvg = article.querySelector(saveSelector);
                if (saveSvg) {
                    const btn = saveSvg.closest('[role="button"]') || saveSvg.closest('button');
                    if (btn) btn.style.display = 'none';
                }
            }

            if (settings.hideMoreOptions) {
                const defaultMoreSelector = 'svg[aria-label="More options"]';
                const moreSelector = (settings.selectorMore && settings.selectorMore.trim()) 
                                    ? settings.selectorMore 
                                    : defaultMoreSelector;

                const moreSvg = article.querySelector(moreSelector);
                if (moreSvg) {
                    const btn = moreSvg.closest('[role="button"]') || moreSvg.closest('button');
                    if (btn) btn.style.display = 'none';
                }
            }

            // 3. Media Download
            if (settings.enableDownload) {
                addDownloadButton(article);
            }
        });

        // 4.5 SINGLE POST VIEW: Always ensure floating button is added (more reliable than inline)
        if (isInSinglePostView && settings.enableDownload) {
            addFloatingDownloadButton();
        }
        
        // 4. Scroll Limit
        if(settings.enableScrollLimit) {
            checkScrollLimit();
        }
    }

    // Hide Reels button/tab in navigation
    function applyNavHide(settingKey, selectorKey, defaultSelectors) {
        if (!settings[settingKey]) return;

        const selectors = buildSelectorList(settings[selectorKey], defaultSelectors);
        selectors.forEach(sel => {
            try {
                const nodes = document.querySelectorAll(sel);
                nodes.forEach(node => {
                    const container = node.closest('a') || node.closest('button') || node.closest('[role="button"]') || node.closest('[role="link"]') || node.closest('li') || node;
                    if (container) container.style.display = 'none';
                });
            } catch (e) {
                console.warn(`ZenBlocker: Invalid selector for ${settingKey}:`, sel, e.message);
            }
        });
    }

    function buildSelectorList(customValue, defaults) {
        if (customValue && typeof customValue === 'string' && customValue.trim()) {
            return customValue.split(',').map(s => s.trim()).filter(Boolean);
        }
        return defaults;
    }

    function hideCustomSelectors(list) {
        const selectors = list.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(sel => {
            try {
                document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
            } catch (e) {
                console.warn('ZenBlocker: Invalid custom hide selector:', sel, e.message);
            }
        });
    }

    function checkScrollLimit() {
        if (!settings.maxPosts) return;
        
        // We count processed articles
        // If we exceed the limit, we try to stop the loading or hide content
        const max = parseInt(settings.maxPosts) || 20;
        
        if (postCount >= max) {
            // Option A: Hard stop - remove scroll capability globally
            document.body.style.overflow = 'hidden'; 
            document.documentElement.style.overflow = 'hidden';
            
            // Option B: Show a barrier and hide subsequent posts
            // We do this proactively in handleDomUpdates now, but redundancy helps
            
            // Add a visible indicator if not added
            if (!document.getElementById('zen-scroll-overlay')) {
                const warning = document.createElement('div');
                warning.id = 'zen-scroll-overlay';
                warning.style.cssText = `
                    position: fixed; 
                    bottom: 20px; 
                    right: 20px; 
                    background: #c13584; 
                    color: white; 
                    padding: 15px; 
                    border-radius: 8px; 
                    z-index: 9999;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    backdrop-filter: blur(4px);
                `;

                // Calculate return time for display
                chrome.storage.local.get(['zenLastReset'], (data) => {
                    const lastReset = data.zenLastReset || Date.now();
                    const intervalHours = parseFloat(settings.resetInterval) || 24;
                    const nextReset = lastReset + (intervalHours * 3600 * 1000);
                    const timeLeftMinutes = Math.max(0, Math.ceil((nextReset - Date.now()) / 60000));
                    
                    const hours = Math.floor(timeLeftMinutes / 60);
                    const mins = timeLeftMinutes % 60;
                    
                    const timeMsg = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                    warning.innerHTML = `
                        <div>You've reached your limit (${max} posts)!</div>
                        <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">Reset in: ${timeMsg}</div>
                    `;
                });
                
                document.body.appendChild(warning);
            }
        }
    }

    function addDownloadButton(article) {
        // Already added anywhere in this container?
        if (article.querySelector('.zen-download-btn')) return;
        
        // For Single Post View (main element), we need to search deeper for the action section
        const isMainElement = article.tagName === 'MAIN';
        const searchRoot = isMainElement ? article : article;
        
        // Find one of the action icons to locate the container
        const customSelector = (settings.selectorLike && settings.selectorLike.trim()) ? settings.selectorLike : 'svg[aria-label="Like"], svg[aria-label="Unlike"], svg[aria-label="Comment"]';
        let triggerIcon = searchRoot.querySelector(customSelector) || searchRoot.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]');
        
        // Single Post View fallback: Try broader search including Save button
        if (!triggerIcon) {
            triggerIcon = searchRoot.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"], svg[aria-label="More options"]');
        }
        
        // Still nothing? Try to find ANY action section with recognizable buttons
        if (!triggerIcon) {
            // Look for the section that typically contains action buttons (usually has multiple svg icons)
            const allSvgs = searchRoot.querySelectorAll('svg[aria-label]');
            for (const svg of allSvgs) {
                const label = svg.getAttribute('aria-label') || '';
                if (['Like', 'Unlike', 'Comment', 'Share', 'Save', 'More options'].some(l => label.includes(l))) {
                    triggerIcon = svg;
                    break;
                }
            }
        }
        
        // Determine if we're in Single Post View
        const isInSinglePostView = window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/');
        
        if (!triggerIcon) {
            console.warn('ZenBlocker: Could not find action icons to place download button in', isMainElement ? 'Single Post View' : 'article');
            
            // FALLBACK: For Single Post View, add a floating button if we can't find the action row
            if (isInSinglePostView && !document.querySelector('.zen-single-view-download-btn')) {
                addFloatingDownloadButton();
            }
            return;
        }
        
        console.log('ZenBlocker: Found trigger icon:', triggerIcon.getAttribute('aria-label'));
        
        // The icons are usually inside a button/link, which is inside a div, which is inside the main action row.
        const btnContainer = triggerIcon.closest('[role="button"]') || triggerIcon.closest('button') || triggerIcon.parentElement;
        
        if (btnContainer) {
            // Find the parent row that contains these buttons
            // Try multiple levels up to find a row with multiple action buttons
            let actionRow = btnContainer.parentElement;
            
            // If actionRow is too small or doesn't seem like a row, go up one more level
            if (actionRow && actionRow.childElementCount < 2) {
                actionRow = actionRow.parentElement;
            }

            if (actionRow && !actionRow.querySelector('.zen-download-btn')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'zen-download-btn-wrapper zen-download-btn';
                wrapper.title = 'Download Media';
                wrapper.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; cursor: pointer;';

                // Main Icon
                const iconDiv = document.createElement('div');
                iconDiv.style.padding = '8px';
                iconDiv.innerHTML = `
                    <svg aria-label="Download Media" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                `;
                wrapper.appendChild(iconDiv);

                // Dropdown Menu
                const dropdown = document.createElement('div');
                dropdown.className = 'zen-download-dropdown';
                wrapper.appendChild(dropdown);

                // Populate on toggle
                const toggleDropdown = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Close any other open dropdowns first
                    document.querySelectorAll('.zen-download-dropdown.active').forEach(d => {
                        if (d !== dropdown) d.classList.remove('active');
                    });

                    const isActive = dropdown.classList.contains('active');
                    if (isActive) {
                        dropdown.classList.remove('active');
                        return;
                    }
                    
                    dropdown.classList.add('active');
                    dropdown.innerHTML = '<div class="zen-download-item">Scanning...</div>';

                    // 1. Try to find shortcode (CRITICAL: Must be accurate to avoid "random image" bug)
                    let shortcode = null;
                    
                    // Improved Extraction: Prioritize Metadata-like links (timestamps)
                    // Caption/Comment links often point to OTHER posts, causing data mismatch.
                    const allLinks = Array.from(article.querySelectorAll('a[href*="/p/"]'));
                    let bestLink = null;
                    
                    // Priority 1: Link containing a <time> element (Standard Timestamp)
                    const timeLink = allLinks.find(a => a.querySelector('time'));
                    if (timeLink) {
                        bestLink = timeLink;
                    } 
                    // Priority 2: Link with specific class patterns commonly used for dates (brittle but effective)
                    // Priority 3: Last link in the article (usually the date is at the bottom)
                    // BUT only if it doesn't look like a comment.
                    else if (allLinks.length > 0) {
                        bestLink = allLinks[allLinks.length - 1];
                    }

                    if (bestLink) {
                         const match = bestLink.getAttribute('href').match(/\/p\/([a-zA-Z0-9_-]+)/);
                         if (match) shortcode = match[1];
                    }

                    // Fallback: If no links found, check if we are in Single View
                    if (!shortcode && window.location.pathname.includes('/p/')) {
                         const match = window.location.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
                         if (match) shortcode = match[1];
                    }

                    console.log('ZenBlocker: Identified shortcode:', shortcode);

                    // 2. Fetch High-Quality Data from Main World (inject.js) only if we have ID
                    let pageData = null;
                    if (shortcode) {
                        try {
                            pageData = await askPageContextForMedia(shortcode);
                        } catch (err) {
                            console.warn('ZenBlocker: Async scan failed', err);
                        }
                    } else {
                        console.warn('ZenBlocker: No shortcode found, skipping React scan to prevent mismatched data.');
                    }

                    // 3. Fallback to Synchronous DOM/Isolated Scan
                    let resources = [];
                    if (pageData) {
                         // Convert inject.js format to our internal resources format
                         const method = 'React';
                         // Carousel
                         if (pageData.carousel && pageData.carousel.length > 0) {
                             pageData.carousel.forEach((c, idx) => {
                                 if (c.url) {
                                     resources.push({
                                         type: c.type,
                                         url: c.url,
                                         index: idx + 1,
                                         shortcode: shortcode,
                                         _method: method
                                     });
                                 }
                             });
                         } 
                         // Single Video (Priority, prevents "random image" fallback)
                         else if (pageData.video_url) {
                            resources.push({
                                type: 'video',
                                url: pageData.video_url,
                                index: 1,
                                shortcode: shortcode,
                                _method: method
                            });
                         }
                         // Single Image (Only if NOT video)
                         else if (!pageData.is_video) { 
                             // We might not have a URL for single image in normalizeMedia yet, check raw
                             // But usually normalizeMedia focuses on video. 
                             // If it was just an image, we probably rely on DOM which is fine.
                         }
                    }

                    // If Page Context failed or returned nothing useful, mix in DOM results
                    if (resources.length === 0) {
                         console.warn('ZenBlocker: Page Context returned no media. Using DOM fallback.');
                         resources = getMediaResources(article);
                    }
                    
                    // Check if we're in Single Post View (reliable) or Feed View (unreliable)
                    const isInSingleView = window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/');
                    
                    const renderDropdown = () => {
                         dropdown.innerHTML = ''; // Clear

                         // Header
                         const header = document.createElement('div');
                         header.style.cssText = 'padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #efefef; display: flex; justify-content: space-between; align-items: center; background: #fafafa;';
                         
                         const method = (resources.length > 0 && resources[0]._method) ? resources[0]._method : 'DOM';
                         const hasVideos = resources.some(r => r.type === 'video');
                         const hasBlobs = resources.some(r => r.url && r.url.startsWith('blob:'));
                         
                         // Show warning if in Feed View with videos/blobs
                         if (!isInSingleView && (hasVideos || hasBlobs)) {
                             header.innerHTML = `<span style="color:#ed4956;">⚠️ Limited (Feed View)</span>`;
                         } else {
                             header.innerHTML = `<span>Found ${resources.length}</span>`;
                         }
                         
                         dropdown.appendChild(header);

                         // PRIMARY ACTION: Open in Single View (only show in Feed View)
                         if (!isInSingleView && shortcode) {
                             const btnOpen = document.createElement('div');
                             btnOpen.className = 'zen-download-item';
                             btnOpen.style.cssText = 'background: #0095f6; color: white; font-weight: bold;';
                             btnOpen.innerText = '📂 Open Post (Reliable Download)';
                             btnOpen.onclick = (ev) => {
                                 ev.stopPropagation();
                                 window.open(`/p/${shortcode}/`, '_blank');
                                 dropdown.classList.remove('active');
                             };
                             dropdown.appendChild(btnOpen);
                             
                             // Separator
                             const sep = document.createElement('div');
                             sep.style.cssText = 'padding: 4px 12px; font-size: 11px; color: #999; border-bottom: 1px solid #efefef;';
                             sep.innerText = '— or try below —';
                             dropdown.appendChild(sep);
                         }

                         if (resources.length > 0) {
                             // Filter out blob URLs for display (they won't work anyway)
                             const downloadableResources = resources.filter(r => r.url && !r.url.startsWith('blob:'));
                             const blobResources = resources.filter(r => r.url && r.url.startsWith('blob:'));
                             
                             // === DOWNLOAD VISIBLE (for images/non-blob, always useful) ===
                             const best = getBestResource(downloadableResources.length > 0 ? downloadableResources : resources, article);
                             if (best && best.url && !best.url.startsWith('blob:')) {
                                 const btnVisible = document.createElement('div');
                                 btnVisible.className = 'zen-download-item';
                                 btnVisible.style.cssText = 'font-weight: bold; background: #fafafa;';
                                 const visLabel = best.type === 'video' ? '🎬 Download Visible Video' : '🖼️ Download Visible Image';
                                 btnVisible.innerText = visLabel;
                                 btnVisible.onclick = (ev) => {
                                     ev.stopPropagation();
                                     handleDownload(best.url, best.shortcode, best.index);
                                     dropdown.classList.remove('active');
                                 };
                                 dropdown.appendChild(btnVisible);
                             }
                             
                             // "Download All" option (only for non-blob URLs, multiple items)
                             if (downloadableResources.length > 1) {
                                 const btnAll = document.createElement('div');
                                 btnAll.className = 'zen-download-item';
                                 btnAll.innerText = `⬇️ Download All (${downloadableResources.length} items)`;
                                 btnAll.onclick = (ev) => {
                                     ev.stopPropagation();
                                     const uniqueUrls = new Set();
                                     downloadableResources.forEach(r => {
                                         if (!uniqueUrls.has(r.url)) {
                                             uniqueUrls.add(r.url);
                                             handleDownload(r.url, r.shortcode, r.index);
                                         }
                                     });
                                     dropdown.classList.remove('active');
                                 };
                                 dropdown.appendChild(btnAll);
                             }

                             // Individual items (show if more than 1 or for clarity)
                             if (downloadableResources.length >= 1) {
                                 downloadableResources.forEach(res => {
                                     const item = document.createElement('div');
                                     item.className = 'zen-download-item';
                                     const label = res.type === 'video' ? '🎬 Video' : '🖼️ Image';
                                     const indexLabel = (res.index && res.index !== '?') ? ` #${res.index}` : '';
                                     item.innerText = `${label}${indexLabel}`;
                                     item.onclick = (ev) => {
                                         ev.stopPropagation();
                                         handleDownload(res.url, res.shortcode, res.index);
                                         dropdown.classList.remove('active');
                                     };
                                     dropdown.appendChild(item);
                                 });
                             }
                             
                             // Show blob items as disabled with explanation
                             if (blobResources.length > 0) {
                                 const blobNote = document.createElement('div');
                                 blobNote.className = 'zen-download-item';
                                 blobNote.style.cssText = 'color: #999; font-size: 11px; cursor: default;';
                                 blobNote.innerText = `⚠️ ${blobResources.length} video(s) protected`;
                                 dropdown.appendChild(blobNote);
                             }

                        } else {
                            const noMedia = document.createElement('div');
                            noMedia.className = 'zen-download-item';
                            noMedia.style.cssText = 'cursor:default; color:#999; font-style: italic;';
                            noMedia.innerText = 'No media found';
                            dropdown.appendChild(noMedia);
                        }
                    };
                    
                    renderDropdown();
                    dropdown.classList.add('active');
                };

                // Main Click (Toggle)
                iconDiv.onclick = toggleDropdown;

                // Close on global click
                document.addEventListener('click', (e) => {
                    if (e.target instanceof Node && !wrapper.contains(e.target)) {
                         dropdown.classList.remove('active');
                    }
                });

                actionRow.appendChild(wrapper);
            }
        }
    }

    // Helper: Recursively search an object for media-like structures
    // Limits depth to avoid performance hits on massive React trees
    function searchForMediaData(obj, depth = 0, maxDepth = 10) {
        if (!obj || typeof obj !== 'object' || depth > maxDepth) return null;
        
        // Fast checks for signatures
        if (obj.video_versions && Array.isArray(obj.video_versions)) return obj;
        if (obj.image_versions2 && obj.image_versions2.candidates) return obj;
        if (obj.carousel_media && Array.isArray(obj.carousel_media)) return obj;
        
        // Specific checks for "items" wrapper (common in GQL)
        if (obj.items && Array.isArray(obj.items) && obj.items.length > 0 && obj.items[0].video_versions) return obj.items[0];

        // Recurse strictly for likely containers (avoiding circulars/DOM nodes)
        // We filter keys to avoid standard React prop noise
        const keys = Object.keys(obj).filter(k => 
            k !== 'children' && k !== 'style' && !k.startsWith('__') && typeof obj[k] === 'object'
        );

        for (const key of keys) {
            const found = searchForMediaData(obj[key], depth + 1, maxDepth);
            if (found) return found;
        }
        return null;
    }

    // Helper to extract full media data from React Props
    function getMediaFromReact(element) {
        if (!element) return null;

        // Try to find the react key
        const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber') || key.startsWith('__reactProps'));
        
        let fiber = reactKey ? element[reactKey] : null;

        // If direct access failed, try querying a likely child that might have it (like the image or video container)
        if (!fiber) {
             const child = element.querySelector('div[role="button"], div._aagv, div._aagu, ._aagv, ._aagu');
             if (child) {
                 const childKey = Object.keys(child).find(key => key.startsWith('__reactFiber'));
                 if (childKey) fiber = child[childKey];
             }
        }

        if (!fiber) return null;

        let attempts = 0;
        
        // Traverse UP the tree looking for data
        while (fiber && attempts < 200) {
            const props = fiber.memoizedProps || fiber.props;
            
            if (props) {
                 // Use the deep search on this prop set
                 const found = searchForMediaData(props, 0, 5); // search 5 levels deep inside props
                 if (found) return found;
            }
            fiber = fiber.return;
            attempts++;
        }
        return null;
    }

    function getMediaResources(container) {
        const resources = [];
        const uniqueUrls = new Set();
        let extractionMethod = 'DOM';
        let shortcode = null;

        // Try to find the shortcode first with improved heuristics
        const potentialLinks = Array.from(container.querySelectorAll('a[href*="/p/"]'));
        for (const link of potentialLinks) {
            const href = link.getAttribute('href');
            const match = href.match(/\/p\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                shortcode = match[1];
                break;
            }
        }
        
        // If not found, try the current URL if we are in single view
        if (!shortcode && window.location.pathname.includes('/p/')) {
            const match = window.location.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
            if (match) shortcode = match[1];
        }

        // METHOD 1: React Props (The Gold Standard)
        // ... (This usually fails in Isolated World content scripts but kept for legacy/Firefox)
        try {
            // Attempt to find React data on current element OR parents
            let reactMedia = getMediaFromReact(container);
            if (!reactMedia) {
                 const parent = container.closest('article, ._aagu, ._aagv') || container.parentElement;
                 if (parent) {
                     reactMedia = getMediaFromReact(parent);
                 }
            }

            if (reactMedia) {
                // Ensure strict match if we have a shortcode, otherwise discard to avoid "Random Image" bug
                let isMatch = true;
                if (shortcode && (reactMedia.code && reactMedia.code !== shortcode) && (reactMedia.shortcode && reactMedia.shortcode !== shortcode)) {
                     isMatch = false;
                }
                
                if (isMatch) {
                    extractionMethod = 'React';

                    // Normalizing carousel data
                    let items = [];
                if (reactMedia.carousel_media && Array.isArray(reactMedia.carousel_media)) {
                    // This is the most reliable source for "All" in a carousel
                    items = reactMedia.carousel_media;
                } else if (reactMedia.edge_sidecar_to_children && reactMedia.edge_sidecar_to_children.edges) {
                    // GraphAPI style structure fallback
                    items = reactMedia.edge_sidecar_to_children.edges.map(e => e.node);
                } else {
                    // Single item (or current item of a carousel if we grabbed a sub-node)
                    items = [reactMedia];
                }
                
                items.forEach((entry, index) => {
                    // Sometimes the actual data is wrapped in 'item' or 'node'
                    const item = entry.node || entry.item || entry;
                    
                    // Video
                    if (item.video_versions && item.video_versions.length > 0) {
                        // Sort by width/height to get best quality (usually first or last? Instagram is inconsistent, search for 1080/720)
                        const bestVid = [...item.video_versions].sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
                        const vidUrl = bestVid ? bestVid.url : item.video_versions[0].url;
                        
                        if (vidUrl && !uniqueUrls.has(vidUrl)) {
                            uniqueUrls.add(vidUrl);
                            resources.push({
                                type: 'video',
                                url: vidUrl,
                                index: index + 1,
                                height: bestVid ? bestVid.height : 0,
                                shortcode: shortcode // Attach shortcode for fallback
                            });
                        }
                    } 
                    // Image
                    else if (item.image_versions2 && item.image_versions2.candidates) {
                        const candidates = item.image_versions2.candidates;
                         // Sort desc by area
                        const best = [...candidates].sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
                        
                        if (best && best.url && !uniqueUrls.has(best.url)) {
                            uniqueUrls.add(best.url);
                             resources.push({
                                type: 'image',
                                url: best.url,
                                index: index + 1,
                                height: best.height || 0,
                                shortcode: shortcode
                            });
                        }
                    } 
                    // Fallbacks
                    else if (item.display_url && !uniqueUrls.has(item.display_url)) {
                         uniqueUrls.add(item.display_url);
                         resources.push({
                            type: 'image',
                            url: item.display_url,
                            index: index + 1, height: 0, 
                            shortcode: shortcode
                        });
                    }
                });
                
                if (resources.length > 0) {
                     resources.forEach(r => r._method = 'React');
                     return resources; 
                }
            }
          }
        } catch(e) { console.error('React extraction failed', e); }

        // METHOD 2: DOM Scraping (Fallback)
        console.warn('ZenBlocker: Falling back to DOM scraping.');

        // 1. Videos
        const videos = Array.from(container.querySelectorAll('video'));
        for (const video of videos) {
            let src = video.src;
            if (!src) {
                const source = video.querySelector('source');
                if (source) src = source.src;
            }
            if (src && !uniqueUrls.has(src)) {
                uniqueUrls.add(src);
                resources.push({
                    type: 'video',
                    url: src,
                    element: video,
                    rect: video.getBoundingClientRect(),
                    index: '?',
                    _method: 'DOM',
                    shortcode: shortcode // Attach shortcode for resolution
                });
            }
        }

        // 2. Images
        const images = Array.from(container.querySelectorAll('img'));
        for (const img of images) {
            const width = img.naturalWidth || img.width || 0;
            if (width > 250) { 
                let src = img.src;
                if (img.srcset) {
                    const sources = img.srcset.split(',').map(s => s.trim());
                    const lastSource = sources[sources.length - 1]; 
                    if (lastSource) {
                        const urlPart = lastSource.split(/\s+/)[0];
                        if (urlPart) src = urlPart;
                    }
                }
                
                if (src && !uniqueUrls.has(src)) {
                    uniqueUrls.add(src);
                    resources.push({
                        type: 'image',
                        url: src,
                        element: img,
                        rect: img.getBoundingClientRect(),
                        index: '?',
                        shortcode: shortcode
                    });
                }
            }
        }
        return resources;
    }

    function getBestResource(resources, container) {
        if (resources.length === 0) return null;

        // If we used React method, resources don't have 'element' attached usually (unless mixed logic used)
        // If we don't have element refs, we can't determine visibility by position easily.
        // HOWEVER, Instagram usually updates 'aria-label' or simple dots to show index.
        
        // HEURISTIC: Scraped DOM "visible" check
        // If we fell back to DOM, we have .rect and .element
        const domResources = resources.filter(r => r.element && r.rect);
        if (domResources.length > 0) {
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.top + (containerRect.height / 2);
            const containerCenterX = containerRect.left + (containerRect.width / 2);
            
            let bestRes = domResources[0];
            let minDist = Infinity;

            for (const res of domResources) {
                const rect = res.element.getBoundingClientRect();
                const resCenterY = rect.top + (rect.height / 2);
                const resCenterX = rect.left + (rect.width / 2);
                
                // Distance in 2D
                const dist = Math.sqrt(Math.pow(containerCenter - resCenterY, 2) + Math.pow(containerCenterX - resCenterX, 2));
                
                if (dist < minDist) {
                    minDist = dist;
                    bestRes = res;
                }
            }
            return bestRes;
        }

        // HEURISTIC: React Data but no DOM refs?
        // We can look for the "active" dot in the carousel UI
        // <div class="_acnb">...</div> dots
        // This is brittle. Return null or first? 
        // Better: Return the one corresponding to the 1/X counter if visible?
        // Or simply failover to "List" mode in UI.
        return null;
    }

    // ... existing ...

    // Inject the main-world script
    function injectScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        script.onload = function() {
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
    }
    injectScript();

    // Promisified helper to ask the Page Context for data
    function askPageContextForMedia(shortcode) {
        return new Promise((resolve) => {
            const handleMessage = (event) => {
                if (event.source !== window || !event.data || event.data.source !== 'ZEN_BLOCKER_PAGE') return;
                
                if (event.data.type === 'MEDIA_FOUND' && (!shortcode || event.data.data.shortcode === shortcode)) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data.data);
                } else if (event.data.type === 'MEDIA_NOT_FOUND' && event.data.shortcode === shortcode) {
                    window.removeEventListener('message', handleMessage);
                    resolve(null);
                }
            };
            
            // Timeout after 2s
            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                resolve(null);
            }, 2000);

            window.addEventListener('message', handleMessage);
            window.postMessage({
                source: 'ZEN_BLOCKER_CS',
                type: 'FIND_REACT_DATA',
                shortcode: shortcode
            }, '*');
        });
    }

    async function resolveMediaUrl(shortcode) {
        if (!shortcode) return null;
        
        console.log('ZenBlocker: Resolving media for', shortcode);

        // STRATEGY 1: Page Context Injection (Fastest, avoids network rate limits)
        try {
            const pageData = await askPageContextForMedia(shortcode);
            if (pageData) {
                console.log('ZenBlocker: Resolved via Page Context', pageData);
                // Return full data including carousel
                return pageData; 
            }
        } catch(e) { console.error('Page context resolution failed', e); }

        // STRATEGY 2: Legacy Network API (Backup)
        try {
            console.log('ZenBlocker: Attempting Network API fallback...');
            const response = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`);
            if (response.ok) {
                const data = await response.json();
                let item = null;
                if (data.graphql && data.graphql.shortcode_media) item = data.graphql.shortcode_media;
                else if (data.items && data.items[0]) item = data.items[0];

                if (item) {
                    // Match structure of inject.js normalizeMedia somewhat to keep consumer logic simple
                    // Or just return raw and let handleDownload adapt
                    return {
                        video_versions: item.video_versions,
                        is_video: item.is_video,
                        carousel: (item.edge_sidecar_to_children ? item.edge_sidecar_to_children.edges : []).map(e => {
                            const n = e.node;
                            return {
                                type: n.is_video ? 'video' : 'image',
                                url: (n.video_versions ? n.video_versions[0].url : n.display_url) // simplified
                            };
                        })
                    };
                }
            }
        } catch (e) {
            console.warn('ZenBlocker: API fetch failed', e);
        }
        
        return null; // Both failed
    }

    async function handleDownload(url, shortcode = null, index = null) {
        console.log('ZenBlocker: Downloading', url, shortcode, index);
        
        // Check if we're in Single Post View (where downloads are reliable)
        const isInSingleView = window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/');

        // IMMEDIATE BLOB REJECTION - Don't even try
        if (url && url.startsWith('blob:')) {
            console.warn('ZenBlocker: Blob URL detected - cannot download');
            
            if (shortcode && !isInSingleView) {
                const openPost = confirm(
                    "This video uses a protected stream (Blob) that cannot be downloaded from the feed.\n\n" +
                    "Click OK to open this post in a new tab where downloads work reliably."
                );
                if (openPost) {
                    window.open(`/p/${shortcode}/`, '_blank');
                }
            } else if (!shortcode) {
                alert("This video uses a protected stream that cannot be downloaded.\n\nTry opening the post directly and downloading from there.");
            }
            return;
        }

        // If no URL provided, try to resolve via shortcode
        if (!url && shortcode) {
             console.log('ZenBlocker: No URL provided, attempting to resolve via shortcode...');
             
             const mediaData = await resolveMediaUrl(shortcode);
             if (mediaData) {
                 // Case A: Carousel Item (if index provided)
                 if (index !== null && mediaData.carousel && mediaData.carousel.length >= index) {
                     const item = mediaData.carousel[index - 1]; // index is 1-based
                     if (item && item.url) {
                         console.log(`ZenBlocker: Resolved Carousel Item ${index}`, item.url);
                         url = item.url;
                     }
                 }
                 
                 // Case B: Single Video
                 if (!url && mediaData.video_url) {
                      url = mediaData.video_url;
                 } else if (!url && mediaData.video_versions) {
                      const best = mediaData.video_versions.sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
                      if (best) url = best.url;
                 }
                 
                 // Case C: Single Image Fallback
                 if (!url && mediaData.display_url) {
                      url = mediaData.display_url;
                 }
             }
        }

        if (!url) {
            console.error('ZenBlocker: Could not resolve download URL');
            
            if (shortcode && !isInSingleView) {
                const openPost = confirm(
                    "Could not find a downloadable URL for this media.\n\n" +
                    "Click OK to open this post in a new tab where downloads are more reliable."
                );
                if (openPost) {
                    window.open(`/p/${shortcode}/`, '_blank');
                }
            } else {
                alert("Could not find a downloadable URL for this media.");
            }
            return;
        }

        // Final blob check after resolution attempts
        if (url.startsWith('blob:')) {
            console.warn('ZenBlocker: Resolution returned blob URL - cannot download');
            if (shortcode && !isInSingleView) {
                const openPost = confirm(
                    "The resolved URL is still a protected stream.\n\n" +
                    "Click OK to open this post in a new tab for reliable download."
                );
                if (openPost) {
                    window.open(`/p/${shortcode}/`, '_blank');
                }
            } else {
                alert("This video uses a protected stream that cannot be downloaded.");
            }
            return;
        }

        // Standard URL - Send to background downloader
        console.log('ZenBlocker: Sending to background for download:', url);
        chrome.runtime.sendMessage({ type: 'download', url: url });
    }

    function applyGlobalStyles() {
        // Global CSS hides if needed (less jarring than JS removal)
        // Note: CSS selectors for Instagram are unstable, so JS removal based on aria-labels in handleDomUpdates is safer
    }

})();