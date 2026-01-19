import { GET as getTokens } from "../../tokens/route.js";

export async function GET(request) {
  const url = new URL(request.url);
  url.searchParams.set("mode", "builder");
  const nextRequest = new Request(url.toString(), request);
  return getTokens(nextRequest);
}
