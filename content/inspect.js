(function() {
    // Prevent multiple injections
    if (window.DEVTOOLS_INSPECT_ACTIVE) return;
    window.DEVTOOLS_INSPECT_ACTIVE = true;

    let overlay;
    let activeElement = null;
    let menu;
    let isEditing = false;
    let doneButton;

    // --- Infobar ---
    const infoBar = document.createElement('div');
    infoBar.innerText = 'Inspect Mode Active. Click to Edit/Remove. Press ESC to quit.';
    Object.assign(infoBar.style, {
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#111827',
        border: '2px solid #ffffffff', // Indigo 500
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        zIndex: '9999999',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
        pointerEvents: 'none'
    });
    document.body.appendChild(infoBar);

    // --- Overlay Helpers ---
    function createOverlay() {
        if (overlay) return;
        overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'absolute',
            border: '1px solid #3c40fdff', // Indigo 500
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            pointerEvents: 'none',
            zIndex: '999999',
            display: 'none',
            transition: 'all 0.1s ease'
        });
        document.body.appendChild(overlay);
    }

    function removeOverlay() {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }

    function updateOverlay(el) {
        if (!el) {
            if (overlay) overlay.style.display = 'none';
            return;
        }
        if (!overlay) createOverlay();
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.top = (rect.top + scrollTop) + 'px';
        overlay.style.left = (rect.left + scrollLeft) + 'px';
        overlay.style.display = 'block';
    }

    // --- Done Button for Edit Mode ---
    function createDoneButton(el) {
        if (doneButton) doneButton.remove();
        
        const rect = el.getBoundingClientRect();
        
        // Calculate position (default: top-right of element, slightly outside)
        let top = rect.top - 40;
        let left = rect.right - 60; // Approximate width of button
        
        // Adjust if off-screen
        if (top < 10) top = rect.bottom + 10;
        if (left < 10) left = rect.left;
        if (left + 80 > window.innerWidth) left = window.innerWidth - 90;

        doneButton = document.createElement('button');
        doneButton.innerText = '✅ Done';
        Object.assign(doneButton.style, {
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            backgroundColor: '#10b981', // Emerald 500
            color: 'white',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '12px',
            zIndex: '10000000',
            cursor: 'pointer',
            fontFamily: 'sans-serif',
            fontSize: '13px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
        });
        
        doneButton.onclick = (e) => {
             e.preventDefault();
             e.stopPropagation();
             el.contentEditable = 'false';
             isEditing = false;
             doneButton.remove();
             doneButton = null;
             infoBar.style.display = 'block';
             // Re-enable inspection
        };
        document.body.appendChild(doneButton);
    }

    // --- Action Menu ---
    function createMenu(x, y, targetEl) {
        if (menu) menu.remove();
        
        menu = document.createElement('div');
        Object.assign(menu.style, {
            position: 'fixed',
            top: y + 'px',
            left: x + 'px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            zIndex: '10000000',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        });

        const btnRemove = document.createElement('button');
        btnRemove.innerText = '🗑️ Remove Element';
        styleButton(btnRemove);
        btnRemove.onclick = () => {
            targetEl.remove();
            menu.remove();
            menu = null;
            updateOverlay(null); // Hide overlay as element is gone
            // Do NOT cleanup, stay in inspect mode
        };

        const btnEdit = document.createElement('button');
        btnEdit.innerText = '✏️ Edit Text';
        styleButton(btnEdit);
        btnEdit.onclick = () => {
            menu.remove();
            menu = null;
            
            isEditing = true;
            targetEl.contentEditable = 'true';
            targetEl.focus();
            
            // Hide overlay while editing to prevent visual clutter
            updateOverlay(null); 
            // Hide main infobar
            infoBar.style.display = 'none';
            
            createDoneButton(targetEl);
        };

        const btnCancel = document.createElement('button');
        btnCancel.innerText = '❌ Cancel';
        styleButton(btnCancel);
        btnCancel.onclick = () => {
            menu.remove();
            menu = null;
        };

        menu.appendChild(btnEdit);
        menu.appendChild(btnRemove);
        menu.appendChild(btnCancel);
        document.body.appendChild(menu);
    }

    function styleButton(btn) {
        Object.assign(btn.style, {
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            padding: '6px 12px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#374151'
        });
        btn.onmouseover = () => btn.style.backgroundColor = '#f3f4f6';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
    }

    // --- Event Handlers ---
    function onMouseOver(e) {
        if (isEditing) return; // Don't highlight while editing
        
        // Ignore our own UI
        if (e.target === overlay || e.target === infoBar || (menu && menu.contains(e.target)) || (doneButton && doneButton.contains(e.target))) return;
        
        e.stopPropagation();
        activeElement = e.target;
        updateOverlay(activeElement);
    }

    function onClick(e) {
        if (isEditing) return;

        if (e.target === overlay || e.target === infoBar || (menu && menu.contains(e.target))  || (doneButton && doneButton.contains(e.target))) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Show menu at click position
        createMenu(e.clientX, e.clientY, activeElement);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            if (isEditing) {
                // If editing, cancel edit
                if (doneButton) doneButton.click();
            } else if (menu) {
                menu.remove();
                menu = null;
            } else {
                cleanup();
            }
        }
    }

    // --- Initialization ---
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    // --- Cleanup ---
    function cleanup() {
        document.removeEventListener('mouseover', onMouseOver, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
        
        removeOverlay();
        if (infoBar) infoBar.remove();
        if (menu) menu.remove();
        if (doneButton) doneButton.remove();
        
        if (activeElement && activeElement.contentEditable === 'true') {
             activeElement.contentEditable = 'false';
        }

        window.DEVTOOLS_INSPECT_ACTIVE = false;
    }

})();
