import { Router, Request, Response } from 'express';
import { getAllClients, addClient, updateClient, deleteClient } from '../store/client-store.js';
import { getDailyOutput, listOutputDates } from '../store/output-store.js';
import { runPipeline } from '../orchestrator.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── GET /api/clients ────────────────────────────────────────
router.get('/clients', (_req: Request, res: Response) => {
    try {
        res.json({ success: true, data: getAllClients() });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── POST /api/clients ───────────────────────────────────────
router.post('/clients', (req: Request, res: Response) => {
    try {
        const { name, email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: 'email is required' });
            return;
        }
        const client = addClient({ name, email });
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

// ── GET /api/outputs ────────────────────────────────────────
router.get('/outputs', (_req: Request, res: Response) => {
    try {
        res.json({ success: true, data: listOutputDates() });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── GET /api/outputs/:date ──────────────────────────────────
router.get('/outputs/:date', (req: Request, res: Response) => {
    try {
        const output = getDailyOutput(req.params.date as string);
        if (!output) {
            res.status(404).json({ success: false, error: 'No output found for this date' });
            return;
        }
        res.json({ success: true, data: output });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

export default router;
