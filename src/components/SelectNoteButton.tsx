"use client";

import useNote from "@/hooks/useNote";
import { Note } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarMenuButton } from "./ui/sidebar";
import Link from "next/link";

type Props = {
  note: Note;
};

function SelectNoteButton({ note }: Props) {
  const noteId = useSearchParams().get("noteId") || "";

  const { noteText: selectedNoteText } = useNote();
  const [shouldUseGlobalNoteText, setShouldUseGlobalNoteText] = useState(false);
  const [localNoteText, setLocalNoteText] = useState(note.text);
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    if (noteId === note.id) {
      setShouldUseGlobalNoteText(true);
    } else {
      setShouldUseGlobalNoteText(false);
    }
  }, [noteId, note.id]);

  useEffect(() => {
    if (shouldUseGlobalNoteText) {
      setLocalNoteText(selectedNoteText);
    }
  }, [selectedNoteText, shouldUseGlobalNoteText]);

  useEffect(() => {
    setFormattedDate(note.updatedAt.toLocaleDateString());
  }, [note.updatedAt]);

  const cleanedSelected = selectedNoteText?.replace(/<p><\/p>/g, "").trim();

  let noteText = note.text || "";
  if (shouldUseGlobalNoteText && cleanedSelected) {
    noteText = selectedNoteText;
  }

  const isNoteEmpty = !noteText || noteText.trim() === "" || noteText.trim() === "<p></p>";

  return (
    <SidebarMenuButton
      asChild
      className={`items-start gap-0 pr-12 ${note.id === noteId && "bg-sidebar-accent/50"}`}
    >
    <Link href={`/?noteId=${note.id}`} className="flex h-fit flex-col">
      {noteText && noteText.trim() !== '' && noteText.trim() !== '<p></p>' ? (
        <div
          className="w-full overflow-hidden truncate text-ellipsis whitespace-nowrap text-left"
          dangerouslySetInnerHTML={{ __html: noteText }}
        />
      ) : (
        <p className=" text-muted-foreground text-sm">
          EMPTY NOTE
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        {formattedDate}
      </p>
    </Link>


    </SidebarMenuButton>
  );
}

export default SelectNoteButton;