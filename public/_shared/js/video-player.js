// 비디오 재생/일시정지, 진행도, 음량, 음소거, 전체화면 컨트롤.
// 기존 web/public/video/js/video-page.js 그대로 이식.

const video = document.getElementById('memoryVideo');
const videoStage = document.getElementById('videoStage');
const centerPlayButton = document.getElementById('centerPlayButton');
const controlPlayButton = document.getElementById('controlPlayButton');
const controlPlayIcon = document.getElementById('controlPlayIcon');
const progressTrack = document.getElementById('progressTrack');
const progressFill = document.getElementById('progressFill');
const progressDot = document.getElementById('progressDot');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const replayButton = document.getElementById('replayButton');
const volumeButton = document.getElementById('volumeButton');
const volumeDownButton = document.getElementById('volumeDownButton');
const volumeUpButton = document.getElementById('volumeUpButton');
const muteButton = document.getElementById('muteButton');
const muteIcon = document.getElementById('muteIcon');
const fullscreenButton = document.getElementById('fullscreenButton');

if (!video) {
    console.warn('[video-player] #memoryVideo 를 찾지 못해 컨트롤을 초기화하지 않습니다.');
} else {
    const VOLUME_STEP = 0.1;

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '00:00';
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function syncPlayIcons() {
        const isPaused = video.paused || video.ended;
        centerPlayButton.style.opacity = isPaused ? '1' : '0';
        centerPlayButton.style.pointerEvents = isPaused ? 'auto' : 'none';
        centerPlayButton.setAttribute('aria-label', isPaused ? '영상 재생' : '영상 일시정지');
        centerPlayButton.innerHTML = isPaused
            ? '<i class="ri-play-fill" aria-hidden="true"></i>'
            : '<i class="ri-pause-fill" aria-hidden="true"></i>';
        controlPlayIcon.className = isPaused ? 'ri-play-fill' : 'ri-pause-fill';
    }

    function togglePlay() {
        if (video.paused || video.ended) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }

    video.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(video.duration);
    });

    video.addEventListener('timeupdate', () => {
        const percent = video.duration ? (video.currentTime / video.duration) * 100 : 0;
        progressFill.style.width = `${percent}%`;
        progressDot.style.left = `${percent}%`;
        currentTimeEl.textContent = formatTime(video.currentTime);
    });

    video.addEventListener('play', syncPlayIcons);
    video.addEventListener('pause', syncPlayIcons);
    video.addEventListener('ended', syncPlayIcons);

    centerPlayButton.addEventListener('click', togglePlay);
    controlPlayButton.addEventListener('click', togglePlay);

    progressTrack.addEventListener('click', (event) => {
        const rect = progressTrack.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        if (video.duration) {
            video.currentTime = video.duration * ratio;
        }
    });

    replayButton?.addEventListener('click', () => {
        video.currentTime = 0;
        video.play().catch(() => {});
    });

    function flashVolumeLabel(text) {
        if (!volumeButton) return;
        const label = volumeButton.querySelector('span');
        if (!label) return;
        const original = '소리 조절';
        label.textContent = text;
        volumeButton.classList.add('is-active');
        window.setTimeout(() => {
            label.textContent = original;
            volumeButton.classList.remove('is-active');
        }, 1200);
    }

    function setVolume(next) {
        const clamped = Math.max(0, Math.min(1, next));
        video.volume = clamped;
        if (clamped > 0) {
            video.muted = false;
            if (muteIcon) muteIcon.className = 'ri-volume-up-fill';
        }
        flashVolumeLabel(`소리 ${Math.round(clamped * 100)}%`);
    }

    volumeButton?.addEventListener('click', () => {
        video.muted = false;
        if (video.volume === 0) {
            setVolume(0.6);
        } else {
            flashVolumeLabel(`소리 ${Math.round(video.volume * 100)}%`);
        }
    });

    volumeDownButton?.addEventListener('click', () => setVolume(video.volume - VOLUME_STEP));
    volumeUpButton?.addEventListener('click', () => setVolume(video.volume + VOLUME_STEP));

    muteButton?.addEventListener('click', () => {
        video.muted = !video.muted;
        muteIcon.className = video.muted ? 'ri-volume-mute-fill' : 'ri-volume-up-fill';
    });

    fullscreenButton?.addEventListener('click', () => {
        const target = videoStage;
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            target.requestFullscreen?.();
        }
    });

    syncPlayIcons();
}
