import { Router, Request, Response } from 'express';
import { getClientById, updateClient } from '../store/client-store.js';
import { getDailyOutput } from '../store/output-store.js';
import { verifyManageToken, verifyViewerToken } from '../utils/access-links.js';

const router = Router();

function getTokenFromRequest(req: Request): string {
    const value = req.query.token;
    return typeof value === 'string' ? value : '';
}

router.get('/viewer/outputs/:key', (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    const verified = verifyViewerToken(token);
    if (!verified || verified.outputKey !== req.params.key) {
        res.status(401).json({ success: false, error: 'Invalid or expired access link' });
        return;
    }

    const client = getClientById(verified.clientId);
    if (!client) {
        res.status(404).json({ success: false, error: 'Recipient not found' });
        return;
    }

    const output = getDailyOutput(req.params.key);
    if (!output) {
        res.status(404).json({ success: false, error: 'No output found for this link' });
        return;
    }

    res.json({ success: true, data: output });
});

router.get('/subscription/status', (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    const verified = verifyManageToken(token);
    if (!verified) {
        res.status(401).json({ success: false, error: 'Invalid or expired manage link' });
        return;
    }

    const client = getClientById(verified.clientId);
    if (!client) {
        res.status(404).json({ success: false, error: 'Subscriber not found' });
        return;
    }

    res.json({
        success: true,
        data: {
            name: client.name,
            email: client.email,
            active: client.active,
            plan: client.plan,
            market: client.market,
            language: client.language,
            hasBilling: Boolean(client.stripeCustomerId),
        },
    });
});

router.post('/subscription/unsubscribe', (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    const verified = token ? verifyManageToken(token) : null;
    if (!verified) {
        res.status(401).json({ success: false, error: 'Invalid or expired manage link' });
        return;
    }

    const client = getClientById(verified.clientId);
    if (!client) {
        res.status(404).json({ success: false, error: 'Subscriber not found' });
        return;
    }

    const updated = updateClient(client.id, { active: false });
    res.json({ success: true, data: { active: updated.active } });
});

router.post('/subscription/resubscribe', (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    const verified = token ? verifyManageToken(token) : null;
    if (!verified) {
        res.status(401).json({ success: false, error: 'Invalid or expired manage link' });
        return;
    }

    const client = getClientById(verified.clientId);
    if (!client) {
        res.status(404).json({ success: false, error: 'Subscriber not found' });
        return;
    }

    const updated = updateClient(client.id, { active: true });
    res.json({ success: true, data: { active: updated.active } });
});

export default router;
