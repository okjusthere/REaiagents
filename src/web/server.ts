import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api.js';
import stripeRouter from './stripe-api.js';
import { getDailyOutput, listOutputDates } from '../store/output-store.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Simple in-memory rate limiter ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10; // 10 requests per window

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        next();
        return;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试 / Too many requests, please try later' });
        return;
    }

    entry.count++;
    next();
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
}, 30 * 60 * 1000);

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

    // ── Public routes (no auth required, rate limited) ──────

    // Stripe subscribe routes — public-facing, rate limited
    app.use('/api/subscribe', rateLimit);
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
