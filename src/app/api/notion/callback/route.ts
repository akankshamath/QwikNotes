import { NextRequest, NextResponse } from "next/server";
import { exchangeNotionCodeAction } from "@/actions/notion-oauth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/?notion_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        new URL("/?notion_error=no_code", request.url)
      );
    }

    // Exchange code for tokens
    const result = await exchangeNotionCodeAction(code);

    if (result.errorMessage) {
      return NextResponse.redirect(
        new URL(`/?notion_error=${encodeURIComponent(result.errorMessage)}`, request.url)
      );
    }

    // Success - redirect to home with success message
    return NextResponse.redirect(
      new URL("/?notion_connected=true", request.url)
    );
  } catch (error) {
    console.error("Notion OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/?notion_error=callback_failed", request.url)
    );
  }
}
