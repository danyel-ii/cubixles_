"use client";

import { useMemo, useState } from "react";

import { withBasePath } from "../_lib/basePath";

type Citation = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score?: number;
};

type HelpResponse = {
  answer?: string;
  citations?: Citation[];
  confidence?: string;
};

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: string;
};

export default function HelpdeskClient() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareDiagnostics, setShareDiagnostics] = useState(false);
  const [chainId, setChainId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [lastError, setLastError] = useState("");

  const latestCitations = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant" && messages[i].citations?.length) {
        return messages[i].citations ?? [];
      }
    }
    return [];
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const diagnostics = shareDiagnostics
        ? {
            chainId: chainId.trim(),
            tokenId: tokenId.trim(),
            lastError: lastError.trim(),
          }
        : null;

      const response = await fetch(withBasePath("/api/help"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed, diagnostics }),
      });

      const data = (await response.json()) as HelpResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "help_failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer ?? "No response yet.",
          citations: data.citations ?? [],
          confidence: data.confidence,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "help_failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="helpdesk-shell">
      <div className="helpdesk-grid">
        <div className="helpdesk-chat">
          <div className="helpdesk-messages">
            {messages.length === 0 ? (
              <p className="helpdesk-empty">
                Ask about provenance, metadata fields, or viewer behavior.
              </p>
            ) : (
              messages.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`helpdesk-message ${entry.role}`}
                >
                  <p className="helpdesk-message-role">
                    {entry.role === "user" ? "You" : "Helpdesk"}
                  </p>
                  <p className="helpdesk-message-body">{entry.content}</p>
                </div>
              ))
            )}
          </div>

          <form className="helpdesk-form" onSubmit={handleSubmit}>
            <label className="helpdesk-label" htmlFor="helpdesk-input">
              Your question
            </label>
            <textarea
              id="helpdesk-input"
              className="helpdesk-input"
              rows={4}
              placeholder="Ask about refsFaces, provenance trails, or verification steps."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <label className="helpdesk-toggle">
              <input
                type="checkbox"
                checked={shareDiagnostics}
                onChange={(event) => setShareDiagnostics(event.target.checked)}
              />
              Share diagnostics (chainId, tokenId, last error)
            </label>
            {shareDiagnostics ? (
              <div className="helpdesk-diagnostics">
                <div className="helpdesk-field">
                  <label className="helpdesk-field-label" htmlFor="helpdesk-chain">
                    Chain ID
                  </label>
                  <input
                    id="helpdesk-chain"
                    className="helpdesk-field-input"
                    type="text"
                    value={chainId}
                    onChange={(event) => setChainId(event.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="helpdesk-field">
                  <label className="helpdesk-field-label" htmlFor="helpdesk-token">
                    Token ID
                  </label>
                  <input
                    id="helpdesk-token"
                    className="helpdesk-field-input"
                    type="text"
                    value={tokenId}
                    onChange={(event) => setTokenId(event.target.value)}
                    placeholder="e.g. 1234"
                  />
                </div>
                <div className="helpdesk-field">
                  <label className="helpdesk-field-label" htmlFor="helpdesk-error">
                    Last error
                  </label>
                  <textarea
                    id="helpdesk-error"
                    className="helpdesk-field-input"
                    rows={3}
                    value={lastError}
                    onChange={(event) => setLastError(event.target.value)}
                    placeholder="Paste the exact error text."
                  />
                </div>
              </div>
            ) : null}
            <div className="helpdesk-form-row">
              <button
                className="landing-button primary helpdesk-send"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Thinking..." : "Ask helpdesk"}
              </button>
              {error ? <span className="helpdesk-error">{error}</span> : null}
            </div>
          </form>
        </div>

        <aside className="helpdesk-citations">
          <h2 className="helpdesk-citations-title">Citations</h2>
          {latestCitations.length === 0 ? (
            <p className="helpdesk-citations-empty">
              Citations will appear here after a response.
            </p>
          ) : (
            <ul className="helpdesk-citations-list">
              {latestCitations.map((citation) => (
                <li key={citation.id} className="helpdesk-citation">
                  <span className="helpdesk-citation-path">
                    {citation.path}:{citation.startLine}-{citation.endLine}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
