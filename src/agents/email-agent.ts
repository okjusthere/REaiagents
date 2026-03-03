import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { Client } from '../store/client-store.js';
import type { DailyOutput } from './script-writer-agent.js';

// ── Create SMTP Transport ───────────────────────────────────
function createTransport() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.GMAIL_USER, pass: config.GMAIL_APP_PASSWORD },
    });
}

// ── Build summary email HTML ────────────────────────────────
function buildEmailHTML(
    clientName: string,
    output: DailyOutput,
    viewerUrl: string,
    date: string
): string {
    const articleCards = output.articles.map((article, i) => {
        const firstHook = article.scripts[0]?.hook || '';
        return `
      <div style="background: #f7fafc; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${article.source}</div>
        <div style="font-size: 15px; font-weight: 600; color: #1a365d; margin-bottom: 6px;">
          ${i + 1}. ${article.title}
        </div>
        <div style="font-size: 13px; color: #4a5568; line-height: 1.5;">
          "${firstHook.substring(0, 80)}..."
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
          ✍️ 4种风格文案已就绪
        </div>
      </div>`;
    }).join('\n');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); padding: 28px 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">🎬 今日视频文案已就绪</h1>
      <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${date} · ${output.articleCount}条新闻 × 4种风格</p>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px 24px 8px;">
      <p style="color: #4a5568; font-size: 15px; margin: 0 0 4px;">
        ${clientName}，早上好！👋
      </p>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">
        今日为您生成了 <strong>${output.articleCount * 4} 条</strong>视频口播文案，覆盖 4 种风格，点击下方按钮查看完整内容并一键复制。
      </p>
    </div>

    <!-- CTA Button -->
    <div style="padding: 0 24px 20px; text-align: center;">
      <a href="${viewerUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59,130,246,0.4);">
        📋 查看完整文案 & 一键复制
      </a>
    </div>

    <!-- Article Cards -->
    <div style="padding: 0 24px 20px;">
      <h3 style="font-size: 14px; color: #64748b; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">📰 今日新闻概览</h3>
      ${articleCards}
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; background: #0f172a; color: #94a3b8; font-size: 12px; text-align: center;">
      <p style="margin: 0;">由 RE AI Agents 自动生成 · 纽约地产视频文案日报</p>
      <p style="margin: 4px 0 0;">如需调整推送，请回复此邮件</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Send to one recipient ───────────────────────────────────
async function sendEmail(
    client: Client,
    output: DailyOutput,
    viewerUrl: string,
    dryRun: boolean
): Promise<boolean> {
    const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
        timeZone: 'America/New_York',
    });

    const totalScripts = output.articleCount * 4;
    const subject = `🎬 ${today} · ${output.articleCount}条新闻 × ${totalScripts}条文案已就绪`;
    const html = buildEmailHTML(client.name, output, viewerUrl, today);

    if (dryRun) {
        logger.info(`📧 [DRY RUN] Would send to ${client.name} <${client.email}>`);
        return true;
    }

    try {
        const transporter = createTransport();
        await transporter.sendMail({
            from: `"${config.EMAIL_FROM_NAME}" <${config.GMAIL_USER}>`,
            to: `"${client.name}" <${client.email}>`,
            subject,
            html,
        });
        logger.info(`✅ Email sent to ${client.name} <${client.email}>`);
        return true;
    } catch (error) {
        logger.error(`❌ Failed to send to ${client.name} <${client.email}>`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

// ── Batch send ──────────────────────────────────────────────
export async function sendBatchEmails(
    clients: Client[],
    output: DailyOutput,
    viewerUrl: string,
    dryRun = false
): Promise<{ sent: number; failed: number }> {
    let sent = 0, failed = 0;

    for (const client of clients) {
        const ok = await sendEmail(client, output, viewerUrl, dryRun);
        if (ok) sent++; else failed++;
        if (!dryRun) await new Promise(r => setTimeout(r, 1000));
    }

    logger.info(`📊 Email results: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}
