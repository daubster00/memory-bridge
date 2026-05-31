// 기억 노트 카드 페이지 — 새 디자인 + 실제 이미지 저장(html2canvas) + PDF 미리보기 + 카카오 공유 + 링크 복사.
// 데모 전용 버튼([data-toast])은 토스트만 띄움.

const CARDS_ENDPOINT = '/api/cards';
const KAKAO_APP_KEY = '6b8dc7fb2839b0def1184f65dca8f30a';
const SITE_ORIGIN = 'https://memory.btmdesign.kr';
const SHARE_URL = `${SITE_ORIGIN}/card.html`;
const SHARE_IMAGE_URL = `${SITE_ORIGIN}/_shared/assets/images/main-visual-bg.png`;

const toast = document.getElementById('toastMessage');
const memoryCard = document.getElementById('memoryCardCanvas');
const saveImageBtn = document.getElementById('saveImageBtn');
const copyLinkBtn = document.getElementById('copyLinkButton');
const pdfPreviewBtn = document.getElementById('pdfPreviewBtn');
const kakaoShareBtn = document.getElementById('kakaoShareBtn');
const toastButtons = document.querySelectorAll('[data-toast]');

let toastTimer = null;
let currentCard = null;

async function loadLatestCard() {
    try {
        const res = await fetch(CARDS_ENDPOINT);
        if (!res.ok) return null;
        const data = await res.json();
        const list = Array.isArray(data?.cards) ? data.cards : [];
        if (list.length === 0) return null;
        return [...list].sort((a, b) => {
            const ta = Date.parse(a.createdAt || 0) || 0;
            const tb = Date.parse(b.createdAt || 0) || 0;
            return tb - ta;
        })[0];
    } catch (err) {
        console.error('[card] /api/cards 로드 실패:', err);
        return null;
    }
}

function renderEssayBody(container, essay) {
    const heading = container.querySelector('h3');
    container.innerHTML = '';
    if (heading) container.appendChild(heading);
    const paragraphs = essay.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    (paragraphs.length ? paragraphs : [essay.trim()]).forEach((text) => {
        const p = document.createElement('p');
        p.textContent = text;
        container.appendChild(p);
    });
}

function applyCardToDom(card) {
    if (!card) return;

    if (card.title) {
        const titleEl = document.querySelector('.memory-card-title-area h2');
        const heroTitleEl = document.querySelector('.card-hero-preview strong');
        if (titleEl) titleEl.textContent = card.title;
        if (heroTitleEl) heroTitleEl.textContent = card.title;
    }

    if (card.essay) {
        const body = document.querySelector('.memory-card-body');
        if (body) renderEssayBody(body, card.essay);

        const heroBodyP = document.querySelector('.card-hero-preview p');
        if (heroBodyP) {
            const flat = card.essay.replace(/\s+/g, ' ').trim();
            heroBodyP.textContent = flat.length > 120 ? flat.slice(0, 120) + '…' : flat;
        }
    }

    if (Array.isArray(card.highlights) && card.highlights.length) {
        const detailStrongs = document.querySelectorAll('.memory-card-detail-grid strong');
        card.highlights.slice(0, detailStrongs.length).forEach((h, i) => {
            if (detailStrongs[i]) detailStrongs[i].textContent = h;
        });
    }
}

loadLatestCard().then((card) => {
    currentCard = card;
    applyCardToDom(card);
});

function ensureKakaoReady() {
    if (typeof window.Kakao === 'undefined') return false;
    if (!window.Kakao.isInitialized()) {
        try { window.Kakao.init(KAKAO_APP_KEY); }
        catch (err) { console.error('[card] Kakao init 실패:', err); return false; }
    }
    return window.Kakao.isInitialized();
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-show'), 2200);
}

toastButtons.forEach((button) => {
    button.addEventListener('click', () => {
        showToast(button.getAttribute('data-toast') || '데모 UI입니다.');
    });
});

if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
        const url = window.location.href;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url);
            }
            showToast('기억 카드 링크가 복사되었습니다.');
        } catch {
            showToast('링크 복사가 지원되지 않는 브라우저입니다.');
        }
    });
}

if (saveImageBtn) {
    saveImageBtn.addEventListener('click', async () => {
        if (!memoryCard) {
            showToast('저장할 기억 카드를 찾지 못했습니다.');
            return;
        }
        if (typeof html2canvas !== 'function') {
            showToast('저장 기능을 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
            return;
        }
        saveImageBtn.disabled = true;
        saveImageBtn.setAttribute('aria-busy', 'true');
        showToast('기억 카드를 이미지로 준비하고 있어요.');
        try {
            const canvas = await html2canvas(memoryCard, {
                backgroundColor: null,
                scale: Math.min(window.devicePixelRatio || 1, 2),
                useCORS: true,
            });
            const link = document.createElement('a');
            link.download = 'memory-card.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast('기억 카드 이미지가 저장되었습니다.');
        } catch {
            showToast('이미지 저장 중 문제가 발생했습니다.');
        } finally {
            saveImageBtn.disabled = false;
            saveImageBtn.removeAttribute('aria-busy');
        }
    });
}

if (pdfPreviewBtn) {
    pdfPreviewBtn.addEventListener('click', async () => {
        if (!memoryCard) {
            showToast('PDF로 만들 기억 카드를 찾지 못했습니다.');
            return;
        }
        if (typeof html2canvas !== 'function' || !window.jspdf?.jsPDF) {
            showToast('PDF 기능을 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
            return;
        }
        pdfPreviewBtn.disabled = true;
        pdfPreviewBtn.setAttribute('aria-busy', 'true');
        showToast('PDF 미리보기를 준비하고 있어요.');
        try {
            const canvas = await html2canvas(memoryCard, {
                backgroundColor: '#fffdf5',
                scale: 2,
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pxToMm = 0.264583;
            const widthMm = canvas.width * pxToMm;
            const heightMm = canvas.height * pxToMm;
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: heightMm >= widthMm ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [widthMm, heightMm],
            });
            pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win) showToast('팝업이 차단되어 PDF를 열 수 없습니다. 팝업 허용 후 다시 시도해 주세요.');
        } catch (err) {
            console.error('[pdf] 생성 실패:', err);
            showToast('PDF 생성 중 문제가 발생했습니다.');
        } finally {
            pdfPreviewBtn.disabled = false;
            pdfPreviewBtn.removeAttribute('aria-busy');
        }
    });
}

if (kakaoShareBtn) {
    kakaoShareBtn.addEventListener('click', () => {
        if (!ensureKakaoReady()) {
            showToast('카카오 SDK를 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
            return;
        }
        const title = currentCard?.title || '기억 노트 카드';
        const essay = (currentCard?.essay || 'AI 다온과 나눈 회상 대화로 완성된 기억 카드입니다.').trim();
        const description = essay.length > 180 ? essay.slice(0, 180) + '…' : essay;
        try {
            window.Kakao.Share.sendDefault({
                objectType: 'feed',
                content: {
                    title,
                    description,
                    imageUrl: SHARE_IMAGE_URL,
                    link: { mobileWebUrl: SHARE_URL, webUrl: SHARE_URL },
                },
                buttons: [
                    {
                        title: '기억 카드 보기',
                        link: { mobileWebUrl: SHARE_URL, webUrl: SHARE_URL },
                    },
                ],
            });
        } catch (err) {
            console.error('[kakao] 공유 실패:', err);
            showToast('카카오 공유 중 문제가 발생했습니다.');
        }
    });
}
