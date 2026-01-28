// ZenBlocker Page Context Injector
// This runs in the MAIN world, having full access to React components and window objects.

(function() {
    console.log('ZenBlocker: Injector loaded in main world');

    window.addEventListener('message', function(event) {
        // Only accept messages from the content script
        if (event.source !== window || !event.data || event.data.source !== 'ZEN_BLOCKER_CS') return;

        if (event.data.type === 'FIND_REACT_DATA') {
            findMediaAndReply(event.data.shortcode);
        }
    });

    async function findMediaAndReply(targetShortcode) {
        console.log('ZenBlocker (Main): Searching for media...', targetShortcode);
        
        let foundData = null;

        // Strategy 1: Search _sharedData (Legacy but sometimes available)
        if (window._sharedData && window._sharedData.entry_data) {
            // Traverse...
        }

        // Strategy 2: React Root Scanning (The Heavy Hitter)
        const articles = document.querySelectorAll('article');
        for (const article of articles) {
            const data = getDeepReactProps(article);
            if (data && matchesShortcode(data, targetShortcode)) {
                foundData = data;
                break;
            }
        }

        // Strategy 3: Direct Page Fetch (The Gold Standard for "Protected" Blobs)
        // If React found nothing OR React data looks suspicious (no video_versions for a video), try fetching.
        if ((!foundData || (foundData.is_video && !foundData.video_versions)) && targetShortcode) {
            console.log('ZenBlocker: React incomplete/missing, fetching source for', targetShortcode);
            try {
                const fetchedData = await fetchPostSource(targetShortcode);
                if (fetchedData) {
                    console.log('ZenBlocker: Source fetch successful');
                    foundData = fetchedData;
                }
            } catch (e) {
                console.error('ZenBlocker: Source fetch failed', e);
            }
        }

        // Strategy 4: Network Resource Sniffing (Fallback)
        // STRICT RULE: If we are looking for a specific shortcode, DO NOT return a random performance entry.
        // It causes the "Random Video" bug where ID A gets Video B's content.
        if (!foundData && !targetShortcode) {
            console.log('ZenBlocker: React scan failed, trying Network Sniffer...');
            const snifferUrl = scanPerformanceEntries();
            if (snifferUrl) {
                console.log('ZenBlocker: Network Sniffer found candidate:', snifferUrl);
                foundData = {
                    code: targetShortcode,
                    video_versions: [{ url: snifferUrl, width: 720, height: 1280 }],
                    is_video: true, // Force video mode
                    media_type: 2
                };
            }
        }
        
        if (foundData) {
            // Normalize
            const normalized = normalizeMedia(foundData);
            window.postMessage({
                source: 'ZEN_BLOCKER_PAGE',
                type: 'MEDIA_FOUND',
                data: normalized
            }, '*');
        } else {
             window.postMessage({
                source: 'ZEN_BLOCKER_PAGE',
                type: 'MEDIA_NOT_FOUND',
                shortcode: targetShortcode
            }, '*');
        }
    }


    // Fetches the post permalink and regex-scrapes the JSON
    async function fetchPostSource(shortcode) {
        // Method A: REST API (GraphAPI style) - Most reliable for JSON
        try {
            console.log('ZenBlocker: Trying __a=1 API for', shortcode);
            const apiResp = await fetch(`/p/${shortcode}/?__a=1&__d=dis`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (apiResp.ok) {
                const json = await apiResp.json();
                console.log('ZenBlocker: API response received', json);
                if (json.graphql && json.graphql.shortcode_media) return json.graphql.shortcode_media;
                if (json.items && json.items[0]) return json.items[0];
            }
        } catch (e) {
            console.warn('ZenBlocker: API fetch failed, falling back to HTML scraping', e);
        }

        // Method B: HTML Scraping with embedded JSON extraction
        console.log('ZenBlocker: Trying HTML scraping for', shortcode);
        const response = await fetch(`/p/${shortcode}/`, {
            credentials: 'include' // Include cookies for logged-in session
        });
        const text = await response.text();
        
        // Try to find the big JSON blob in script tags
        // Instagram often embeds data in: window.__additionalDataLoaded('feed',{...});
        // or: <script type="application/json" data-sjs>...</script>
        // or: window._sharedData = {...};
        
        // Strategy 1: Look for additionalDataLoaded with our shortcode
        const additionalMatch = text.match(/window\.__additionalDataLoaded\s*\(\s*['"][^'"]+['"]\s*,\s*(\{.+?\})\s*\)\s*;/gs);
        if (additionalMatch) {
            for (const match of additionalMatch) {
                try {
                    const jsonStr = match.match(/,\s*(\{.+\})\s*\)/s);
                    if (jsonStr && jsonStr[1]) {
                        const parsed = JSON.parse(jsonStr[1]);
                        // Navigate to find our media
                        if (parsed.graphql && parsed.graphql.shortcode_media) {
                            return parsed.graphql.shortcode_media;
                        }
                        if (parsed.items && parsed.items[0]) {
                            return parsed.items[0];
                        }
                    }
                } catch (e) { /* continue */ }
            }
        }

        // Strategy 2: Look for _sharedData
        const sharedMatch = text.match(/window\._sharedData\s*=\s*(\{.+?\})\s*;<\/script>/s);
        if (sharedMatch && sharedMatch[1]) {
            try {
                const shared = JSON.parse(sharedMatch[1]);
                if (shared.entry_data && shared.entry_data.PostPage) {
                    const post = shared.entry_data.PostPage[0];
                    if (post && post.graphql && post.graphql.shortcode_media) {
                        return post.graphql.shortcode_media;
                    }
                }
            } catch (e) { /* continue */ }
        }

        // Strategy 3: Regex for video_versions directly (last resort)
        const videoMatch = text.match(/"video_versions":\s*(\[\{[^\]]+\}\])/);
        if (videoMatch && videoMatch[1]) {
            try {
                const videoVersions = JSON.parse(videoMatch[1]);
                return {
                    code: shortcode,
                    video_versions: videoVersions,
                    is_video: true,
                    media_type: 2
                };
            } catch (e) {
                // Try to extract just the URL
                const urlMatch = videoMatch[1].match(/"url":"([^"]+)"/);
                if (urlMatch && urlMatch[1]) {
                    const rawUrl = JSON.parse(`"${urlMatch[1]}"`);
                    return {
                        code: shortcode,
                        video_versions: [{ url: rawUrl, width: 1080, height: 1920 }],
                        is_video: true,
                        media_type: 2
                    };
                }
            }
        }

        // Strategy 4: Look for carousel_media in HTML
        const carouselMatch = text.match(/"carousel_media":\s*(\[\{.+?\}\])/s);
        if (carouselMatch && carouselMatch[1]) {
            try {
                const carouselMedia = JSON.parse(carouselMatch[1]);
                return {
                    code: shortcode,
                    carousel_media: carouselMedia,
                    is_video: false
                };
            } catch (e) { /* continue */ }
        }
        
        console.error('ZenBlocker: All fetch strategies failed for', shortcode);
        return null;
    }
    
    // Helper to extract full media data from React Props (MAIN WORLD VERSION)
    // Allows accessing Symbols that might be hidden in isolated world
    function getDeepReactProps(element) {
        const key = Object.keys(element).find(k => k.startsWith('__reactFiber'));
        if (!key) return null;
        
        let fiber = element[key];
        let attempts = 0;
        let bestCandidate = null;

        while(fiber && attempts < 100) {
            const props = fiber.memoizedProps;
            if (props) {
                // We prefer a candidate that has carousel_media or edge_sidecar
                const candidate = searchInProps(props);
                if (candidate) {
                     // Heuristic: If we already have a candidate, is this one better?
                     // If existing candidate is just random image, and this one has carousel, take this one.
                     if (!bestCandidate) {
                         bestCandidate = candidate;
                     } else {
                         // Upgrade path: Single -> Carousel
                         const hasSlides = (candidate.carousel_media || candidate.edge_sidecar_to_children);
                         const currHasSlides = (bestCandidate.carousel_media || bestCandidate.edge_sidecar_to_children);
                         
                         if (hasSlides && !currHasSlides) {
                             bestCandidate = candidate;
                         }
                     }
                }
            }
            fiber = fiber.return;
            attempts++;
        }
        return bestCandidate;
    }
    
    // Recursive search for media object within props
    // CRITICAL: This must find the PARENT object containing carousel_media, not just a single slide
    function searchInProps(obj, depth = 0, path = '') {
        if (!obj || depth > 6) return null;
        if (typeof obj !== 'object') return null;
        
        // Priority 1: Carousel data (this is what we MUST find for "Download All" to work)
        if (obj.carousel_media && Array.isArray(obj.carousel_media) && obj.carousel_media.length > 0) {
            console.log('ZenBlocker: Found carousel_media at', path, 'with', obj.carousel_media.length, 'items');
            return obj;
        }
        if (obj.edge_sidecar_to_children && obj.edge_sidecar_to_children.edges) {
            console.log('ZenBlocker: Found edge_sidecar at', path, 'with', obj.edge_sidecar_to_children.edges.length, 'items');
            return obj;
        }
        
        // Priority 2: Single video (only if no carousel found)
        if (obj.video_versions && Array.isArray(obj.video_versions)) {
            // Check if this is actually inside a carousel or standalone
            // If standalone, return it. If part of carousel, keep searching for parent.
            console.log('ZenBlocker: Found video_versions at', path);
            return obj;
        }

        // Common wrappers - MUST recurse into these
        const wrapperKeys = ['media', 'post', 'item', 'data', 'node', 'items', 'graphql', 'shortcode_media'];
        for (const k of wrapperKeys) {
            if (obj[k] && typeof obj[k] === 'object') {
                const found = searchInProps(obj[k], depth + 1, path + '.' + k);
                if (found) {
                    // Check if parent has carousel but child doesn't - prefer parent
                    if ((obj.carousel_media || obj.edge_sidecar_to_children) && 
                        !(found.carousel_media || found.edge_sidecar_to_children)) {
                        return obj; // Return parent with carousel
                    }
                    return found;
                }
            }
        }
        
        return null;
    }

    function matchesShortcode(data, shortcode) {
        if (!shortcode) {
            // STRICT RULE: Never loose match in feed.
            // Only loose match if we are confident there is only one post (Single View handled by URL check usually)
            // But inject.js doesn't know context easily.
            // Safest: FAIL if no shortcode. The content script should have scraped it.
            return false;
        }
        return (data.code === shortcode || data.shortcode === shortcode);
    }
    
    function normalizeMedia(data) {
         // Return raw data usually, but lets clean it up
         // We specifically want video_versions
         let bestVideo = null;
         if (data.video_versions) {
             bestVideo = [...data.video_versions].sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
         }
         
         // Handle Carousel
         let carousel = [];
         // Check both standard carousel_media and edge_sidecar_to_children (GraphAPI format)
         const nodes = data.carousel_media || 
                       (data.edge_sidecar_to_children ? data.edge_sidecar_to_children.edges : null);

         if (nodes && Array.isArray(nodes)) {
             console.log('ZenBlocker: Normalizing carousel with', nodes.length, 'items');
             carousel = nodes.map((m, idx) => {
                 // Unwrap 'node' if it exists (mostly edge_sidecar format)
                 const item = m.node || m; 
                 
                 console.log(`ZenBlocker: Carousel item ${idx}:`, Object.keys(item));
                 
                 let url = null;
                 let type = 'image';
                 
                 // Video takes priority
                 if (item.video_versions && item.video_versions.length > 0) {
                     const v = [...item.video_versions].sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
                     url = v.url;
                     type = 'video';
                     console.log(`ZenBlocker: Item ${idx} is VIDEO with URL`);
                 }
                 // Image from image_versions2 
                 else if (item.image_versions2 && item.image_versions2.candidates && item.image_versions2.candidates.length > 0) {
                     const i = [...item.image_versions2.candidates].sort((a,b) => (b.width * b.height) - (a.width * a.height))[0];
                     url = i.url;
                     console.log(`ZenBlocker: Item ${idx} is IMAGE from image_versions2`);
                 }
                 // Image from display_resources (GraphQL format)
                 else if (item.display_resources && item.display_resources.length > 0) {
                     const i = [...item.display_resources].sort((a,b) => (b.config_width * b.config_height) - (a.config_width * a.config_height))[0];
                     url = i.src || i.url;
                     console.log(`ZenBlocker: Item ${idx} is IMAGE from display_resources`);
                 }
                 // Fallback: display_url (direct URL in GraphQL)
                 else if (item.display_url) {
                     url = item.display_url;
                     console.log(`ZenBlocker: Item ${idx} is IMAGE from display_url`);
                 }
                 // Last resort: video_url for single video 
                 else if (item.video_url) {
                     url = item.video_url;
                     type = 'video';
                     console.log(`ZenBlocker: Item ${idx} is VIDEO from video_url`);
                 }
                 
                 if (!url) {
                     console.warn(`ZenBlocker: Item ${idx} has NO extractable URL. Keys:`, Object.keys(item));
                 }
                 
                 return { 
                     type: (item.media_type === 2 || item.is_video) ? 'video' : type, 
                     url: url
                 };
             });
         }
         
         console.log('ZenBlocker: Normalized carousel has', carousel.filter(c => c.url).length, 'items with URLs');
         
         return {
             shortcode: data.code || data.shortcode,
             video_url: bestVideo ? bestVideo.url : null,
             carousel: carousel,
             is_video: data.is_video || (data.media_type === 2)
         };
    }

    function scanPerformanceEntries() {
        try {
            const resources = performance.getEntriesByType('resource');
            const candidates = resources.filter(entry => {
                // Cast to PerformanceResourceTiming to access initiatorType
                const resourceEntry = entry;
                const isVideoInit = resourceEntry.initiatorType === 'video';
                const hasVideoExt = /\.(mp4|webm)($|\?)/i.test(entry.name);
                const isInstaCdn = entry.name.includes('.cdninstagram.com') && entry.name.includes('/v/');
                // Exclude DASH segments (.m4s, bytestart ranges) to prevent downloading 0s "empty" chunks
                const isSegment = entry.name.includes('.m4s') || entry.name.includes('bytestart') || entry.name.includes('sq=');
                return (isVideoInit || hasVideoExt || isInstaCdn) && !isSegment;
            });
            candidates.sort((a, b) => b.startTime - a.startTime);
            return candidates.length > 0 ? candidates[0].name : null;
        } catch (e) {
            console.error('ZenBlocker: Sniffer error', e);
            return null;
        }
    }

})();
