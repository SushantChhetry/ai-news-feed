import axios from "axios";

// ✅ Handle Expo env vars properly
const NEWS_API_KEY = process.env.NEWS_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

interface Article {
  title: string;
  url: string;
  description?: string;
  content?: string;
  source?: { name: string };
  publishedAt?: string;
}

interface SummaryResult {
  title: string;
  url: string;
  summary: string;
  source: string;
  publishedAt?: string;
}

export async function getSummarizedNews(topics: string[] = ["AI"]): Promise<SummaryResult[]> {
  if (!NEWS_API_KEY || !OPENAI_API_KEY) {
    console.error("❌ Missing API keys for News API or OpenAI.");
    return [];
  }

  try {
    const query = topics.join(" OR ");

    // 1️⃣ Fetch latest news
    const { data } = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: query,
        language: "en",
        sortBy: "publishedAt",
        pageSize: 5,
      },
      headers: { "X-Api-Key": NEWS_API_KEY },
      timeout: 10000,
    });

    if (!data.articles || data.articles.length === 0) {
      console.warn("⚠️ No articles found for query:", query);
      return [];
    }

    // Deduplicate articles by title
    const uniqueArticles: Article[] = Array.from(
      new Map((data.articles as Article[]).map((a) => [a.title, a])).values()
    );

    // 2️⃣ Summarize each article
    const summaries = await Promise.allSettled(
      uniqueArticles.map(async (article: Article) => {
        const content = article.description || article.content || "";
        if (!content.trim()) return null;

        const prompt = `Summarize the following news article in 2 concise sentences:\n\nTitle: ${article.title}\n\nContent: ${content}`;

        try {
          const gptRes = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 80,
              temperature: 0.7,
            },
            {
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              timeout: 12000,
            }
          );

          return {
            title: article.title,
            url: article.url,
            summary:
              gptRes.data?.choices?.[0]?.message?.content?.trim() ||
              content.slice(0, 150) + "...",
            source: article.source?.name || "Unknown",
            publishedAt: article.publishedAt,
          };
        } catch (gptErr: any) {
          console.error("⚠️ OpenAI summarization failed:", gptErr?.message || gptErr);
          return {
            title: article.title,
            url: article.url,
            summary: content.slice(0, 150) + "...",
            source: article.source?.name || "Unknown",
            publishedAt: article.publishedAt,
          };
        }
      })
    );

    // 3️⃣ Filter only successful summaries
    return summaries
      .filter((res) => res.status === "fulfilled" && res.value)
      .map((res: any) => res.value);
  } catch (error: any) {
    console.error("❌ Error fetching news:", error.response?.data || error.message);
    return [];
  }
}

// Default export for backward compatibility
export default getSummarizedNews;
