import axios from "axios";
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function getSummarizedNews(topics: string[] = ["AI"]) {
  try {
    const query = topics.join(" OR ");
    const newsRes = await axios.get(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=5`,
      { headers: { Authorization: NEWS_API_KEY } }
    );

    const articles = newsRes.data.articles;

    const summaries = await Promise.all(
      articles.map(async (article: any) => {
        const prompt = `Summarize this article in 2 sentences:\nTitle: ${article.title}\nDescription: ${article.description}`;
        const gptRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        return {
          title: article.title,
          url: article.url,
          summary: gptRes.data.choices[0].message.content,
        };
      })
    );

    return summaries;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}
