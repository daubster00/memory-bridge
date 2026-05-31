// 단순 JSON 파일 저장. 단일 사용자 데모용.
// 동시성 보호는 process-level mutex(Promise chain)만으로 충분.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');

let writeChain = Promise.resolve();

async function ensureCardsFile() {
    try {
        await fs.access(CARDS_FILE);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(CARDS_FILE, '[]', 'utf8');
    }
}

export async function readCards() {
    await ensureCardsFile();
    const raw = await fs.readFile(CARDS_FILE, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function appendCard(card) {
    // 직렬화된 쓰기 — 동시 요청 시 마지막 카드 누락 방지
    writeChain = writeChain.then(async () => {
        const list = await readCards();
        list.push(card);
        await fs.writeFile(CARDS_FILE, JSON.stringify(list, null, 2), 'utf8');
        return card;
    });
    return writeChain;
}
