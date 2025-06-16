'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { debounceTimeout } from "@/lib/constants";
import useNote from "@/hooks/useNote";
import { updateNoteAction } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import Placeholder from '@tiptap/extension-placeholder';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


type Props = {
  noteId: string
  startingNoteText: string
}

let updateTimeout: NodeJS.Timeout

export default function NoteTextInput({ noteId, startingNoteText }: Props) {
  const { noteText, setNoteText } = useNote()
  const noteIdParam = useSearchParams().get("noteId") || ""
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const editor = useEditor({
    extensions: [
        StarterKit, 
        Placeholder.configure({
          placeholder: 'Type your notes here...',
        }),
        BulletList,
        ListItem,
      ],
    content: startingNoteText,
    editorProps: {
      attributes: {
        class:
          "custom-scrollbar h-[32rem] resize-none border-none p-4 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
      },

    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setNoteText(html)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateNoteAction(noteId, html)
      }, debounceTimeout)
    },
  })

  useEffect(() => {
    if (noteIdParam === noteId && editor) {
      editor.commands.setContent(startingNoteText)
    }
  }, [startingNoteText, noteIdParam, noteId, editor])

  if (!editor) return null

  return (
    <div className="relative w-full max-w-4xl">
      <div className="border rounded-lg overflow-hidden bg-background">
        <EditorContent editor={editor} />
        

        <div className="flex gap-2 border-t p-2 bg-muted justify-center">
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
          <div className="control-group">
        <div className="button-group">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant={editor.isActive("bulletList") ? "default" : "secondary"}>
              List
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              Toggle Bullet List
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
              disabled={!editor.can().sinkListItem('listItem')}
            >
              Indent List Item
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
              disabled={!editor.can().liftListItem('listItem')}
            >
              Outdent List Item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        </div>
      </div>
        </div>
      </div>
    </div>
  )
}
