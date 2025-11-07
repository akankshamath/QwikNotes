"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  getNotionAuthUrlAction,
  getNotionConnectionStatusAction,
  disconnectNotionAction,
} from "@/actions/notion-oauth";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

export function NotionConnectionButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isConnected, setIsConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Check if component has mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
    checkConnectionStatus();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const notionConnected = searchParams?.get("notion_connected");
    const notionError = searchParams?.get("notion_error");

    if (notionConnected === "true") {
      toast.success("Notion connected successfully!");
      checkConnectionStatus();
      // Clear URL params
      router.replace("/");
    }

    if (notionError) {
      toast.error(`Notion connection failed: ${notionError}`);
      // Clear URL params
      router.replace("/");
    }
  }, [searchParams, router]);

  const checkConnectionStatus = async () => {
    const result = await getNotionConnectionStatusAction();
    if (!result.errorMessage && "isConnected" in result) {
      setIsConnected(result.isConnected);
      setWorkspaceName(result.workspaceName || null);
    }
  };

  const handleConnect = () => {
    startTransition(async () => {
      const result = await getNotionAuthUrlAction();

      if (result.errorMessage) {
        toast.error(result.errorMessage);
        return;
      }

      if ("authUrl" in result && result.authUrl) {
        // Redirect to Notion OAuth
        window.location.href = result.authUrl;
      }
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      const result = await disconnectNotionAction();

      if (result.errorMessage) {
        toast.error("Failed to disconnect Notion");
        return;
      }

      toast.success("Notion disconnected");
      setIsConnected(false);
      setWorkspaceName(null);
      setIsOpen(false);
    });
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4v16h16V4H4zm8 14H6v-6h6v6zm0-8H6V6h6v4zm6 8h-4V6h4v12z" />
        </svg>
        <span className="hidden sm:inline">Notion</span>
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isConnected ? "secondary" : "outline"}
          size="sm"
          className="gap-2"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 4v16h16V4H4zm8 14H6v-6h6v6zm0-8H6V6h6v4zm6 8h-4V6h4v12z" />
          </svg>
          <span className="hidden sm:inline">Notion</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notion Integration</DialogTitle>
          <DialogDescription>
            {isConnected
              ? "Your Notion workspace is connected. You can now search, read, and create Notion pages using AI."
              : "Connect your Notion workspace to unlock powerful integrations with your notes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Connected Workspace</p>
                <p className="text-sm text-muted-foreground">
                  {workspaceName || "Unknown"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">What you can do:</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Search your Notion pages</li>
                  <li>Read Notion page content</li>
                  <li>Create new Notion pages</li>
                  <li>Update existing pages</li>
                  <li>List available databases</li>
                </ul>
              </div>

              <Button
                onClick={handleDisconnect}
                disabled={isPending}
                variant="destructive"
                className="w-full"
              >
                Disconnect Notion
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Features:</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Search Notion pages from QwikNotes</li>
                  <li>Import Notion content to your notes</li>
                  <li>Create Notion pages via AI</li>
                  <li>Bi-directional sync between systems</li>
                </ul>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? "Connecting..." : "Connect with Notion"}
              </Button>

              <p className="text-xs text-muted-foreground">
                You'll be redirected to Notion to authorize access to your
                workspace. Only pages you explicitly share with the integration
                will be accessible.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
