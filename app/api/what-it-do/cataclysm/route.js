import { NextResponse } from "next/server";
import { insertCataclysm } from "../../../../src/server/what-it-do.js";

export async function POST() {
  const result = await insertCataclysm();
  return NextResponse.json(result);
}
