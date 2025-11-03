"use client";

import useNote from "@/hooks/useNote";
import { Note } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { SidebarMenuButton } from "./ui/sidebar";
import Link from "next/link";
import { useEffect } from "react";

type Props = {
  note: Note;
};

// Helper function to strip HTML tags and get plain text
function stripHtml(html: string): string {
  // Use regex to remove HTML tags - works on both server and client
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .trim();
}

// Helper function to truncate text to a specific length
function truncateText(text: string, maxLength: number = 60): string {
  const plainText = stripHtml(text);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + "...";
}

function SelectNoteButton({ note }: Props) {
  const searchParams = useSearchParams();
  const selectedNoteId = searchParams.get("noteId") || "";

  const { noteText: selectedNoteText, setNoteText } = useNote();
  const isSelected = note.id === selectedNoteId;

  // Reset context when switching to a different note
  useEffect(() => {
    if (isSelected) {
      setNoteText(note.text || "");
    }
  }, [isSelected, note.text, setNoteText]);

  const displayedTextRaw = isSelected
    ? (selectedNoteText?.trim() || note.text?.trim())
    : note.text?.trim();

  const isEmpty =
    !displayedTextRaw || displayedTextRaw === "" || displayedTextRaw === "<p></p>";

  const formattedDate = new Date(note.updatedAt).toLocaleDateString("en-GB");

  // Get preview text (truncated plain text without HTML)
  const previewText = isEmpty ? "" : truncateText(displayedTextRaw);

  return (
    <SidebarMenuButton
      asChild
      className={`items-start gap-0 pr-12 ${isSelected && "bg-sidebar-accent/50"}`}
    >
      <Link href={`/?noteId=${note.id}`} className="flex h-fit flex-col">
        {!isEmpty ? (
          <p className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm">
            {previewText}
          </p>
        ) : (
          <p className="italic text-muted-foreground text-sm">EMPTY NOTE</p>
        )}
        <p className="text-muted-foreground text-xs">{formattedDate}</p>
      </Link>
    </SidebarMenuButton>
  );
}

export default SelectNoteButton;
