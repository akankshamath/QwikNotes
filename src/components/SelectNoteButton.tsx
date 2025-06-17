"use client";

import useNote from "@/hooks/useNote";
import { Note } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { SidebarMenuButton } from "./ui/sidebar";
import Link from "next/link";

type Props = {
  note: Note;
};

function SelectNoteButton({ note }: Props) {
  const searchParams = useSearchParams();
  const selectedNoteId = searchParams.get("noteId") || "";

  const { noteText: selectedNoteText } = useNote();
  const isSelected = note.id === selectedNoteId;

  const displayedTextRaw = isSelected
    ? (selectedNoteText?.trim() || note.text?.trim())
    : note.text?.trim();

  const isEmpty =
    !displayedTextRaw || displayedTextRaw === "" || displayedTextRaw === "<p></p>";

    const formattedDate = new Date(note.updatedAt).toLocaleDateString("en-GB");

  return (
    <SidebarMenuButton
      asChild
      className={`items-start gap-0 pr-12 ${isSelected && "bg-sidebar-accent/50"}`}
    >
      <Link href={`/?noteId=${note.id}`} className="flex h-fit flex-col">
        {!isEmpty ? (
          <div
            className="w-full overflow-hidden truncate text-ellipsis whitespace-nowrap text-left"
            dangerouslySetInnerHTML={{ __html: displayedTextRaw }}
          />
        ) : (
          <p className="italic text-muted-foreground text-sm">EMPTY NOTE</p>
        )}
        <p className="text-muted-foreground text-xs">{formattedDate}</p>
      </Link>
    </SidebarMenuButton>
  );
}

export default SelectNoteButton;
