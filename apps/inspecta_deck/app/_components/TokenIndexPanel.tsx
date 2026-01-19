"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import FallbackImage from "./FallbackImage";
import CubixlesText from "./CubixlesText";
import { withBasePath } from "../_lib/basePath";

type TokenMedia = {
  gateway?: string;
  raw?: string;
  thumbnail?: string;
  format?: string;
};

type TokenListItem = {
  tokenId: string;
  title?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  media?: TokenMedia[];
  mint?: {
    timestamp?: string;
    transactionHash?: string;
  } | null;
};

type TokenListResponse = {
  tokens: TokenListItem[];
  pageKey?: string | null;
  pages?: number;
  truncated?: boolean;
  count: number;
};

type TokenListMode = "page" | "all";

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_LIMIT = 100;
const MAX_PAGES_LIMIT = 50;
const DEFAULT_MAX_PAGES = 25;

function truncateMiddle(value: string, start = 6, end = 4) {
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().split("T")[0] ?? value;
}

function resolveGatewayUrl(value: string): string {
  if (value.startsWith("ipfs://") || value.toLowerCase().startsWith("ipfs://")) {
    const path = value.replace(/^ipfs:\/\/ipfs\//i, "").replace(/^ipfs:\/\//i, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  if (value.startsWith("ar://") || value.toLowerCase().startsWith("ar://")) {
    const path = value.replace(/^ar:\/\//i, "");
    return `https://arweave.net/${path}`;
  }
  return value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFeingehaltLabel(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function isFeingehaltTrait(trait: string) {
  const normalized = trait.trim().toLowerCase();
  return (
    normalized === "feingehalt" ||
    normalized === "total floor snapshot (eth)" ||
    normalized === "total floor snapshot"
  );
}

function findFeingehaltKey(record: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(record)) {
    if (key.trim().toLowerCase() === "feingehalt") {
      const label = toFeingehaltLabel(value);
      if (label) {
        return label;
      }
    }
  }
  return null;
}

function extractFeingehaltFromAttributes(attributes: unknown): string | null {
  if (!attributes) {
    return null;
  }
  const entries = Array.isArray(attributes) ? attributes : [attributes];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const direct = findFeingehaltKey(entry);
    if (direct) {
      return direct;
    }

    const traitRaw =
      (entry.trait_type as string | undefined) ??
      (entry.traitType as string | undefined) ??
      (entry.type as string | undefined) ??
      (entry.name as string | undefined);

    if (traitRaw && isFeingehaltTrait(traitRaw)) {
      const label = toFeingehaltLabel(
        entry.value ?? entry.val ?? entry.amount
      );
      if (label) {
        return label;
      }
    }
  }
  return null;
}

function extractFeingehaltFromProvenance(
  metadata: Record<string, unknown>
): string | null {
  const provenanceSummary = isRecord(metadata.provenanceSummary)
    ? metadata.provenanceSummary
    : null;
  const provenance = isRecord(metadata.provenance) ? metadata.provenance : null;
  const floorSummary =
    provenance && isRecord(provenance.floorSummary)
      ? provenance.floorSummary
      : null;
  const summaryValue =
    provenanceSummary?.sumFloorEth ??
    floorSummary?.sumFloorEth ??
    provenanceSummary?.sumFloor ??
    floorSummary?.sumFloor ??
    null;
  return toFeingehaltLabel(summaryValue);
}

function pickFeingehaltValue(
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) {
    return null;
  }

  const direct = findFeingehaltKey(metadata);
  if (direct) {
    return direct;
  }

  const provenanceLabel = extractFeingehaltFromProvenance(metadata);
  if (provenanceLabel) {
    return provenanceLabel;
  }

  const properties = isRecord(metadata.properties) ? metadata.properties : null;
  if (properties) {
    const propDirect = findFeingehaltKey(properties);
    if (propDirect) {
      return propDirect;
    }
    const propProvenance = extractFeingehaltFromProvenance(properties);
    if (propProvenance) {
      return propProvenance;
    }
    const propAttrs = extractFeingehaltFromAttributes(
      properties.attributes ?? properties.traits
    );
    if (propAttrs) {
      return propAttrs;
    }
  }

  return extractFeingehaltFromAttributes(metadata.attributes ?? metadata.traits);
}

function parseFeingehaltSortValue(label: string | null): number | null {
  if (!label) {
    return null;
  }
  const match = label.replace(/,/g, ".").match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFeingehaltDisplay(
  label: string | null,
  numericValue: number | null
): string | null {
  if (!label) {
    return null;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^-?[\d.,]+$/.test(trimmed) || numericValue === null) {
    return trimmed;
  }
  const factor = 10_000;
  const truncated = Math.trunc(numericValue * factor) / factor;
  const fixed = truncated.toFixed(4);
  const stripped = fixed.replace(/\.?0+$/, "");
  return stripped.replace(".", ",");
}

function extractStringValues(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractStringValues(entry));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      extractStringValues(entry)
    );
  }
  return [];
}

function getTokenImageCandidates(token: TokenListItem): string[] {
  const candidates: string[] = [];
  const mediaCandidates =
    token.media?.flatMap((media) =>
      [media.gateway, media.thumbnail, media.raw]
        .filter(Boolean)
        .map((entry) => resolveGatewayUrl(entry as string))
    ) ?? [];
  candidates.push(...mediaCandidates);

  if (token.metadata) {
    const metadataImage = token.metadata.image ??
      token.metadata.image_url ??
      token.metadata.imageUrl ??
      token.metadata.imageURI ??
      token.metadata.image_uri ??
      token.metadata.preview ??
      token.metadata.thumbnail;
    candidates.push(
      ...extractStringValues(metadataImage).map((entry) =>
        resolveGatewayUrl(entry)
      )
    );
  }

  return uniqueStrings(candidates);
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

type TokenIndexPanelProps = {
  defaultChainId?: number;
};

export default function TokenIndexPanel({ defaultChainId = 1 }: TokenIndexPanelProps) {
  const normalizedDefaultChainId = defaultChainId === 8453 ? 8453 : 1;
  const [activeChainId, setActiveChainId] = useState(normalizedDefaultChainId);
  const [mode, setMode] = useState<TokenListMode>("page");
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [truncated, setTruncated] = useState(false);
  const [pageSizeInput, setPageSizeInput] = useState(DEFAULT_PAGE_SIZE);
  const [pageSizeApplied, setPageSizeApplied] = useState(DEFAULT_PAGE_SIZE);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isAllMode = mode === "all";
  const hasMore = Boolean(pageKey);
  const maxPagesId = "token-index-max-pages";
  const pageSizeId = "token-index-page-size";
  const debouncedPageSize = useDebouncedValue(pageSizeInput, 300);

  const loadTokens = useCallback(
    async ({
      reset,
      nextPageKey,
    }: {
      reset: boolean;
      nextPageKey?: string | null;
    }) => {
      setStatus("loading");
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSizeApplied));
        params.set("chainId", String(activeChainId));

        if (mode === "all") {
          params.set("all", "true");
          params.set("maxPages", String(maxPages));
        } else if (nextPageKey) {
          params.set("pageKey", nextPageKey);
        }

        const response = await fetch(
          withBasePath(`/api/poc/tokens?${params.toString()}`),
          {
            cache: "no-store",
          }
        );
        const raw = await response.text();
        let data: (TokenListResponse & { error?: string }) | null = null;

        if (raw) {
          try {
            data = JSON.parse(raw) as TokenListResponse & { error?: string };
          } catch {
            if (response.ok) {
              throw new Error("Token list response was malformed.");
            }
          }
        }

        if (!response.ok) {
          throw new Error(
            data?.error ?? `Token list request failed (${response.status}).`
          );
        }

        if (!data) {
          throw new Error("Token list response was empty.");
        }

        const incoming = Array.isArray(data.tokens) ? data.tokens : [];

        if (mode === "all" || reset) {
          setTokens(incoming);
        } else {
          setTokens((prev) => {
            const seen = new Set(prev.map((token) => token.tokenId));
            const merged = [...prev];
            incoming.forEach((token) => {
              if (!seen.has(token.tokenId)) {
                merged.push(token);
              }
            });
            return merged;
          });
        }

        setPageKey(data.pageKey ?? null);
        setPages(data.pages ?? 1);
        setTruncated(Boolean(data.truncated));
        setStatus("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setError(message);
      }
    },
    [activeChainId, maxPages, mode, pageSizeApplied]
  );

  useEffect(() => {
    loadTokens({ reset: true, nextPageKey: null });
  }, [loadTokens, refreshTick]);

  useEffect(() => {
    if (!tokens.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => (prev < tokens.length ? prev : 0));
  }, [tokens.length]);

  useEffect(() => {
    if (!tokens.length || hoveredIndex !== null) {
      return;
    }
    const handle = window.setInterval(() => {
      setActiveIndex((prev) => {
        if (!tokens.length) {
          return 0;
        }
        return (prev + 1) % tokens.length;
      });
    }, 1500);
    return () => window.clearInterval(handle);
  }, [tokens.length, hoveredIndex]);

  const handleLoadMore = () => {
    if (status === "loading" || !pageKey || isAllMode) {
      return;
    }
    loadTokens({ reset: false, nextPageKey: pageKey });
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === "all" ? "page" : "all"));
  };

  const handleMaxPagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), MAX_PAGES_LIMIT);
    setMaxPages(clamped);
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), PAGE_SIZE_LIMIT);
    setPageSizeInput(clamped);
  };

  const handleRefresh = () => {
    const nextPageSize =
      debouncedPageSize === pageSizeInput ? debouncedPageSize : pageSizeInput;
    setPageSizeApplied(nextPageSize);
    setRefreshTick((prev) => prev + 1);
  };

  const statusLabel = useMemo(() => {
    if (status === "loading") {
      return "Loading collection tokens...";
    }
    if (isAllMode) {
      return truncated
        ? `Loaded ${tokens.length} tokens across ${pages} pages (truncated).`
        : `Loaded ${tokens.length} tokens across ${pages} pages.`;
    }
    if (!tokens.length) {
      return "No tokens loaded yet.";
    }
    return hasMore
      ? `Loaded ${tokens.length} tokens. More pages available.`
      : `Loaded ${tokens.length} tokens. End of list.`;
  }, [status, isAllMode, truncated, pages, tokens.length, hasMore]);

  const displayTokens = useMemo(() => {
    const enriched = tokens.map((token) => {
      const feingehaltLabel = pickFeingehaltValue(token.metadata ?? null);
      const feingehaltSort = parseFeingehaltSortValue(feingehaltLabel);
      const feingehaltDisplay = formatFeingehaltDisplay(
        feingehaltLabel,
        feingehaltSort
      );
      return {
        token,
        feingehaltLabel,
        feingehaltSort,
        feingehaltDisplay,
      };
    });

    return enriched.sort((a, b) => {
      if (a.feingehaltSort === null && b.feingehaltSort === null) {
        return a.token.tokenId.localeCompare(b.token.tokenId);
      }
      if (a.feingehaltSort === null) {
        return 1;
      }
      if (b.feingehaltSort === null) {
        return -1;
      }
      if (a.feingehaltSort === b.feingehaltSort) {
        return a.token.tokenId.localeCompare(b.token.tokenId);
      }
      return b.feingehaltSort - a.feingehaltSort;
    });
  }, [tokens]);
  const highlightIndex = hoveredIndex ?? activeIndex;

  return (
    <section className="provenance-panel token-index-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Live index</p>
          <h2 className="panel-title">Chain token list</h2>
          <p className="panel-subhead">
            Quick inspection list pulled from the collection API. Use pagination
            or pull the full set.
          </p>
        </div>
        <div className="token-index-actions">
          <div className="token-index-network" role="group" aria-label="Network">
            <span className="token-detail-label">Network</span>
            <div className="token-chain-buttons">
              <button
                type="button"
                className={`token-chain-button ${
                  activeChainId === 1 ? "is-active" : ""
                }`}
                onClick={() => setActiveChainId(1)}
              >
                Ethereum
              </button>
              <button
                type="button"
                className={`token-chain-button ${
                  activeChainId === 8453 ? "is-active" : ""
                }`}
                onClick={() => setActiveChainId(8453)}
              >
                Base
              </button>
            </div>
          </div>
          <label className="token-index-control" htmlFor={pageSizeId}>
            <span>Page size</span>
            <input
              id={pageSizeId}
              type="number"
              min={1}
              max={PAGE_SIZE_LIMIT}
              value={pageSizeInput}
              onChange={handlePageSizeChange}
              className="token-index-input"
            />
          </label>
          <label className="token-index-control" htmlFor={maxPagesId}>
            <span>All-mode max pages</span>
            <input
              id={maxPagesId}
              type="number"
              min={1}
              max={MAX_PAGES_LIMIT}
              value={maxPages}
              onChange={handleMaxPagesChange}
              className="token-index-input"
            />
          </label>
          <button
            type="button"
            className="landing-button secondary"
            onClick={handleToggleMode}
            disabled={status === "loading"}
          >
            {isAllMode ? "Use pagination" : `Load all (max ${maxPages} pages)`}
          </button>
          {!isAllMode && (
            <button
              type="button"
              className="landing-button primary"
              onClick={handleLoadMore}
              disabled={!hasMore || status === "loading"}
            >
              {hasMore ? "Load more" : "End of list"}
            </button>
          )}
          <button
            type="button"
            className="landing-button tertiary"
            onClick={handleRefresh}
            disabled={status === "loading"}
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="token-index-status">{statusLabel}</p>
      {error && <p className="token-index-error">Error: {error}</p>}

      <div className="token-index-carousel">
        {displayTokens.map((entry, index) => {
          const { token, feingehaltDisplay } = entry;
          const shortTokenId = truncateMiddle(token.tokenId);
          const displayTitleRaw =
            token.title ?? token.name ?? `Token ${token.tokenId}`;
          const displayTitle = displayTitleRaw.includes(token.tokenId)
            ? displayTitleRaw.replace(token.tokenId, shortTokenId)
            : displayTitleRaw;
          const imageCandidates = getTokenImageCandidates(token);
          const isHighlighted = index === highlightIndex;
          const tokenHref = `/token/${token.tokenId}?chainId=${activeChainId}`;
          return (
            <Link
              key={token.tokenId}
              href={tokenHref}
              className={`token-index-card${isHighlighted ? " is-highlighted" : ""}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              aria-label={`Inspect token ${token.tokenId}`}
            >
              <div className="token-index-media">
                <FallbackImage
                  candidates={imageCandidates}
                  alt={`Token ${token.tokenId} preview`}
                  placeholderClassName="token-index-media-placeholder"
                  placeholderLabel="No preview resolved"
                />
              </div>
              <div className="token-index-card-head">
                <span className="panel-face-label">Token</span>
                <span className="token-index-id" title={token.tokenId}>
                  {truncateMiddle(token.tokenId)}
                </span>
              </div>
              <p className="token-index-title" title={displayTitleRaw}>
                <CubixlesText text={displayTitle} />
              </p>
              <p className="token-index-copy token-index-feingehalt">
                <span className="token-index-feingehalt-label">Feingehalt</span>{" "}
                <span className="token-index-feingehalt-value">
                  {feingehaltDisplay ?? "n/a"}
                </span>
              </p>
              <div className="token-index-meta">
                <span>Minted {formatTimestamp(token.mint?.timestamp)}</span>
                <span>
                  Tx {token.mint?.transactionHash ? "available" : "n/a"}
                </span>
              </div>
              <div className="token-index-links">
                <span className="landing-button secondary token-index-inspect">
                  Inspect token
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
