import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { contentModules, getTodayTopics, type ContentModule, type TopicItem } from '../config/topics.js';
import { scriptsSchema, type ScriptItem, type ArticleScripts } from './script-writer-agent.js';
import type { Language, MarketId } from '../store/client-store.js';

// ── Types ────────────────────────────────────────────────────
export interface ModuleOutput {
    moduleId: string;
    moduleName: string;
    moduleEmoji: string;
    articles: ArticleScripts[];
}

// ── Market display names ────────────────────────────────────
const MARKET_DISPLAY: Record<string, { zh: string; en: string }> = {
    'new-york': { zh: '纽约', en: 'New York' },
    'los-angeles': { zh: '洛杉矶', en: 'Los Angeles' },
    'san-francisco': { zh: '旧金山/湾区', en: 'San Francisco Bay Area' },
    'chicago': { zh: '芝加哥', en: 'Chicago' },
    'miami': { zh: '迈阿密', en: 'Miami' },
    'seattle': { zh: '西雅图', en: 'Seattle' },
    'boston': { zh: '波士顿', en: 'Boston' },
    'houston': { zh: '休斯顿', en: 'Houston' },
};

function getMarketName(market: MarketId, lang: Language): string {
    return MARKET_DISPLAY[market]?.[lang] || market;
}

// ── Prompt ───────────────────────────────────────────────────
function buildTopicPrompt(topic: TopicItem, module: ContentModule, date: string, language: Language, market: MarketId): string {
    const mkt = getMarketName(market, language);

    if (language === 'en') {
        return `Today is ${date}.

You are a senior real estate content strategist specializing in the ${mkt} market. Generate 4 different style 90-second video scripts based on this topic.

Content Module: ${module.emoji} ${module.name}
Topic: ${topic.title}
Angle: ${topic.angle}
Keywords: ${topic.keywords.join(', ')}

IMPORTANT: Adapt all content to the ${mkt} market. Use local neighborhood names, market data, and regulations specific to ${mkt}.

Generate 4 styles:
1. **Professional Analysis (professional)** — formal, data-driven, with specific numbers and case studies
2. **Casual Chat (casual)** — relaxed, friendly, like talking to a friend, for social media
3. **Investor Advisor (investor)** — investor perspective, focusing on returns, risk, and asset allocation
4. **Myth Buster (mythbuster)** — bold, direct, exposing industry insider tips and common misconceptions

Each script must include:
- **hook**: Opening hook (1-2 sentences, create suspense or curiosity)
- **content**: Main body (350-450 words, deep explanation, mention specific ${mkt} neighborhoods and areas)
- **cta**: Call to action (1-2 sentences, drive follow/DM/comment)
- **platform**: Best platform ("Instagram", "TikTok", "YouTube" or "General", cover at least 3 platforms)
- **duration**: Fixed "90 seconds"
- **tags**: 5-7 hashtags

Return ONLY JSON array (no markdown code blocks):
[
  {"style":"professional","styleName":"Professional Analysis","platform":"General","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"casual","styleName":"Casual Chat","platform":"TikTok","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"investor","styleName":"Investor Advisor","platform":"YouTube","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"mythbuster","styleName":"Myth Buster","platform":"Instagram","duration":"90 seconds","hook":"...","content":"...","cta":"...","tags":[...]}
]`;
    }

    // Chinese prompt
    return `今天是 ${date}。

你是一个${mkt}地产领域的资深内容策划师。请根据以下话题，生成 4 种不同风格的短视频口播文案（90秒）。

内容模块：${module.emoji} ${module.name}
话题：${topic.title}
创作角度：${topic.angle}
参考关键词：${topic.keywords.join(', ')}

重要：将所有内容适配到${mkt}市场。使用${mkt}当地的社区名称、市场数据和法规。

请生成 4 种风格的文案：

1. **专业分析型 (professional)** — 正式、数据驱动，引用具体数字和案例
2. **轻松聊天型 (casual)** — 轻松亲切，像朋友聊天，适合社交媒体
3. **投资顾问型 (investor)** — 投资者视角，关注收益、风险和资产配置
4. **犀利避坑/揭秘型 (mythbuster)** — 犀利直接，揭示行业内幕和常见误区

每种文案必须包含：
- **hook**: 开场钩子（1-2句，制造悬念或好奇心）
- **content**: 主要内容（350-450字，深度讲解，多提及${mkt}具体地名和社区）
- **cta**: 行动号召（1-2句，引导关注/私信/评论）
- **platform**: 适合的平台（"小红书"、"视频号"、"YouTube" 或 "通用"，4条至少覆盖3个平台）
- **duration**: 固定为 "90秒"
- **tags**: 5-7个话题标签

请严格返回 JSON 数组格式（不要 markdown 代码块）：
[
  {"style":"professional","styleName":"专业分析型","platform":"通用","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"casual","styleName":"轻松聊天型","platform":"小红书","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"investor","styleName":"投资顾问型","platform":"YouTube","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]},
  {"style":"mythbuster","styleName":"犀利避坑/揭秘型","platform":"视频号","duration":"90秒","hook":"...","content":"...","cta":"...","tags":[...]}
]`;
}

// ── Call Azure OpenAI ────────────────────────────────────────
async function callAI(prompt: string, language: Language, market: MarketId): Promise<string> {
    let url = config.AZURE_OPENAI_ENDPOINT;
    if (!url.includes('/openai/')) {
        url = `${url.replace(/\/$/, '')}/openai/deployments/${config.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${config.AZURE_OPENAI_API_VERSION}`;
    }
    const isResponsesAPI = url.includes('/openai/responses');
    const mkt = getMarketName(market, language);
    const system = language === 'en'
        ? `You are a senior real estate content strategist specializing in ${mkt}. Return ONLY valid JSON.`
        : `你是${mkt}地产领域的资深内容策划师。请务必只返回 JSON 格式。`;

    if (isResponsesAPI) {
        try {
            const res = await axios.post(url, {
                model: config.AZURE_OPENAI_DEPLOYMENT,
                input: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            }, { headers: { 'api-key': config.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' }, timeout: 120000 });
            const output = res.data?.output;
            if (!output || !Array.isArray(output)) throw new Error('Empty output');
            const msg = output.find((o: any) => o.type === 'message');
            const text = msg?.content?.[0]?.text;
            if (!text) throw new Error('No text in response');
            return text;
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message || String(err);
            throw new Error(`Azure OpenAI API error: ${msg}`);
        }
    } else {
        try {
            const res = await axios.post(url, {
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            }, { headers: { 'api-key': config.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' }, timeout: 120000 });
            const text = res.data?.choices?.[0]?.message?.content;
            if (!text) throw new Error('Empty response');
            return text;
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message || String(err);
            throw new Error(`Azure OpenAI API error: ${msg}`);
        }
    }
}

function parseScripts(raw: string): ScriptItem[] {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return scriptsSchema.parse(JSON.parse(cleaned)) as ScriptItem[];
}

// ── Generate content for all modules ────────────────────────
export async function generateAllModuleContent(
    dateStr: string,
    language: Language = 'zh',
    market: MarketId = 'new-york',
): Promise<ModuleOutput[]> {
    const today = language === 'en'
        ? new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
            timeZone: 'America/New_York',
        })
        : new Date().toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
            timeZone: 'America/New_York',
        });

    const results: ModuleOutput[] = [];

    for (const module of contentModules) {
        const topics = getTodayTopics(module, dateStr);
        logger.info(`\n${module.emoji} Module: ${module.name} — ${topics.length} topic(s) today [${language}/${market}]`);

        const articles: ArticleScripts[] = [];

        for (const topic of topics) {
            logger.info(`   ✍️  Generating: ${topic.title}...`);

            try {
                const prompt = buildTopicPrompt(topic, module, today, language, market);
                const raw = await retry(
                    async () => callAI(prompt, language, market),
                    { retries: 2, delayMs: 3000, label: topic.title }
                );
                const scripts = parseScripts(raw);
                logger.info(`   ✅ Got ${scripts.length} scripts`);
                articles.push({
                    title: topic.title,
                    source: `${module.emoji} ${module.name}`,
                    url: '',
                    scripts,
                });
            } catch (err: any) {
                logger.error(`   ❌ Failed: ${topic.title}`, { error: err.message });
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 2000));
        }

        results.push({
            moduleId: module.id,
            moduleName: module.name,
            moduleEmoji: module.emoji,
            articles,
        });
    }

    const totalScripts = results.reduce((s, m) => s + m.articles.reduce((s2, a) => s2 + a.scripts.length, 0), 0);
    logger.info(`\n🎉 Content modules: ${totalScripts} scripts generated across ${results.length} modules [${language}/${market}]`);

    return results;
}
