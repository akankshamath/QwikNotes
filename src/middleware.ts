import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/sign-up";

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    if (error || !user) {
      return supabaseResponse;
    }
    

    if (isAuthRoute && user) {
      return NextResponse.redirect(
        new URL("/", process.env.NEXT_PUBLIC_BASE_URL),
      );
    }

    const { searchParams, pathname } = new URL(request.url);

    if (!searchParams.get("noteId") && pathname === "/" && user) {
      // Try fetching newest note
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/fetchNewestNote?userId=${user.id}`
        );
        const json = await res.json();
        const newestNoteId = json?.newestNoteId;

        if (newestNoteId) {
          const url = request.nextUrl.clone();
          url.searchParams.set("noteId", newestNoteId);
          return NextResponse.redirect(url);
        }
      } catch (err) {
        console.error("Failed to fetch newest note:", err);
      }

      // If no note found, create a new one
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/createNewNote?userId=${user.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        const json = await res.json();
        const noteId = json?.noteId;

        if (noteId && typeof noteId === "string") {
          const url = request.nextUrl.clone();
          url.searchParams.set("noteId", noteId);
          return NextResponse.redirect(url);
        } else {
          console.error("noteId was invalid:", noteId);
        }
      } catch (err) {
        console.error("Failed to create new note:", err);
      }
    }
  } catch (err) {
    console.error("Supabase user fetch failed:", err);
  }

  return supabaseResponse;
}
