"use server";

import { getUser } from "@/auth/server";
import prisma from "@/db/prisma";
import openai from "@/openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
];

/**
 * Call an MCP tool via stdio communication
 */
async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  notes?: Array<{ id: string; text: string; createdAt: Date; updatedAt: Date }>,
  userId?: string,
  currentNoteId?: string
) {
  // Special handling for create_note - actually create the note in the database
  if (toolName === "create_note") {
    if (!userId) {
      throw new Error("User ID is required to create a note");
    }

    try {
      const newNote = await prisma.note.create({
        data: {
          text: String(args.content),
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
        updatedText = String(args.newContent);
      } else {
        // Append mode - add new content to existing
        updatedText = currentNote.text + "\n\n" + String(args.newContent);
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

  // Special handling for analyze_notes - pass the notes
  if (toolName === "analyze_notes" && notes) {
    args.notes = notes;
  }

  // Special handling for extract_entities - if no text provided, use all notes
  if (toolName === "extract_entities" && !args.text && notes) {
    args.text = notes.map((n) => n.text).join("\n\n");
  }

  const mcpRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
    id: Date.now(),
  };

  try {
    const mcpServerPath = process.env.MCP_SERVER_PATH;

    // If no MCP server path is configured (e.g., in production), return a stub response
    if (!mcpServerPath) {
      console.warn(`⚠️ MCP server not available for tool: ${toolName}`);
      return {
        error: "MCP server features are only available in local development",
        message: "This feature requires the MCP server which is not available in this environment",
      };
    }

    console.log(`🔧 Calling MCP tool: ${toolName}`, args);

    const command = `echo '${JSON.stringify(mcpRequest).replace(/'/g, "\\'")}' | node ${mcpServerPath}`;

    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

    if (stderr && !stderr.includes("QwikNotes MCP server")) {
      console.error("❌ MCP stderr:", stderr);
    }

    // Parse the response - MCP returns the result in content array
    const lines = stdout.trim().split("\n");
    const responseLine = lines.find((line) => line.startsWith("{"));

    if (!responseLine) {
      throw new Error("No valid JSON response from MCP server");
    }

    const response = JSON.parse(responseLine);

    if (response.content && response.content[0]) {
      const result = JSON.parse(response.content[0].text);
      console.log(`✅ Tool result:`, result);
      return result;
    }

    return response;
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

        When the user asks to "add", "update", "append", or "search and add" information to their note, use the update_note tool with noteId="${currentNote.id}".
        ` : ''}

        You have access to powerful tools:
        - web_search: Search the internet for current information
        - analyze_notes: Extract topics, sentiment, action items, or statistics from notes
        - get_weather: Get current weather information
        - extract_entities: Find emails, URLs, dates, and phone numbers
        - create_note: Create a new note for the user
        - update_note: Update or append content to an existing note (especially the current note)

        Use these tools when appropriate:
        - User asks about current events/news → use web_search
        - User asks about topics/themes in notes → use analyze_notes with "topics"
        - User asks "what should I know" or wants insights → use analyze_notes with "statistics"
        - User asks about todos or tasks → use analyze_notes with "actionItems"
        - User mentions weather → use get_weather
        - User asks to find emails/contacts → use extract_entities
        - User asks to save/create/remember/write down something NEW → use create_note
        - User asks to add/update/append to CURRENT note → use update_note with the current note ID
        - User asks to "search and add" or "look up and add" → FIRST use web_search, THEN use update_note with the findings

        IMPORTANT - Response Formatting Guidelines:
        1. Always structure responses with proper HTML elements
        2. Use headings (<h3>, <h4>) to organize different sections
        3. Use bullet points (<ul><li>) for lists of items
        4. Use numbered lists (<ol><li>) for sequential steps
        5. Use <strong> for emphasis on key points
        6. Break long text into multiple <p> paragraphs
        7. Never return a single long paragraph - always break it up
        8. Use <code> for technical terms or data values
        9. Use line breaks and spacing for readability

        Example good format:
        <h3>Here's what I found:</h3>
        <p>Based on your notes, I can see several key themes.</p>
        <ul>
          <li><strong>Topic 1:</strong> Description here</li>
          <li><strong>Topic 2:</strong> Description here</li>
        </ul>
        <p>This suggests that you focus mainly on...</p>

        Example bad format (avoid):
        <p>Based on your notes I can see several key themes including topic 1 which appears frequently and topic 2 which also shows up often and this suggests that you focus mainly on these areas and you might want to consider...</p>

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
          const toolResult = await callMCPTool(toolName, toolArgs, notes, user.id, currentNoteId);

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
