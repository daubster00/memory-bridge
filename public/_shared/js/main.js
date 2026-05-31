// 공통 헤더를 _shared/header.html 에서 불러와 페이지마다 주입한다.
// 페이지 HTML 에는 <div data-include="header"></div> 한 줄만 두면 된다.

(async function injectHeader() {
    const mount = document.querySelector('[data-include="header"]');
    if (!mount) return;

    try {
        const response = await fetch('/_shared/header.html', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`header fetch ${response.status}`);
        const html = await response.text();
        mount.outerHTML = html;
    } catch (err) {
        console.error('[header] 로드 실패:', err);
        return;
    }

    detachMobileNav();
    initHeaderInteractions();
    markActiveNav();
    initRevealObserver();
})();

// .site-header 가 backdrop-filter 를 갖고 있어서 그 안의 position:fixed 자식이
// viewport 가 아닌 헤더 박스를 기준으로 잡힌다. mobile-nav 를 body 직속으로 옮겨서
// 풀스크린 오버레이가 정상 작동하도록 한다.
function detachMobileNav() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav && mobileNav.parentElement !== document.body) {
        document.body.appendChild(mobileNav);
    }
}

function initHeaderInteractions() {
    const userMenus = document.querySelectorAll('[data-user-menu]');
    let toastTimer = null;

    function showDemoNotice() {
        let toast = document.querySelector('.demo-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'demo-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }
        toast.textContent = '데모 버전에서는 지원하지 않는 서비스입니다.';
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
    }

    userMenus.forEach((menu) => {
        const toggle = menu.querySelector('.user-menu-toggle');
        const alertButtons = menu.querySelectorAll('[data-demo-alert]');
        if (!toggle) return;

        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = menu.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        alertButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                menu.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
                showDemoNotice();
            });
        });
    });

    document.addEventListener('click', () => {
        userMenus.forEach((menu) => {
            menu.classList.remove('is-open');
            const toggle = menu.querySelector('.user-menu-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    });

    document.querySelectorAll('[data-demo-alert]').forEach((button) => {
        if (button.closest('[data-user-menu]')) return;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            showDemoNotice();
        });
    });

    const toggle = document.querySelector('.nav-toggle');
    const mobileNav = document.getElementById('mobileNav');
    const closeButton = document.getElementById('mobileNavClose');
    if (toggle && mobileNav) {
        const closeNav = () => {
            mobileNav.classList.remove('is-open');
            toggle.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', '메뉴 열기');
            document.body.classList.remove('is-mobile-nav-open');
        };
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = mobileNav.classList.toggle('is-open');
            toggle.classList.toggle('is-open', isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
            document.body.classList.toggle('is-mobile-nav-open', isOpen);
        });
        // 오버레이 안의 닫기(X) 버튼
        closeButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            closeNav();
        });
        // mobile-nav 내부 빈 공간 클릭은 닫히지 않게, 링크 클릭은 자연스럽게 페이지 이동
        mobileNav.addEventListener('click', (event) => {
            if (event.target.tagName !== 'A') event.stopPropagation();
        });
        // ESC 키로도 닫히게
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && mobileNav.classList.contains('is-open')) closeNav();
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) closeNav();
        });
    }
}

function markActiveNav() {
    const pageKey = document.body.dataset.page;
    if (!pageKey) return;
    document.querySelectorAll(`[data-nav="${pageKey}"]`).forEach((a) => {
        a.classList.add('active');
    });
}

function initRevealObserver() {
    const revealTargets = document.querySelectorAll(
        '.intro-grid, .theme-section, .episode-section, .daon-section, .memory-card-section, .auto-summary-section, .auto-book-section, .auto-theme-section, .auto-episode-section'
    );
    if (!revealTargets.length) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('is-visible');
            });
        }, { threshold: 0.12 });
        revealTargets.forEach((target) => {
            target.classList.add('reveal-ready');
            observer.observe(target);
        });
    } else {
        revealTargets.forEach((target) => target.classList.add('is-visible'));
    }
}
