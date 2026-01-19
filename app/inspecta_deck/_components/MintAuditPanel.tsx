"use client";

import PanelExplanation from "./PanelExplanation";
import CubixlesLogo from "./CubixlesLogo";
import CubixlesText from "./CubixlesText";
import { MINT_AUDIT } from "../_data/mint-audit";

type MintAuditPanelProps = {
  focusTokenId?: string;
};

function truncateMiddle(value: string, start = 6, end = 4) {
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function MintAuditPanel({ focusTokenId }: MintAuditPanelProps) {
  const tokenId = focusTokenId ?? MINT_AUDIT.tokenId;
  const truncatedTokenId = truncateMiddle(tokenId);

  return (
    <section className="mint-audit-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Audit + provenance mapping</p>
          <h2 className="panel-title">
            <CubixlesText text={MINT_AUDIT.title} />
          </h2>
          <p className="panel-subhead">
            <CubixlesText text={MINT_AUDIT.tagline} />
          </p>
          <p className="panel-note" title={tokenId}>
            Centered on token {truncatedTokenId}. Data captured from the live mint page and the public metadata it publishes.
          </p>
        </div>
        <PanelExplanation
          summary="This panel tracks the recorded steps for this mint."
          description="Each step documents how the interactive cube, metadata snapshot, and on-chain record tie back to the NFTs selected during minting."
        />
      </div>

      <p className="panel-body-text">
        <CubixlesText text={MINT_AUDIT.summary} />
      </p>

      <div className="mint-audit-grid">
        <div className="mint-audit-card">
          <div className="panel-face-heading">
            <span className="panel-face-label">Audit steps</span>
            <PanelExplanation
              summary="Sequential workflow."
              description="From wallet selection to IPFS hosting, these five actions make up the mint's provenance workflow."
            />
          </div>
          <ol className="mint-audit-steps">
            {MINT_AUDIT.auditSteps.map((step, index) => (
              <li key={step.title} className="mint-audit-step">
                <span className="mint-audit-step-number">{index + 1}</span>
                <div>
                  <span className="mint-audit-step-label">{step.title}</span>
                  <p>
                    <CubixlesText text={step.detail} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mint-audit-card">
          <div className="panel-face-heading">
            <span className="panel-face-label">Provenance mapping</span>
            <PanelExplanation
              summary="A reusable reference path."
              description="Each row below ties a stage of the mint to the artifact it produces — the cube faces, the IPFS bundle, and the ERC-721."
            />
          </div>
          <ul className="mint-audit-mappings">
            {MINT_AUDIT.mappings.map((mapping) => (
              <li key={mapping.label}>
                <strong>{mapping.label}</strong>
                <span>
                  <CubixlesText text={mapping.detail} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mint-audit-info">
        {MINT_AUDIT.metadataHighlights.map((highlight) => (
          <div key={highlight.label} className="mint-audit-info-row">
            <span className="mint-audit-info-label">{highlight.label}</span>
            <span className="mint-audit-info-value">
              <CubixlesText text={highlight.value} />
            </span>
          </div>
        ))}
        <div className="mint-audit-info-row">
          <span className="mint-audit-info-label">Fees</span>
          <span className="mint-audit-info-value">
            <CubixlesText text={MINT_AUDIT.fees} />
          </span>
        </div>
        <div className="mint-audit-info-row">
          <span className="mint-audit-info-label">Notes</span>
          <span className="mint-audit-info-value">
            <CubixlesText text={MINT_AUDIT.notes} />
          </span>
        </div>
        <div className="mint-audit-info-row">
          <span className="mint-audit-info-label">Price mechanic</span>
          <span className="mint-audit-info-value">
            <CubixlesText text={MINT_AUDIT.priceMechanic} />
          </span>
        </div>
      </div>

      <div className="mint-audit-action-row">
        <a
          href={MINT_AUDIT.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="landing-button secondary"
        >
          View token on <CubixlesLogo className="cubixles-logo-tight" />
          <span>.xyz</span>
        </a>
        <div className="mint-audit-references">
          {MINT_AUDIT.references.map((reference) => (
            <a
              key={reference.url}
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className="mint-audit-reference"
            >
              {reference.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
