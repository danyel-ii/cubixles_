"use client";

import { useEffect, useMemo, useState } from "react";

import type { MintedCube } from "../_data/minted-cube";
import FallbackImage from "./FallbackImage";
import CubixlesLogo from "./CubixlesLogo";
import CubixlesText from "./CubixlesText";

type CubeProvenanceExplorerProps = {
  cube: MintedCube;
  requestedTokenId: string;
};

function truncateMiddle(value: string, start = 6, end = 4) {
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getOpenSeaCollectionUrl(explorerUrl?: string | null): string | null {
  if (!explorerUrl) {
    return null;
  }

  try {
    const url = new URL(explorerUrl);
    if (!url.hostname.includes("opensea.io")) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (!segments.length) {
      return null;
    }

    if (segments[0] === "collection" && segments[1]) {
      return `${url.origin}/collection/${segments[1]}`;
    }

    if (segments[0] === "assets" && segments[1] && segments[2]) {
      return `${url.origin}/assets/${segments[1]}/${segments[2]}`;
    }

    if (segments[0] === "assets" && segments[1]) {
      return `${url.origin}/assets/${segments[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

function getMediaCandidates(media?: MintedCube["media"]) {
  if (media?.imageCandidates?.length) {
    return media.imageCandidates;
  }
  if (media?.image) {
    return [media.image];
  }
  return [];
}

export default function CubeProvenanceExplorer({
  cube,
  requestedTokenId,
}: CubeProvenanceExplorerProps) {
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(
    cube.provenanceNFTs[0]?.faceId ?? null
  );

  useEffect(() => {
    setSelectedFaceId(cube.provenanceNFTs[0]?.faceId ?? null);
  }, [cube.tokenId, cube.provenanceNFTs]);

  const selectedFace = useMemo(
    () =>
      cube.provenanceNFTs.find((nft) => nft.faceId === selectedFaceId) ??
      cube.provenanceNFTs[0],
    [cube.provenanceNFTs, selectedFaceId]
  );

  const isMismatch = cube.tokenId !== requestedTokenId;
  const truncatedCubeTokenId = truncateMiddle(cube.tokenId);
  const selectedFaceCollectionUrl = selectedFace
    ? getOpenSeaCollectionUrl(selectedFace.explorerUrl)
    : null;

  return (
    <section className="minted-cube-panel">
      <div className="minted-cube-panel-heading">
        <div>
          <p className="panel-eyebrow">Minted cube inspector</p>
          <h2
            className="panel-title"
            title={`cubixles_ #${cube.tokenId}`}
          >
            Investigating <CubixlesLogo className="cubixles-logo-inline" /> #
            {truncatedCubeTokenId}
          </h2>
          <p className="panel-subhead">
            <CubixlesText text={cube.description} />
          </p>
          {isMismatch && (
            <p className="panel-note" title={cube.tokenId}>
              Showing the verified cube for {truncatedCubeTokenId} because that is the
              actual token minted at this position in the series.
            </p>
          )}
        </div>
        <div className="minted-cube-meta">
          <span>Minted {cube.mintedAt}</span>
          <span>{cube.network}</span>
          <span>{cube.mintedBy}</span>
        </div>
      </div>

      <div className="minted-cube-links">
        {cube.tokenViewUrl && (
          <a
            href={cube.tokenViewUrl}
            target="_blank"
            rel="noreferrer"
            className="landing-button primary"
          >
            Open mint gallery
          </a>
        )}
        {cube.references.map((reference) => (
          <a
            key={reference.url}
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            className="landing-button tertiary"
          >
            {reference.label}
          </a>
        ))}
      </div>

      <div className="minted-cube-media">
        <div className="minted-cube-media-frame">
          <FallbackImage
            candidates={getMediaCandidates(cube.media)}
            alt={`Cubixles ${cube.tokenId} media`}
            className="minted-cube-media-image"
            placeholderClassName="minted-cube-media-placeholder"
            placeholderLabel="No cube image resolved"
          />
          {cube.media?.animation && (
            <a
              href={cube.media.animation}
              target="_blank"
              rel="noreferrer"
              className="minted-cube-media-link"
            >
              View animation
            </a>
          )}
        </div>
        <div className="minted-cube-media-caption">
          <span className="panel-face-label">
            <CubixlesLogo className="cubixles-logo-inline" /> media
          </span>
          <span
            className="minted-cube-media-id"
            title={cube.tokenId}
          >
            Token {truncatedCubeTokenId}
          </span>
        </div>
      </div>

      <div className="provenance-explorer-heading">
        <p className="panel-eyebrow">Provenance NFTs</p>
        <p className="panel-subhead">
          <CubixlesText text={cube.provenanceNote} />
        </p>
      </div>

      <div className="provenance-face-tabs">
        {cube.provenanceNFTs.map((nft) => (
          <button
            key={nft.faceId}
            type="button"
            className={`provenance-tab ${
              selectedFaceId === nft.faceId ? "active" : ""
            }`}
            onClick={() => setSelectedFaceId(nft.faceId)}
          >
            Face {nft.faceId}
          </button>
        ))}
      </div>

      {selectedFace && (
        <div className="provenance-face-detail">
          <div className="provenance-face-media">
            <FallbackImage
              candidates={getMediaCandidates(selectedFace.media)}
              alt={`${selectedFace.collection} ${selectedFace.tokenId}`}
              className="provenance-face-image"
              placeholderClassName="provenance-face-placeholder"
              placeholderLabel="No face image resolved"
            />
            {selectedFace.media?.animation && (
              <a
                href={selectedFace.media.animation}
                target="_blank"
                rel="noreferrer"
                className="provenance-media-link"
              >
                View animation
              </a>
            )}
          </div>
          <div className="provenance-face-info">
            <div className="provenance-card-header">
              <span className="panel-face-label">Face {selectedFace.faceId}</span>
              <span className="panel-ref-title">{selectedFace.title}</span>
            </div>
            <p className="provenance-card-description">
              <CubixlesText text={selectedFace.description} />
            </p>
            <div className="provenance-card-meta">
              <span title={selectedFace.contractAddress ?? selectedFace.collection}>
                {selectedFace.collection}
              </span>
              <span title={selectedFace.tokenId}>
                Token {truncateMiddle(selectedFace.tokenId)}
              </span>
            </div>
            <p className="panel-note">{selectedFace.ownerNote}</p>
            <div className="provenance-card-links">
              {selectedFace.explorerUrl && (
                <a
                  href={selectedFace.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mint-audit-reference"
                >
                  View on-chain
                </a>
              )}
              {selectedFaceCollectionUrl && (
                <a
                  href={selectedFaceCollectionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mint-audit-reference"
                >
                  OpenSea collection
                </a>
              )}
              {selectedFace.metadataUrl && (
                <a
                  href={selectedFace.metadataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mint-audit-reference"
                >
                  Metadata snapshot
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="provenance-grid">
        {cube.provenanceNFTs.map((nft) => {
          const collectionUrl = getOpenSeaCollectionUrl(nft.explorerUrl);
          return (
            <article
              key={`${cube.tokenId}-${nft.faceId}`}
              className={`provenance-card ${
                selectedFaceId === nft.faceId ? "provenance-card-highlight" : ""
              }`}
            >
              <div className="provenance-card-media">
                <FallbackImage
                  candidates={getMediaCandidates(nft.media)}
                  alt={`${nft.collection} ${nft.tokenId}`}
                  className="provenance-card-image"
                  placeholderClassName="provenance-card-placeholder"
                  placeholderLabel="No face image resolved"
                />
              </div>
              <div className="provenance-card-header">
                <span className="panel-face-label">Face {nft.faceId}</span>
                <span className="panel-ref-title">{nft.title}</span>
              </div>
              <p className="provenance-card-description">{nft.description}</p>
              <div className="provenance-card-meta">
                <span title={nft.contractAddress ?? nft.collection}>
                  {nft.collection}
                </span>
                <span title={nft.tokenId}>
                  Token {truncateMiddle(nft.tokenId)}
                </span>
              </div>
              <p className="panel-note">{nft.ownerNote}</p>
              <div className="provenance-card-links">
                {nft.explorerUrl && (
                  <a
                    href={nft.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mint-audit-reference"
                  >
                    View on-chain
                  </a>
                )}
                {collectionUrl && (
                  <a
                    href={collectionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mint-audit-reference"
                  >
                    OpenSea collection
                  </a>
                )}
                {nft.metadataUrl && (
                  <a
                    href={nft.metadataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mint-audit-reference"
                  >
                    Metadata snapshot
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="provenance-trail">
        <div className="provenance-trail-heading">
          <p className="panel-eyebrow">Full provenance trail</p>
          <p className="panel-subhead">
            A staged account of how the cube was built, referenced, and sealed on-chain.
          </p>
        </div>
        <ol className="provenance-trail-list">
          {cube.provenanceTrail.map((step, index) => (
            <li key={`${cube.tokenId}-${step.title}`}>
              <span className="panel-face-label">Stage {index + 1}</span>
              <p className="panel-ref-title">{step.title}</p>
              <p className="panel-body-text">{step.detail}</p>
              {step.reference && (
                <a
                  href={step.reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mint-audit-reference"
                >
                  {step.reference.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
