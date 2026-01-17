import { z } from "zod";

const CHAIN_ID_SCHEMA = z.union([
  z.literal(1),
  z.literal(8453),
  z.literal(11155111),
]);

export const pinRequestSchema = z.object({
  address: z.string(),
  nonce: z.string(),
  signature: z.string(),
  chainId: CHAIN_ID_SCHEMA.optional(),
  payload: z.record(z.unknown()),
});

export const nftRequestSchema = z.object({
  mode: z.enum(["alchemy", "rpc"]).optional(),
  chainId: CHAIN_ID_SCHEMA,
  path: z.string().optional(),
  query: z.record(z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])).optional(),
  calls: z
    .array(
      z.object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        data: z.string().regex(/^0x[0-9a-fA-F]*$/),
      })
    )
    .optional(),
});

export const identityRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const builderQuoteRequestSchema = z.object({
  chainId: CHAIN_ID_SCHEMA,
  refs: z
    .array(
      z.object({
        contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        tokenId: z.union([z.string(), z.number()]),
      })
    )
    .min(1)
    .max(6),
});

export async function readJsonWithLimit(request, maxBytes) {
  const text = await request.text();
  const size = Buffer.byteLength(text, "utf8");
  if (size > maxBytes) {
    const error = new Error("Payload too large");
    error.status = 413;
    error.size = size;
    throw error;
  }
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
  return { data, size };
}

export function formatZodError(error) {
  return error.issues.map((issue) => issue.message).join("; ");
}
