import { searchNews } from './agents/news-agent.js';
import { generateDailyScripts } from './agents/script-writer-agent.js';
import { generateAllModuleContent } from './agents/content-agent.js';
import { sendBatchEmails } from './agents/email-agent.js';
import { getSubscribers, getVipClients, getTrialClients, markTrialUsed, type Client, type Language, type MarketId } from './store/client-store.js';
import { saveDailyOutput } from './store/output-store.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

interface ClientGroup {
    language: Language;
    market: MarketId;
    clients: Client[];
}

let activeRun: Promise<void> | null = null;

function groupByPreferences(clients: Client[]): ClientGroup[] {
    const map = new Map<string, ClientGroup>();
    for (const client of clients) {
        const key = `${client.language}|${client.market}`;
        if (!map.has(key)) {
            map.set(key, { language: client.language, market: client.market, clients: [] });
        }
        map.get(key)!.clients.push(client);
    }
    return Array.from(map.values());
}

function getBaseUrl(): string {
    return config.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${process.env.PORT || 3000}`);
}

async function runPipelineInternal(dryRun = false): Promise<void> {
    const startTime = Date.now();
    logger.info('🚀 ═══════════════════════════════════════════');
    logger.info('🚀 RE AI Agents Pipeline Starting...');
    logger.info(`🚀 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    logger.info('🚀 ═══════════════════════════════════════════');

    try {
        const subscribers = getSubscribers();
        const vipClients = getVipClients();
        const trialClients = getTrialClients();
        const allRecipients = [...subscribers, ...vipClients, ...trialClients];

        if (allRecipients.length === 0) {
            logger.warn('⚠️  No recipients found (0 subscribers, 0 VIP, 0 pending trials).');
            return;
        }

        logger.info(`👥 Recipients: ${subscribers.length} subscribers + ${vipClients.length} VIP + ${trialClients.length} trial users = ${allRecipients.length} total`);

        const groups = groupByPreferences(allRecipients);
        logger.info(`📊 Preference groups: ${groups.map((group) => `${group.language}/${group.market}(${group.clients.length})`).join(', ')}`);

        const baseUrl = getBaseUrl();
        const subscribeUrl = `${baseUrl}/subscribe.html`;

        let totalNewsScripts = 0;
        let totalModuleScripts = 0;

        for (const group of groups) {
            const { language, market, clients } = group;
            const payingClients = clients.filter((client) => client.plan === 'subscriber' || client.plan === 'vip');
            const pendingTrialClients = clients.filter((client) => client.plan === 'free' && !client.freeTrialUsed);

            logger.info(`\n🌐 ═══ Processing group: ${language}/${market} (${payingClients.length} subs + ${pendingTrialClients.length} trials) ═══`);

            logger.info(`📰 Searching news for ${market}...`);
            const articles = await searchNews(market);
            logger.info(`📰 Found ${articles.length} articles`);

            logger.info(`✍️  Generating news scripts (${language})...`);
            const dailyOutput = await generateDailyScripts(articles, 3, language, market);

            logger.info(`📚 Generating content module scripts (${language}/${market})...`);
            const dateStr = new Date().toISOString().split('T')[0];
            const modules = await generateAllModuleContent(dateStr, language, market);
            dailyOutput.modules = modules;

            const savedOutput = saveDailyOutput(dailyOutput);
            dailyOutput.key = savedOutput.key;

            const newsScripts = dailyOutput.articles.reduce((sum, article) => sum + article.scripts.length, 0);
            const moduleScripts = modules.reduce((sum, module) => sum + module.articles.reduce((inner, article) => inner + article.scripts.length, 0), 0);
            totalNewsScripts += newsScripts;
            totalModuleScripts += moduleScripts;

            if (payingClients.length > 0) {
                logger.info(`  💳 Sending to ${payingClients.length} subscribers/VIP...`);
                const subscriberResult = await sendBatchEmails(payingClients, dailyOutput, baseUrl, dryRun, false);
                logger.info(`  💳 Subscribers/VIP: ${subscriberResult.sent} sent, ${subscriberResult.failed} failed`);
            }

            if (pendingTrialClients.length > 0) {
                logger.info(`  🎁 Sending to ${pendingTrialClients.length} trial users...`);
                const trialResult = await sendBatchEmails(pendingTrialClients, dailyOutput, baseUrl, dryRun, true, subscribeUrl);
                logger.info(`  🎁 Trials: ${trialResult.sent} sent, ${trialResult.failed} failed`);

                if (!dryRun) {
                    for (const clientId of trialResult.sentClientIds) {
                        markTrialUsed(clientId);
                    }
                }
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info('\n🎉 ═══════════════════════════════════════════');
        logger.info(`🎉 Pipeline completed in ${elapsed}s`);
        logger.info(`🎉 Groups processed: ${groups.length}`);
        logger.info(`🎉 Total scripts: ${totalNewsScripts + totalModuleScripts} (news: ${totalNewsScripts}, modules: ${totalModuleScripts})`);
        logger.info(`🎉 Sent to: ${subscribers.length} subscribers + ${vipClients.length} VIP + ${trialClients.length} trial users`);
        logger.info('🎉 ═══════════════════════════════════════════');
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(`💥 Pipeline failed after ${elapsed}s`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

export function isPipelineRunning(): boolean {
    return activeRun !== null;
}

export function getBaseAppUrl(): string {
    return getBaseUrl();
}

export async function runPipeline(dryRun = false): Promise<void> {
    if (activeRun) {
        throw new Error('Pipeline is already running');
    }

    activeRun = runPipelineInternal(dryRun).finally(() => {
        activeRun = null;
    });

    return activeRun;
}
