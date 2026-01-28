document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    
    // Elements
    const inputs = {
        enableDelay: document.getElementById('enableDelay'),
        blockFeedDuration: document.getElementById('blockFeedDuration'),
        enableScrollLimit: document.getElementById('enableScrollLimit'),
        maxPosts: document.getElementById('maxPosts'),
        resetInterval: document.getElementById('resetInterval'),
        enableKeywordBlock: document.getElementById('enableKeywordBlock'),
        keywords: document.getElementById('keywords'),
        hideLikes: document.getElementById('hideLikes'),
        hideShare: document.getElementById('hideShare'),
        hideComments: document.getElementById('hideComments'),
        enableDownload: document.getElementById('enableDownload'),
        enableStatusCheck: document.getElementById('enableStatusCheck'),
        disableUpdateCheck: document.getElementById('disableUpdateCheck'),
        // Advanced Selectors
        selectorPost: document.getElementById('selectorPost'),
        selectorLike: document.getElementById('selectorLike'),
        selectorShare: document.getElementById('selectorShare'),
        selectorComment: document.getElementById('selectorComment')
    };

    // Tabs Logic
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Activate clicked
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Display current version
    const currentVersion = chrome.runtime.getManifest().version;
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay) versionDisplay.textContent = `v${currentVersion}`;

    // Load settings from sync storage
    chrome.storage.sync.get(Object.keys(inputs), (data) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            const status = document.getElementById('status');
            if(status) status.textContent = 'Error loading settings.';
            return;
        }
        for (const [key, element] of Object.entries(inputs)) {
            if (!element) continue;
            if (element.type === 'checkbox') {
                element.checked = !!data[key];
            } else {
                element.value = data[key] || '';
            }
        }
        
        // Start version check if not disabled
        if (!data.disableUpdateCheck) {
            checkVersion(currentVersion);
        }
    });

    // Reset Counter
    const resetBtn = document.getElementById('resetCounter');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset your daily post counter?')) {
                chrome.storage.local.set({ zenPostCount: 0, zenLastReset: Date.now() }, () => {
                   const status = document.getElementById('status');
                   if (status) {
                        status.textContent = 'Counter reset.';
                        setTimeout(() => status.textContent = '', 2000);
                   }
                });
            }
        });
    }

    // Reset To Defaults
    const defaultsBtn = document.getElementById('resetDefaults');
    if (defaultsBtn) {
        defaultsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to default values?')) {
                const defaultSettings = {
                    enableDelay: true,
                    blockFeedDuration: 3,
                    enableScrollLimit: true,
                    maxPosts: 5,
                    resetInterval: 1,
                    enableKeywordBlock: false,
                    keywords: '',
                    hideLikes: true,
                    hideShare: true,
                    hideComments: true,
                    enableDownload: true,
                    enableStatusCheck: true,
                    disableUpdateCheck: false,
                    selectorPost: '',
                    selectorLike: '',
                    selectorShare: '',
                    selectorComment: ''
                };
                
                // Update UI immediately
                for (const [key, element] of Object.entries(inputs)) {
                    if (!element) continue;
                    if (element.type === 'checkbox') {
                        element.checked = !!defaultSettings[key];
                    } else {
                        element.value = defaultSettings[key];
                    }
                }
                
                // Save to storage
                chrome.storage.sync.set(defaultSettings, () => {
                   const status = document.getElementById('status');
                   if (status) {
                        status.textContent = 'Settings reset to defaults.';
                        setTimeout(() => status.textContent = '', 2000);
                   }
                });
            }
        });
    }

    // Save settings
    const saveBtn = document.getElementById('save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const settings = {};
            for (const [key, element] of Object.entries(inputs)) {
                if (!element) continue;
                 settings[key] = element.type === 'checkbox' ? element.checked : element.value;
            }
            
            // Validate inputs if necessary
            
            chrome.storage.sync.set(settings, () => {
                 const status = document.getElementById('status');
                 if (chrome.runtime.lastError) {
                    if (status) status.textContent = 'Error saving.';
                    console.error(chrome.runtime.lastError);
                 } else {
                    if (status) {
                        status.textContent = 'Options saved. Reload Instagram.';
                        setTimeout(() => status.textContent = '', 2000);
                    }
                 }
            });
        });
    }

    function checkVersion(current) {
        // --- VISUAL TEST: Simulate an available update ---
        // I've enabled this so you can see the popup. 
        // Change 'true' to 'false' below when you are done testing.
        const TEST_MODE = false; 
        if (TEST_MODE) {
            showUpdateNotification('https://github.com/Lin8x/Instergater/releases', '2.0.0 (Test)');
            return;
        }
        // --------------------------------------------------

        // Industry standard often uses a remote JSON file or GitHub API
        const REPO_USER = 'Lin8x'; 
        const REPO_NAME = 'Instergater';
        const GITHUB_API_URL = `https://api.github.com/repos/${REPO_USER}/${REPO_NAME}/releases/latest`;
        
        // Timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Simple fetch 
        fetch(GITHUB_API_URL, { signal: controller.signal })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                // Determine remote version from tag (e.g. "v1.1.0" -> "1.1.0")
                const remoteTag = data.tag_name || '';
                const remoteVersion = remoteTag.replace(/^v/, '');
                
                if (remoteVersion && isNewerVersion(current, remoteVersion)) {
                    showUpdateNotification(data.html_url, remoteVersion);
                }
            })
            .catch(error => {
                // Silently fail for network issues or 404s (common in dev/private repos)
                console.log('Update check skipped:', error.message);
            })
            .finally(() => clearTimeout(timeoutId));
    }

    function isNewerVersion(current, remote) {
        const cParts = current.split('.').map(Number);
        const rParts = remote.split('.').map(Number);
        
        for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
            const c = cParts[i] || 0;
            const r = rParts[i] || 0;
            if (r > c) return true;
            if (r < c) return false;
        }
        return false;
    }

    function showUpdateNotification(url, version) {
        const container = document.getElementById('update-container');
        if (container) {
            container.style.display = 'block';
            container.innerHTML = `
                <div style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 13px; border: 1px solid #ffeeba;">
                    <strong>Update Available (v${version})</strong><br>
                    <a href="${url}" target="_blank" style="color: #533f03; text-decoration: underline;">View on GitHub</a>
                </div>
            `;
        }
    }
});
