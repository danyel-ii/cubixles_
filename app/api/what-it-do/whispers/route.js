import { NextResponse } from "next/server";
import { insertWhisper } from "../../../../src/server/what-it-do.js";

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const result = await insertWhisper(payload);
  if (result?.error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
