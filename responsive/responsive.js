const defaultDevices = [
    { name: 'Mobile S (320px)', width: 320, height: 568 },
    { name: 'Mobile M (375px)', width: 375, height: 667 },
    { name: 'Mobile L (425px)', width: 425, height: 853 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Laptop (1024px)', width: 1024, height: 768 },
    { name: 'Laptop L (1440px)', width: 1440, height: 900 },
    { name: '4K (2560px)', width: 2560, height: 1440 }
];

let activeDevices = [...defaultDevices.slice(0, 4)]; // Default to first 4
let isRotated = false;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    let targetUrl = params.get('url');
    const container = document.getElementById('device-container');
    const urlDisplay = document.getElementById('target-url');
    const rotateBtn = document.getElementById('rotate-btn');
    
    // Create Device Selector UI
    createDeviceSelector();

    if (!targetUrl) {
        urlDisplay.textContent = 'No URL provided';
        return;
    }

    urlDisplay.textContent = targetUrl;
    renderDevices(targetUrl);

    rotateBtn.addEventListener('click', () => {
        isRotated = !isRotated;
        container.innerHTML = '';
        renderDevices(targetUrl);
    });
});

function createDeviceSelector() {
    const header = document.querySelector('header .header-content');
    const selectorBtn = document.createElement('button');
    selectorBtn.textContent = '⚙️ Devices';
    styleBtn(selectorBtn);
    
    // Panel
    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.top = '60px'; // Below header
    panel.style.right = '2rem';
    panel.style.background = 'white';
    panel.style.border = '1px solid #e5e7eb';
    panel.style.borderRadius = '8px';
    panel.style.padding = '12px';
    panel.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    panel.style.zIndex = '50';
    panel.style.display = 'none';
    panel.style.minWidth = '200px';

    defaultDevices.forEach(dev => {
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `dev-${dev.name}`;
        checkbox.checked = activeDevices.some(d => d.name === dev.name);
        
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                if (!activeDevices.some(d => d.name === dev.name)) activeDevices.push(dev);
            } else {
                activeDevices = activeDevices.filter(d => d.name !== dev.name);
            }
            // Rerender
            const container = document.getElementById('device-container');
            container.innerHTML = '';
            renderDevices(document.getElementById('target-url').textContent);
        };
        
        const label = document.createElement('label');
        label.htmlFor = `dev-${dev.name}`;
        label.textContent = dev.name;
        label.style.marginLeft = '8px';
        label.style.fontSize = '14px';
        label.style.cursor = 'pointer';
        
        row.appendChild(checkbox);
        row.appendChild(label);
        panel.appendChild(row);
    });

    document.body.appendChild(panel);
    
    selectorBtn.onclick = () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
    
    header.appendChild(selectorBtn);
}

function styleBtn(btn) {
    btn.style.backgroundColor = 'white';
    btn.style.border = '1px solid #e5e7eb';
    btn.style.padding = '0.5rem 1rem';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '500';
    btn.onmouseover = () => { btn.style.borderColor = '#6366f1'; btn.style.color = '#6366f1'; };
    btn.onmouseout = () => { btn.style.borderColor = '#e5e7eb'; btn.style.color = 'initial'; };
}

function renderDevices(url) {
    const container = document.getElementById('device-container');

    activeDevices.forEach(device => {
        const wrapper = document.createElement('div');
        wrapper.className = 'device-wrapper';

        const label = document.createElement('span');
        label.className = 'device-label';
        
        // Calculate dimensions
        let w = device.width;
        let h = device.height;
        if (isRotated && (w < 1000)) { // Only rotate mobile/tablet
             // Simple swap for rotation simulation
            [w, h] = [h, w];
            label.textContent = `${device.name} (Landscape) - ${w}x${h}`;
        } else {
            label.textContent = `${device.name} - ${w}x${h}`;
        }

        const frame = document.createElement('div');
        frame.className = 'device-frame';

        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.width = w;
        iframe.height = h;

        // Apply Sandbox to prevent breakouts but allow scripts
        iframe.sandbox = "allow-same-origin allow-scripts allow-forms allow-popups";

        frame.appendChild(iframe);
        wrapper.appendChild(label);
        wrapper.appendChild(frame);
        container.appendChild(wrapper);
    });
}
