chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'stitchImages') {
        const { images, totalWidth, totalHeight, devicePixelRatio } = msg;
        
        // Return true synchronously to indicate we will respond asynchronously
        (async () => {
            try {
                console.log('Stitching images...', images.length);
                const dataUrl = await stitchImages(images, totalWidth, totalHeight, devicePixelRatio);
                sendResponse({ dataUrl });
            } catch (err) {
                console.error('Stitch error:', err);
                sendResponse({ error: err.message });
            }
        })();
        
        return true; 
    }
});

async function stitchImages(images, totalWidth, totalHeight, devicePixelRatio) {
    const canvas = document.getElementById('stitch-canvas');
    const ctx = canvas.getContext('2d');

    // Adjust for high-DPI screens
    canvas.width = totalWidth * devicePixelRatio;
    canvas.height = totalHeight * devicePixelRatio;

    for (const item of images) {
        const img = await loadImage(item.dataUrl);
        // source, x, y, w, h, destX, destY, destW, destH
        // item.y is the scroll offset.
        // We assume captureVisibleTab captures the viewport * devicePixelRatio
        const yOffset = item.y * devicePixelRatio;
        
        ctx.drawImage(img, 0, yOffset);
    }

    // Convert back to data URL (blob is better for large files but data URL is easier)
    return canvas.toDataURL('image/png');
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
