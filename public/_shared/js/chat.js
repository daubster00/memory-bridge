// AI 다온 회상 대화 — 새 디자인 UI + 기존 web 프로젝트의 실제 OpenAI 호출 로직.
// 서버: POST /api/chat (대화), POST /api/summarize (요약), POST /api/cards (카드 저장)

const API_ENDPOINT = '/api/chat';
const SUMMARIZE_ENDPOINT = '/api/summarize';
const CARDS_ENDPOINT = '/api/cards';
const STORAGE_KEY = 'memory-bridge-chat-history';

const stream = document.getElementById('messageStream');
const form = document.getElementById('chatForm');
const input = document.getElementById('chatInput');
const sendButton = form?.querySelector('button[type="submit"]');
const voiceButton = document.getElementById('voiceDemoButton');
const resetButton = document.getElementById('resetChatButton');
const endButton = document.getElementById('endChatButton');
const sampleButtons = document.querySelectorAll('[data-sample]');
const previewText = document.getElementById('memoryPreviewText');
const summaryModal = document.getElementById('summaryModal');
const summaryBody = document.getElementById('summaryBody');
const summaryFooter = document.getElementById('summaryFooter');

const INITIAL_MESSAGES = [
    { role: 'assistant', content: 'EPUB에서 이어진 AI 회상 대화입니다. 방금 감상한 고향집 이야기를 바탕으로 천천히 대화를 시작해 볼게요.' },
    { role: 'assistant', content: '고향집에서 가장 오래 머물던 장소가 어디인가요?' },
];

let messages = loadHistory();
let isAwaitingReply = false;
let isListening = false;
let recognition = null;
let pendingCard = null;

function loadHistory() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [...INITIAL_MESSAGES];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return [...INITIAL_MESSAGES];
        return parsed;
    } catch {
        return [...INITIAL_MESSAGES];
    }
}

function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
}

function scrollToBottom() {
    if (stream) stream.scrollTop = stream.scrollHeight;
}

function appendMessage(type, text) {
    const row = document.createElement('div');
    row.className = `message-row ${type === 'user' ? 'user-row' : 'ai-row'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (type === 'user') {
        avatar.textContent = '나';
    } else {
        const img = document.createElement('img');
        img.src = '/_shared/assets/images/daon-ai.png';
        img.alt = '다온';
        avatar.appendChild(img);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const name = document.createElement('span');
    name.textContent = type === 'user' ? '나' : '다온';
    const p = document.createElement('p');
    p.textContent = text;
    bubble.appendChild(name);
    bubble.appendChild(p);

    if (type === 'user') {
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
    }
    stream.appendChild(row);
    scrollToBottom();
    return row;
}

function appendTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row ai-row typing-indicator';
    row.id = 'typingIndicator';
    row.innerHTML = `
        <div class="message-avatar"><img src="/_shared/assets/images/daon-ai.png" alt="다온 응답 중"></div>
        <div class="message-bubble typing-bubble">
            <span></span><span></span><span></span>
        </div>
    `;
    stream.appendChild(row);
    scrollToBottom();
}

function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

function setBusy(busy) {
    isAwaitingReply = busy;
    if (sendButton) sendButton.disabled = busy;
    if (input) input.disabled = busy;
    if (sendButton) sendButton.style.opacity = busy ? '0.6' : '';
}

function renderInitialMessages() {
    if (!stream) return;
    stream.innerHTML = '';
    messages.forEach((m) => appendMessage(m.role === 'user' ? 'user' : 'ai', m.content));
    updatePreview();
}

function updatePreview() {
    if (!previewText) return;
    const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
    if (userTurns.length === 0) return;
    const joined = userTurns.join(' ');
    previewText.textContent = joined.length > 140 ? joined.slice(0, 140) + '…' : joined;
}

async function requestAssistantReply() {
    appendTypingIndicator();
    setBusy(true);
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `요청 실패 (${response.status})`);
        }
        const data = await response.json();
        const reply = (data.reply || '').trim();
        removeTypingIndicator();
        if (!reply) {
            appendMessage('ai', '잠시만요, 한 번 더 말씀해 주실 수 있을까요?');
            return;
        }
        appendMessage('ai', reply);
        messages.push({ role: 'assistant', content: reply });
        saveHistory();
    } catch (err) {
        removeTypingIndicator();
        const friendly = err?.message?.includes('Failed to fetch')
            ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '대화를 가져오지 못했어요. 한 번 더 말씀해 주실래요?';
        appendMessage('ai', friendly);
        console.error('[chat] request failed:', err);
    } finally {
        setBusy(false);
    }
}

function submitMessage(text) {
    if (isAwaitingReply) return;
    const value = (text || '').trim();
    if (!value) return;
    appendMessage('user', value);
    messages.push({ role: 'user', content: value });
    saveHistory();
    if (input) input.value = '';
    updatePreview();
    requestAssistantReply();
}

function setListeningState(nextState, label) {
    isListening = nextState;
    if (!voiceButton) return;
    voiceButton.classList.toggle('is-listening', isListening);
    const span = voiceButton.querySelector('span') || voiceButton;
    if (label) {
        span.textContent = label;
    } else {
        span.textContent = isListening ? '듣고 있어요' : '음성으로 말하기';
    }
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const instance = new SpeechRecognition();
    instance.lang = 'ko-KR';
    instance.interimResults = false;
    instance.continuous = false;
    instance.onstart = () => setListeningState(true);
    instance.onresult = (event) => {
        const transcript = Array.from(event.results).map((r) => r[0].transcript).join('');
        if (input) input.value = transcript;
        submitMessage(transcript);
    };
    instance.onerror = () => setListeningState(false, '음성 인식이 원활하지 않습니다. 다시 눌러주세요');
    instance.onend = () => setListeningState(false);
    return instance;
}

function startVoiceRecognition() {
    if (isAwaitingReply) return;
    setListeningState(true, '준비 중...');
    if (!recognition) recognition = setupSpeechRecognition();
    if (!recognition) {
        setListeningState(true, '이 브라우저는 음성 인식을 지원하지 않습니다');
        window.setTimeout(() => setListeningState(false), 1800);
        return;
    }
    try { recognition.start(); } catch { setListeningState(false, '음성 인식을 시작하지 못했습니다'); }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openSummaryModal() {
    if (!summaryModal) return;
    summaryModal.hidden = false;
    summaryModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeSummaryModal() {
    if (!summaryModal) return;
    summaryModal.hidden = true;
    summaryModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pendingCard = null;
    if (summaryBody) summaryBody.innerHTML = '';
    if (summaryFooter) summaryFooter.innerHTML = '';
}

function renderSummaryLoading() {
    summaryBody.innerHTML = `
        <div class="summary-loading">
            <span></span><span></span><span></span>
            <p>들려주신 이야기를 기억 카드로 정리하고 있어요...</p>
        </div>
    `;
    summaryFooter.innerHTML = `<button type="button" class="summary-btn summary-btn-secondary" data-summary-close>닫기</button>`;
}

function renderSummaryPreview(card) {
    pendingCard = card;
    const highlightsHtml = card.highlights?.length
        ? `<ul class="summary-highlights">${card.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
        : '';
    const paragraphs = card.essay.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');
    summaryBody.innerHTML = `
        <article class="summary-card-preview">
            <h3 class="summary-card-title">${escapeHtml(card.title)}</h3>
            ${highlightsHtml}
            <div class="summary-card-essay">${paragraphs}</div>
        </article>
    `;
    summaryFooter.innerHTML = `
        <button type="button" class="summary-btn summary-btn-secondary" id="summaryCancelButton">취소</button>
        <button type="button" class="summary-btn summary-btn-primary" id="summarySaveButton">이 카드로 저장</button>
    `;
    document.getElementById('summaryCancelButton').addEventListener('click', closeSummaryModal);
    document.getElementById('summarySaveButton').addEventListener('click', saveCard);
}

function renderSummaryError(message) {
    summaryBody.innerHTML = `<div class="summary-error"><p>${escapeHtml(message)}</p></div>`;
    summaryFooter.innerHTML = `
        <button type="button" class="summary-btn summary-btn-secondary" data-summary-close>닫기</button>
        <button type="button" class="summary-btn summary-btn-primary" id="summaryRetryButton">다시 시도</button>
    `;
    document.getElementById('summaryRetryButton').addEventListener('click', startSummaryFlow);
}

function renderSummarySaved() {
    summaryBody.innerHTML = `
        <div class="summary-saved">
            <p>기억 카드를 잘 담아두었어요.<br>잠시 후 기억카드 페이지로 이동합니다.</p>
        </div>
    `;
    summaryFooter.innerHTML = '';
}

async function startSummaryFlow() {
    openSummaryModal();
    renderSummaryLoading();
    try {
        const response = await fetch(SUMMARIZE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `요약 실패 (${response.status})`);
        }
        const card = await response.json();
        if (!card?.essay) throw new Error('빈 응답을 받았습니다.');
        renderSummaryPreview(card);
    } catch (err) {
        console.error('[summary] failed:', err);
        const friendly = err?.message?.includes('Failed to fetch')
            ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : (err?.message || '요약을 만들지 못했어요.');
        renderSummaryError(friendly);
    }
}

async function saveCard() {
    if (!pendingCard) return;
    summaryFooter.innerHTML = `<button type="button" class="summary-btn summary-btn-primary" disabled>저장 중...</button>`;
    try {
        const response = await fetch(CARDS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingCard),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `저장 실패 (${response.status})`);
        }
        renderSummarySaved();
        sessionStorage.removeItem(STORAGE_KEY);
        window.setTimeout(() => { window.location.href = '/card.html'; }, 1800);
    } catch (err) {
        console.error('[save] failed:', err);
        renderSummaryError(err?.message || '카드를 저장하지 못했어요.');
    }
}

form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitMessage(input?.value || '');
});

input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submitMessage(input.value || '');
});

sampleButtons.forEach((button) => {
    button.addEventListener('click', () => {
        if (input) {
            input.value = button.getAttribute('data-sample') || '';
            input.focus();
        }
    });
});

voiceButton?.addEventListener('click', startVoiceRecognition);

resetButton?.addEventListener('click', () => {
    if (!confirm('대화를 처음부터 다시 시작할까요?')) return;
    sessionStorage.removeItem(STORAGE_KEY);
    messages = [...INITIAL_MESSAGES];
    saveHistory();
    renderInitialMessages();
});

endButton?.addEventListener('click', () => {
    if (messages.length < 4) {
        if (!confirm('아직 이야기가 충분하지 않아요. 그래도 종료하시겠어요?')) return;
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = '/video.html';
        return;
    }
    startSummaryFlow();
});

summaryModal?.addEventListener('click', (event) => {
    if (event.target?.dataset?.summaryClose !== undefined) closeSummaryModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && summaryModal && !summaryModal.hidden) closeSummaryModal();
});

renderInitialMessages();
setListeningState(false);
