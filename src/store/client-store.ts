import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

export type Language = 'zh' | 'en';

export const SUPPORTED_MARKETS = [
    { id: 'new-york', label: 'New York / 纽约', queries: ['New York real estate', 'NYC housing market', 'Manhattan property market'] },
    { id: 'los-angeles', label: 'Los Angeles / 洛杉矶', queries: ['Los Angeles real estate', 'LA housing market', 'Southern California property'] },
    { id: 'san-francisco', label: 'San Francisco / 旧金山', queries: ['San Francisco real estate', 'Bay Area housing market', 'Silicon Valley property'] },
    { id: 'chicago', label: 'Chicago / 芝加哥', queries: ['Chicago real estate', 'Chicago housing market', 'Illinois property market'] },
    { id: 'miami', label: 'Miami / 迈阿密', queries: ['Miami real estate', 'South Florida housing market', 'Miami Beach property'] },
    { id: 'seattle', label: 'Seattle / 西雅图', queries: ['Seattle real estate', 'Pacific Northwest housing market', 'Puget Sound property'] },
    { id: 'boston', label: 'Boston / 波士顿', queries: ['Boston real estate', 'Massachusetts housing market', 'New England property'] },
    { id: 'houston', label: 'Houston / 休斯顿', queries: ['Houston real estate', 'Texas housing market', 'Houston property market'] },
] as const;

export type MarketId = typeof SUPPORTED_MARKETS[number]['id'];

export interface Client {
    id: string;
    name: string;
    email: string;
    active: boolean;
    createdAt: string;

    // Preferences
    language: Language;
    market: MarketId;

    // Subscription fields
    plan: 'free' | 'subscriber';
    freeTrialUsed: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}

function ensureDataFile(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CLIENTS_FILE)) {
        fs.writeFileSync(CLIENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
        logger.info('📁 Created empty clients.json');
    }
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ── Migrate legacy clients (add missing fields) ──────────────
function migrateClient(c: any): Client {
    return {
        ...c,
        language: c.language || 'zh',
        market: c.market || 'new-york',
        plan: c.plan || 'free',
        freeTrialUsed: c.freeTrialUsed ?? false,
    };
}

function readClients(): Client[] {
    ensureDataFile();
    const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    return (JSON.parse(data) as any[]).map(migrateClient);
}

function writeClients(clients: Client[]): void {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
}

// ── Queries ──────────────────────────────────────────────────

export function getAllClients(): Client[] {
    return readClients();
}

export function getActiveClients(): Client[] {
    return readClients().filter(c => c.active);
}

/** Get paying subscribers only */
export function getSubscribers(): Client[] {
    return readClients().filter(c => c.active && c.plan === 'subscriber');
}

/** Get free users who haven't used their trial yet */
export function getTrialClients(): Client[] {
    return readClients().filter(c => c.active && c.plan === 'free' && !c.freeTrialUsed);
}

/** Find a client by email (case-insensitive) */
export function findByEmail(email: string): Client | undefined {
    return readClients().find(c => c.email.toLowerCase() === email.toLowerCase());
}

// ── Mutations ────────────────────────────────────────────────

export function addClient(data: { name?: string; email: string; language?: Language; market?: MarketId }): Client {
    const clients = readClients();

    if (clients.some(c => c.email.toLowerCase() === data.email.toLowerCase())) {
        throw new Error(`Email already exists: ${data.email}`);
    }

    const newClient: Client = {
        id: generateId(),
        name: data.name || data.email.split('@')[0],
        email: data.email,
        active: true,
        createdAt: new Date().toISOString(),
        language: data.language || 'zh',
        market: data.market || 'new-york',
        plan: 'free',
        freeTrialUsed: false,
    };

    clients.push(newClient);
    writeClients(clients);
    logger.info(`➕ Client added: ${newClient.name} <${newClient.email}> [${newClient.language}/${newClient.market}]`);
    return newClient;
}

export function updateClient(id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>): Client {
    const clients = readClients();
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) throw new Error(`Client not found: ${id}`);

    if (data.email && data.email.toLowerCase() !== clients[index].email.toLowerCase()) {
        if (clients.some(c => c.email.toLowerCase() === data.email!.toLowerCase())) {
            throw new Error(`Email already exists: ${data.email}`);
        }
    }

    clients[index] = { ...clients[index], ...data };
    writeClients(clients);
    logger.info(`✏️  Client updated: ${clients[index].name}`);
    return clients[index];
}

export function deleteClient(id: string): void {
    const clients = readClients();
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) throw new Error(`Client not found: ${id}`);

    const removed = clients.splice(index, 1)[0];
    writeClients(clients);
    logger.info(`🗑️  Client deleted: ${removed.name} <${removed.email}>`);
}

/** Mark a free-trial user as having used their free email */
export function markTrialUsed(id: string): void {
    const clients = readClients();
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    clients[index].freeTrialUsed = true;
    writeClients(clients);
    logger.info(`🎫 Trial used: ${clients[index].name} <${clients[index].email}>`);
}

/** Upgrade a client to subscriber (after Stripe payment) */
export function upgradeToSubscriber(
    email: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
): Client | null {
    const clients = readClients();
    const index = clients.findIndex(c => c.email.toLowerCase() === email.toLowerCase());
    if (index === -1) return null;

    clients[index].plan = 'subscriber';
    clients[index].active = true;
    clients[index].stripeCustomerId = stripeCustomerId;
    clients[index].stripeSubscriptionId = stripeSubscriptionId;
    writeClients(clients);
    logger.info(`💳 Upgraded to subscriber: ${clients[index].name} <${clients[index].email}>`);
    return clients[index];
}

/** Downgrade a client when subscription is cancelled */
export function cancelSubscription(stripeSubscriptionId: string): void {
    const clients = readClients();
    const index = clients.findIndex(c => c.stripeSubscriptionId === stripeSubscriptionId);
    if (index === -1) return;

    clients[index].plan = 'free';
    clients[index].active = false;
    clients[index].stripeSubscriptionId = undefined;
    writeClients(clients);
    logger.info(`❌ Subscription cancelled: ${clients[index].name} <${clients[index].email}>`);
}
