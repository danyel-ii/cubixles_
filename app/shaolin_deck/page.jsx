"use client";

import { useEffect, useMemo, useState } from "react";

import { buildBuilderTokenViewUrl } from "../_client/src/config/links.js";

const DEFAULT_LIMIT = 48;

function truncateMiddle(value, start = 6, end = 4) {
  if (!value) {
    return "";
  }
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatEth(value) {
  if (!value || typeof value !== "string") {
    return "0.0000";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return numeric.toFixed(4);
}

export default function ShaolinDeckPage() {
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState("Loading builder deck...");
  const [summary, setSummary] = useState({ totalMinted: 0 });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/builder/tokens?limit=${DEFAULT_LIMIT}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load builder deck.");
        }
        if (!mounted) {
          return;
        }
        setTokens(Array.isArray(data?.tokens) ? data.tokens : []);
        setSummary({ totalMinted: data?.totalMinted || 0 });
        setStatus("");
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load builder deck.";
        setStatus(message);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const headerSubtitle = useMemo(() => {
    if (!summary.totalMinted) {
      return "Builder-minted cubixles_.";
    }
    return `Builder-minted cubixles_: ${summary.totalMinted} total.`;
  }, [summary.totalMinted]);

  return (
    <main className="shaolin-deck">
      <header className="shaolin-deck-header">
        <p className="shaolin-deck-eyebrow">shaolin_deck</p>
        <h1 className="shaolin-deck-title">Builder mint index</h1>
        <p className="shaolin-deck-subhead">{headerSubtitle}</p>
      </header>

      {status && tokens.length === 0 && (
        <div className="shaolin-deck-status">{status}</div>
      )}

      <section className="shaolin-deck-grid">
        {tokens.map((token) => {
          const tokenId = String(token.tokenId || "");
          const viewerUrl = buildBuilderTokenViewUrl(tokenId);
          return (
            <article key={tokenId} className="shaolin-card">
              <div className="shaolin-card-media">
                {token.image ? (
                  <img src={token.image} alt={token.name || tokenId} loading="lazy" />
                ) : (
                  <div className="shaolin-card-placeholder">No image</div>
                )}
              </div>
              <div className="shaolin-card-body">
                <div className="shaolin-card-title">
                  Token {truncateMiddle(tokenId)}
                </div>
                <div className="shaolin-card-meta">
                  Feingehalt: {formatEth(token.mintPriceEth)} ETH
                </div>
                <div className="shaolin-card-actions">
                  {viewerUrl ? (
                    <a className="shaolin-card-link" href={viewerUrl}>
                      Open viewer
                    </a>
                  ) : null}
                  {token.externalUrl ? (
                    <a
                      className="shaolin-card-link is-ghost"
                      href={token.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      External
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
