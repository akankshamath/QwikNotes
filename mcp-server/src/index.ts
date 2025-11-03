#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as cheerio from "cheerio";
import { z } from "zod";

// Tool schemas
const WebSearchSchema = z.object({
  query: z.string().describe("Search query"),
  numResults: z.number().optional().default(5).describe("Number of results to return"),
});

const AnalyzeNotesSchema = z.object({
  notes: z.array(z.object({
    id: z.string(),
    text: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).describe("Array of note objects to analyze"),
  analysisType: z.enum([
    "summary",
    "topics",
    "sentiment",
    "actionItems",
    "statistics"
  ]).describe("Type of analysis to perform"),
});

const WeatherSchema = z.object({
  location: z.string().describe("City name or coordinates"),
});

const SummarizeTextSchema = z.object({
  text: z.string().describe("Text to summarize"),
  maxLength: z.number().optional().default(100).describe("Maximum summary length in words"),
});

const ExtractEntitiesSchema = z.object({
  text: z.string().describe("Text to extract entities from"),
  entityTypes: z.array(z.string()).optional().describe("Types of entities to extract (person, organization, location, date, etc.)"),
});

const CreateNoteSchema = z.object({
  title: z.string().optional().describe("Optional title for the note"),
  content: z.string().describe("The content/text of the note to create"),
  tags: z.array(z.string()).optional().describe("Optional tags for categorizing the note"),
});

const UpdateNoteSchema = z.object({
  noteId: z.string().describe("The ID of the note to update"),
  newContent: z.string().describe("New content to append or replace in the note"),
  mode: z.enum(["append", "replace"]).default("append").describe("Whether to append to existing content or replace it"),
});

// Server implementation
class QwikNotesServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "qwiknotes-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "web_search",
            description: "Search the web for information. Useful for finding recent information, facts, or context not in the notes.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                numResults: {
                  type: "number",
                  description: "Number of results to return (default: 5)",
                  default: 5,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "analyze_notes",
            description: "Perform advanced analysis on notes: generate summaries, extract topics, analyze sentiment, find action items, or calculate statistics.",
            inputSchema: {
              type: "object",
              properties: {
                notes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      text: { type: "string" },
                      createdAt: { type: "string" },
                      updatedAt: { type: "string" },
                    },
                  },
                  description: "Array of note objects to analyze",
                },
                analysisType: {
                  type: "string",
                  enum: ["summary", "topics", "sentiment", "actionItems", "statistics"],
                  description: "Type of analysis to perform",
                },
              },
              required: ["notes", "analysisType"],
            },
          },
          {
            name: "get_weather",
            description: "Get current weather information for a location. Useful when users mention weather or outdoor activities.",
            inputSchema: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "City name or coordinates",
                },
              },
              required: ["location"],
            },
          },
          {
            name: "summarize_text",
            description: "Generate a concise summary of a long text. Useful for condensing lengthy notes.",
            inputSchema: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "Text to summarize",
                },
                maxLength: {
                  type: "number",
                  description: "Maximum summary length in words (default: 100)",
                  default: 100,
                },
              },
              required: ["text"],
            },
          },
          {
            name: "extract_entities",
            description: "Extract named entities (people, organizations, locations, dates) from text. Useful for finding important information in notes.",
            inputSchema: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "Text to extract entities from",
                },
                entityTypes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Types of entities to extract (optional)",
                },
              },
              required: ["text"],
            },
          },
          {
            name: "create_note",
            description: "Create a new note for the user. Use this when the user asks to save information, create a note, remember something, or jot something down.",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Optional title for the note",
                },
                content: {
                  type: "string",
                  description: "The content/text of the note to create",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional tags for categorizing the note",
                },
              },
              required: ["content"],
            },
          },
          {
            name: "update_note",
            description: "Update or append content to an existing note. Use this when the user asks to add information to their current note, update it with web search results, or modify the content.",
            inputSchema: {
              type: "object",
              properties: {
                noteId: {
                  type: "string",
                  description: "The ID of the note to update",
                },
                newContent: {
                  type: "string",
                  description: "New content to append or replace in the note",
                },
                mode: {
                  type: "string",
                  enum: ["append", "replace"],
                  description: "Whether to append to existing content or replace it (default: append)",
                  default: "append",
                },
              },
              required: ["noteId", "newContent"],
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "web_search":
            return await this.handleWebSearch(request.params.arguments);

          case "analyze_notes":
            return await this.handleAnalyzeNotes(request.params.arguments);

          case "get_weather":
            return await this.handleGetWeather(request.params.arguments);

          case "summarize_text":
            return await this.handleSummarizeText(request.params.arguments);

          case "extract_entities":
            return await this.handleExtractEntities(request.params.arguments);

          case "create_note":
            return await this.handleCreateNote(request.params.arguments);

          case "update_note":
            return await this.handleUpdateNote(request.params.arguments);

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async handleWebSearch(args: unknown) {
    const { query, numResults } = WebSearchSchema.parse(args);

    // Simple DuckDuckGo HTML scraping (you can use a proper API like Brave Search, Serper, etc.)
    try {
      const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const results: Array<{ title: string; snippet: string; url: string }> = [];

      $(".result").slice(0, numResults).each((_, element) => {
        const title = $(element).find(".result__title").text().trim();
        const snippet = $(element).find(".result__snippet").text().trim();
        const url = $(element).find(".result__url").text().trim();

        if (title && snippet) {
          results.push({ title, snippet, url });
        }
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ query, results, count: results.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleAnalyzeNotes(args: unknown) {
    const { notes, analysisType } = AnalyzeNotesSchema.parse(args);

    let result: any;

    switch (analysisType) {
      case "summary":
        result = this.generateSummary(notes);
        break;

      case "topics":
        result = this.extractTopics(notes);
        break;

      case "sentiment":
        result = this.analyzeSentiment(notes);
        break;

      case "actionItems":
        result = this.extractActionItems(notes);
        break;

      case "statistics":
        result = this.calculateStatistics(notes);
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private generateSummary(notes: any[]) {
    const totalNotes = notes.length;
    const totalWords = notes.reduce((acc, note) => {
      const text = note.text.replace(/<[^>]*>/g, ""); // Strip HTML
      return acc + text.split(/\s+/).length;
    }, 0);
    const avgWords = Math.round(totalWords / totalNotes);

    return {
      summary: `You have ${totalNotes} notes with a total of ${totalWords} words (avg: ${avgWords} words per note).`,
      totalNotes,
      totalWords,
      avgWords,
    };
  }

  private extractTopics(notes: any[]) {
    // Simple keyword extraction using word frequency
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

  private analyzeSentiment(notes: any[]) {
    // Simple sentiment analysis using keyword matching
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

  private extractActionItems(notes: any[]) {
    // Extract lines that look like action items (contain "TODO", checkboxes, etc.)
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

  private calculateStatistics(notes: any[]) {
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

  private async handleGetWeather(args: unknown) {
    const { location } = WeatherSchema.parse(args);

    // Using wttr.in free weather API
    try {
      const response = await axios.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
        timeout: 10000,
      });

      const data = response.data;
      const current = data.current_condition[0];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              location,
              temperature: `${current.temp_C}°C / ${current.temp_F}°F`,
              condition: current.weatherDesc[0].value,
              humidity: `${current.humidity}%`,
              windSpeed: `${current.windspeedKmph} km/h`,
              feelsLike: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Weather lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleSummarizeText(args: unknown) {
    const { text, maxLength } = SummarizeTextSchema.parse(args);

    // Simple extractive summarization (take first N sentences)
    const cleanText = text.replace(/<[^>]*>/g, "");
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

    let summary = "";
    let wordCount = 0;

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).length;
      if (wordCount + words > maxLength) break;
      summary += sentence;
      wordCount += words;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary: summary.trim() || sentences[0],
            originalLength: cleanText.split(/\s+/).length,
            summaryLength: wordCount,
          }, null, 2),
        },
      ],
    };
  }

  private async handleExtractEntities(args: unknown) {
    const { text, entityTypes } = ExtractEntitiesSchema.parse(args);

    // Simple regex-based entity extraction
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

    // Dates (simple patterns)
    const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi;
    entities.dates = [...new Set(cleanText.match(dateRegex) || [])];

    // Phone numbers
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\(\d{3}\)\s*\d{3}[-.]?\d{4}/g;
    entities.phones = [...new Set(cleanText.match(phoneRegex) || [])];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ entities }, null, 2),
        },
      ],
    };
  }

  private async handleCreateNote(args: unknown) {
    const { title, content, tags } = CreateNoteSchema.parse(args);

    // Return the note data to be created
    // The actual database creation will happen in the notes-mcp.ts file
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            note: {
              title: title || null,
              content,
              tags: tags || [],
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleUpdateNote(args: unknown) {
    const { noteId, newContent, mode } = UpdateNoteSchema.parse(args);

    // Return the update data
    // The actual database update will happen in the notes-mcp.ts file
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            update: {
              noteId,
              newContent,
              mode,
            },
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("QwikNotes MCP server running on stdio");
  }
}

// Start server
const server = new QwikNotesServer();
server.run().catch(console.error);
