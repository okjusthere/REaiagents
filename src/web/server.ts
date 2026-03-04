import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api.js';
import stripeRouter from './stripe-api.js';
import { getDailyOutput, listOutputDates } from '../store/output-store.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Auth middleware for admin routes ────────────────────────
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${config.ADMIN_TOKEN}`) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
    }
    next();
}

export function startWebServer(port: number = 3000): void {
    const app = express();

    // ── Stripe webhook needs raw body (BEFORE json parser) ──
    app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

    // ── Standard JSON parser for all other routes ───────────
    app.use(express.json());

    // ── Public routes (no auth required) ────────────────────

    // Stripe subscribe routes — public-facing
    app.use('/api', stripeRouter);

    // Output viewing — public (shared via email links)
    app.get('/api/outputs/:date', (req, res) => {
        try {
            const output = getDailyOutput(req.params.date);
            if (!output) {
                res.status(404).json({ success: false, error: 'No output found for this date' });
                return;
            }
            res.json({ success: true, data: output });
        } catch (error) {
            res.status(500).json({ success: false, error: (error as Error).message });
        }
    });

    // ── Admin API routes (auth required) ────────────────────
    app.use('/api', requireAdmin, apiRouter);

    // ── Admin page ──────────────────────────────────────────
    app.get('/admin.html', (_req, res) => {
        res.sendFile(path.join(__dirname, '../../public/admin.html'));
    });

    // Serve other static files (subscribe.html, success.html, view.html)
    app.use(express.static(path.join(__dirname, '../../public')));

    // Default route → subscribe landing page (public-facing)
    app.use((_req, res) => {
        res.sendFile(path.join(__dirname, '../../public/subscribe.html'));
    });

    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 Web server running on port ${port}`);
        logger.info(`   📄 Landing page: http://localhost:${port}/`);
        logger.info(`   🔧 Admin dashboard: http://localhost:${port}/admin.html`);
        logger.info(`   🔒 Admin API protected with ADMIN_TOKEN`);
    });
}
