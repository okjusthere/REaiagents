import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

export interface NewsArticle {
    title: string;
    description: string;
    source: string;
    url: string;
    publishedAt: string;
}

// ── Bing News Search (Primary) ──────────────────────────────
async function searchBingNews(): Promise<NewsArticle[]> {
    const queries = [
        'New York real estate',
        'NYC housing market',
        'Manhattan property',
    ];

    const allArticles: NewsArticle[] = [];

    for (const query of queries) {
        try {
            const response = await axios.get('https://api.bing.microsoft.com/v7.0/news/search', {
                params: {
                    q: query,
                    count: 10,
                    freshness: 'Day',
                    mkt: 'en-US',
                    sortBy: 'Relevance',
                },
                headers: {
                    'Ocp-Apim-Subscription-Key': config.BING_NEWS_API_KEY,
                },
            });

            const articles = (response.data.value || []).map((item: any) => ({
                title: item.name,
                description: item.description || '',
                source: item.provider?.[0]?.name || 'Unknown',
                url: item.url,
                publishedAt: item.datePublished || new Date().toISOString(),
            }));

            allArticles.push(...articles);
        } catch (error) {
            logger.warn(`Bing News search failed for query "${query}"`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return allArticles;
}

// ── Google News RSS (Fallback) ──────────────────────────────
async function searchGoogleNewsRSS(): Promise<NewsArticle[]> {
    const query = encodeURIComponent('New York real estate');
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    try {
        const response = await axios.get(rssUrl, { timeout: 10000 });
        const xml = response.data as string;

        // Simple XML parsing for RSS items
        const items: NewsArticle[] = [];
        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const itemXml of itemMatches.slice(0, 15)) {
            const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || '';
            const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
            const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
            const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || 'Google News';

            if (title && link) {
                items.push({
                    title: title.trim(),
                    description: '',
                    source: source.trim(),
                    url: link.trim(),
                    publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                });
            }
        }

        return items;
    } catch (error) {
        logger.error('Google News RSS fallback also failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

// ── Deduplication ───────────────────────────────────────────
function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    const unique: NewsArticle[] = [];

    for (const article of articles) {
        // Normalize title for dedup: lowercase, remove extra spaces
        const key = article.title.toLowerCase().replace(/\s+/g, ' ').trim();

        // Check for similar titles (first 50 chars)
        const shortKey = key.substring(0, 50);
        if (!seen.has(shortKey)) {
            seen.add(shortKey);
            unique.push(article);
        }
    }

    return unique;
}

// ── Main Search Function ────────────────────────────────────
export async function searchNews(): Promise<NewsArticle[]> {
    logger.info('🔍 Starting news search...');

    // Try Bing News first
    let articles = await retry(() => searchBingNews(), {
        retries: 2,
        delayMs: 2000,
        label: 'Bing News Search',
    }).catch(() => [] as NewsArticle[]);

    // Fallback to Google News RSS if Bing returned nothing
    if (articles.length === 0) {
        logger.info('📡 Bing News returned no results, falling back to Google News RSS...');
        articles = await searchGoogleNewsRSS();
    }

    // Deduplicate and limit
    const uniqueArticles = deduplicateArticles(articles).slice(0, 10);

    logger.info(`📰 Found ${uniqueArticles.length} unique articles`, {
        sources: [...new Set(uniqueArticles.map(a => a.source))],
    });

    return uniqueArticles;
}
