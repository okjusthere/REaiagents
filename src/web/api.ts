import { Router, Request, Response } from 'express';
import { getAllClients, addClient, updateClient, deleteClient } from '../store/client-store.js';
import { runPipeline } from '../orchestrator.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── GET /api/clients ────────────────────────────────────────
router.get('/clients', (_req: Request, res: Response) => {
    try {
        const clients = getAllClients();
        res.json({ success: true, data: clients });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── POST /api/clients ───────────────────────────────────────
router.post('/clients', (req: Request, res: Response) => {
    try {
        const { name, email, style, active } = req.body;
        if (!name || !email || !style) {
            res.status(400).json({ success: false, error: 'name, email, style are required' });
            return;
        }
        const client = addClient({ name, email, style, active: active !== false });
        res.status(201).json({ success: true, data: client });
    } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
    }
});

// ── PUT /api/clients/:id ────────────────────────────────────
router.put('/clients/:id', (req: Request, res: Response) => {
    try {
        const client = updateClient(req.params.id as string, req.body);
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
    }
});

// ── DELETE /api/clients/:id ─────────────────────────────────
router.delete('/clients/:id', (req: Request, res: Response) => {
    try {
        deleteClient(req.params.id as string);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
    }
});

// ── POST /api/send-now ──────────────────────────────────────
let isRunning = false;

router.post('/send-now', async (_req: Request, res: Response) => {
    if (isRunning) {
        res.status(429).json({ success: false, error: 'Pipeline is already running' });
        return;
    }

    isRunning = true;
    try {
        logger.info('🚀 Manual pipeline trigger from admin dashboard');
        res.json({ success: true, message: 'Pipeline started' });
        // Run async, don't await in request handler
        runPipeline(config.DRY_RUN)
            .catch((err) => {
                logger.error('💥 Pipeline failed', { error: err instanceof Error ? err.message : String(err) });
            })
            .finally(() => { isRunning = false; });
    } catch (error) {
        isRunning = false;
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── GET /api/status ─────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            isRunning,
            schedule: config.CRON_SCHEDULE,
            timezone: config.CRON_TIMEZONE,
            dryRun: config.DRY_RUN,
            model: config.AZURE_OPENAI_DEPLOYMENT,
        },
    });
});

// ── GET /api/styles ─────────────────────────────────────────
router.get('/styles', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: [
            { id: 'professional', name: '专业分析型', description: '正式、数据驱动的市场分析' },
            { id: 'casual', name: '轻松聊天型', description: '轻松对话式社交媒体风格' },
            { id: 'investor', name: '投资顾问型', description: '投资者视角的专业分析' },
            { id: 'mythbuster', name: '犀利避坑/揭秘型', description: '犀利直接的避坑指南' },
        ],
    });
});

export default router;
