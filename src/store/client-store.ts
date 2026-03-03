import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

export interface Client {
    id: string;
    name: string;
    email: string;
    style: 'professional' | 'casual' | 'investor' | 'mythbuster';
    active: boolean;
    createdAt: string;
}

// Ensure data directory and file exist
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

export function getAllClients(): Client[] {
    ensureDataFile();
    const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    return JSON.parse(data) as Client[];
}

export function getActiveClients(): Client[] {
    return getAllClients().filter(c => c.active);
}

export function getClientById(id: string): Client | undefined {
    return getAllClients().find(c => c.id === id);
}

export function addClient(data: Omit<Client, 'id' | 'createdAt'>): Client {
    const clients = getAllClients();

    // Check duplicate email
    if (clients.some(c => c.email.toLowerCase() === data.email.toLowerCase())) {
        throw new Error(`Email already exists: ${data.email}`);
    }

    const newClient: Client = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
    logger.info(`➕ Client added: ${newClient.name} <${newClient.email}>`);
    return newClient;
}

export function updateClient(id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>): Client {
    const clients = getAllClients();
    const index = clients.findIndex(c => c.id === id);

    if (index === -1) {
        throw new Error(`Client not found: ${id}`);
    }

    // Check duplicate email if email is being changed
    if (data.email && data.email.toLowerCase() !== clients[index].email.toLowerCase()) {
        if (clients.some(c => c.email.toLowerCase() === data.email!.toLowerCase())) {
            throw new Error(`Email already exists: ${data.email}`);
        }
    }

    clients[index] = { ...clients[index], ...data };
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
    logger.info(`✏️  Client updated: ${clients[index].name}`);
    return clients[index];
}

export function deleteClient(id: string): void {
    const clients = getAllClients();
    const index = clients.findIndex(c => c.id === id);

    if (index === -1) {
        throw new Error(`Client not found: ${id}`);
    }

    const removed = clients.splice(index, 1)[0];
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
    logger.info(`🗑️  Client deleted: ${removed.name} <${removed.email}>`);
}
