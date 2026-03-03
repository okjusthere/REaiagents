import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Azure OpenAI
    AZURE_OPENAI_ENDPOINT: z.string().url(),
    AZURE_OPENAI_API_KEY: z.string().min(1),
    AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-5.2-chat'),
    AZURE_OPENAI_API_VERSION: z.string().default('2025-01-01-preview'),

    // Gmail SMTP
    GMAIL_USER: z.string().email(),
    GMAIL_APP_PASSWORD: z.string().min(1),

    // Email Settings
    EMAIL_FROM_NAME: z.string().default('NY地产日报'),
    EMAIL_SUBJECT_PREFIX: z.string().default('[纽约地产AI日报]'),

    // Schedule
    CRON_SCHEDULE: z.string().default('0 7 * * *'),
    CRON_TIMEZONE: z.string().default('America/New_York'),

    // Optional
    DRY_RUN: z.string().default('false').transform(v => v === 'true'),
    LOG_LEVEL: z.string().default('info'),
});

function loadConfig() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Environment configuration errors:');
        for (const issue of result.error.issues) {
            console.error(`   ${issue.path.join('.')}: ${issue.message}`);
        }
        console.error('\n📋 Copy .env.example to .env and fill in your values.');
        process.exit(1);
    }

    return result.data;
}

export const config = loadConfig();
export type Config = ReturnType<typeof loadConfig>;
