import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import type { NewsArticle } from './news-agent.js';
import type { Language, MarketId } from '../store/client-store.js';

// ── Types ────────────────────────────────────────────────────
export interface ScriptItem {
    style: string;
    styleName: string;
    platform: string;
    duration: string;
    hook: string;
    content: string;
    cta: string;
    tags: string[];
}

export interface ArticleScripts {
    title: string;
    source: string;
    url: string;
    scripts: ScriptItem[];
}

export interface DailyOutput {
    date: string;
    generatedAt: string;
    articleCount: number;
    articles: ArticleScripts[];
    modules?: import('./content-agent.js').ModuleOutput[];
}

// ── Market display names ────────────────────────────────────
const MARKET_DISPLAY: Record<string, { zh: string; en: string }> = {
    'new-york': { zh: '纽约', en: 'New York' },
    'los-angeles': { zh: '洛杉矶', en: 'Los Angeles' },
    'san-francisco': { zh: '旧金山/湾区', en: 'San Francisco Bay Area' },
    'chicago': { zh: '芝加哥', en: 'Chicago' },
    'miami': { zh: '迈阿密/南佛罗里达', en: 'Miami / South Florida' },
    'seattle': { zh: '西雅图', en: 'Seattle' },
    'boston': { zh: '波士顿', en: 'Boston' },
    'houston': { zh: '休斯顿', en: 'Houston' },
};

function getMarketName(market: MarketId, lang: Language): string {
    return MARKET_DISPLAY[market]?.[lang] || market;
}

// ── Prompt ───────────────────────────────────────────────────
function buildPrompt(article: NewsArticle, date: string, language: Language, market: MarketId): string {
    const mkt = getMarketName(market, language);

    if (language === 'en') {
        return `Today is ${date}.

You are a senior real estate content strategist specializing in the ${mkt} market. Based on the following news article, generate 4 different style video scripts.

News Title: ${article.title}
News Source: ${article.source}
News Summary: ${article.description || '(no summary)'}
News Link: ${article.url}

Generate 4 styles, each representing a different positioning:

1. **Professional Analysis (professional)** — formal, data-driven, suitable for market analysis
2. **Casual Chat (casual)** — relaxed conversational style, for social media
3. **Investor Advisor (investor)** — investor perspective, focusing on returns and risk
4. **Myth Buster (mythbuster)** — bold, direct, exposing hidden risks and pitfalls

Each script must include:
- **hook**: Opening hook (1-2 sentences, attention-grabbing)
- **content**: Main body (300-500 words, deep analysis, mention specific neighborhoods and areas in ${mkt})
- **cta**: Call to action (1-2 sentences, drive engagement)
- **platform**: Best platform ("Instagram", "TikTok", "YouTube" or "General", cover at least 3 platforms)
- **duration**: Fixed "90 seconds"
- **tags**: 5-7 relevant hashtags

Return ONLY this JSON array (no markdown code blocks):
[
  {"style":"professional","styleName":"Professional Analysis","platform":"General","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"casual","styleName":"Casual Chat","platform":"TikTok","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"investor","styleName":"Investor Advisor","platform":"YouTube","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"mythbuster","styleName":"Myth Buster","platform":"Instagram","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]}
]`;
    }

    // Chinese prompt
    return `今天是 ${date}。

你是一个${mkt}地产领域的资深内容策划师。请根据以下新闻，生成 4 种不同风格的短视频口播文案。

新闻标题：${article.title}
新闻来源：${article.source}
新闻摘要：${article.description || '(无摘要)'}
新闻链接：${article.url}

请生成 4 种风格的文案，每种风格代表不同的定位：

1. **专业分析型 (professional)** — 正式、数据驱动，适合专业市场分析
2. **轻松聊天型 (casual)** — 轻松对话风格，适合社交媒体传播
3. **投资顾问型 (investor)** — 投资者视角，关注收益和风险
4. **犀利避坑/揭秘型 (mythbuster)** — 犀利直接，揭示隐藏风险和避坑指南

每种风格的文案必须包含：
- **hook**: 开场钩子（1-2句话，吸引眼球）
- **content**: 主要内容（300-500字，深度解读，提及${mkt}的具体地名和社区增加本地化）
- **cta**: 行动号召（1-2句话，引导互动）
- **platform**: 适合的平台（"小红书"、"视频号"、"YouTube" 或 "通用"，4条文案至少覆盖3个不同平台）
- **duration**: 固定为 "90秒"
- **tags**: 5-7个相关话题标签

请严格按照以下 JSON 格式返回（不要添加 markdown 代码块标记）：
[
  {"style":"professional","styleName":"专业分析型","platform":"通用","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"casual","styleName":"轻松聊天型","platform":"小红书","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"investor","styleName":"投资顾问型","platform":"YouTube","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"mythbuster","styleName":"犀利避坑/揭秘型","platform":"视频号","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]}
]`;
}

// ── Call Azure OpenAI ────────────────────────────────────────
async function callAzureOpenAI(prompt: string, language: Language, market: MarketId): Promise<string> {
    let url = config.AZURE_OPENAI_ENDPOINT;

    if (!url.includes('/openai/')) {
        url = `${url.replace(/\/$/, '')}/openai/deployments/${config.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${config.AZURE_OPENAI_API_VERSION}`;
    }

    const isResponsesAPI = url.includes('/openai/responses');
    const mkt = getMarketName(market, language);

    const systemPrompt = language === 'en'
        ? `You are a senior real estate content strategist specializing in ${mkt}. You create engaging video scripts in 4 different styles for real estate professionals. You know the local neighborhoods, market trends, and buyer/seller dynamics. Return ONLY valid JSON.`
        : `你是一个${mkt}地产领域的资深内容策划师，专门为房地产经纪人创作短视频口播文案。你的文案风格多样，能够精准匹配不同平台和受众。你非常了解${mkt}各区域的房产市场。请务必只返回 JSON 格式。`;

    if (isResponsesAPI) {
        try {
            const response = await axios.post(url, {
                model: config.AZURE_OPENAI_DEPLOYMENT,
                input: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
            }, {
                headers: { 'api-key': config.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' },
                timeout: 120000,
            });

            const output = response.data?.output;
            if (!output || !Array.isArray(output)) throw new Error('Empty output from API');
            const messageOutput = output.find((o: any) => o.type === 'message');
            const content = messageOutput?.content?.[0]?.text;
            if (!content) throw new Error('No text in response');
            return content;
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message || String(err);
            throw new Error(`Azure OpenAI API error: ${msg}`);
        }
    } else {
        try {
            const response = await axios.post(url, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
            }, {
                headers: { 'api-key': config.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' },
                timeout: 120000,
            });
            const content = response.data?.choices?.[0]?.message?.content;
            if (!content) throw new Error('Empty response from API');
            return content;
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message || String(err);
            throw new Error(`Azure OpenAI API error: ${msg}`);
        }
    }
}

// ── Parse JSON from AI response ─────────────────────────────
function parseScripts(raw: string): ScriptItem[] {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid script format: expected non-empty array');
    }
    return parsed as ScriptItem[];
}

// ── Generate scripts for one article ────────────────────────
async function generateForArticle(
    article: NewsArticle,
    date: string,
    index: number,
    total: number,
    language: Language = 'zh',
    market: MarketId = 'new-york',
): Promise<ArticleScripts> {
    logger.info(`✍️  [${index + 1}/${total}] Generating 4 scripts for: ${article.title.substring(0, 50)}... (${language}/${market})`);

    const prompt = buildPrompt(article, date, language, market);

    const raw = await retry(
        async () => callAzureOpenAI(prompt, language, market),
        { retries: 3, delayMs: 3000, label: `Scripts for article ${index + 1}` }
    );

    const scripts = parseScripts(raw);
    logger.info(`   ✅ Got ${scripts.length} style scripts`);

    return {
        title: article.title,
        source: article.source,
        url: article.url,
        scripts,
    };
}

// ── Generate all scripts for all articles ───────────────────
export async function generateDailyScripts(
    articles: NewsArticle[],
    maxArticles: number = 7,
    language: Language = 'zh',
    market: MarketId = 'new-york',
): Promise<DailyOutput> {
    const today = language === 'en'
        ? new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
            timeZone: 'America/New_York',
        })
        : new Date().toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
            timeZone: 'America/New_York',
        });

    // Pick top N articles
    const selected = articles.slice(0, maxArticles);

    logger.info(`📝 Generating scripts for ${selected.length} articles × 4 styles (${language}/${market})...`);

    const results: ArticleScripts[] = [];

    for (let i = 0; i < selected.length; i++) {
        const result = await generateForArticle(selected[i], today, i, selected.length, language, market);
        results.push(result);

        // Delay between calls to avoid rate limiting
        if (i < selected.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const output: DailyOutput = {
        date: new Date().toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
        articleCount: results.length,
        articles: results,
    };

    const totalScripts = results.reduce((sum, a) => sum + a.scripts.length, 0);
    logger.info(`🎉 Generated ${totalScripts} total scripts (${results.length} articles × 4 styles) [${language}/${market}]`);

    return output;
}
