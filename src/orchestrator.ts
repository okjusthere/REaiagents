import { searchNews } from './agents/news-agent.js';
import { generateDailyScripts } from './agents/script-writer-agent.js';
import { generateAllModuleContent } from './agents/content-agent.js';
import { sendBatchEmails } from './agents/email-agent.js';
import { getActiveClients } from './store/client-store.js';
import { saveDailyOutput } from './store/output-store.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

export async function runPipeline(dryRun = false): Promise<void> {
    const startTime = Date.now();
    logger.info('🚀 ═══════════════════════════════════════════');
    logger.info('🚀 RE AI Agents Pipeline Starting...');
    logger.info(`🚀 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    logger.info('🚀 ═══════════════════════════════════════════');

    try {
        const clients = getActiveClients();
        if (clients.length === 0) {
            logger.warn('⚠️  No active clients found. Add clients via admin dashboard.');
            return;
        }
        logger.info(`👥 Active clients: ${clients.length}`);

        // ── Step 1: Search News ──────────────────────────────
        logger.info('\n📰 Step 1/4: Searching for NY real estate news...');
        const articles = await searchNews();
        logger.info(`📰 Found ${articles.length} articles`);

        // ── Step 2: Generate news scripts ────────────────────
        logger.info('\n✍️  Step 2/4: Generating news scripts (per-article × 4 styles)...');
        const dailyOutput = await generateDailyScripts(articles, 5);

        // ── Step 3: Generate content module scripts ──────────
        logger.info('\n📚 Step 3/4: Generating content module scripts...');
        const dateStr = new Date().toISOString().split('T')[0];
        const modules = await generateAllModuleContent(dateStr);
        dailyOutput.modules = modules;

        // Save to volume
        const outputDate = saveDailyOutput(dailyOutput);

        // Build viewer URL
        const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : `http://localhost:${process.env.PORT || 3000}`;
        const viewerUrl = `${baseUrl}/view.html?date=${outputDate}`;

        // ── Step 4: Send Emails ──────────────────────────────
        logger.info('\n📧 Step 4/4: Sending emails to clients...');
        const result = await sendBatchEmails(clients, dailyOutput, viewerUrl, dryRun);

        // ── Summary ──────────────────────────────────────────
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const newsScripts = dailyOutput.articles.reduce((s, a) => s + a.scripts.length, 0);
        const moduleScripts = modules.reduce((s, m) => s + m.articles.reduce((s2, a) => s2 + a.scripts.length, 0), 0);
        logger.info('\n🎉 ═══════════════════════════════════════════');
        logger.info(`🎉 Pipeline completed in ${elapsed}s`);
        logger.info(`🎉 News: ${dailyOutput.articleCount} articles → ${newsScripts} scripts`);
        logger.info(`🎉 Content: ${modules.length} modules → ${moduleScripts} scripts`);
        logger.info(`🎉 Total: ${newsScripts + moduleScripts} scripts`);
        logger.info(`🎉 Emails: ${result.sent} sent, ${result.failed} failed`);
        logger.info(`🎉 Viewer: ${viewerUrl}`);
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
