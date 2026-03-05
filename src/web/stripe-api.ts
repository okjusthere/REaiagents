import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { config } from '../config/index.js';
import {
    addClient,
    cancelSubscription,
    findByEmail,
    findByStripeCustomerId,
    getClientById,
    markTrialUsed,
    SUPPORTED_MARKETS,
    updateClient,
    updateClientByEmail,
    upgradeToSubscriber,
    type AudienceProfile,
    type Client,
    type Language,
    type MarketId,
} from '../store/client-store.js';
import { getDailyOutput, getLatestOutputForPreferences } from '../store/output-store.js';
import { sendBatchEmails } from '../agents/email-agent.js';
import { logger } from '../utils/logger.js';
import { createManageToken, createViewerToken, verifyManageToken } from '../utils/access-links.js';
import { getBaseAppUrl } from '../orchestrator.js';

const router = Router();

const marketIds = SUPPORTED_MARKETS.map((market) => market.id) as [string, ...string[]];
const subscribeSchema = z.object({
    email: z.string().trim().email(),
    language: z.enum(['zh', 'en']).default('en'),
    audienceProfile: z.enum(['general', 'chinese-community']).optional(),
    market: z.string().default('new-york').transform((value) => (
        marketIds.includes(value) ? value : 'new-york'
    ) as MarketId),
});

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
    if (!stripeClient) {
        if (!config.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        stripeClient = new Stripe(config.STRIPE_SECRET_KEY);
    }
    return stripeClient;
}

function resolveAudienceProfile(input: { audienceProfile?: AudienceProfile; language: Language }): AudienceProfile {
    if (input.audienceProfile) {
        return input.audienceProfile;
    }
    return input.language === 'zh' ? 'chinese-community' : 'general';
}

function upsertLead(input: { email: string; language: Language; market: MarketId; audienceProfile?: AudienceProfile }): Client {
    const audienceProfile = resolveAudienceProfile(input);
    const existing = findByEmail(input.email);
    if (existing) {
        return updateClient(existing.id, {
            language: input.language,
            market: input.market,
            audienceProfile,
        });
    }
    return addClient({ ...input, audienceProfile });
}

function buildViewerUrl(baseUrl: string, client: Client, outputKey: string): string {
    const token = createViewerToken(client, outputKey);
    return `${baseUrl}/view.html?key=${encodeURIComponent(outputKey)}&token=${encodeURIComponent(token)}`;
}

function buildCheckoutCustomText(
    language: Language,
    baseUrl: string,
): Stripe.Checkout.SessionCreateParams.CustomText {
    if (language === 'zh') {
        return {
            submit: {
                message: '订阅后将按你的市场和受众，每日发送可直接发布的地产短视频文案。可随时在管理页取消。',
            },
            terms_of_service_acceptance: {
                message: `订阅即表示你同意服务条款与隐私政策（${baseUrl}/terms.html，${baseUrl}/privacy.html）。`,
            },
            after_submit: {
                message: '支付完成后会返回激活页，你可立即查看私有链接并管理订阅。',
            },
        };
    }

    return {
        submit: {
            message: 'Daily, market-ready real estate video scripts tailored to your market and audience. Cancel anytime from your manage page.',
        },
        terms_of_service_acceptance: {
            message: `By subscribing, you agree to the Terms and Privacy Policy (${baseUrl}/terms.html, ${baseUrl}/privacy.html).`,
        },
        after_submit: {
            message: 'After payment, you will return to activation with your private links and subscription controls.',
        },
    };
}

async function handleSampleRegistration(req: Request, res: Response) {
    try {
        const input = subscribeSchema.parse(req.body);
        const existing = findByEmail(input.email);

        if (existing && (existing.plan === 'subscriber' || existing.plan === 'vip')) {
            res.json({
                success: true,
                status: 'subscriber',
                message: input.language === 'zh'
                    ? '您已经是订阅用户了，每天都会收到最新文案。'
                    : 'You are already subscribed and will continue receiving daily scripts.',
            });
            return;
        }

        if (existing && existing.freeTrialUsed) {
            res.json({
                success: true,
                status: 'sample_used',
                message: input.language === 'zh'
                    ? '您已领取过免费 sample，请订阅以继续接收每日文案。'
                    : 'You already claimed the free sample. Subscribe to continue receiving daily scripts.',
            });
            return;
        }

        const client = upsertLead(input);
        const baseUrl = getBaseAppUrl();
        const subscribeUrl = `${baseUrl}/subscribe.html`;
        const latestOutputSummary = getLatestOutputForPreferences(client.language, client.market, client.audienceProfile);

        if (latestOutputSummary) {
            const latestOutput = getDailyOutput(latestOutputSummary.key);
            if (latestOutput) {
                const result = await sendBatchEmails([client], latestOutput, baseUrl, false, true, subscribeUrl);
                if (result.sentClientIds.includes(client.id)) {
                    markTrialUsed(client.id);
                    res.status(201).json({
                        success: true,
                        status: 'sample_sent',
                        clientId: client.id,
                        viewUrl: buildViewerUrl(baseUrl, client, latestOutput.key),
                        message: input.language === 'zh'
                            ? '免费 sample 已发送，正在打开您的专属查看链接。'
                            : 'Your free sample has been sent. Opening your private access link now.',
                    });
                    return;
                }
            }
        }

        res.status(201).json({
            success: true,
            status: 'sample_ready',
            clientId: client.id,
            message: input.language === 'zh'
                ? '注册成功。您将在下一次对应市场生成后收到 sample 邮件。'
                : 'You are registered. Your sample email will arrive with the next matching market run.',
        });
    } catch (error) {
        logger.error('Sample registration error', { error: error instanceof Error ? error.message : String(error) });
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
}

router.post('/subscribe/sample', handleSampleRegistration);
router.post('/subscribe/trial', handleSampleRegistration);

router.post('/subscribe/checkout', async (req: Request, res: Response) => {
    try {
        const input = subscribeSchema.parse(req.body);

        if (!config.STRIPE_PRICE_ID) {
            res.status(500).json({ success: false, error: 'Stripe Price ID not configured' });
            return;
        }

        const client = upsertLead(input);
        if (client.plan === 'subscriber' || client.plan === 'vip') {
            const manageToken = createManageToken(client);
            res.json({
                success: true,
                url: `${config.BASE_URL}/manage.html?token=${encodeURIComponent(manageToken)}`,
                message: input.language === 'zh' ? '您已经是订阅者。' : 'You are already subscribed.',
            });
            return;
        }

        const stripe = getStripe();
        const baseUrl = getBaseAppUrl();
        const checkoutLocale: Stripe.Checkout.SessionCreateParams.Locale = client.language === 'zh' ? 'zh' : 'en';
        const checkoutCustomText = buildCheckoutCustomText(client.language, baseUrl);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            locale: checkoutLocale,
            consent_collection: {
                terms_of_service: 'required',
            },
            custom_text: checkoutCustomText,
            customer_email: client.email,
            metadata: {
                email: client.email,
                clientId: client.id,
                language: client.language,
                market: client.market,
                audienceProfile: client.audienceProfile,
            },
            line_items: [{
                price: config.STRIPE_PRICE_ID,
                quantity: 1,
            }],
            success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/subscribe.html?cancelled=true`,
            subscription_data: {
                metadata: {
                    email: client.email,
                    clientId: client.id,
                    language: client.language,
                    market: client.market,
                    audienceProfile: client.audienceProfile,
                },
            },
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        logger.error('Checkout creation error', { error: error instanceof Error ? error.message : String(error) });
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Checkout failed' });
    }
});

router.get('/subscribe/session/:sessionId', async (req: Request, res: Response) => {
    try {
        const sessionId = String(req.params.sessionId);
        if (!sessionId) {
            res.status(400).json({ success: false, error: 'Session ID is required' });
            return;
        }

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const email = session.metadata?.email || session.customer_email;
        if (!email) {
            res.status(404).json({ success: false, error: 'No subscriber found for this session' });
            return;
        }

        const client = findByEmail(email);
        if (!client) {
            res.status(404).json({ success: false, error: 'Subscriber not found' });
            return;
        }

        const latestOutputSummary = getLatestOutputForPreferences(client.language, client.market, client.audienceProfile);
        const baseUrl = getBaseAppUrl();
        const manageToken = createManageToken(client);

        res.json({
            success: true,
            data: {
                plan: client.plan,
                active: client.active,
                language: client.language,
                audienceProfile: client.audienceProfile,
                manageUrl: `${baseUrl}/manage.html?token=${encodeURIComponent(manageToken)}`,
                viewUrl: latestOutputSummary ? buildViewerUrl(baseUrl, client, latestOutputSummary.key) : null,
            },
        });
    } catch (error) {
        logger.error('Checkout session lookup error', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ success: false, error: 'Failed to load checkout session' });
    }
});

router.post('/subscription/billing-portal', async (req: Request, res: Response) => {
    try {
        const { token } = req.body as { token?: string };
        const verified = token ? verifyManageToken(token) : null;
        if (!verified) {
            res.status(401).json({ success: false, error: 'Invalid or expired manage link' });
            return;
        }

        const client = getClientById(verified.clientId);
        if (!client || !client.stripeCustomerId) {
            res.status(404).json({ success: false, error: 'No active billing profile found' });
            return;
        }

        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
            customer: client.stripeCustomerId,
            locale: client.language === 'zh' ? 'zh' : 'en',
            return_url: `${getBaseAppUrl()}/manage.html?token=${encodeURIComponent(token!)}`,
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        logger.error('Billing portal error', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ success: false, error: 'Failed to open billing portal' });
    }
});

router.post('/stripe/webhook', async (req: Request, res: Response) => {
    try {
        if (!config.STRIPE_WEBHOOK_SECRET) {
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }

        const stripe = getStripe();
        const signature = req.headers['stripe-signature'] as string;
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(req.body, signature, config.STRIPE_WEBHOOK_SECRET);
        } catch (error) {
            logger.error('⚠️ Webhook signature verification failed', { error: (error as Error).message });
            res.status(400).json({ error: 'Webhook signature verification failed' });
            return;
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const email = session.metadata?.email || session.customer_email;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;
                const language = (session.metadata?.language === 'en' ? 'en' : 'zh') as Language;
                const market = ((session.metadata?.market as MarketId) || 'new-york');
                const audienceProfile = (session.metadata?.audienceProfile === 'chinese-community'
                    ? 'chinese-community'
                    : 'general') as AudienceProfile;

                if (email && customerId && subscriptionId) {
                    if (!findByEmail(email)) {
                        addClient({ email, language, market, audienceProfile });
                    } else {
                        updateClientByEmail(email, { language, market, audienceProfile });
                    }
                    upgradeToSubscriber(email, customerId, subscriptionId);
                    logger.info(`🎉 New subscriber via Stripe: ${email}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                const client = findByStripeCustomerId(customerId);
                if (client) {
                    const isActiveStatus = ['active', 'trialing', 'past_due'].includes(subscription.status);
                    const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
                    const rawCurrentPeriodEnd = (subscription as any).current_period_end ?? subscription.cancel_at;
                    const currentPeriodEnd = typeof rawCurrentPeriodEnd === 'number'
                        ? new Date(rawCurrentPeriodEnd * 1000).toISOString()
                        : undefined;
                    updateClient(client.id, {
                        active: isActiveStatus,
                        plan: isActiveStatus ? 'subscriber' : 'free',
                        stripeSubscriptionId: subscription.id,
                        stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
                        stripeCurrentPeriodEnd: cancelAtPeriodEnd ? currentPeriodEnd : undefined,
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
                if (customerId) {
                    const client = findByStripeCustomerId(customerId);
                    if (client) {
                        updateClient(client.id, { active: false });
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
        logger.error('Webhook processing error', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
