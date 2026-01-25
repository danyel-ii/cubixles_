import { NextResponse } from "next/server";
import { getInitData } from "../../../../src/server/what-it-do.js";

export async function GET() {
  const data = await getInitData();
  return NextResponse.json(data);
}
