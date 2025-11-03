"use client";
import {User} from "@supabase/supabase-js";
import { Note } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
  import { Fragment, useRef, useState, useTransition} from "react";
  import {useRouter} from "next/navigation";
  import { Textarea } from "./ui/textarea";
  import { askAIAboutNotesAction } from "@/actions/notes-mcp";
  import "@/styles/ai-response.css";
  import { Button } from "@/components/ui/button";
  import { ArrowUpIcon } from "lucide-react";



type Props = {
    user: User | null;
    currentNote: Note | null;
}

function AskAIButton({user, currentNote}: Props) {

    const router = useRouter();
    const [isPending, startTransition] = useTransition();


    const [open, setOpen] = useState(false);
    const [questionText, setQuestionText] = useState("");
    const [questions, setQuestions] = useState<string[]>([]);
    const [responses, setResponses] = useState<string[]>([]);

    const handleOnOpenChange = (isOpen: boolean) => {
        if (!user) {
            router.push("/login");
        } else {
            if (isOpen){
                setQuestionText("");
                setQuestions([]);
                setResponses([]);
            }
            setOpen(isOpen);
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleInput = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
    
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }; 

    const handleClickInput = () => {
        textareaRef.current?.focus();
      };

      const handleSubmit = () => {
        if (!questionText.trim()) return;

        const newQuestions = [...questions, questionText];
        setQuestions(newQuestions);
        setQuestionText("");
        setTimeout(scrollToBottom, 100);

        startTransition(async () => {
          const result = await askAIAboutNotesAction(newQuestions, responses, currentNote?.id);

          // Parse the response to check if a note was created or updated
          try {
            const parsed = JSON.parse(result);
            setResponses((prev) => [...prev, parsed.response]);

            // If a note was created, refresh the page to update the sidebar
            if (parsed.noteCreated) {
              router.refresh();
            }

            // If a note was updated, refresh the page to update both sidebar and note content
            if (parsed.noteUpdated) {
              router.refresh();
            }
          } catch (error) {
            // If parsing fails, treat it as a plain text response (backward compatibility)
            setResponses((prev) => [...prev, result]);
          }

          setTimeout(scrollToBottom, 100);
        });
    };

    const scrollToBottom = () => {
        contentRef.current?.scrollTo({
          top: contentRef.current.scrollHeight,
          behavior: "smooth",
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
    };

    return (
    <Dialog open = {open} onOpenChange = {handleOnOpenChange}>
    <DialogTrigger asChild>
        <Button variant = "secondary">
            Ask AI
        </Button>
    </DialogTrigger>
    <DialogContent className = "custom-scrollbar flex h-[85vh] max-w-4xl flex-col overflow-y-auto" ref= {contentRef}>
        <DialogHeader>
        <DialogTitle>Ask AI about your notes!</DialogTitle>
        <DialogDescription>
            Ask questions about your notes to our AI
        </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-6">
            {questions.map((question, index) => (
                <Fragment key = {index}>
                <div className="ml-auto max-w-[75%]">
                  <p className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
                    {question}
                  </p>
                </div>
                {responses[index] && (
                <div className="mr-auto max-w-[85%]">
                  <div
                    className="bot-response bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm"
                    dangerouslySetInnerHTML={{ __html: responses[index] }}
                  />
                </div>
              )}
                </Fragment>
            ))}
            {isPending && (
              <div className="mr-auto max-w-[85%]">
                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-foreground/40" style={{animationDelay: '0ms'}}></span>
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-foreground/40" style={{animationDelay: '150ms'}}></span>
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-foreground/40" style={{animationDelay: '300ms'}}></span>
                    </div>
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
        </div>
        <div
          className="mt-auto flex cursor-text flex-col rounded-lg border p-4"
          onClick={handleClickInput}
        >
          <Textarea
            ref={textareaRef}
            placeholder="Ask me anything about your notes!"
            className="placeholder:text-muted-foreground resize-none rounded-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              minHeight: "0",
              lineHeight: "normal",
            }}
            rows={1}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />
          <Button
            className="ml-auto size-8 rounded-full"
            onClick={handleSubmit}
            disabled={!questionText.trim() || isPending}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </div>
    </DialogContent>
    </Dialog>

    );
}

export default AskAIButton;