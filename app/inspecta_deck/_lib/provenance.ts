import { normalizeAddress, normalizeTokenId } from "./normalize";

export type MetadataEvidence = {
  fieldPath: string;
  value: string;
};

export type SameTransactionEvidence = {
  txHash: string;
  mintedTokenIds: string[];
};

export type OwnerOverlapEvidence = {
  overlapCount: number;
  overlapOwners: string[];
  ownerCount: number;
  candidateOwnerCount: number;
  overlapRatio: number;
};

export type ProvenanceEvidence = {
  explicitMetadataReference?: MetadataEvidence[];
  sameTransaction?: SameTransactionEvidence;
  ownerOverlap?: OwnerOverlapEvidence;
};

export type ProvenanceCandidate = {
  tokenId: string;
  confidence: "low" | "medium" | "high";
  score: number;
  source: string;
  evidence: ProvenanceEvidence;
};

const REFERENCE_KEYWORDS = /(token|reference|parent|source|provenance|origin|inspired|composition)/i;

function extractTokenIdsFromString(value: string): string[] {
  const tokens = new Set<string>();
  const hexMatches = value.match(/0x[a-fA-F0-9]{1,64}/g) ?? [];
  const decMatches = value.match(/\b\d{1,78}\b/g) ?? [];

  for (const match of [...hexMatches, ...decMatches]) {
    const normalized = normalizeTokenId(match);
    if (normalized) {
      tokens.add(normalized);
    }
  }

  return Array.from(tokens);
}

function recordEvidence(
  map: Map<string, MetadataEvidence[]>,
  tokenId: string,
  fieldPath: string,
  value: string
) {
  if (!map.has(tokenId)) {
    map.set(tokenId, []);
  }
  map.get(tokenId)?.push({ fieldPath, value });
}

function scanValue(
  value: unknown,
  fieldPath: string,
  map: Map<string, MetadataEvidence[]>,
  forceScan: boolean,
  visited: WeakSet<object>,
  depth: number
) {
  if (depth > 6) {
    return;
  }

  if (typeof value === "string") {
    if (!forceScan) {
      return;
    }
    const tokenIds = extractTokenIdsFromString(value);
    tokenIds.forEach((tokenId) => recordEvidence(map, tokenId, fieldPath, value));
    return;
  }

  if (typeof value === "number") {
    if (!forceScan) {
      return;
    }
    const tokenId = normalizeTokenId(String(value));
    if (tokenId) {
      recordEvidence(map, tokenId, fieldPath, String(value));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const entryPath = `${fieldPath}[${index}]`;
      scanValue(entry, entryPath, map, forceScan, visited, depth + 1);
    });
    return;
  }

  if (value && typeof value === "object") {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    Object.entries(value).forEach(([key, entry]) => {
      const entryPath = fieldPath ? `${fieldPath}.${key}` : key;
      const keyMatches = REFERENCE_KEYWORDS.test(key);

      if (key === "attributes" || key === "properties") {
        scanValue(entry, entryPath, map, true, visited, depth + 1);
        return;
      }

      scanValue(entry, entryPath, map, keyMatches || forceScan, visited, depth + 1);

      if (!entry || typeof entry !== "object") {
        return;
      }

      const record = entry as Record<string, unknown>;
      const trait =
        (record.trait_type as string | undefined) ??
        (record.traitType as string | undefined) ??
        (record.type as string | undefined);

      if (trait && REFERENCE_KEYWORDS.test(trait)) {
        const valueCandidate =
          record.value ?? record.tokenId ?? record.token_id ?? record.id ?? null;
        scanValue(valueCandidate, `${entryPath}.value`, map, true, visited, depth + 1);
      }
    });
  }
}

export function scanMetadataReferences(metadata: Record<string, unknown> | null) {
  const map = new Map<string, MetadataEvidence[]>();
  if (!metadata) {
    return map;
  }

  scanValue(metadata, "metadata", map, false, new WeakSet<object>(), 0);
  return map;
}

export function buildSameTransactionEvidence(
  txHash: string,
  mintedTokenIds: string[],
  targetTokenId: string
) {
  const map = new Map<string, SameTransactionEvidence>();
  const normalizedTarget = normalizeTokenId(targetTokenId);
  const normalizedMints = mintedTokenIds
    .map((tokenId) => normalizeTokenId(tokenId))
    .filter((tokenId): tokenId is string => Boolean(tokenId));

  const candidates = normalizedMints.filter(
    (tokenId) => tokenId !== normalizedTarget
  );

  candidates.forEach((tokenId) => {
    map.set(tokenId, { txHash, mintedTokenIds: normalizedMints });
  });

  return map;
}

export function buildOwnerOverlapEvidence(
  owners: string[],
  candidateOwners: string[]
): OwnerOverlapEvidence | null {
  const normalizedOwners = owners
    .map((owner) => normalizeAddress(owner))
    .filter((owner): owner is string => Boolean(owner));
  const normalizedCandidates = candidateOwners
    .map((owner) => normalizeAddress(owner))
    .filter((owner): owner is string => Boolean(owner));

  if (!normalizedOwners.length || !normalizedCandidates.length) {
    return null;
  }

  const ownerSet = new Set(normalizedOwners);
  const overlap = normalizedCandidates.filter((owner) => ownerSet.has(owner));

  if (!overlap.length) {
    return null;
  }

  const uniqueOverlap = Array.from(new Set(overlap));
  const overlapRatio = uniqueOverlap.length /
    Math.max(normalizedOwners.length, normalizedCandidates.length, 1);

  return {
    overlapCount: uniqueOverlap.length,
    overlapOwners: uniqueOverlap,
    ownerCount: normalizedOwners.length,
    candidateOwnerCount: normalizedCandidates.length,
    overlapRatio,
  };
}

function scoreCandidate(evidence: ProvenanceEvidence) {
  let score = 0;
  const sources: string[] = [];

  if (evidence.explicitMetadataReference?.length) {
    score += 0.6;
    sources.push("metadata");
  }

  if (evidence.sameTransaction) {
    score += 0.3;
    sources.push("transaction");
  }

  if (evidence.ownerOverlap) {
    score += 0.1 + Math.min(evidence.ownerOverlap.overlapRatio * 0.2, 0.2);
    sources.push("ownership");
  }

  score = Math.min(score, 1);

  const confidence: ProvenanceCandidate["confidence"] =
    score >= 0.75 ? "high" : score >= 0.4 ? "medium" : "low";

  return { score, confidence, source: sources.join("+") || "heuristic" };
}

export function buildProvenanceCandidates(options: {
  targetTokenId: string;
  metadataReferences: Map<string, MetadataEvidence[]>;
  sameTransactionReferences: Map<string, SameTransactionEvidence>;
  ownerOverlap: Map<string, OwnerOverlapEvidence>;
}): ProvenanceCandidate[] {
  const { targetTokenId, metadataReferences, sameTransactionReferences, ownerOverlap } = options;
  const candidateIds = new Set<string>();

  metadataReferences.forEach((_, tokenId) => candidateIds.add(tokenId));
  sameTransactionReferences.forEach((_, tokenId) => candidateIds.add(tokenId));
  ownerOverlap.forEach((_, tokenId) => candidateIds.add(tokenId));

  candidateIds.delete(targetTokenId);

  const candidates: ProvenanceCandidate[] = [];

  candidateIds.forEach((tokenId) => {
    const evidence: ProvenanceEvidence = {};

    const metadataEvidence = metadataReferences.get(tokenId);
    if (metadataEvidence?.length) {
      evidence.explicitMetadataReference = metadataEvidence;
    }

    const txEvidence = sameTransactionReferences.get(tokenId);
    if (txEvidence) {
      evidence.sameTransaction = txEvidence;
    }

    const overlapEvidence = ownerOverlap.get(tokenId);
    if (overlapEvidence) {
      evidence.ownerOverlap = overlapEvidence;
    }

    const scoring = scoreCandidate(evidence);

    candidates.push({
      tokenId,
      evidence,
      confidence: scoring.confidence,
      score: scoring.score,
      source: scoring.source,
    });
  });

  return candidates.sort((a, b) => b.score - a.score);
}
