import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { ensureDirSync, readJsonFileSync, writeJsonFileAtomicSync } from '../utils/file-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

export type Language = 'zh' | 'en';
export type ClientPlan = 'free' | 'subscriber' | 'vip';

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
    updatedAt: string;
    language: Language;
    market: MarketId;
    plan: ClientPlan;
    freeTrialUsed: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}

type ClientUpdate = Partial<Omit<Client, 'id' | 'createdAt'>>;

const SUPPORTED_LANGUAGE_SET = new Set<Language>(['zh', 'en']);
const SUPPORTED_MARKET_SET = new Set<MarketId>(SUPPORTED_MARKETS.map((market) => market.id));
const PLAN_SET = new Set<ClientPlan>(['free', 'subscriber', 'vip']);

function ensureDataFile(): void {
    ensureDirSync(DATA_DIR);
    if (!readJsonFileSync(CLIENTS_FILE, null)) {
        writeJsonFileAtomicSync(CLIENTS_FILE, []);
    }
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function normalizeLanguage(language: unknown): Language {
    return SUPPORTED_LANGUAGE_SET.has(language as Language) ? (language as Language) : 'zh';
}

function normalizeMarket(market: unknown): MarketId {
    return SUPPORTED_MARKET_SET.has(market as MarketId) ? (market as MarketId) : 'new-york';
}

function normalizePlan(plan: unknown): ClientPlan {
    return PLAN_SET.has(plan as ClientPlan) ? (plan as ClientPlan) : 'free';
}

function migrateClient(input: any): Client {
    const now = new Date().toISOString();
    return {
        id: String(input.id || generateId()),
        name: String(input.name || input.email || 'Client').trim(),
        email: String(input.email || '').trim().toLowerCase(),
        active: input.active ?? true,
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || input.createdAt || now,
        language: normalizeLanguage(input.language),
        market: normalizeMarket(input.market),
        plan: normalizePlan(input.plan),
        freeTrialUsed: Boolean(input.freeTrialUsed),
        stripeCustomerId: input.stripeCustomerId || undefined,
        stripeSubscriptionId: input.stripeSubscriptionId || undefined,
    };
}

function readClients(): Client[] {
    ensureDataFile();
    return readJsonFileSync<any[]>(CLIENTS_FILE, []).map(migrateClient);
}

function writeClients(clients: Client[]): void {
    writeJsonFileAtomicSync(CLIENTS_FILE, clients);
}

function updateClientCollection(
    matcher: (client: Client) => boolean,
    apply: (client: Client) => Client,
): Client | null {
    const clients = readClients();
    const index = clients.findIndex(matcher);
    if (index === -1) {
        return null;
    }

    clients[index] = apply(clients[index]);
    writeClients(clients);
    return clients[index];
}

function assertUniqueEmail(clients: Client[], email: string, ignoreId?: string): void {
    const lower = email.toLowerCase();
    if (clients.some((client) => client.id !== ignoreId && client.email.toLowerCase() === lower)) {
        throw new Error(`Email already exists: ${email}`);
    }
}

function sanitizeUpdate(current: Client, data: ClientUpdate): Client {
    const next: Client = {
        ...current,
        ...data,
        updatedAt: new Date().toISOString(),
    };

    if (data.email) {
        next.email = data.email.trim().toLowerCase();
    }
    if (data.name !== undefined) {
        next.name = data.name.trim() || current.name;
    }
    if (data.language !== undefined) {
        next.language = normalizeLanguage(data.language);
    }
    if (data.market !== undefined) {
        next.market = normalizeMarket(data.market);
    }
    if (data.plan !== undefined) {
        next.plan = normalizePlan(data.plan);
    }

    return next;
}

export function getAllClients(): Client[] {
    return readClients();
}

export function getClientById(id: string): Client | undefined {
    return readClients().find((client) => client.id === id);
}

export function getActiveClients(): Client[] {
    return readClients().filter((client) => client.active);
}

export function getSubscribers(): Client[] {
    return readClients().filter((client) => client.active && client.plan === 'subscriber');
}

export function getVipClients(): Client[] {
    return readClients().filter((client) => client.active && client.plan === 'vip');
}

export function getTrialClients(): Client[] {
    return readClients().filter((client) => client.active && client.plan === 'free' && !client.freeTrialUsed);
}

export function findByEmail(email: string): Client | undefined {
    const lower = email.trim().toLowerCase();
    return readClients().find((client) => client.email.toLowerCase() === lower);
}

export function findByStripeCustomerId(stripeCustomerId: string): Client | undefined {
    return readClients().find((client) => client.stripeCustomerId === stripeCustomerId);
}

export function addClient(data: { name?: string; email: string; language?: Language; market?: MarketId }): Client {
    const clients = readClients();
    const email = data.email.trim().toLowerCase();
    assertUniqueEmail(clients, email);

    const now = new Date().toISOString();
    const client: Client = {
        id: generateId(),
        name: data.name?.trim() || email.split('@')[0],
        email,
        active: true,
        createdAt: now,
        updatedAt: now,
        language: normalizeLanguage(data.language),
        market: normalizeMarket(data.market),
        plan: 'free',
        freeTrialUsed: false,
    };

    clients.push(client);
    writeClients(clients);
    logger.info(`➕ Client added: ${client.name} <${client.email}> [${client.language}/${client.market}]`);
    return client;
}

export function updateClient(id: string, data: ClientUpdate): Client {
    const clients = readClients();
    const index = clients.findIndex((client) => client.id === id);
    if (index === -1) {
        throw new Error(`Client not found: ${id}`);
    }

    if (data.email) {
        assertUniqueEmail(clients, data.email.trim().toLowerCase(), id);
    }

    clients[index] = sanitizeUpdate(clients[index], data);
    writeClients(clients);
    logger.info(`✏️  Client updated: ${clients[index].name}`);
    return clients[index];
}

export function updateClientByEmail(email: string, data: ClientUpdate): Client | null {
    const lower = email.trim().toLowerCase();
    const clients = readClients();
    const index = clients.findIndex((client) => client.email.toLowerCase() === lower);
    if (index === -1) {
        return null;
    }

    if (data.email) {
        assertUniqueEmail(clients, data.email.trim().toLowerCase(), clients[index].id);
    }

    clients[index] = sanitizeUpdate(clients[index], data);
    writeClients(clients);
    logger.info(`✏️  Client updated by email: ${clients[index].name}`);
    return clients[index];
}

export function deleteClient(id: string): void {
    const clients = readClients();
    const index = clients.findIndex((client) => client.id === id);
    if (index === -1) {
        throw new Error(`Client not found: ${id}`);
    }

    const [removed] = clients.splice(index, 1);
    writeClients(clients);
    logger.info(`🗑️  Client deleted: ${removed.name} <${removed.email}>`);
}

export function markTrialUsed(id: string): Client | null {
    const updated = updateClientCollection(
        (client) => client.id === id,
        (client) => ({ ...client, freeTrialUsed: true, updatedAt: new Date().toISOString() }),
    );
    if (updated) {
        logger.info(`🎫 Trial used: ${updated.name} <${updated.email}>`);
    }
    return updated;
}

export function upgradeToSubscriber(
    email: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
): Client | null {
    const updated = updateClientByEmail(email, {
        plan: 'subscriber',
        active: true,
        stripeCustomerId,
        stripeSubscriptionId,
    });
    if (updated) {
        logger.info(`💳 Upgraded to subscriber: ${updated.name} <${updated.email}>`);
    }
    return updated;
}

export function cancelSubscription(stripeSubscriptionId: string): Client | null {
    const updated = updateClientCollection(
        (client) => client.stripeSubscriptionId === stripeSubscriptionId,
        (client) => ({
            ...client,
            plan: 'free',
            active: false,
            stripeSubscriptionId: undefined,
            updatedAt: new Date().toISOString(),
        }),
    );
    if (updated) {
        logger.info(`❌ Subscription cancelled: ${updated.name} <${updated.email}>`);
    }
    return updated;
}
