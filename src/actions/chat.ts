"use server";

import { getUser } from "@/auth/server";
import prisma from "@/db/prisma";
import { handleError } from "@/lib/utils";

/**
 * Save a chat message (question and response) for a specific note
 */
export const saveChatMessageAction = async (
  noteId: string,
  question: string,
  response: string
) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to save chat messages");

    // Verify the note belongs to the user
    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: user.id },
    });

    if (!note) {
      throw new Error("Note not found or you don't have permission to access it");
    }

    // Save the chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        noteId,
        question,
        response,
      },
    });

    return { errorMessage: null, chatMessage };
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Load all chat messages for a specific note
 */
export const loadChatHistoryAction = async (noteId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to load chat history");

    // Verify the note belongs to the user
    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: user.id },
    });

    if (!note) {
      throw new Error("Note not found or you don't have permission to access it");
    }

    // Load chat messages for this note
    const chatMessages = await prisma.chatMessage.findMany({
      where: { noteId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        question: true,
        response: true,
        createdAt: true,
      },
    });

    return { errorMessage: null, chatMessages };
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Clear all chat history for a specific note
 */
export const clearChatHistoryAction = async (noteId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to clear chat history");

    // Verify the note belongs to the user
    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: user.id },
    });

    if (!note) {
      throw new Error("Note not found or you don't have permission to access it");
    }

    // Delete all chat messages for this note
    await prisma.chatMessage.deleteMany({
      where: { noteId },
    });

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};
