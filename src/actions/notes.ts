"use server"

import { getUser } from "@/auth/server";
import  prisma  from "@/db/prisma";
import { handleError } from "@/lib/utils";
import openai from "@/openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { revalidatePath } from "next/cache";


export const createNoteAction = async (noteId: string) => {
  try {
    const user = await getUser();
    console.log("🟢 createNoteAction CALLED with ID:", noteId);

    if (!user) throw new Error("You must be logged in to create a note");

    await prisma.note.create({
      data: {
        id: noteId,
        authorId: user.id,
        text: "",
      },
    });

    revalidatePath("/");

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const updateNoteAction = async (noteId: string, text: string, shouldRevalidate = false) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to update a note");

    await prisma.note.update({
      where: { id: noteId },
      data: { text },
    });

    // Only revalidate when explicitly requested (e.g., after significant changes)
    if (shouldRevalidate) {
      revalidatePath("/");
    }

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const deleteNoteAction = async (noteId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to delete a note");

    await prisma.note.delete({
      where: { id: noteId, authorId: user.id },
    });

    revalidatePath("/");

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const askAIAboutNotesAction = async (
  newQuestions: string[],
  responses: string[],
) => {
  const user = await getUser();
  if (!user) throw new Error("You must be logged in to ask AI questions");

  const notes = await prisma.note.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { text: true, createdAt: true, updatedAt: true },
  });

  if (notes.length === 0) {
    return "You don't have any notes yet.";
  }

  const formattedNotes = notes
    .map((note) =>
      `
      Text: ${note.text}
      Created at: ${note.createdAt}
      Last updated: ${note.updatedAt}
      `.trim(),
    )
    .join("\n");

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content: `
          You are a helpful assistant that answers questions about a user's notes.
          Assume all questions are related to the user's notes.
          Make sure that your answers are not too verbose and you speak succinctly.

          Your responses MUST be formatted in clean, valid HTML with proper structure.

          IMPORTANT - Formatting Guidelines:
          1. Use headings (<h3>, <h4>) to organize sections
          2. Use bullet points (<ul><li>) for lists of items
          3. Use numbered lists (<ol><li>) for steps or rankings
          4. Use <strong> for emphasis on key points
          5. Break content into multiple <p> paragraphs - never one long paragraph
          6. Use <code> for technical terms or specific data
          7. Avoid inline styles, JavaScript, or custom attributes

          Example good format:
          <h3>Analysis Results</h3>
          <p>I found several interesting patterns in your notes.</p>
          <ul>
            <li><strong>Pattern 1:</strong> Description</li>
            <li><strong>Pattern 2:</strong> Description</li>
          </ul>
          <p>This suggests...</p>

          Example bad format (avoid):
          <p>I found several interesting patterns in your notes including pattern 1 which shows this and pattern 2 which shows that and this suggests you should...</p>

          Here are the user's notes:
          ${formattedNotes}
          `,
    },
  ];

  for (let i = 0; i < newQuestions.length; i++) {
    messages.push({ role: "user", content: newQuestions[i] });
    if (responses.length > i) {
      messages.push({ role: "assistant", content: responses[i] });
    }
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  return completion.choices[0].message.content || "A problem has occurred";
};