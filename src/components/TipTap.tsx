'use client';

import {
  EditorContent,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "./ui/button";
import { useRef, useEffect } from "react";

type Props = {
  noteContent: string;
  onUpdate: (updatedHTML: string) => void;
  className?: string;
};

export default function TipTap({ noteContent, onUpdate, className }: Props) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: noteContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdate(html), 500);
    }
  });

  useEffect(() => {
    if (editor && noteContent !== editor.getHTML()) {
      editor.commands.setContent(noteContent);
    }
  }, [noteContent, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
      <div className="flex gap-2 border-b p-2 bg-muted justify-center">
        <Button
          variant={
            !editor.isActive("bold") &&
            !editor.isActive("italic") &&
            !editor.isActive("bulletList")
              ? "default"
              : "secondary"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          Regular
        </Button>
        <Button
          variant={editor.isActive("bold") ? "default" : "secondary"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        <Button
          variant={editor.isActive("italic") ? "default" : "secondary"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>
        <Button
          variant={editor.isActive("bulletList") ? "default" : "secondary"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </Button>
      </div>

      {/* Typable Editor Area */}
      <EditorContent
        editor={editor}
        className={
          className ||
          'custom-scrollbar h-[32rem] resize-none p-4 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0'
        }
      />
    </div>
  );
}
