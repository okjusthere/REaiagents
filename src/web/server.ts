import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startWebServer(port: number = 3000): void {
    const app = express();

    app.use(express.json());

    // Serve static admin dashboard
    app.use(express.static(path.join(__dirname, '../../public')));

    // API routes
    app.use('/api', apiRouter);

    // SPA fallback
    app.get('*', (_req, res) => {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 Admin dashboard running on port ${port}`);
    });
}
