import axios, { AxiosInstance, AxiosResponse } from "axios";

// Configuration interface
interface NewsConfig {
  apiKey: string;
  openaiKey: string;
  maxArticles: number;
  timeout: number;
  retryAttempts: number;
  cacheDuration: number;
}

// Enhanced article interface
interface Article {
  title: string;
  url: string;
  description?: string;
  content?: string;
  source?: { name: string; id?: string };
  publishedAt?: string;
  urlToImage?: string;
  author?: string;
}

// Enhanced summary result interface
interface SummaryResult {
  title: string;
  url: string;
  summary: string;
  source: string;
  publishedAt?: string;
  urlToImage?: string;
  author?: string;
  readingTime?: number;
  category?: string;
}

// Cache interface
interface CacheEntry {
  data: SummaryResult[];
  timestamp: number;
  topics: string[];
}

// Error types
class NewsAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "NewsAPIError";
  }
}

class OpenAIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "OpenAIError";
  }
}

// Configuration
const DEFAULT_CONFIG: NewsConfig = {
  apiKey: process.env.NEWS_API_KEY ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  maxArticles: 10,
  timeout: 15000,
  retryAttempts: 3,
  cacheDuration: 5 * 60 * 1000, // 5 minutes
};

// In-memory cache (in production, consider Redis or similar)
const cache = new Map<string, CacheEntry>();

// Rate limiting
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

// Enhanced news fetcher class
export class NewsFetcher {
  private config: NewsConfig;
  private newsApi: AxiosInstance;
  private openaiApi: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor(config: Partial<NewsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (!this.config.apiKey || !this.config.openaiKey) {
      throw new Error("Missing required API keys for News API or OpenAI");
    }

    this.newsApi = axios.create({
      baseURL: "https://newsapi.org/v2",
      timeout: this.config.timeout,
      headers: { "X-Api-Key": this.config.apiKey },
    });

    this.openaiApi = axios.create({
      baseURL: "https://api.openai.com/v1",
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.openaiKey}`,
        "Content-Type": "application/json",
      },
    });

    this.rateLimiter = new RateLimiter();
  }

  private generateCacheKey(topics: string[]): string {
    return topics.sort().join("|");
  }

  private getCachedResult(topics: string[]): SummaryResult[] | null {
    const cacheKey = this.generateCacheKey(topics);
    const entry = cache.get(cacheKey);
    
    if (entry && Date.now() - entry.timestamp < this.config.cacheDuration) {
      console.log("📦 Using cached results for topics:", topics);
      return entry.data;
    }
    
    return null;
  }

  private setCachedResult(topics: string[], data: SummaryResult[]): void {
    const cacheKey = this.generateCacheKey(topics);
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      topics,
    });
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (i === attempts - 1) throw error;
        
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`⚠️ Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retry attempts reached");
  }

  private async fetchArticles(topics: string[]): Promise<Article[]> {
    await this.rateLimiter.waitForSlot();
    
    const query = topics.join(" OR ");
    console.log(`🔍 Fetching articles for query: ${query}`);

    try {
      const response: AxiosResponse = await this.retryWithBackoff(() =>
        this.newsApi.get("/everything", {
          params: {
            q: query,
            language: "en",
            sortBy: "publishedAt",
            pageSize: this.config.maxArticles * 2, // Fetch more to account for filtering
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
          },
        })
      );

      if (!response.data.articles || response.data.articles.length === 0) {
        console.warn("⚠️ No articles found for query:", query);
        return [];
      }

      // Deduplicate and filter articles
      const uniqueArticles = this.deduplicateArticles(response.data.articles);
      return this.filterQualityArticles(uniqueArticles);
    } catch (error: any) {
      console.error("❌ Error fetching articles:", error.response?.data || error.message);
      throw new NewsAPIError(
        `Failed to fetch articles: ${error.response?.data?.message || error.message}`,
        error.response?.status
      );
    }
  }

  private deduplicateArticles(articles: Article[]): Article[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const normalizedTitle = article.title.toLowerCase().trim();
      if (seen.has(normalizedTitle)) return false;
      seen.add(normalizedTitle);
      return true;
    });
  }

  private filterQualityArticles(articles: Article[]): Article[] {
    return articles
      .filter(article => {
        // Filter out articles with very short titles or missing content
        const hasValidTitle = article.title && article.title.length > 10;
        const hasContent = article.description || article.content;
        const hasValidUrl = article.url && article.url.startsWith("http");
        
        return hasValidTitle && hasContent && hasValidUrl;
      })
      .slice(0, this.config.maxArticles);
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  private async summarizeArticle(article: Article): Promise<SummaryResult | null> {
    const content = article.description || article.content || "";
    if (!content.trim()) return null;

    const prompt = `Summarize the following news article in 2-3 concise, engaging sentences. Focus on the key facts and implications:

Title: ${article.title}

Content: ${content}

Provide a clear, informative summary that captures the main points.`;

    try {
      const response = await this.retryWithBackoff(() =>
        this.openaiApi.post("/chat/completions", {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          temperature: 0.3,
        })
      );

      const summary = response.data?.choices?.[0]?.message?.content?.trim();
      
      if (!summary) {
        throw new Error("No summary generated");
      }

      return {
        title: article.title,
        url: article.url,
        summary,
        source: article.source?.name || "Unknown",
        publishedAt: article.publishedAt,
        urlToImage: article.urlToImage,
        author: article.author,
        readingTime: this.calculateReadingTime(article.title + " " + content),
        category: this.categorizeArticle(article.title, content),
      };
    } catch (error: any) {
      console.error("⚠️ OpenAI summarization failed:", error.message);
      // Fallback to truncated content
      return {
        title: article.title,
        url: article.url,
        summary: content.slice(0, 200) + "...",
        source: article.source?.name || "Unknown",
        publishedAt: article.publishedAt,
        urlToImage: article.urlToImage,
        author: article.author,
        readingTime: this.calculateReadingTime(article.title + " " + content),
        category: this.categorizeArticle(article.title, content),
      };
    }
  }

  private categorizeArticle(title: string, content: string): string {
    const text = (title + " " + content).toLowerCase();
    
    const categories = {
      "AI & Technology": ["artificial intelligence", "ai", "machine learning", "ml", "technology", "tech"],
      "Science": ["science", "research", "study", "discovery"],
      "Health": ["health", "medical", "medicine", "covid", "vaccine"],
      "Business": ["business", "startup", "company", "finance", "investment"],
      "Environment": ["climate", "environment", "sustainability", "green"],
      "Space": ["space", "nasa", "satellite", "planet", "mars"],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return "General";
  }

  public async getSummarizedNews(topics: string[] = ["AI"]): Promise<SummaryResult[]> {
    console.log("🚀 Starting news fetch for topics:", topics);
    
    // Check cache first
    const cached = this.getCachedResult(topics);
    if (cached) return cached;

    try {
      // Fetch articles
      const articles = await this.fetchArticles(topics);
      
      if (articles.length === 0) {
        console.warn("⚠️ No articles found after filtering");
        return [];
      }

      console.log(`📰 Processing ${articles.length} articles...`);

      // Summarize articles with concurrency control
      const summaries = await Promise.allSettled(
        articles.map(async (article, index) => {
          // Add small delay between requests to avoid rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          return this.summarizeArticle(article);
        })
      );

      // Filter successful summaries
      const results = summaries
        .filter((result): result is PromiseFulfilledResult<SummaryResult | null> => 
          result.status === "fulfilled" && result.value !== null
        )
        .map(result => result.value!);

      console.log(`✅ Successfully processed ${results.length} articles`);

      // Cache the results
      this.setCachedResult(topics, results);

      return results;
    } catch (error: any) {
      console.error("❌ Error in getSummarizedNews:", error.message);
      throw error;
    }
  }

  public clearCache(): void {
    cache.clear();
    console.log("🗑️ Cache cleared");
  }

  public getCacheStats(): { size: number; entries: { topics: string[]; age: number }[] } {
    const now = Date.now();
    const entries = Array.from(cache.entries()).map(([key, entry]) => ({
      topics: entry.topics,
      age: now - entry.timestamp,
    }));

    return {
      size: cache.size,
      entries,
    };
  }
}

// Backward compatibility function
export async function getSummarizedNews(topics: string[] = ["AI"]): Promise<SummaryResult[]> {
  const fetcher = new NewsFetcher();
  return fetcher.getSummarizedNews(topics);
}

// Default export for backward compatibility
export default getSummarizedNews;

// Export the class and error types for advanced usage
export { NewsAPIError, OpenAIError };
