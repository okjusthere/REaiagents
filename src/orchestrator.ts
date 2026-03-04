import { searchNews } from './agents/news-agent.js';
import { generateDailyScripts } from './agents/script-writer-agent.js';
import { generateAllModuleContent } from './agents/content-agent.js';
import { sendBatchEmails } from './agents/email-agent.js';
import { getSubscribers, getVipClients, getTrialClients, markTrialUsed, type Client, type Language, type MarketId } from './store/client-store.js';
import { saveDailyOutput } from './store/output-store.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

// ── Group clients by language + market ──────────────────────
interface ClientGroup {
    language: Language;
    market: MarketId;
    clients: Client[];
}

function groupByPreferences(clients: Client[]): ClientGroup[] {
    const map = new Map<string, ClientGroup>();
    for (const c of clients) {
        const key = `${c.language}|${c.market}`;
        if (!map.has(key)) {
            map.set(key, { language: c.language, market: c.market, clients: [] });
        }
        map.get(key)!.clients.push(c);
    }
    return Array.from(map.values());
}

export async function runPipeline(dryRun = false): Promise<void> {
    const startTime = Date.now();
    logger.info('🚀 ═══════════════════════════════════════════');
    logger.info('🚀 RE AI Agents Pipeline Starting...');
    logger.info(`🚀 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    logger.info('🚀 ═══════════════════════════════════════════');

    try {
        // ── Determine recipients ─────────────────────────────
        const subscribers = getSubscribers();
        const vipClients = getVipClients();
        const trialClients = getTrialClients();
        const allRecipients = [...subscribers, ...vipClients, ...trialClients];

        if (allRecipients.length === 0) {
            logger.warn('⚠️  No recipients found (0 subscribers, 0 VIP, 0 pending trials).');
            return;
        }
        logger.info(`👥 Recipients: ${subscribers.length} subscribers + ${vipClients.length} VIP + ${trialClients.length} trial users = ${allRecipients.length} total`);

        // Group all recipients by language + market
        const groups = groupByPreferences(allRecipients);
        logger.info(`📊 Preference groups: ${groups.map(g => `${g.language}/${g.market}(${g.clients.length})`).join(', ')}`);

        const baseUrl = config.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : `http://localhost:${process.env.PORT || 3000}`);
        const subscribeUrl = `${baseUrl}/subscribe.html`;

        let totalNewsScripts = 0;
        let totalModuleScripts = 0;

        // ── Process each preference group ────────────────────
        for (const group of groups) {
            const { language, market, clients } = group;
            const groupSubs = clients.filter(c => c.plan === 'subscriber' || c.plan === 'vip');
            const groupTrials = clients.filter(c => c.plan === 'free' && !c.freeTrialUsed);

            logger.info(`\n🌐 ═══ Processing group: ${language}/${market} (${groupSubs.length} subs + ${groupTrials.length} trials) ═══`);

            // Step 1: Search News for this market
            logger.info(`📰 Searching news for ${market}...`);
            const articles = await searchNews(market);
            logger.info(`📰 Found ${articles.length} articles`);

            // Step 2: Generate news scripts in this language
            logger.info(`✍️  Generating news scripts (${language})...`);
            const dailyOutput = await generateDailyScripts(articles, 3, language, market);

            // Step 3: Generate content module scripts
            logger.info(`📚 Generating content module scripts (${language}/${market})...`);
            const dateStr = new Date().toISOString().split('T')[0];
            const modules = await generateAllModuleContent(dateStr, language, market);
            dailyOutput.modules = modules;

            // Save output
            const outputDate = saveDailyOutput(dailyOutput);
            const viewerUrl = `${baseUrl}/view.html?date=${outputDate}`;

            const newsScripts = dailyOutput.articles.reduce((s, a) => s + a.scripts.length, 0);
            const moduleScripts = modules.reduce((s, m) => s + m.articles.reduce((s2, a) => s2 + a.scripts.length, 0), 0);
            totalNewsScripts += newsScripts;
            totalModuleScripts += moduleScripts;

            // Step 4a: Send to paying subscribers
            if (groupSubs.length > 0) {
                logger.info(`  💳 Sending to ${groupSubs.length} subscribers/VIP...`);
                const subResult = await sendBatchEmails(groupSubs, dailyOutput, viewerUrl, dryRun, false);
                logger.info(`  💳 Subscribers/VIP: ${subResult.sent} sent, ${subResult.failed} failed`);
            }

            // Step 4b: Send to trial users
            if (groupTrials.length > 0) {
                logger.info(`  🎁 Sending to ${groupTrials.length} trial users...`);
                const trialResult = await sendBatchEmails(groupTrials, dailyOutput, viewerUrl, dryRun, true, subscribeUrl);
                logger.info(`  🎁 Trials: ${trialResult.sent} sent, ${trialResult.failed} failed`);

                if (!dryRun) {
                    for (const client of groupTrials) {
                        markTrialUsed(client.id);
                    }
                }
            }
        }

        // ── Summary ──────────────────────────────────────────
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
