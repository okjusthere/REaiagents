import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { addClient, findByEmail, markTrialUsed, upgradeToSubscriber, cancelSubscription, type Language, type MarketId } from '../store/client-store.js';
import { listOutputDates, getDailyOutput } from '../store/output-store.js';
import { sendBatchEmails } from '../agents/email-agent.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Stripe client (lazy init) ───────────────────────────────
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        if (!config.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        _stripe = new Stripe(config.STRIPE_SECRET_KEY);
    }
    return _stripe;
}

// ── POST /api/subscribe/trial — Free trial registration ─────
router.post('/subscribe/trial', async (req: Request, res: Response) => {
    try {
        const { email, language, market } = req.body;
        if (!email || typeof email !== 'string') {
            res.status(400).json({ success: false, error: '请输入有效的邮箱地址 / Please enter a valid email' });
            return;
        }

        const emailLower = email.toLowerCase().trim();
        const lang = (language === 'en' ? 'en' : 'zh') as Language;
        const mkt = (market || 'new-york') as MarketId;
        const existing = findByEmail(emailLower);

        if (existing) {
            // Update preferences if changed
            if (existing.language !== lang || existing.market !== mkt) {
                existing.language = lang;
                existing.market = mkt;
            }
            if (existing.plan === 'subscriber' || existing.plan === 'vip') {
                res.json({ success: true, status: 'subscriber', message: lang === 'zh' ? '您已经是订阅用户了！每天都会收到最新文案。' : 'You are already subscribed! You will receive daily scripts.' });
                return;
            }
            if (existing.freeTrialUsed) {
                res.json({ success: true, status: 'trial_used', message: lang === 'zh' ? '您已使用过免费体验，请订阅以继续接收每日文案。' : 'Free trial used. Subscribe to continue receiving daily scripts.' });
                return;
            }
        }

        // New user or existing user who hasn't used trial yet
        let client = existing;
        if (!client) {
            client = addClient({ email: emailLower, language: lang, market: mkt });
        }

        // ── Instant delivery: find latest output and send immediately ──
        const dates = listOutputDates();
        if (dates.length > 0) {
            const latestDate = dates[0];
            const latestOutput = getDailyOutput(latestDate);

            if (latestOutput) {
                const baseUrl = config.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
                const viewerUrl = `${baseUrl}/view.html?date=${latestDate}`;
                const subscribeUrl = `${baseUrl}/subscribe.html`;

                // Send email immediately (async, don't block response)
                sendBatchEmails([client], latestOutput, viewerUrl, false, true, subscribeUrl)
                    .then(() => {
                        markTrialUsed(client!.id);
                        logger.info(`🎁 Instant trial email sent to ${client!.email}`);
                    })
                    .catch((err) => {
                        logger.error(`❌ Instant trial email failed for ${client!.email}`, { error: (err as Error).message });
                    });

                res.status(201).json({
                    success: true,
                    status: 'trial_sent',
                    clientId: client.id,
                    viewUrl: `/view.html?date=${latestDate}`,
                    message: lang === 'zh'
                        ? '🎉 免费体验邮件已发送！正在为您展示最新文案...'
                        : '🎉 Trial email sent! Showing you the latest scripts...',
                });
                return;
            }
        }

        // No outputs available yet — fall back to "wait for next batch" message
        res.status(201).json({
            success: true,
            status: 'trial_ready',
            clientId: client.id,
            message: lang === 'zh'
                ? '🎉 注册成功！您将在下一次推送时收到一封完整的AI文案邮件。'
                : '🎉 Registered! You will receive a full AI script email in the next batch.',
        });
    } catch (error) {
        logger.error('Trial registration error', { error: (error as Error).message });
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── POST /api/subscribe/checkout — Create Stripe Checkout ───
router.post('/subscribe/checkout', async (req: Request, res: Response) => {
    try {
        const { email, language, market } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: '请输入邮箱' });
            return;
        }

        if (!config.STRIPE_PRICE_ID) {
            res.status(500).json({ success: false, error: 'Stripe Price ID not configured' });
            return;
        }

        const stripe = getStripe();
        const emailLower = email.toLowerCase().trim();
        const lang = (language === 'en' ? 'en' : 'zh') as Language;
        const mkt = (market || 'new-york') as MarketId;

        // Ensure the user exists in our system
        let existing = findByEmail(emailLower);
        if (!existing) {
            existing = addClient({ email: emailLower, language: lang, market: mkt });
        }

        // If already subscriber or VIP, no need to pay
        if (existing.plan === 'subscriber' || existing.plan === 'vip') {
            res.json({ success: true, url: `${config.BASE_URL}/success.html`, message: '您已经是订阅者了' });
            return;
        }

        // Create Stripe Checkout session with 7-day free trial
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'alipay'],
            mode: 'subscription',
            customer_email: emailLower,
            metadata: { email: emailLower, clientId: existing.id },
            line_items: [{
                price: config.STRIPE_PRICE_ID,
                quantity: 1,
            }],
            success_url: `${config.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.BASE_URL}/subscribe.html?cancelled=true`,
            subscription_data: {
                trial_period_days: 7,
                metadata: { email: emailLower, clientId: existing.id },
            },
            // Alipay fallback: if Alipay fails, card is still available as option
            payment_method_options: {
                alipay: {},
            },
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        logger.error('Checkout creation error', { error: (error as Error).message });
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── POST /api/stripe/webhook — Stripe Webhook handler ───────
router.post('/stripe/webhook', async (req: Request, res: Response) => {
    try {
        if (!config.STRIPE_WEBHOOK_SECRET) {
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }

        const stripe = getStripe();
        const sig = req.headers['stripe-signature'] as string;
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body, // raw body — must be Buffer
                sig,
                config.STRIPE_WEBHOOK_SECRET,
            );
        } catch (err) {
            logger.error('⚠️ Webhook signature verification failed', { error: (err as Error).message });
            res.status(400).json({ error: 'Webhook signature verification failed' });
            return;
        }

        // Handle events
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const email = session.metadata?.email || session.customer_email;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;

                if (email && customerId && subscriptionId) {
                    const upgraded = upgradeToSubscriber(email, customerId, subscriptionId);
                    if (upgraded) {
                        logger.info(`🎉 New subscriber via Stripe: ${email}`);
                    } else {
                        // User paid but not in our system — add them
                        const client = addClient({ email });
                        upgradeToSubscriber(email, customerId, subscriptionId);
                        logger.info(`🎉 New subscriber (auto-created): ${email}`);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                cancelSubscription(subscription.id);
                logger.info(`❌ Subscription cancelled via Stripe: ${subscription.id}`);
                break;
            }

            default:
                logger.info(`ℹ️ Unhandled Stripe event: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        logger.error('Webhook processing error', { error: (error as Error).message });
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
