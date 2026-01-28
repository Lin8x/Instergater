// Cross-browser compatibility layer
// Provides unified API for Chrome (MV3) and Firefox (MV2)
(function() {
    'use strict';

    // Firefox supports 'browser' namespace with Promises, Chrome uses 'chrome' with callbacks
    // Firefox also supports 'chrome' namespace for compatibility, but we normalize here
    const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;
    const isChrome = !isFirefox && typeof chrome !== 'undefined';

    // Export detection flags
    window.ZenBrowserCompat = {
        isFirefox: isFirefox,
        isChrome: isChrome,
        // Normalize the API namespace - prefer browser if available (Firefox), fallback to chrome
        api: (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome
    };

    // Log which browser we detected
    console.log('ZenBlocker: Browser detected -', isFirefox ? 'Firefox' : 'Chrome/Chromium');
})();
