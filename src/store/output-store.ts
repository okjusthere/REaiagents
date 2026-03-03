import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import type { DailyOutput } from '../agents/script-writer-agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = path.join(__dirname, '../../data/outputs');

function ensureDir(): void {
    if (!fs.existsSync(OUTPUTS_DIR)) {
        fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
}

export function saveDailyOutput(output: DailyOutput): string {
    ensureDir();
    const filePath = path.join(OUTPUTS_DIR, `${output.date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
    logger.info(`💾 Saved daily output to ${output.date}.json`);
    return output.date;
}

export function getDailyOutput(date: string): DailyOutput | null {
    ensureDir();
    const filePath = path.join(OUTPUTS_DIR, `${date}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as DailyOutput;
}

export function listOutputDates(): string[] {
    ensureDir();
    return fs.readdirSync(OUTPUTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
}
