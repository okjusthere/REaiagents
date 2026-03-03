import { searchNews } from './agents/news-agent.js';
import { generateAllScripts } from './agents/script-writer-agent.js';
import { sendBatchEmails } from './agents/email-agent.js';
import clients from './config/clients.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

export async function runPipeline(dryRun = false): Promise<void> {
    const startTime = Date.now();
    logger.info('🚀 ═══════════════════════════════════════════');
    logger.info('🚀 RE AI Agents Pipeline Starting...');
    logger.info(`🚀 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    logger.info('🚀 ═══════════════════════════════════════════');

    try {
        // ── Step 1: Search News ──────────────────────────────
        logger.info('\n📰 Step 1/3: Searching for NY real estate news...');
        const articles = await searchNews();

        if (articles.length === 0) {
            logger.warn('⚠️  No news articles found. Skipping pipeline.');
            return;
        }

        logger.info(`📰 Found ${articles.length} articles:`);
        articles.forEach((a, i) => {
            logger.info(`   ${i + 1}. [${a.source}] ${a.title}`);
        });

        // ── Step 2: Generate Scripts ─────────────────────────
        logger.info('\n✍️  Step 2/3: Generating speaking scripts...');
        const requiredStyles = [...new Set(clients.map(c => c.style))];
        const scripts = await generateAllScripts(articles, requiredStyles);

        // ── Step 3: Send Emails ──────────────────────────────
        logger.info('\n📧 Step 3/3: Sending emails to clients...');
        const emailRecipients = clients.map(client => {
            const scriptData = scripts.get(client.style);
            if (!scriptData) {
                throw new Error(`No script generated for style: ${client.style}`);
            }
            return {
                name: client.name,
                email: client.email,
                styleName: scriptData.styleName,
                script: scriptData.script,
            };
        });

        const result = await sendBatchEmails(emailRecipients, articles, dryRun);

        // ── Summary ──────────────────────────────────────────
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info('\n🎉 ═══════════════════════════════════════════');
        logger.info(`🎉 Pipeline completed in ${elapsed}s`);
        logger.info(`🎉 Articles: ${articles.length}`);
        logger.info(`🎉 Scripts: ${scripts.size} styles`);
        logger.info(`🎉 Emails: ${result.sent} sent, ${result.failed} failed`);
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
