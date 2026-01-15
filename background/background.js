async function setupOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    if (existingContexts.length > 0) {
        return;
    }
    await chrome.offscreen.createDocument({
        url: 'background/offscreen.html',
        reasons: ['BLOBS'],
        justification: 'Stitching screenshots',
    });
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureVisible') {
        captureAndDownload('visible');
    } else if (request.action === 'captureFull') {
        captureFullPage();
    }
});
function captureAndDownload(prefix) {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        downloadImage(dataUrl, prefix);
    });
}
function downloadImage(dataUrl, prefix) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `devtools-${prefix}-${timestamp}.png`;
    chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false 
    });
}
async function captureFullPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        await setupOffscreenDocument();
        const metrics = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return {
                    width: document.documentElement.scrollWidth,
                    height: document.documentElement.scrollHeight,
                    viewportHeight: window.innerHeight,
                    devicePixelRatio: window.devicePixelRatio,
                    originalScrollY: window.scrollY
                };
            }
        });
        if (!metrics || !metrics[0] || !metrics[0].result) return;
        const { width, height, viewportHeight, devicePixelRatio, originalScrollY } = metrics[0].result;
        
        let currentY = 0;
        const captures = [];
        let hiddenElements = false;

        while (currentY < height) {
            // Scroll to position
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (y) => window.scrollTo(0, y),
                args: [currentY]
            });
            
            // Wait for scroll/render (800ms)
            await new Promise(r => setTimeout(r, 800));
            
            // HIDE FIXED ELEMENTS (Only after the first screenshot, or if we want them ONLY on the first one)
            // Strategy: Capture first frame with header. Then hide them for subsequent frames so they don't repeat.
            if (currentY > 0 && !hiddenElements) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const style = document.createElement('style');
                        style.id = 'devtools-hide-fixed';
                        style.innerHTML = `
                            [style*="position: fixed"], [style*="position: sticky"],
                            .fixed, .sticky, header, nav,
                            div[class*="header"], div[class*="nav"], div[class*="sticky"], div[class*="fixed"] {
                                visibility: hidden !important;
                                opacity: 0 !important; 
                            }
                        `;
                        document.head.appendChild(style);
                        // Force manual check
                        document.querySelectorAll('*').forEach(el => {
                             const s = window.getComputedStyle(el);
                             if(s.position === 'fixed' || s.position === 'sticky') {
                                 el.classList.add('devtools-force-hide');
                                 el.style.setProperty('visibility', 'hidden', 'important');
                             }
                        });
                    }
                });
                hiddenElements = true;
                // Wait small bit for style to apply
                await new Promise(r => setTimeout(r, 200));
            }

            // Capture
            try {
                const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
                captures.push({ y: currentY, dataUrl });
            } catch (captureErr) {
                console.warn('Rate limit or capture error, waiting longer...', captureErr);
                await new Promise(r => setTimeout(r, 1500));
                const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
                captures.push({ y: currentY, dataUrl });
            }
            
            currentY += viewportHeight;
        }
        
        // Restore
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (y) => {
                window.scrollTo(0, y);
                // Restore elements
                const s = document.getElementById('devtools-hide-fixed');
                if(s) s.remove();
                
                document.querySelectorAll('.devtools-force-hide').forEach(el => {
                    el.classList.remove('devtools-force-hide');
                    el.style.removeProperty('visibility');
                });
            },
            args: [originalScrollY]
        });

        const response = await chrome.runtime.sendMessage({
            action: 'stitchImages',
            images: captures,
            totalWidth: width,
            totalHeight: height,
            devicePixelRatio: devicePixelRatio
        });

        if (response && response.dataUrl) {
            downloadImage(response.dataUrl, 'fullpage');
        }

    } catch (err) {
        console.error('Full page capture failed', err);
    }
}

// --- Context Menu Integration ---
chrome.runtime.onInstalled.addListener(() => {
    // Parent
    chrome.contextMenus.create({
        id: "devtools-parent",
        title: "DevTools",
        contexts: ["all"]
    });

    // Inspect
    chrome.contextMenus.create({
        id: "ctx-inspect",
        parentId: "devtools-parent",
        title: "Inspect Element",
        contexts: ["all"]
    });

    // Eyedropper
    chrome.contextMenus.create({
        id: "ctx-eyedropper",
        parentId: "devtools-parent",
        title: "Eyedropper",
        contexts: ["all"]
    });

    // Screenshot Parent
    chrome.contextMenus.create({
        id: "ctx-screenshot",
        parentId: "devtools-parent",
        title: "Screenshot",
        contexts: ["all"]
    });
    
    // Screenshot Children
    chrome.contextMenus.create({
        id: "ctx-shot-visible",
        parentId: "ctx-screenshot",
        title: "Visible Section",
        contexts: ["all"]
    });
    
    chrome.contextMenus.create({
        id: "ctx-shot-full",
        parentId: "ctx-screenshot",
        title: "Full Page",
        contexts: ["all"]
    });

    // Responsive
    chrome.contextMenus.create({
        id: "ctx-responsive",
        parentId: "devtools-parent",
        title: "Responsive Test",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;

    switch (info.menuItemId) {
        case "ctx-inspect":
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/inspect.js']
            });
            break;

        case "ctx-eyedropper":
            // EyeDropper must be triggered by user gesture.
            // Executing script from context menu counts as gesture.
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    try {
                        if (!window.EyeDropper) {
                            alert("EyeDropper API not supported in this browser.");
                            return;
                        }
                        const eyeDropper = new EyeDropper();
                        const result = await eyeDropper.open();
                        const hex = result.sRGBHex;
                        
                        // Parse RGB
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        const rgb = `rgb(${r}, ${g}, ${b})`;
                        const rgba = `rgba(${r}, ${g}, ${b}, 1)`;
                        
                        // Create UI
                        const id = "devtools-eyedropper-result";
                        const old = document.getElementById(id);
                        if (old) old.remove();

                        const container = document.createElement('div');
                        container.id = id;
                        // Stylish Glassmorphism UI
                        Object.assign(container.style, {
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(12px)',
                            webkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: '16px',
                            padding: '20px',
                            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)',
                            zIndex: 10000000,
                            fontFamily: 'sans-serif',
                            minWidth: '260px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            animation: 'slideIn 0.3s ease-out'
                        });

                        // Color Preview
                        const preview = document.createElement('div');
                        Object.assign(preview.style, {
                            width: '100%',
                            height: '50px',
                            backgroundColor: hex,
                            borderRadius: '8px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            marginBottom: '4px'
                        });

                        // Close Button
                        const closeBtn = document.createElement('button');
                        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                        Object.assign(closeBtn.style, {
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(255,255,255,0.5)',
                            border: 'none',
                            borderRadius: '50%',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#4b5563',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        });
                        closeBtn.onmouseenter = () => closeBtn.style.color = 'black';
                        closeBtn.onmouseleave = () => closeBtn.style.color = '#4b5563';
                        closeBtn.onclick = (e) => {
                             e.stopPropagation();
                             container.remove();
                        };

                        // Rows
                        const createRow = (label, value) => {
                             const row = document.createElement('div');
                             Object.assign(row.style, {
                                 display: 'flex',
                                 justifyContent: 'space-between',
                                 alignItems: 'center',
                                 fontSize: '13px',
                                 color: '#374151'
                             });
                             
                             const left = document.createElement('div');
                             left.style.display = 'flex';
                             left.style.gap = '8px';
                             left.innerHTML = `<strong>${label}</strong>`;
                             
                             const valSpan = document.createElement('span');
                             valSpan.innerText = value;
                             valSpan.style.fontFamily = 'monospace';
                             valSpan.style.opacity = '0.8';
                             
                             const copy = document.createElement('button');
                             copy.innerText = 'Copy';
                             Object.assign(copy.style, {
                                 background: '#4f46e5', // Indigo 600
                                 color: 'white',
                                 border: 'none',
                                 borderRadius: '6px',
                                 padding: '4px 8px',
                                 cursor: 'pointer',
                                 fontSize: '11px',
                                 fontWeight: '600',
                                 transition: 'all 0.2s',
                                 marginLeft: '12px'
                             });
                             copy.onclick = (e) => {
                                 e.stopPropagation(); // Prevent bubbling
                                 navigator.clipboard.writeText(value);
                                 const original = copy.innerText;
                                 copy.innerText = '✓';
                                 copy.style.background = '#10b981'; // Green
                                 setTimeout(() => {
                                     copy.innerText = original;
                                     copy.style.background = '#4f46e5';
                                 }, 1500);
                             };
                             
                             row.appendChild(left);
                             left.appendChild(valSpan);
                             row.appendChild(copy);
                             return row;
                        };

                        container.appendChild(closeBtn);
                        container.appendChild(preview);
                        container.appendChild(createRow('HEX', hex));
                        container.appendChild(createRow('RGB', rgb));
                        container.appendChild(createRow('RGBA', rgba));
                        
                        // Add animation style safely
                        if (!document.getElementById('devtools-anim-style')) {
                            const s = document.createElement('style');
                            s.id = 'devtools-anim-style';
                            s.innerHTML = '@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
                            document.head.appendChild(s);
                        }

                        document.body.appendChild(container);
                        
                        // NO AUTO TIMEOUT - User must close it manually.

                    } catch (e) {
                        // cancelled
                    }
                }
            });
            break;

        case "ctx-shot-visible":
            captureAndDownload('visible');
            break;

        case "ctx-shot-full":
            captureFullPage();
            break;
            
        case "ctx-responsive":
            if (tab.url) {
                const viewerUrl = chrome.runtime.getURL('responsive/responsive.html');
                const fullUrl = `${viewerUrl}?url=${encodeURIComponent(tab.url)}`;
                chrome.tabs.create({ url: fullUrl });
            }
            break;
    }
});
