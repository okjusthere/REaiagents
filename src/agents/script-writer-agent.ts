import { AzureOpenAI } from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { getStyle, type StyleConfig } from '../config/styles.js';
import type { NewsArticle } from './news-agent.js';

// ── Azure OpenAI Client ─────────────────────────────────────
const client = new AzureOpenAI({
    endpoint: config.AZURE_OPENAI_ENDPOINT,
    apiKey: config.AZURE_OPENAI_API_KEY,
    apiVersion: config.AZURE_OPENAI_API_VERSION,
});

// ── Build prompt from news articles ─────────────────────────
function buildUserPrompt(articles: NewsArticle[], date: string): string {
    const newsList = articles
        .map((article, i) => {
            return `${i + 1}. 【${article.source}】${article.title}
   摘要：${article.description || '(无摘要)'}
   链接：${article.url}
   发布时间：${article.publishedAt}`;
        })
        .join('\n\n');

    return `今天是 ${date}。

以下是今日纽约地产领域的最新新闻，请根据你的角色设定，将这些新闻整理成一篇完整的中文口播稿。

要求：
1. 口播稿需要 800-1200 字
2. 要包含：开场吸引人的hook → 逐条新闻解读（选择最重要的5-7条）→ 整体市场洞察 → 结尾总结
3. 语言自然流畅，适合直接拿来口播录制
4. 不要照搬新闻原文，要有你自己的解读和观点
5. 在口播稿末尾，附上一个"📌 今日要点总结"的简短列表（3-5个要点）

=== 今日新闻 ===

${newsList}`;
}

// ── Generate script for one style ───────────────────────────
export async function generateScript(
    articles: NewsArticle[],
    styleId: string
): Promise<{ styleId: string; styleName: string; script: string }> {
    const style = getStyle(styleId);
    const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'America/New_York',
    });

    logger.info(`✍️  Generating script in style: ${style.name}...`);

    const result = await retry(
        async () => {
            const response = await client.chat.completions.create({
                model: config.AZURE_OPENAI_DEPLOYMENT,
                messages: [
                    { role: 'system', content: style.systemPrompt },
                    { role: 'user', content: buildUserPrompt(articles, today) },
                ],
                temperature: 0.8,
                max_tokens: 3000,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from Azure OpenAI');
            }
            return content;
        },
        { retries: 3, delayMs: 2000, label: `Script generation (${style.name})` }
    );

    logger.info(`✅ Script generated for style: ${style.name} (${result.length} chars)`);

    return {
        styleId: style.id,
        styleName: style.name,
        script: result,
    };
}

// ── Generate scripts for all required styles ────────────────
export async function generateAllScripts(
    articles: NewsArticle[],
    styleIds: string[]
): Promise<Map<string, { styleName: string; script: string }>> {
    const uniqueStyles = [...new Set(styleIds)];
    const results = new Map<string, { styleName: string; script: string }>();

    logger.info(`📝 Generating ${uniqueStyles.length} script style(s)...`);

    // Generate scripts sequentially to avoid rate limits
    for (const styleId of uniqueStyles) {
        const result = await generateScript(articles, styleId);
        results.set(result.styleId, {
            styleName: result.styleName,
            script: result.script,
        });
    }

    logger.info(`🎉 All ${results.size} scripts generated successfully`);
    return results;
}
