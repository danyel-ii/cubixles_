"use client";

import { useEffect } from "react";

export default function AppShell() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.__CUBIXLES_MAIN_IMPORTED__) {
        return;
      }
      window.__CUBIXLES_MAIN_IMPORTED__ = true;
    }
    import("../_client/src/main.js");
  }, []);

  return (
    <>
      <div id="overlay" className="overlay">
        <div className="overlay-card">
          <div className="overlay-title">cubixles_</div>
          <div className="overlay-sub">
            Mint interactive p5.js artworks whose provenance is tethered to NFTs you already own.
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">How it works</div>
            <ol className="overlay-steps">
              <li>Connect your wallet.</li>
              <li>Select 1–6 NFTs from your wallet.</li>
              <li>We snapshot key metadata (and collection floors when available).</li>
              <li>We publish the interactive artwork + metadata to IPFS.</li>
              <li>You sign a direct mint on Ethereum.</li>
            </ol>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">What gets minted</div>
            <p className="overlay-text">
              An ERC-721 with hosted metadata and an{" "}
              <span className="overlay-em">animation_url</span> pointing to an IPFS-hosted
              interactive cube.
            </p>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">Fees</div>
            <p className="overlay-text">
              Mint: dynamic (base 0.0015 ETH) · Resale royalty: 5% (ERC-2981)
            </p>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">Notes</div>
            <p className="overlay-text">
              If floor data is unavailable, we display 0. Your selection is embedded as provenance.
            </p>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">Mint price</div>
            <p className="overlay-text">
              Mint cost is calculated as a function of current{" "}
              <a
                className="ui-link"
                href="https://www.nftstrategy.fun/strategies/0x9c2ca573009f181eac634c4d6e44a0977c24f335"
                target="_blank"
                rel="noreferrer"
              >
                $LESS
              </a>{" "}
              supply.
            </p>
          </div>
          <div className="overlay-actions">
            <button id="enter-btn" className="overlay-button" type="button">
              Enter
            </button>
            <button id="overlay-leaderboard" className="overlay-button is-ghost" type="button">
              Leaderboard
            </button>
            <button id="overlay-about" className="overlay-button is-ghost" type="button">
              About
            </button>
          </div>
          <div id="overlay-about-panel" className="overlay-about">
            <div className="overlay-section-title">About</div>
            <p className="overlay-text">
              cubixles_ reads your wallet address and NFT metadata to build provenance snapshots. No
              private keys are accessed; minting is a direct onchain transaction you sign.
            </p>
          </div>
        </div>
      </div>
      <div id="toast-root" className="toast-root" aria-live="polite" aria-atomic="true"></div>
      <div id="eth-hud" className="eth-hud" aria-hidden="true">
        <div className="eth-hud-body">
          <svg className="eth-hud-icon" viewBox="0 0 120 180" aria-hidden="true">
            <polygon points="60,0 115,90 60,125 5,90" />
            <polygon points="60,130 115,90 60,180 5,90" />
          </svg>
          <div className="eth-hud-label">ΔLESS</div>
          <div id="eth-hud-value" className="eth-hud-value">
            ΔLESS —
          </div>
          <div id="eth-hud-time" className="eth-hud-time">
            token: —
          </div>
        </div>
      </div>
      <div id="less-hud" className="less-hud" aria-hidden="true">
        <div className="less-hud-label">$LESS remaining</div>
        <div id="less-supply-value" className="less-hud-value">
          —
        </div>
        <div id="less-supply-time" className="less-hud-time">
          updated —
        </div>
      </div>
      <div id="token-view-status" className="token-view-status is-hidden">
        Loading token...
      </div>
      <div id="share-modal" className="share-modal is-hidden" role="dialog" aria-modal="true">
        <div id="share-backdrop" className="share-backdrop" aria-hidden="true"></div>
        <div className="share-card">
          <div className="share-title">Share this cube</div>
          <div className="share-actions">
            <a id="share-farcaster" className="share-button" target="_blank" rel="noreferrer">
              Farcaster
            </a>
            <a id="share-x" className="share-button" target="_blank" rel="noreferrer">
              X
            </a>
            <a id="share-base" className="share-button" target="_blank" rel="noreferrer">
              Base
            </a>
            <a id="share-signal" className="share-button" target="_blank" rel="noreferrer">
              Signal
            </a>
            <button id="share-copy" className="share-button is-ghost" type="button">
              Copy link
            </button>
          </div>
          <button id="share-close" className="share-close" type="button">
            Close
          </button>
        </div>
      </div>
      <div id="ui" className="ui-panel">
        <div className="ui-title">cubixles_</div>
        <div className="ui-sub">Choose 1 to 6 Ethereum Mainnet NFTs to wrap the cube.</div>
        <div className="ui-row">
          <button id="wallet-connect" className="ui-button" type="button">
            Connect Wallet
          </button>
          <button id="wallet-disconnect" className="ui-button is-ghost" type="button">
            Disconnect
          </button>
        </div>
        <div id="wallet-status" className="ui-hint">
          Wallet: not connected.
        </div>
        <div className="ui-row">
          <button id="leaderboard-open" className="ui-button is-ghost" type="button">
            Leaderboard
          </button>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">NFT picker</div>
          <div id="nft-status" className="ui-hint">
            Connect your wallet to load Ethereum Mainnet NFTs.
          </div>
          <div className="ui-row">
            <button id="nft-refresh" className="ui-button is-ghost" type="button">
              Refresh NFTs
            </button>
            <button id="nft-clear" className="ui-button is-ghost" type="button">
              Clear selection
            </button>
            <button id="nft-apply" className="ui-button" type="button">
              Apply to cube
            </button>
          </div>
          <div id="nft-selection" className="ui-hint">
            Selected 0 / 6
          </div>
          <div id="nft-grid" className="ui-grid"></div>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">Mint</div>
          <div id="mint-status" className="ui-hint">
            Connect your wallet to mint.
          </div>
          <div id="mint-floor-summary" className="ui-hint">
            Total floor (snapshot): 0.0000 ETH
          </div>
          <div id="mint-floor-list" className="ui-floor-list"></div>
          <div className="ui-row">
            <input
              id="mint-payment"
              className="ui-input"
              type="number"
              min="0"
              step="0.0001"
              placeholder="ETH amount"
            />
            <button id="mint-submit" className="ui-button" type="button">
              Mint NFT
            </button>
          </div>
          <div id="mint-price" className="ui-hint">
            Mint price: —
          </div>
          <div className="ui-hint is-accent">
            Mint price rises as{" "}
            <a
              className="ui-link"
              href="https://www.nftstrategy.fun/strategies/0x9c2ca573009f181eac634c4d6e44a0977c24f335"
              target="_blank"
              rel="noreferrer"
            >
              $LESS
            </a>{" "}
            supply drops (more burns = higher cost).
          </div>
        </div>
        <div className="ui-row">
          <button id="ui-preview" className="ui-button is-ghost ui-preview-btn" type="button">
            Preview
          </button>
          <button id="ui-landing" className="ui-button is-ghost" type="button">
            Landing
          </button>
        </div>
        <div id="minted-banner" className="ui-row minted-banner is-hidden">
          <button id="minted-link" className="ui-button is-ghost minted-link" type="button">
            cubelink
          </button>
          <span id="minted-copied" className="minted-copied is-hidden">
            copied
          </span>
        </div>
        <a
          className="ui-footer-link"
          href="https://deepwiki.com/danyel-ii/cubeless_/1-overview#what-is-cubeless"
          target="_blank"
          rel="noreferrer"
        >
          deepwiki cubixles_
        </a>
      </div>
      <div id="preview-bar" className="preview-bar is-hidden">
        <button id="preview-back" className="ui-button is-ghost" type="button">
          Back to controls
        </button>
      </div>
      <div id="leaderboard" className="ui-panel is-hidden">
        <div className="ui-title">Leaderboard</div>
        <div className="ui-sub">Mint history powered by $LESS supply snapshots.</div>
        <div className="ui-section">
          <div className="ui-section-title">$LESS + Minting</div>
          <p className="ui-text">
            Mint fees and resale royalties route through the RoyaltySplitter. Half the ETH goes to
            the contract owner, and the other half is swapped to $LESS. Of the $LESS output, 90% is
            sent to the owner and 10% is sent to the burn address.
          </p>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">How the leaderboard works</div>
          <p className="ui-text">
            Each mint snapshots total $LESS supply. The leaderboard ranks tokens by ΔLESS — the
            drop in total supply since the token’s last transfer. Earlier mint and longer holds
            contribute to bigger ΔLESS.
          </p>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">Contract</div>
          <div id="leaderboard-contract" className="ui-hint"></div>
          <div id="leaderboard-chain" className="ui-hint"></div>
          <div id="leaderboard-supply" className="ui-hint"></div>
          <div id="leaderboard-updated" className="ui-hint"></div>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">Top ΔLESS</div>
          <div id="leaderboard-status" className="ui-hint">
            Connect your wallet to load the leaderboard.
          </div>
          <div id="leaderboard-list" className="ui-list"></div>
        </div>
        <div className="ui-row">
          <button id="leaderboard-back" className="ui-button is-ghost" type="button">
            Back
          </button>
          <button id="leaderboard-landing" className="ui-button is-ghost" type="button">
            Landing
          </button>
        </div>
      </div>
      <div id="debug-panel" className="debug-panel is-hidden" aria-live="polite">
        <div className="debug-header">
          <span>Debug</span>
          <button id="debug-close" className="debug-close" type="button">
            ×
          </button>
        </div>
        <pre id="debug-log" className="debug-log"></pre>
      </div>
      <main id="app"></main>
    </>
  );
}
