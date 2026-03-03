import { config } from './config/index.js';
import { runPipeline } from './orchestrator.js';
import { startScheduler } from './scheduler.js';
import { logger } from './utils/logger.js';
import clients from './config/clients.js';
import { getAllStyleIds } from './config/styles.js';

// ── Parse CLI flags ─────────────────────────────────────────
const args = process.argv.slice(2);
const immediate = args.includes('--now');
const dryRun = args.includes('--dry-run') || config.DRY_RUN;

// ── Banner ──────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════╗
║    🏠  RE AI Agents — 纽约地产AI口播稿推送系统    ║
╚══════════════════════════════════════════════════╝
`);

logger.info('Configuration:');
logger.info(`  Azure OpenAI: ${config.AZURE_OPENAI_ENDPOINT}`);
logger.info(`  Model: ${config.AZURE_OPENAI_DEPLOYMENT}`);
logger.info(`  Email from: ${config.GMAIL_USER}`);
logger.info(`  Clients: ${clients.length}`);
logger.info(`  Styles: ${getAllStyleIds().join(', ')}`);
logger.info(`  Schedule: ${config.CRON_SCHEDULE} (${config.CRON_TIMEZONE})`);
logger.info(`  Dry run: ${dryRun}`);

// ── Execute ─────────────────────────────────────────────────
if (immediate) {
    logger.info('\n🚀 Immediate execution requested (--now flag)');

    runPipeline(dryRun)
        .then(() => {
            logger.info('✅ Immediate run completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('💥 Immediate run failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            process.exit(1);
        });
} else {
    // Start the cron scheduler
    startScheduler();
    logger.info('\n🟢 System is running. Waiting for scheduled execution...');
    logger.info('   Press Ctrl+C to stop.\n');
}
