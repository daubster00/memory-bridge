
(function () {
    const playButton = document.getElementById('storyPlayButton');
    const audio = document.getElementById('storyAudio');
    const progressBar = document.getElementById('storyProgressBar');
    const timeText = document.getElementById('storyTimeText');
    const durationText = document.getElementById('storyDurationText');
    const paragraphs = Array.from(document.querySelectorAll('#storyTextList p'));

    if (!playButton || !audio || !progressBar || !timeText || !paragraphs.length) {
        return;
    }

    // 문단별 시작 시각(초). 오디오 ~125.7초, 글자 수 비례로 산출한 기본값.
    // 음성과 더 정밀히 맞추고 싶다면 이 배열만 손보면 됨.
    const cueStarts = [0.0, 19.12, 33.4, 53.29, 66.0, 79.0, 97.0];

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
        const s = Math.floor(seconds);
        const min = String(Math.floor(s / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${min}:${sec}`;
    }

    let currentIndex = -1;
    let suppressAutoScrollUntil = 0;

    function findActiveIndex(t) {
        let idx = 0;
        for (let i = 0; i < cueStarts.length; i++) {
            if (t + 0.001 >= cueStarts[i]) idx = i;
            else break;
        }
        return Math.min(idx, paragraphs.length - 1);
    }

    function setActiveParagraph(idx) {
        if (idx === currentIndex) return;
        currentIndex = idx;
        paragraphs.forEach((p, i) => p.classList.toggle('is-active', i === idx));

        if (idx < 0 || idx >= paragraphs.length) return;
        if (audio.paused) return;
        if (Date.now() < suppressAutoScrollUntil) return;

        const target = paragraphs[idx];
        try {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {
            target.scrollIntoView();
        }
    }

    function updateProgress() {
        const dur = audio.duration;
        if (!Number.isFinite(dur) || dur <= 0) {
            progressBar.style.width = '0%';
            timeText.textContent = '00:00';
            return;
        }
        const pct = Math.min(100, (audio.currentTime / dur) * 100);
        progressBar.style.width = `${pct}%`;
        timeText.textContent = formatTime(audio.currentTime);
    }

    function handleTimeUpdate() {
        updateProgress();
        setActiveParagraph(findActiveIndex(audio.currentTime));
    }

    audio.addEventListener('loadedmetadata', () => {
        if (durationText && Number.isFinite(audio.duration)) {
            durationText.textContent = formatTime(audio.duration);
        }
        updateProgress();
    });

    audio.addEventListener('timeupdate', handleTimeUpdate);

    audio.addEventListener('play', () => {
        playButton.textContent = '일시정지';
        setActiveParagraph(findActiveIndex(audio.currentTime));
    });

    audio.addEventListener('pause', () => {
        playButton.textContent = audio.ended ? '다시 듣기' : '이어 듣기';
    });

    audio.addEventListener('ended', () => {
        playButton.textContent = '다시 듣기';
    });

    // 사용자가 직접 스크롤하면 잠깐 자동 스크롤을 보류 (3초)
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        const dy = Math.abs(window.scrollY - lastScrollY);
        lastScrollY = window.scrollY;
        if (dy > 4) suppressAutoScrollUntil = Date.now() + 3000;
    }, { passive: true });

    playButton.addEventListener('click', () => {
        if (audio.ended) {
            audio.currentTime = 0;
        }
        if (audio.paused) {
            const p = audio.play();
            if (p && typeof p.catch === 'function') {
                p.catch((err) => {
                    console.warn('[story] 오디오 재생 실패:', err);
                    playButton.textContent = '이야기 듣기';
                });
            }
        } else {
            audio.pause();
        }
    });

    // 초기 렌더링
    updateProgress();
})();
