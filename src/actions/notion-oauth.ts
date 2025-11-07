"use server";

import { getUser } from "@/auth/server";
import prisma from "@/db/prisma";
import { handleError } from "@/lib/utils";
import { Client } from "@notionhq/client";

/**
 * Generate Notion OAuth authorization URL
 */
export async function getNotionAuthUrlAction() {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in");

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/notion/callback`;

    if (!clientId) {
      throw new Error("Notion OAuth is not configured. Please add NOTION_CLIENT_ID to environment variables.");
    }

    // Generate authorization URL
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return { errorMessage: null, authUrl };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Exchange OAuth code for access token and save to database
 */
export async function exchangeNotionCodeAction(code: string) {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in");

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/notion/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Notion OAuth is not configured properly");
    }

    // Exchange code for access token
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion OAuth failed: ${error}`);
    }

    const data = await response.json();

    // Extract tokens and workspace info
    const {
      access_token,
      workspace_id,
      workspace_name,
      bot_id,
    } = data;

    // Save to database
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          notionAccessToken: access_token,
          notionWorkspaceId: workspace_id,
          notionWorkspaceName: workspace_name,
          notionBotId: bot_id,
          notionConnectedAt: new Date(),
        },
      });
    } catch (dbError) {
      throw new Error("Notion fields not in database. Please run the migration: pnpm prisma migrate dev --name add-notion-oauth");
    }

    return {
      errorMessage: null,
      success: true,
      workspaceName: workspace_name,
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Disconnect Notion integration
 */
export async function disconnectNotionAction() {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in");

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          notionAccessToken: null,
          notionWorkspaceId: null,
          notionWorkspaceName: null,
          notionBotId: null,
          notionConnectedAt: null,
        },
      });
    } catch (dbError) {
      throw new Error("Notion fields not in database. Please run the migration.");
    }

    return { errorMessage: null, success: true };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Check if user has Notion connected
 */
export async function getNotionConnectionStatusAction() {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in");

    let userData;
    try {
      userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          notionWorkspaceName: true,
          notionConnectedAt: true,
        },
      });
    } catch (dbError) {
      // Notion fields don't exist yet
      return {
        errorMessage: null,
        isConnected: false,
        workspaceName: null,
        connectedAt: null,
      };
    }

    const isConnected = !!userData?.notionWorkspaceName;

    return {
      errorMessage: null,
      isConnected,
      workspaceName: userData?.notionWorkspaceName,
      connectedAt: userData?.notionConnectedAt,
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get user's Notion access token (for internal use by Notion tools)
 */
export async function getUserNotionTokenAction() {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in");

    let userData;
    try {
      userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          notionAccessToken: true,
        },
      });
    } catch (dbError) {
      throw new Error("Notion fields not in database. Please run the migration.");
    }

    if (!userData?.notionAccessToken) {
      throw new Error("Notion is not connected. Please connect your Notion workspace first.");
    }

    return {
      errorMessage: null,
      accessToken: userData.notionAccessToken,
    };
  } catch (error) {
    return handleError(error);
  }
}
