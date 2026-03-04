import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { createManageToken, createViewerToken } from '../utils/access-links.js';
import { escapeHtml, escapeHtmlWithBreaks, safeHttpUrl } from '../utils/html.js';
import type { Client, Language, MarketId } from '../store/client-store.js';
import type { DailyOutput } from './script-writer-agent.js';

const MARKET_LABELS: Record<MarketId, Record<Language, string>> = {
    'new-york': { zh: '纽约', en: 'New York' },
    'los-angeles': { zh: '洛杉矶', en: 'Los Angeles' },
    'san-francisco': { zh: '旧金山湾区', en: 'San Francisco Bay Area' },
    'chicago': { zh: '芝加哥', en: 'Chicago' },
    'miami': { zh: '迈阿密', en: 'Miami' },
    'seattle': { zh: '西雅图', en: 'Seattle' },
    'boston': { zh: '波士顿', en: 'Boston' },
    'houston': { zh: '休斯顿', en: 'Houston' },
};

function createTransport() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.GMAIL_USER, pass: config.GMAIL_APP_PASSWORD },
    });
}

function t(language: Language, zh: string, en: string): string {
    return language === 'en' ? en : zh;
}

function getMarketLabel(market: MarketId, language: Language): string {
    return MARKET_LABELS[market]?.[language] || market;
}

function renderArticleCards(output: DailyOutput): string {
    return output.articles.map((article, index) => {
        const preview = article.scripts[0]?.hook || '';
        return `
      <div style="background: #f7fafc; border-radius: 8px; padding: 14px; margin-bottom: 8px; border-left: 4px solid #3b82f6;">
        <div style="font-size: 14px; font-weight: 600; color: #1a365d;">${index + 1}. ${escapeHtml(article.title)}</div>
        <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">${escapeHtml(preview.substring(0, 90))}${preview.length > 90 ? '...' : ''}</div>
      </div>`;
    }).join('\n');
}

function renderModuleCards(output: DailyOutput): string {
    return (output.modules || []).map((module) => {
        const count = module.articles.reduce((sum, article) => sum + article.scripts.length, 0);
        const titles = module.articles.map((article) => escapeHtml(article.title)).join(' · ');
        return `
      <div style="background: #f0fdf4; border-radius: 8px; padding: 14px; margin-bottom: 8px; border-left: 4px solid #22c55e;">
        <div style="font-size: 14px; font-weight: 600; color: #14532d;">${escapeHtml(module.moduleEmoji)} ${escapeHtml(module.moduleName)} <span style="color:#64748b;font-weight:400;font-size:12px;">(${count})</span></div>
        <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">${titles}</div>
      </div>`;
    }).join('\n');
}

function buildEmailHTML(
    client: Client,
    output: DailyOutput,
    viewerUrl: string,
    manageUrl: string,
    dateLabel: string,
    isTrial = false,
    subscribeUrl?: string,
): string {
    const language = client.language;
    const marketLabel = getMarketLabel(output.market, language);
    const articleCards = renderArticleCards(output);
    const moduleCards = renderModuleCards(output);
    const moduleScripts = output.modules
        ? output.modules.reduce((sum, module) => sum + module.articles.reduce((inner, article) => inner + article.scripts.length, 0), 0)
        : 0;
    const totalScripts = output.articleCount * 4 + moduleScripts;
    const companyAddress = config.COMPANY_ADDRESS
        ? `<p style="margin: 6px 0 0; color: #64748b;">${escapeHtml(config.COMPANY_ADDRESS)}</p>`
        : '';
    const safeSubscribeUrl = subscribeUrl ? safeHttpUrl(subscribeUrl) : null;

    const trialNotice = isTrial ? `
      <div style="padding: 0 24px 12px;">
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e;">
          ${t(language,
        `🎁 这是您的免费体验邮件。如需继续接收，请 ${safeSubscribeUrl ? `<a href="${safeSubscribeUrl}" style="color: #4338ca; font-weight: 600;">升级订阅</a>` : '升级订阅'}。`,
        `🎁 This is your free trial email. ${safeSubscribeUrl ? `<a href="${safeSubscribeUrl}" style="color: #4338ca; font-weight: 600;">Upgrade to continue</a>.` : 'Upgrade to continue.'}`)}
        </div>
      </div>` : '';

    const trialBanner = isTrial && safeSubscribeUrl ? `
      <div style="margin: 0; padding: 24px; background: linear-gradient(135deg, #4338ca, #2563eb); text-align: center;">
        <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: white;">${t(language, '喜欢今天的文案吗？', 'Like today’s scripts?')}</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255,255,255,0.88);">${t(language, `订阅后每天自动收到 ${totalScripts}+ 条新文案。`, `Subscribe to receive ${totalScripts}+ fresh scripts every day.`)}</p>
        <a href="${safeSubscribeUrl}" style="display: inline-block; background: white; color: #4338ca; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 700;">${t(language, '立即订阅', 'Subscribe now')}</a>
      </div>` : '';

    return `
<!DOCTYPE html>
<html lang="${language === 'en' ? 'en' : 'zh-CN'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); padding: 28px 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${t(language, '今日视频文案已就绪', 'Your video scripts are ready')}</h1>
      <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${escapeHtml(dateLabel)} · ${escapeHtml(marketLabel)} · ${totalScripts} ${t(language, '条文案', 'scripts')}</p>
    </div>

    <div style="padding: 24px 24px 8px;">
      <p style="color: #4a5568; font-size: 15px; margin: 0 0 4px;">${escapeHtml(client.name)}，${t(language, '你好', 'hello')}.</p>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">${t(language, `今天已生成 ${totalScripts} 条视频文案，覆盖新闻热点和内容模块。`, `Today's package includes ${totalScripts} ready-to-use scripts across news and evergreen content modules.`)}</p>
    </div>

    ${trialNotice}

    <div style="padding: 0 24px 20px; text-align: center;">
      <a href="${viewerUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59,130,246,0.4);">${t(language, '查看完整文案并一键复制', 'Open scripts and copy in one click')}</a>
    </div>

    <div style="padding: 0 24px 12px;">
      <h3 style="font-size: 13px; color: #64748b; margin: 0 0 10px;">${t(language, '新闻热点', 'News highlights')}</h3>
      ${articleCards}
    </div>

    ${moduleCards ? `<div style="padding: 0 24px 20px;">
      <h3 style="font-size: 13px; color: #64748b; margin: 0 0 10px;">${t(language, '内容模块', 'Content modules')}</h3>
      ${moduleCards}
    </div>` : ''}

    ${trialBanner}

    <div style="padding: 16px 24px; background: #0f172a; color: #94a3b8; font-size: 12px; text-align: center;">
      <p style="margin: 0 0 6px;">REscript · AI-powered real estate video scripts</p>
      <p style="margin: 0;">
        <a href="${manageUrl}" style="color: #60a5fa; text-decoration: none;">${t(language, '管理订阅 / 退订', 'Manage subscription / unsubscribe')}</a>
        ·
        <a href="${config.BASE_URL}/privacy.html" style="color: #60a5fa; text-decoration: none;">${t(language, '隐私政策', 'Privacy')}</a>
        ·
        <a href="${config.BASE_URL}/terms.html" style="color: #60a5fa; text-decoration: none;">${t(language, '服务条款', 'Terms')}</a>
      </p>
      <p style="margin: 6px 0 0; color: #64748b;">${escapeHtml(config.SUPPORT_EMAIL)}</p>
      ${companyAddress}
    </div>
  </div>
</body>
</html>`;
}

function buildSubject(client: Client, output: DailyOutput, dateLabel: string, isTrial: boolean): string {
    const marketLabel = getMarketLabel(output.market, client.language);
    const core = t(
        client.language,
        `${dateLabel} · ${marketLabel} ${output.articleCount}条热点文案已就绪`,
        `${dateLabel} · ${marketLabel} scripts are ready`,
    );
    const trialTag = isTrial ? t(client.language, ' [免费体验]', ' [Trial]') : '';
    return `${config.EMAIL_SUBJECT_PREFIX} ${core}${trialTag}`.trim();
}

async function sendEmail(
    client: Client,
    output: DailyOutput,
    baseUrl: string,
    dryRun: boolean,
    isTrial = false,
    subscribeUrl?: string,
): Promise<boolean> {
    const dateLabel = new Date(output.generatedAt).toLocaleDateString(client.language === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'America/New_York',
    });
    const viewerToken = createViewerToken(client, output.key);
    const manageToken = createManageToken(client);
    const viewerUrl = `${baseUrl}/view.html?key=${encodeURIComponent(output.key)}&token=${encodeURIComponent(viewerToken)}`;
    const manageUrl = `${baseUrl}/manage.html?token=${encodeURIComponent(manageToken)}`;
    const subject = buildSubject(client, output, dateLabel, isTrial);
    const html = buildEmailHTML(client, output, viewerUrl, manageUrl, dateLabel, isTrial, subscribeUrl);

    if (dryRun) {
        logger.info(`📧 [DRY RUN] Would send to ${client.name} <${client.email}> (${isTrial ? 'trial' : client.plan})`);
        return true;
    }

    try {
        const transporter = createTransport();
        await transporter.sendMail({
            from: `"${config.EMAIL_FROM_NAME}" <${config.GMAIL_USER}>`,
            to: `"${client.name}" <${client.email}>`,
            replyTo: config.SUPPORT_EMAIL,
            subject,
            html,
            headers: {
                'List-Unsubscribe': `<${manageUrl}>, <mailto:${config.SUPPORT_EMAIL}?subject=unsubscribe>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
        });
        logger.info(`✅ Email sent to ${client.name} <${client.email}> (${isTrial ? 'trial' : client.plan})`);
        return true;
    } catch (error) {
        logger.error(`❌ Failed to send to ${client.name} <${client.email}>`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

export async function sendBatchEmails(
    clients: Client[],
    output: DailyOutput,
    baseUrl: string,
    dryRun = false,
    isTrial = false,
    subscribeUrl?: string,
): Promise<{ sent: number; failed: number; sentClientIds: string[] }> {
    let sent = 0;
    let failed = 0;
    const sentClientIds: string[] = [];

    for (const client of clients) {
        const ok = await sendEmail(client, output, baseUrl, dryRun, isTrial, subscribeUrl);
        if (ok) {
            sent += 1;
            sentClientIds.push(client.id);
        } else {
            failed += 1;
        }
        if (!dryRun) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    logger.info(`📊 Email results (${isTrial ? 'trial' : 'subscriber'}): ${sent} sent, ${failed} failed`);
    return { sent, failed, sentClientIds };
}
