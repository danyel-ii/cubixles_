"use client";

import { useState } from "react";

import CollapsiblePanel from "./CollapsiblePanel";
import { withBasePath } from "../_lib/basePath";

type VerifyResponse = {
  tokenId?: string;
  owner?: string;
  tokenUri?: string;
  verified?: boolean;
  readOnly?: boolean;
  error?: string;
  detail?: string;
};

type TokenVerifyPanelProps = {
  tokenId: string;
  chainId?: number;
};

export default function TokenVerifyPanel({ tokenId, chainId }: TokenVerifyPanelProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const handleVerify = async () => {
    setStatus("loading");
    setResult(null);

    try {
      const query = chainId ? `?chainId=${chainId}` : "";
      const response = await fetch(withBasePath(`/api/token/${tokenId}/verify${query}`), {
        method: "POST",
      });
      const data = (await response.json()) as VerifyResponse;

      if (!response.ok) {
        setStatus("error");
        setResult(data);
        return;
      }

      setStatus("success");
      setResult(data);
    } catch (error) {
      setStatus("error");
      setResult({ error: "network_error", detail: String(error) });
    }
  };

  return (
    <CollapsiblePanel
      eyebrow="Verification"
      title="Read-only contract check"
      subhead="Runs server-side ownerOf + tokenURI checks with no wallet connection."
      actions={
        <button
          type="button"
          className="landing-button primary"
          onClick={handleVerify}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Verifying..." : "Run verification"}
        </button>
      }
    >
      {status === "idle" && (
        <p className="panel-body-text">
          Verification is rate limited to protect the RPC endpoint. This uses the
          configured RPC provider only.
        </p>
      )}

      {status === "error" && (
        <p className="token-verify-status error">
          Verification failed. {result?.error ?? "unknown_error"}
        </p>
      )}

      {status === "success" && result && (
        <div className="token-verify-grid">
          <div className="token-detail-row">
            <span className="token-detail-label">Owner</span>
            <span className="token-detail-value">{result.owner ?? "n/a"}</span>
          </div>
          <div className="token-detail-row">
            <span className="token-detail-label">Token URI</span>
            <span className="token-detail-value">{result.tokenUri ?? "n/a"}</span>
          </div>
          <div className="token-detail-row">
            <span className="token-detail-label">Read-only</span>
            <span className="token-detail-value">
              {result.readOnly ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
}
