import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const tokenIdSchema = z.union([z.string(), z.number(), z.bigint()]);

const refSchema = z.object({
  contractAddress: addressSchema,
  tokenId: tokenIdSchema,
});

export const metadataSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    animation_url: z.string().optional(),
    external_url: z.string().optional(),
    tokenId: z.union([z.string(), z.number()]).optional(),
    provenance: z.object({
      mintedBy: addressSchema.optional(),
      chainId: z.number().optional(),
      refs: z.array(refSchema).max(6).optional(),
      refsCanonical: z.array(refSchema).max(6).optional(),
      refsFaces: z.array(refSchema).max(6).optional(),
      salt: z.string().optional(),
      tokenId: z.union([z.string(), z.number()]).optional(),
    }),
  })
  .passthrough();

export function extractRefs(metadata) {
  const provenance = metadata?.provenance ?? null;
  if (provenance?.refsFaces?.length) {
    return provenance.refsFaces;
  }
  if (provenance?.refsCanonical?.length) {
    return provenance.refsCanonical;
  }
  if (provenance?.refs?.length) {
    return provenance.refs;
  }
  return [];
}
