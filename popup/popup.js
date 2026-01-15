document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const toolsGrid = document.querySelector('.tools-grid');
  
  // Buttons
  const btnInspect = document.getElementById('btn-inspect');
  const btnEyedropper = document.getElementById('btn-eyedropper');
  const btnScreenshot = document.getElementById('btn-screenshot');
  const btnResponsive = document.getElementById('btn-responsive');
  
  // Submenu
  const screenshotMenu = document.getElementById('screenshot-options');
  const btnShotVisible = document.getElementById('btn-shot-visible');
  const btnShotFull = document.getElementById('btn-shot-full');
  const btnShotCancel = document.getElementById('btn-shot-cancel');
  
  // Output
  const outputArea = document.getElementById('output-area');
  const outputText = document.getElementById('output-text');
  const copyBtn = document.getElementById('time-copy-btn');

  // --- Theme Logic ---
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // --- Inspect Element ---
  btnInspect.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    // Inject CSS
    // We'll need a way to verify if it's already injected, or just toggle it.
    // For now, simple message to background or content script.
    
    // Check if we can inject script
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/inspect.js']
        });
        window.close(); // Close popup so user can interact
    } catch (err) {
        console.error('Failed to inject inspect script', err);
        showOutput('Error starting inspector');
    }
  });

  // --- Eyedropper ---
  btnEyedropper.addEventListener('click', async () => {
    if (!window.EyeDropper) {
      showOutput('EyeDropper API not supported', 'Error');
      return;
    }

    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const hex = result.sRGBHex;
      
      // Convert to RGB
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const rgb = `rgb(${r}, ${g}, ${b})`;
      const rgba = `rgba(${r}, ${g}, ${b}, 1)`;

      showOutput([ 
          { label: 'HEX', value: hex },
          { label: 'RGB', value: rgb },
          { label: 'RGBA', value: rgba }
      ]);
    } catch (e) {
      console.log('Eyedropper cancelled', e);
    }
  });

  // --- Screenshot ---
  btnScreenshot.addEventListener('click', () => {
    toolsGrid.classList.add('hidden');
    screenshotMenu.classList.remove('hidden');
  });

  btnShotCancel.addEventListener('click', () => {
    screenshotMenu.classList.add('hidden');
    toolsGrid.classList.remove('hidden');
  });
  
  btnShotVisible.addEventListener('click', () => {
     chrome.runtime.sendMessage({ action: 'captureVisible' });
     window.close();
  });
  
  btnShotFull.addEventListener('click', () => {
     chrome.runtime.sendMessage({ action: 'captureFull' });
     window.close();
  });

  // --- Responsive ---
  btnResponsive.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const viewerUrl = chrome.runtime.getURL('responsive/responsive.html');
      // Append target URL
      const fullUrl = `${viewerUrl}?url=${encodeURIComponent(tab.url)}`;
      chrome.tabs.create({ url: fullUrl });
    }
  });

  // --- Helper: Output ---
  function showOutput(data) {
    outputArea.classList.remove('hidden');
    outputArea.innerHTML = ''; // Clear previous

    if (typeof data === 'string') {
        outputArea.innerHTML = `<span style="font-size:0.9rem">${data}</span>`;
        return;
    }

    // Assume array of objects {label, value}
    data.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '6px';
        row.style.width = '100%';
        
        const labelVal = document.createElement('div');
        labelVal.innerHTML = `<strong style="color:var(--text-secondary); font-size:0.8rem; margin-right:8px;">${item.label}:</strong> <span style="font-family:monospace">${item.value}</span>`;
        
        const cBtn = document.createElement('button');
        cBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        cBtn.className = 'icon-btn';
        cBtn.title = 'Copy';
        cBtn.onclick = () => {
             navigator.clipboard.writeText(item.value);
             // flash effect
             cBtn.style.color = 'var(--accent)';
             setTimeout(() => cBtn.style.color = '', 500);
        };
        
        row.appendChild(labelVal);
        row.appendChild(cBtn);
        outputArea.appendChild(row);
    });
    
    // Adjust container style to handle list
    outputArea.style.flexDirection = 'column';
    outputArea.style.alignItems = 'flex-start';
  }
});
