// import { NextRequest, NextResponse } from "next/server";
// import prisma from "@/db/prisma";

// export async function POST(req: NextRequest) {
//   const { id, text } = await req.json();

//   if (!id || !text) {
//     return NextResponse.json({ error: "Missing fields" }, { status: 400 });
//   }

//   const updatedNote = await prisma.note.update({
//     where: { id },
//     data: { text, updatedAt: new Date() },
//   });

//   return NextResponse.json(updatedNote);
// }
