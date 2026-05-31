import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { SUMMARY_SYSTEM_PROMPT } from './summary-prompt.js';
import { readCards, appendCard } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3002;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) {
    console.warn('[경고] OPENAI_API_KEY가 비어 있습니다. .env 파일을 확인하세요.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL, hasKey: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
    }

    const trimmed = messages
        .slice(-30)
        .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m?.content ?? '').slice(0, 4000),
        }))
        .filter((m) => m.content.length > 0);

    if (trimmed.length === 0) {
        return res.status(400).json({ error: '빈 메시지입니다.' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            temperature: 0.7,
            max_tokens: 220,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...trimmed,
            ],
        });

        const reply = completion.choices?.[0]?.message?.content?.trim()
            || '잠시만요, 다시 한 번 말씀해 주실 수 있을까요?';

        res.json({ reply });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[chat error]', msg);
        res.status(500).json({ error: '대화 응답을 받지 못했습니다.', detail: msg });
    }
});

app.post('/api/summarize', async (req, res) => {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length < 2) {
        return res.status(400).json({ error: '요약할 대화가 부족합니다.' });
    }

    const trimmed = messages
        .slice(-60)
        .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m?.content ?? '').slice(0, 4000),
        }))
        .filter((m) => m.content.length > 0);

    if (trimmed.length < 2) {
        return res.status(400).json({ error: '요약할 대화가 부족합니다.' });
    }

    const transcript = trimmed
        .map((m) => `${m.role === 'user' ? '어르신' : '다온'}: ${m.content}`)
        .join('\n');

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            temperature: 0.5,
            max_tokens: 900,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
                { role: 'user', content: `[대화 히스토리]\n${transcript}` },
            ],
        });

        const raw = completion.choices?.[0]?.message?.content || '{}';
        let card;
        try {
            card = JSON.parse(raw);
        } catch {
            console.error('[summarize] JSON parse 실패:', raw);
            return res.status(502).json({ error: '요약 결과를 해석할 수 없습니다.' });
        }

        const title = String(card.title || '제목 없음').trim().slice(0, 80);
        const essay = String(card.essay || '').trim().slice(0, 6000);
        const highlights = Array.isArray(card.highlights)
            ? card.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 12)
            : [];

        if (!essay) {
            return res.status(502).json({ error: '요약 본문이 비어 있습니다.' });
        }

        res.json({ title, essay, highlights });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[summarize error]', msg);
        res.status(500).json({ error: '요약을 만들지 못했습니다.', detail: msg });
    }
});

app.post('/api/cards', async (req, res) => {
    const { title, essay, highlights } = req.body || {};

    if (!essay || typeof essay !== 'string') {
        return res.status(400).json({ error: 'essay 본문이 필요합니다.' });
    }

    const card = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: String(title || '제목 없음').trim().slice(0, 80),
        essay: essay.trim().slice(0, 6000),
        highlights: Array.isArray(highlights)
            ? highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 12)
            : [],
    };

    try {
        await appendCard(card);
        res.status(201).json(card);
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[cards save error]', msg);
        res.status(500).json({ error: '카드를 저장하지 못했습니다.', detail: msg });
    }
});

app.get('/api/cards', async (_req, res) => {
    try {
        const list = await readCards();
        res.json({ count: list.length, cards: list });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[cards read error]', msg);
        res.status(500).json({ error: '카드를 불러오지 못했습니다.', detail: msg });
    }
});

// 기존 EPUB 빌드에서 참조하던 /video/, /chat/, /card/ URL을
// 새 평면 구조의 .html 로 리다이렉트한다. (slash 유무 모두 처리)
['video', 'chat', 'card'].forEach((slug) => {
    app.get(`/${slug}`, (_req, res) => res.redirect(301, `/${slug}.html`));
    app.get(`/${slug}/`, (_req, res) => res.redirect(301, `/${slug}.html`));
});

app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
    console.log(`Memory Bridge server listening on http://localhost:${PORT}`);
    console.log(`  - 메인:        http://localhost:${PORT}/`);
    console.log(`  - 서비스 소개: http://localhost:${PORT}/about.html`);
    console.log(`  - 이야기 듣기: http://localhost:${PORT}/story.html`);
    console.log(`  - 영상 회상:   http://localhost:${PORT}/video.html`);
    console.log(`  - AI 대화:     http://localhost:${PORT}/chat.html`);
    console.log(`  - 기억 노트:   http://localhost:${PORT}/card.html`);
    console.log(`  - 자서전:      http://localhost:${PORT}/autobiography.html`);
    console.log(`  - 카드 API:    http://localhost:${PORT}/api/cards`);
    console.log(`  - 모델:        ${MODEL}`);
});
