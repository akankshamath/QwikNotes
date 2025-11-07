"use server";

import { getUser } from "@/auth/server";
import prisma from "@/db/prisma";
import openai from "@/openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { webSearch, getWeather, extractEntities, analyzeNotes as analyzeNotesUtil } from "@/lib/mcp-tools";
import { searchNotion, getNotionPage, createNotionPage, appendToNotionPage, listNotionDatabases } from "@/lib/notion-tools";
import { callMCPToolViaStdio } from "@/lib/mcp-client";

// MCP Tool definitions for OpenAI
const MCP_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the web for current information, facts, or context not available in the user's notes. Use this when the user asks about recent events, news, or information that wouldn't be in their personal notes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up",
          },
          numResults: {
            type: "number",
            description: "Number of search results to return (default: 5)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_notes",
      description:
        "Perform advanced analysis on the user's notes. Use this when asked to find topics, analyze sentiment, extract action items, or generate statistics.",
      parameters: {
        type: "object",
        properties: {
          analysisType: {
            type: "string",
            enum: ["summary", "topics", "sentiment", "actionItems", "statistics"],
            description:
              "Type of analysis: 'summary' for statistics, 'topics' for keyword extraction, 'sentiment' for emotional analysis, 'actionItems' for todos, 'statistics' for metrics",
          },
        },
        required: ["analysisType"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description:
        "Get current weather information for a location. Use when the user mentions weather or asks about current conditions.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or location to get weather for",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "extract_entities",
      description:
        "Extract structured information (emails, URLs, dates, phone numbers) from notes. Use when user asks to find contact info or specific data.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to extract entities from (can be combined notes)",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description:
        "Create a new note for the user. Use this when the user asks to save information, create a note, remember something, write down something, or jot something down.",
      parameters: {
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
            items: {
              type: "string",
            },
            description: "Optional tags for categorizing the note",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_note",
      description:
        "Update or append content to the current note. Use this when the user asks to add information to their note, update it with web search results, or modify the existing content. You can search the web first and then add findings to the note.",
      parameters: {
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
          },
        },
        required: ["noteId", "newContent"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_notion",
      description:
        "Search for pages in Notion workspace. Use this when the user asks to find or search for Notion pages or content.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find Notion pages",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_notion_page",
      description:
        "Retrieve the full content of a specific Notion page by ID. Use this when the user wants to read or view a Notion page.",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "The ID of the Notion page to retrieve",
          },
        },
        required: ["pageId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_notion_page",
      description:
        "Create a new page in a Notion database. Use this when the user asks to create or save something to Notion.",
      parameters: {
        type: "object",
        properties: {
          databaseId: {
            type: "string",
            description: "The ID of the Notion database to create the page in",
          },
          title: {
            type: "string",
            description: "Title of the new Notion page",
          },
          content: {
            type: "string",
            description: "Content to add to the new page",
          },
        },
        required: ["databaseId", "title", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "append_to_notion",
      description:
        "Append content to an existing Notion page. Use this when the user wants to add information to a Notion page.",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "The ID of the Notion page to append to",
          },
          content: {
            type: "string",
            description: "Content to append to the page",
          },
        },
        required: ["pageId", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_notion_databases",
      description:
        "List all Notion databases accessible to the integration. Use this when the user asks what Notion databases are available or where they can save content.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/**
 * Call an MCP tool via stdio communication
 */
async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  notes?: Array<{ id: string; text: string; createdAt: Date; updatedAt: Date }>,
  userId?: string,
  currentNoteId?: string,
  notionAccessToken?: string
) {
  // Special handling for create_note - actually create the note in the database
  if (toolName === "create_note") {
    if (!userId) {
      throw new Error("User ID is required to create a note");
    }

    try {
      const content = args.content ? String(args.content) : "";

      // Validate content
      if (!content.trim()) {
        throw new Error("Cannot create a note with empty content");
      }

      const newNote = await prisma.note.create({
        data: {
          text: content,
          authorId: userId,
        },
      });

      console.log(`✅ Note created:`, newNote.id);
      return {
        success: true,
        message: "Note created successfully",
        noteId: newNote.id,
      };
    } catch (error) {
      console.error("❌ Failed to create note:", error);
      throw new Error(
        `Failed to create note: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Special handling for update_note - actually update the note in the database
  if (toolName === "update_note") {
    if (!userId) {
      throw new Error("User ID is required to update a note");
    }

    try {
      const noteId = String(args.noteId);
      const mode = String(args.mode || "append");
      const newContent = args.newContent ? String(args.newContent) : "";

      // Validate that we have content to add
      if (!newContent) {
        throw new Error("No content provided to update the note");
      }

      // Fetch the current note
      const currentNote = await prisma.note.findFirst({
        where: { id: noteId, authorId: userId },
      });

      if (!currentNote) {
        throw new Error("Note not found or you don't have permission to update it");
      }

      // Prepare the new text based on mode
      let updatedText: string;
      if (mode === "replace") {
        updatedText = newContent;
      } else {
        // Append mode - add new content to existing
        // Only add separator if current note has content
        const separator = currentNote.text ? "\n\n" : "";
        updatedText = currentNote.text + separator + newContent;
      }

      // Update the note
      const updatedNote = await prisma.note.update({
        where: { id: noteId },
        data: { text: updatedText },
      });

      console.log(`✅ Note updated:`, updatedNote.id);
      return {
        success: true,
        message: "Note updated successfully",
        noteId: updatedNote.id,
        mode,
      };
    } catch (error) {
      console.error("❌ Failed to update note:", error);
      throw new Error(
        `Failed to update note: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Call MCP tools via actual MCP protocol or direct implementation
  try {
    console.log(`🔧 Calling tool: ${toolName}`, args);

    // Tools supported by MCP server - use actual MCP protocol
    const mcpServerTools = ["web_search", "get_weather", "extract_entities", "analyze_notes"];

    if (mcpServerTools.includes(toolName)) {
      // Prepare arguments for MCP server
      let mcpArgs = { ...args };

      // Special handling for analyze_notes - needs to pass notes array
      if (toolName === "analyze_notes" && notes) {
        mcpArgs = {
          notes: notes.map((n) => ({
            id: n.id,
            text: n.text,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
          })),
          analysisType: args.analysisType,
        };
      }

      // Special handling for extract_entities - prepare text
      if (toolName === "extract_entities" && !args.text && notes) {
        mcpArgs = {
          text: notes.map((n) => n.text).join("\n\n"),
        };
      }

      console.log(`📡 Using MCP protocol for ${toolName}`);
      return await callMCPToolViaStdio(toolName, mcpArgs);
    }

    // Notion tools and database operations - use direct implementation
    switch (toolName) {
      case "search_notion":
        if (!notionAccessToken) {
          throw new Error("Notion is not connected. Please connect your Notion workspace in settings.");
        }
        return await searchNotion(String(args.query), notionAccessToken);

      case "get_notion_page":
        if (!notionAccessToken) {
          throw new Error("Notion is not connected. Please connect your Notion workspace in settings.");
        }
        return await getNotionPage(String(args.pageId), notionAccessToken);

      case "create_notion_page":
        if (!notionAccessToken) {
          throw new Error("Notion is not connected. Please connect your Notion workspace in settings.");
        }
        return await createNotionPage(
          String(args.databaseId),
          String(args.title),
          String(args.content),
          notionAccessToken
        );

      case "append_to_notion":
        if (!notionAccessToken) {
          throw new Error("Notion is not connected. Please connect your Notion workspace in settings.");
        }
        return await appendToNotionPage(
          String(args.pageId),
          String(args.content),
          notionAccessToken
        );

      case "list_notion_databases":
        if (!notionAccessToken) {
          throw new Error("Notion is not connected. Please connect your Notion workspace in settings.");
        }
        return await listNotionDatabases(notionAccessToken);

      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  } catch (error) {
    console.error("❌ MCP tool call failed:", error);
    throw new Error(
      `MCP tool ${toolName} failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Enhanced askAIAboutNotesAction with MCP tools
 */
export async function askAIAboutNotesAction(
  newQuestions: string[],
  responses: string[],
  currentNoteId?: string
) {
  const user = await getUser();
  if (!user) throw new Error("You must be logged in to ask AI questions");

  // Fetch user data including Notion token (if fields exist)
  let notionAccessToken: string | undefined;
  try {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notionAccessToken: true },
    });
    notionAccessToken = userData?.notionAccessToken || undefined;
  } catch (error) {
    // Notion fields don't exist yet - that's okay, just don't use Notion features
    console.log("Notion fields not in database yet. Run migration to enable Notion features.");
    notionAccessToken = undefined;
  }

  // Fetch user's notes
  const notes = await prisma.note.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, createdAt: true, updatedAt: true },
  });

  if (notes.length === 0) {
    return "You don't have any notes yet.";
  }

  // Format notes for context (keep it concise to save tokens)
  const formattedNotes = notes
    .map(
      (note) =>
        `
      Note ID: ${note.id}
      Text: ${note.text}
      Created: ${note.createdAt.toISOString().split("T")[0]}
      Updated: ${note.updatedAt.toISOString().split("T")[0]}
    `.trim()
    )
    .join("\n\n");

  // Find the current note if provided
  const currentNote = currentNoteId ? notes.find(n => n.id === currentNoteId) : null;

  // Build conversation messages
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content: `
        You are a helpful AI assistant for QwikNotes. You help users understand and work with their personal notes.

        ${currentNote ? `CURRENT NOTE (User is viewing this note):
        Note ID: ${currentNote.id}
        Text: ${currentNote.text}

        ONLY use update_note with noteId="${currentNote.id}" when the user EXPLICITLY asks to:
        - "add this to my note"
        - "update my note with..."
        - "append this to my note"
        - "save this to my note"
        - "write this in my note"
        - "search and add to my note"

        DO NOT use update_note if the user just asks to search or find information.
        ` : ''}

        You have access to powerful tools:
        - web_search: Search the internet for current information
        - analyze_notes: Extract topics, sentiment, action items, or statistics from notes
        - get_weather: Get current weather information
        - extract_entities: Find emails, URLs, dates, and phone numbers
        - create_note: Create a new note for the user
        - update_note: Update or append content to an existing note (especially the current note)
        - search_notion: Search for pages in Notion workspace
        - get_notion_page: Retrieve full content of a Notion page
        - create_notion_page: Create a new page in Notion database
        - append_to_notion: Add content to an existing Notion page
        - list_notion_databases: List available Notion databases

        Use these tools when appropriate:
        - User asks to "summarize my notes" or "what are my notes about" → use analyze_notes with "summary"
        - User asks about topics/themes in notes → use analyze_notes with "topics"
        - User asks for metrics/counts (how many notes, word count) → use analyze_notes with "statistics"
        - User asks about todos or tasks → use analyze_notes with "actionItems"
        - User asks about sentiment/mood → use analyze_notes with "sentiment"
        - User asks about current events/news → use web_search (just search, DO NOT add to note unless explicitly requested)
        - User mentions weather → use get_weather
        - User asks to find emails/contacts → use extract_entities
        - User asks to save/create/remember/write down something NEW → use create_note
        - User asks to add/update/append to CURRENT note → use update_note with the current note ID
        - User asks to "search and add" or "look up and add" → FIRST use web_search, THEN use update_note with the findings
        - User asks to search Notion or find something in Notion → use search_notion
        - User asks to read or view a Notion page → use get_notion_page
        - User asks to save/create something in Notion → use create_notion_page
        - User asks to add to an existing Notion page → use append_to_notion
        - User asks what Notion databases are available → use list_notion_databases

        CRITICAL: When using web_search, DO NOT automatically call update_note or create_note unless the user explicitly asks you to add/save/write the information to their notes. Simply searching for information should NOT modify notes.

        CRITICAL - Response Formatting Rules (ALWAYS FOLLOW):

        1. ALWAYS use proper HTML structure - never plain text
        2. Start responses with a clear <h3> heading
        3. Use <p> tags for every paragraph - NEVER wall of text
        4. Use <ul><li> for any list of items (3+ items)
        5. Use <strong> to highlight important words/phrases
        6. Use <code> for IDs, technical terms, or data values
        7. Keep paragraphs SHORT (2-3 sentences max)
        8. Add space between sections with separate <p> tags

        GOOD Examples:

        For summaries:
        <h3>Notes Summary</h3>
        <p>You have <strong>5 notes</strong> covering these main topics:</p>
        <ul>
          <li><strong>React development:</strong> 3 notes about hooks and components</li>
          <li><strong>Project planning:</strong> 2 notes with meeting notes</li>
        </ul>
        <p>Your most recent note discusses API integration strategies.</p>

        For search results:
        <h3>Search Results</h3>
        <p>I found <strong>3 pages</strong> matching your search:</p>
        <ul>
          <li><strong>Meeting Notes</strong> (ID: <code>abc123</code>) - Created Nov 3</li>
          <li><strong>Project Roadmap</strong> (ID: <code>def456</code>) - Created Nov 1</li>
        </ul>

        BAD Examples (NEVER DO THIS):
        <p>You have 5 notes and they cover React development which has 3 notes about hooks and components and also project planning with 2 notes about meetings and your most recent note discusses API integration which is important for...</p>

        Remember: Break. Things. Up. Short paragraphs = better readability!

        User's notes:
        ${formattedNotes}
      `,
    },
  ];

  // Add conversation history
  for (let i = 0; i < newQuestions.length; i++) {
    messages.push({ role: "user", content: newQuestions[i] });
    if (responses.length > i) {
      messages.push({ role: "assistant", content: responses[i] });
    }
  }

  console.log(`💬 User question: ${newQuestions[newQuestions.length - 1]}`);

  try {
    // Initial completion with tools
    let completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: MCP_TOOLS,
      tool_choice: "auto", // Let the model decide when to use tools
    });

    let assistantMessage = completion.choices[0].message;

    // Handle tool calls (function calling) - max 3 iterations to prevent loops
    let iterations = 0;
    const maxIterations = 3;
    let noteCreated = false;
    let noteUpdated = false;

    while (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0 &&
      iterations < maxIterations
    ) {
      iterations++;
      console.log(`🔄 Tool call iteration ${iterations}`);

      // Add assistant's message with tool calls
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Track if create_note or update_note was called
        if (toolName === "create_note") {
          noteCreated = true;
        }
        if (toolName === "update_note") {
          noteUpdated = true;
        }

        try {
          // Call the MCP tool
          const toolResult = await callMCPTool(toolName, toolArgs, notes, user.id, currentNoteId, notionAccessToken);

          // Add tool result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        } catch (error) {
          // Add error as tool result
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          });

          console.error(`❌ Tool call failed:`, error);
        }
      }

      // Get next completion with tool results
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: MCP_TOOLS,
        tool_choice: "auto",
      });

      assistantMessage = completion.choices[0].message;
    }

    // Return the final response with metadata
    const responseText = assistantMessage.content || "I'm sorry, I couldn't generate a response.";
    return JSON.stringify({ response: responseText, noteCreated, noteUpdated });
  } catch (error) {
    console.error("❌ AI completion failed:", error);
    return JSON.stringify({
      response: `<p class="text-red-500">Error: ${error instanceof Error ? error.message : "An error occurred"}</p>`,
      noteCreated: false,
      noteUpdated: false,
    });
  }
}
