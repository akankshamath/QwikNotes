
import axios from "axios";
import * as cheerio from "cheerio";

export async function webSearch(query: string, numResults = 5) {
  try {
    const response = await axios.get(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(response.data);
    const results: Array<{ title: string; snippet: string; url: string }> = [];

    $(".result")
      .slice(0, numResults)
      .each((_, element) => {
        const title = $(element).find(".result__title").text().trim();
        const snippet = $(element).find(".result__snippet").text().trim();
        const url = $(element).find(".result__url").text().trim();

        if (title && snippet) {
          results.push({ title, snippet, url });
        }
      });

    return { query, results, count: results.length };
  } catch (error) {
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getWeather(location: string) {
  try {
    const response = await axios.get(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      { timeout: 10000 }
    );

    const data = response.data;
    const current = data.current_condition[0];

    return {
      location,
      temperature: `${current.temp_C}°C / ${current.temp_F}°F`,
      condition: current.weatherDesc[0].value,
      humidity: `${current.humidity}%`,
      windSpeed: `${current.windspeedKmph} km/h`,
      feelsLike: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`,
    };
  } catch (error) {
    throw new Error(`Weather lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function extractEntities(text: string) {
  const cleanText = text.replace(/<[^>]*>/g, "");

  const entities: Record<string, string[]> = {
    emails: [],
    urls: [],
    dates: [],
    phones: [],
  };

  // Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  entities.emails = [...new Set(cleanText.match(emailRegex) || [])];

  // URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  entities.urls = [...new Set(cleanText.match(urlRegex) || [])];

  // Dates
  const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi;
  entities.dates = [...new Set(cleanText.match(dateRegex) || [])];

  // Phone numbers
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\(\d{3}\)\s*\d{3}[-.]?\d{4}/g;
  entities.phones = [...new Set(cleanText.match(phoneRegex) || [])];

  return { entities };
}

export function analyzeNotes(
  notes: Array<{ id: string; text: string; createdAt: Date | string; updatedAt: Date | string }>,
  analysisType: "summary" | "topics" | "sentiment" | "actionItems" | "statistics"
) {
  switch (analysisType) {
    case "summary":
      return generateNoteSummary(notes);
    case "topics":
      return extractTopics(notes);
    case "sentiment":
      return analyzeSentiment(notes);
    case "actionItems":
      return extractActionItems(notes);
    case "statistics":
      return calculateStatistics(notes);
    default:
      return { error: "Unknown analysis type" };
  }
}

function generateNoteSummary(notes: Array<{ id: string; text: string; createdAt: Date | string; updatedAt: Date | string }>) {
  // Combine all notes text
  const allText = notes.map(note => {
    const cleanText = note.text.replace(/<[^>]*>/g, ""); // Strip HTML
    return cleanText;
  }).join("\n\n");

  // Get word count
  const wordCount = allText.split(/\s+/).filter(word => word.length > 0).length;

  // Get most recent notes
  const recentNotes = notes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(note => ({
      id: note.id,
      preview: note.text.replace(/<[^>]*>/g, "").substring(0, 100) + (note.text.length > 100 ? "..." : ""),
      createdAt: note.createdAt,
    }));

  // Extract key phrases (simple frequency analysis)
  const words = allText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "this", "that", "from", "have", "will", "been", "their", "there", "what", "when", "which", "your", "about", "would", "could", "should"]);

  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const keyPhrases = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return {
    totalNotes: notes.length,
    totalWords: wordCount,
    keyPhrases,
    recentNotes,
    summary: `You have ${notes.length} notes with approximately ${wordCount} words. Key topics include: ${keyPhrases.slice(0, 5).join(", ")}.`,
  };
}

function extractTopics(notes: Array<{ text: string }>) {
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]);

  notes.forEach((note) => {
    const text = note.text.replace(/<[^>]*>/g, "").toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];

    words.forEach((word: string) => {
      if (!stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  const topics = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return { topics, totalUniqueWords: Object.keys(wordFreq).length };
}

function analyzeSentiment(notes: Array<{ id: string; text: string }>) {
  const positiveWords = ["happy", "great", "excellent", "good", "love", "awesome", "wonderful", "fantastic"];
  const negativeWords = ["sad", "bad", "terrible", "hate", "awful", "horrible", "poor", "worst"];

  const sentiments = notes.map((note) => {
    const text = note.text.replace(/<[^>]*>/g, "").toLowerCase();
    let score = 0;

    positiveWords.forEach((word) => {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "g"));
      if (matches) score += matches.length;
    });

    negativeWords.forEach((word) => {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "g"));
      if (matches) score -= matches.length;
    });

    return {
      noteId: note.id,
      sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
      score,
    };
  });

  const avgSentiment = sentiments.reduce((acc, s) => acc + s.score, 0) / sentiments.length;

  return { sentiments, averageSentiment: avgSentiment.toFixed(2) };
}

function extractActionItems(notes: Array<{ id: string; text: string }>) {
  const actionItems: Array<{ noteId: string; item: string }> = [];

  notes.forEach((note) => {
    const text = note.text.replace(/<[^>]*>/g, "");
    const lines = text.split("\n");

    lines.forEach((line: string) => {
      if (
        line.toLowerCase().includes("todo") ||
        line.includes("[ ]") ||
        line.match(/^\s*[-*]\s/) ||
        line.toLowerCase().includes("action:") ||
        line.toLowerCase().includes("task:")
      ) {
        actionItems.push({
          noteId: note.id,
          item: line.trim(),
        });
      }
    });
  });

  return { actionItems, count: actionItems.length };
}

function calculateStatistics(notes: Array<{ id: string; text: string; createdAt: Date | string; updatedAt: Date | string }>) {
  const now = new Date();
  const sortedByDate = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const oldest = sortedByDate[sortedByDate.length - 1];
  const newest = sortedByDate[0];

  const notesThisWeek = notes.filter((note) => {
    const noteDate = new Date(note.createdAt);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return noteDate >= weekAgo;
  }).length;

  const notesThisMonth = notes.filter((note) => {
    const noteDate = new Date(note.createdAt);
    return (
      noteDate.getMonth() === now.getMonth() &&
      noteDate.getFullYear() === now.getFullYear()
    );
  }).length;

  return {
    totalNotes: notes.length,
    oldestNote: oldest?.createdAt,
    newestNote: newest?.createdAt,
    notesThisWeek,
    notesThisMonth,
  };
}
