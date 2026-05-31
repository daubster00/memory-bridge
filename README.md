# web/ — 영상 페이지 + AI 다온 대화 페이지

EPUB 뷰어와 연결되는 두 개의 웹 페이지와, 실제 OpenAI 호출을 처리하는 Node.js 백엔드.

## 구조

```
web/
├─ public/                 # 정적 파일 (브라우저에 그대로 전달)
│  ├─ video/               # 영상 감상 페이지
│  │  ├─ index.html
│  │  ├─ css/ js/ assets/  (recording.mp4 포함)
│  └─ chat/                # AI 다온 대화 페이지
│     ├─ index.html
│     ├─ css/ js/ assets/
└─ server/                 # Node.js OpenAI 프록시 + 정적 서빙
   ├─ index.js             # Express 서버 (포트 3002)
   ├─ system-prompt.js     # 다온 시스템 프롬프트
   ├─ package.json
   ├─ .env.example         # OPENAI_API_KEY 자리 — 복사해서 .env 만들기
   └─ .gitignore
```

## 로컬 실행

```powershell
cd "D:\projects\Memory Bridge\web\server"
Copy-Item .env.example .env       # 그 다음 .env 열어서 OPENAI_API_KEY 채우기
npm install
npm start
```

브라우저:
- 영상: <http://localhost:3002/video/>
- 대화: <http://localhost:3002/chat/>
- 헬스체크: <http://localhost:3002/api/health>

`npm run dev`로 띄우면 파일 변경 시 자동 재시작.

## 사용자 동선

1. EPUB 뷰어에서 마지막 페이지의 "다온이와 대화하기" 버튼 → 새 탭으로 `/chat/` 으로 이동 (현재는 placeholder URL, 배포 후 교체)
2. (또는) 영상 페이지에서 "AI 다온과 이야기하기" CTA → `/chat/` 이동
3. 채팅 페이지에서 텍스트 입력 또는 마이크 버튼으로 음성 인식 → OpenAI 응답

## 카페24 우분투 서버 배포 메모

대략적인 흐름 (구체 배포 시 한 번 더 검토 필요):

```bash
# 서버 접속 후
sudo apt update && sudo apt install -y nodejs npm nginx
git clone <repo> /var/www/memory-bridge
cd /var/www/memory-bridge/web/server
cp .env.example .env
nano .env                         # OPENAI_API_KEY 입력
npm install --production
sudo npm install -g pm2
pm2 start index.js --name memory-bridge
pm2 save
pm2 startup                       # 부팅 시 자동 실행
```

nginx 리버스 프록시 예시 (`/etc/nginx/sites-available/memory-bridge`):

```nginx
server {
    listen 80;
    server_name memory-bridge.example.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

배포 후:
- `build/epub-src/OEBPS/xhtml/13-ai-bridge.xhtml`의 `https://memory-bridge.example.com/chat/` 부분을 실제 도메인으로 교체
- `python build/build_all.py` 재실행 → 새 EPUB·HTML 생성
- 새 `dist/기억을잇다_데모.html`을 심사위원에게 전달

## 다음 세션에 이어서 할 일 (메모)

- 기억노트 카드 자동 정리 (EPUB에 언급된 기능, 현재 미구현)
- 서버 세션 영속화 (지금은 sessionStorage라 새로고침하면 초기화)
- TTS (다온 음성으로 답변 읽어주기 — 현재는 텍스트만)
- 디자인 미세 조정 (사용자 피드백 반영)
