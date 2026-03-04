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
  date: string,
  isTrial: boolean = false,
  subscribeUrl?: string,
): string {
  const moduleScripts = output.modules
    ? output.modules.reduce((s, m) => s + m.articles.reduce((s2, a) => s2 + a.scripts.length, 0), 0)
    : 0;
  const totalScripts = output.articleCount * 4 + moduleScripts;

  const articleCards = output.articles.map((article, i) => {
    const firstHook = article.scripts[0]?.hook || '';
    return `
      <div style="background: #f7fafc; border-radius: 8px; padding: 14px; margin-bottom: 8px; border-left: 4px solid #3b82f6;">
        <div style="font-size: 14px; font-weight: 600; color: #1a365d;">${i + 1}. ${article.title}</div>
        <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">"${firstHook.substring(0, 60)}..."</div>
      </div>`;
  }).join('\n');

  const moduleCards = output.modules
    ? output.modules.map(m => {
      const count = m.articles.reduce((s, a) => s + a.scripts.length, 0);
      const topicNames = m.articles.map(a => a.title).join(' · ');
      return `
      <div style="background: #f0fdf4; border-radius: 8px; padding: 14px; margin-bottom: 8px; border-left: 4px solid #22c55e;">
        <div style="font-size: 14px; font-weight: 600; color: #14532d;">${m.moduleEmoji} ${m.moduleName} <span style="color:#64748b;font-weight:400;font-size:12px;">(${count}条)</span></div>
        <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">${topicNames}</div>
      </div>`;
    }).join('\n')
    : '';

  // Trial upgrade banner
  const trialBanner = isTrial && subscribeUrl ? `
    <div style="margin: 0; padding: 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); text-align: center;">
      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: white;">🔥 喜欢今天的文案吗？</p>
      <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255,255,255,0.85);">这是您的免费体验邮件。订阅后每天自动收到 ${totalScripts}+ 条文案。</p>
      <a href="${subscribeUrl}" style="display: inline-block; background: white; color: #6366f1; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 700;">立即订阅 — $9.99/月 →</a>
      <p style="margin: 12px 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">支持信用卡 / 支付宝 · 随时取消</p>
    </div>` : '';

  const trialNotice = isTrial ? `
    <div style="padding: 0 24px 12px;">
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e;">
        🎁 这是您的 <strong>免费体验邮件</strong>。如果觉得有用，<a href="${subscribeUrl}" style="color: #6366f1; font-weight: 600;">点击这里订阅</a>，每天自动收到新鲜文案。
      </div>
    </div>` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); padding: 28px 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">🎬 今日视频文案已就绪</h1>
      <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${date} · ${totalScripts} 条文案${isTrial ? ' · 🎁 免费体验' : ''}</p>
    </div>

    <div style="padding: 24px 24px 8px;">
      <p style="color: #4a5568; font-size: 15px; margin: 0 0 4px;">${clientName}，早上好！👋</p>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">今日共生成 <strong>${totalScripts} 条</strong>视频文案，覆盖新闻热点 + 7 大内容模块。</p>
    </div>

    ${trialNotice}

    <div style="padding: 0 24px 20px; text-align: center;">
      <a href="${viewerUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59,130,246,0.4);">📋 查看完整文案 & 一键复制</a>
    </div>

    <div style="padding: 0 24px 12px;">
      <h3 style="font-size: 13px; color: #64748b; margin: 0 0 10px;">📰 新闻热点</h3>
      ${articleCards}
    </div>

    ${moduleCards ? `<div style="padding: 0 24px 20px;">
      <h3 style="font-size: 13px; color: #64748b; margin: 0 0 10px;">📚 内容模块</h3>
      ${moduleCards}
    </div>` : ''}

    ${trialBanner}

    <div style="padding: 16px 24px; background: #0f172a; color: #94a3b8; font-size: 12px; text-align: center;">
      <p style="margin: 0;">由 AI文案日报 自动生成 · 纽约地产视频文案${isTrial ? '' : ' · <a href="' + (subscribeUrl || '#') + '" style="color: #60a5fa;">管理订阅</a>'}</p>
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
  dryRun: boolean,
  isTrial: boolean = false,
  subscribeUrl?: string,
): Promise<boolean> {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'America/New_York',
  });

  const totalScripts = output.articleCount * 4;
  const trialTag = isTrial ? ' [🎁 免费体验]' : '';
  const subject = `🎬 ${today} · ${output.articleCount}条新闻 × ${totalScripts}条文案已就绪${trialTag}`;
  const html = buildEmailHTML(client.name, output, viewerUrl, today, isTrial, subscribeUrl);

  if (dryRun) {
    logger.info(`📧 [DRY RUN] Would send to ${client.name} <${client.email}> (${isTrial ? 'trial' : 'subscriber'})`);
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
    logger.info(`✅ Email sent to ${client.name} <${client.email}> (${isTrial ? 'trial' : 'subscriber'})`);
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
  dryRun = false,
  isTrial = false,
  subscribeUrl?: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;

  for (const client of clients) {
    const ok = await sendEmail(client, output, viewerUrl, dryRun, isTrial, subscribeUrl);
    if (ok) sent++; else failed++;
    if (!dryRun) await new Promise(r => setTimeout(r, 1000));
  }

  logger.info(`📊 Email results (${isTrial ? 'trial' : 'subscriber'}): ${sent} sent, ${failed} failed`);
  return { sent, failed };
}
