document.addEventListener('DOMContentLoaded', () => {
    const langBtns = document.querySelectorAll('.lang-btn');
    const html = document.documentElement;

    // --- Language Logic ---
    let currentLang = localStorage.getItem('devtools-lang') || 'id';
    setLanguage(currentLang);

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            setLanguage(lang);
        });
    });

    function setLanguage(lang) {
        currentLang = lang;
        html.setAttribute('lang', lang);
        localStorage.setItem('devtools-lang', lang);

        langBtns.forEach(btn => {
            if (btn.dataset.lang === lang) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    // --- Modal Logic ---
    const modalOverlay = document.getElementById('legal-modal');
    const modalCloseBtn = document.querySelector('.modal-close');
    const btnPrivacy = document.getElementById('btn-privacy');
    const btnTerms = document.getElementById('btn-terms');
    const contentPrivacy = document.getElementById('content-privacy');
    const contentTerms = document.getElementById('content-terms');

    function openModal(type) {
        // Hide all bodies first
        contentPrivacy.classList.remove('active');
        contentTerms.classList.remove('active');

        // Show requested body
        if (type === 'privacy') contentPrivacy.classList.add('active');
        if (type === 'terms') contentTerms.classList.add('active');

        // Show overlay
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (btnPrivacy) {
        btnPrivacy.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('privacy');
        });
    }

    if (btnTerms) {
        btnTerms.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('terms');
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    // Close on outside click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // --- Scroll Animation ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

function downloadExt() {
    window.open('https://github.com/wafarifki/DevTools/raw/refs/heads/main/Dev_Chrome_Ext.crx', '_self')
}