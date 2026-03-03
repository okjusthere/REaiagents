import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { NewsArticle } from './news-agent.js';

// ── Create SMTP Transport (abstracted for easy future upgrade) ──
function createTransport() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.GMAIL_USER,
            pass: config.GMAIL_APP_PASSWORD,
        },
    });
}

// ── HTML Email Template ─────────────────────────────────────
function buildEmailHTML(
    clientName: string,
    styleName: string,
    script: string,
    articles: NewsArticle[],
    date: string
): string {
    // Convert script line breaks to HTML
    const scriptHTML = script
        .split('\n')
        .map(line => {
            if (line.startsWith('#')) {
                const level = (line.match(/^#+/) || [''])[0].length;
                const text = line.replace(/^#+\s*/, '');
                return `<h${Math.min(level + 1, 4)} style="color: #1a365d; margin-top: 20px;">${text}</h${Math.min(level + 1, 4)}>`;
            }
            if (line.startsWith('📌') || line.startsWith('**📌')) {
                return `<h3 style="color: #c53030; margin-top: 24px; border-top: 2px solid #e2e8f0; padding-top: 16px;">📌 ${line.replace(/[📌*]/g, '').trim()}</h3>`;
            }
            if (line.match(/^\d+\./)) {
                return `<p style="margin: 4px 0; padding-left: 16px;">${line}</p>`;
            }
            if (line.startsWith('-') || line.startsWith('•')) {
                return `<p style="margin: 4px 0; padding-left: 16px;">• ${line.replace(/^[-•]\s*/, '')}</p>`;
            }
            if (line.trim() === '') {
                return '<br/>';
            }
            return `<p style="margin: 8px 0; line-height: 1.8;">${line}</p>`;
        })
        .join('\n');

    const sourceLinks = articles
        .slice(0, 8)
        .map(a => `<li style="margin: 4px 0;"><a href="${a.url}" style="color: #2b6cb0; text-decoration: none;">${a.title}</a> <span style="color: #999; font-size: 12px;">— ${a.source}</span></li>`)
        .join('\n');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 32px 24px; color: white;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🏠 ${config.EMAIL_SUBJECT_PREFIX}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${date} · ${styleName}</p>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px 24px 0;">
      <p style="color: #4a5568; font-size: 15px; margin: 0;">
        ${clientName}，早上好！👋<br/>
        以下是今日为您精心整理的纽约地产口播稿（${styleName}风格）：
      </p>
    </div>

    <!-- Script Content -->
    <div style="padding: 16px 24px; color: #2d3748; font-size: 15px;">
      ${scriptHTML}
    </div>

    <!-- Source Links -->
    <div style="padding: 16px 24px; background: #f7fafc; border-top: 1px solid #e2e8f0;">
      <h4 style="color: #4a5568; margin: 0 0 12px; font-size: 14px;">📎 新闻来源</h4>
      <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px;">
        ${sourceLinks}
      </ul>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 24px; background: #1a365d; color: #a0aec0; font-size: 12px; text-align: center;">
      <p style="margin: 0;">由 RE AI Agents 自动生成 · 纽约地产智能日报</p>
      <p style="margin: 4px 0 0;">如需调整推送时间或风格，请回复此邮件</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send email to one recipient ─────────────────────────────
export async function sendEmail(
    recipientName: string,
    recipientEmail: string,
    styleName: string,
    script: string,
    articles: NewsArticle[],
    dryRun = false
): Promise<boolean> {
    const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'America/New_York',
    });

    const subject = `${config.EMAIL_SUBJECT_PREFIX} ${today} · ${styleName}`;
    const html = buildEmailHTML(recipientName, styleName, script, articles, today);

    if (dryRun) {
        logger.info(`📧 [DRY RUN] Would send email to ${recipientName} <${recipientEmail}>`);
        logger.info(`   Subject: ${subject}`);
        logger.info(`   Script length: ${script.length} chars`);
        console.log('\n' + '='.repeat(60));
        console.log(`📬 DRY RUN EMAIL — To: ${recipientName} <${recipientEmail}>`);
        console.log(`   Subject: ${subject}`);
        console.log('='.repeat(60));
        console.log(script);
        console.log('='.repeat(60) + '\n');
        return true;
    }

    try {
        const transporter = createTransport();

        await transporter.sendMail({
            from: `"${config.EMAIL_FROM_NAME}" <${config.GMAIL_USER}>`,
            to: `"${recipientName}" <${recipientEmail}>`,
            subject,
            html,
        });

        logger.info(`✅ Email sent to ${recipientName} <${recipientEmail}>`);
        return true;
    } catch (error) {
        logger.error(`❌ Failed to send email to ${recipientName} <${recipientEmail}>`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

// ── Batch send to all recipients ────────────────────────────
export async function sendBatchEmails(
    recipients: { name: string; email: string; styleName: string; script: string }[],
    articles: NewsArticle[],
    dryRun = false
): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        const success = await sendEmail(
            recipient.name,
            recipient.email,
            recipient.styleName,
            recipient.script,
            articles,
            dryRun
        );

        if (success) sent++;
        else failed++;

        // Small delay between sends to avoid rate limiting
        if (!dryRun) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    logger.info(`📊 Email results: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}
