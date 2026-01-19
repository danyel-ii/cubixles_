"use client";

import { useEffect } from "react";

export default function AppShell({ mode = "mint" }) {
  const isBuilder = mode === "builder";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__CUBIXLES_UI_MODE__ = mode;
      document.body.classList.toggle("is-builder", isBuilder);
      if (window.__CUBIXLES_MAIN_IMPORTED__) {
        return;
      }
      window.__CUBIXLES_MAIN_IMPORTED__ = true;
    }
    import("../_client/src/main.js");
  }, [mode, isBuilder]);

  return (
    <>
      <div id="intro-shield" className="intro-shield" aria-hidden="true"></div>
      <div id="overlay" className={`overlay${isBuilder ? " is-hidden" : ""}`}>
        <div className="overlay-card">
          <div className="overlay-title is-logotype" aria-label="cubixles_">
            <span className="logo-mark" aria-hidden="true">
              {"\uE000"}
            </span>
            <span className="sr-only">cubixles_</span>
          </div>
          <div className="overlay-sub">
            A{" "}
            <span className="logo-mark logo-mark-inline" aria-hidden="true">
              {"\uE000"}
            </span>
            <span className="sr-only">cubixles_</span> is an ERC721 linked to interactive p5.js
            artwork whose provenance is tethered to NFTs you already own.
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">How it works</div>
            <ol className="overlay-steps">
              <li>Connect your wallet.</li>
              <li>Select 1-6 NFTs from your wallet.</li>
              <li>We snapshot key metadata (and collection floors when available).</li>
              <li>We publish the interactive artwork + metadata and Feingehalt to IPFS.</li>
              <li>
                {isBuilder
                  ? "You sign the mint transaction on Ethereum Mainnet."
                  : "You sign the mint transaction on the selected network."}
              </li>
            </ol>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">What gets minted</div>
            {isBuilder ? (
              <p className="overlay-text">
                An ERC-721 with metadata pinned to IPFS, a paper clip sculpture image, a QR render
                derived from it, a per-mint royalty contract owned by the minter, and an{" "}
                <span className="overlay-em">external_url</span> pointing to the interactive cube.
              </p>
            ) : (
              <p className="overlay-text">
                An ERC-721 with hosted metadata and an{" "}
                <span className="overlay-em">external_url</span> pointing to your IPFS-hosted
                interactive cube.
              </p>
            )}
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">Mint price</div>
            {isBuilder ? (
              <p className="overlay-text">
                Feingehalt is set to 10% of snapshot floor totals (0.001 ETH min per face). Each
                mint deploys a royalty forwarder controlled by the minter for future split updates.
              </p>
            ) : (
              <p className="overlay-text">
                Mint cost depends on network: mainnet tracks{" "}
                <a
                  className="ui-link"
                  href="https://less.ripe.wtf/about"
                  target="_blank"
                  rel="noreferrer"
                >
                  $LESS
                </a>{" "}
                supply, Base uses an immutable linear step (0.0012 ETH base + 0.000036 ETH per
                mint).
              </p>
            )}
          </div>
          <div className="overlay-actions">
            <a id="overlay-build" className="overlay-button is-ghost is-glow" href="/build">
              Dig it
            </a>
            <a id="overlay-inspect" className="overlay-button is-ghost" href="/shaolin_deck">
              Inspect
            </a>
            <button id="overlay-about" className="overlay-button is-ghost" type="button">
              Dug it
            </button>
            <button id="enter-btn" className="overlay-button is-ghost" type="button">
              Bootleg it
            </button>
          </div>
          <div id="overlay-about-panel" className="overlay-about">
            <div className="overlay-about-head">
              <div className="overlay-section-title">Contextualized Rarity as Inversion</div>
              <button id="overlay-about-back" className="overlay-back" type="button">
                Back
              </button>
            </div>
            <p className="overlay-text">
              NFT-native digital art forces a reconsideration of rarity. In a medium where images
              are infinitely replicable and traits are algorithmically enumerable, scarcity at the
              level of form is largely synthetic.
            </p>
            <p className="overlay-text">
              Cubixles starts from a different premise: the only element that is conceptually rare
              in NFT space is contextualized provenance.
            </p>
            <p className="overlay-text">
              Images can be copied. Styles can be forked. Traits can be regenerated.
            </p>
            <p className="overlay-text">
              But the specific, verifiable context of ownership relations - who owned what, when,
              and how those works were brought into relation - is irreducible.
            </p>
            <p className="overlay-text">
              Cubixles consolidates this insight into three aligned layers:
            </p>
            <ul className="overlay-steps overlay-dig-list">
              <li>
                <span className="overlay-em">Principle:</span> Rarity in NFTs does not emerge from
                visual uniqueness, but from contextualized lineage - the historically specific
                configuration of provenance mapped onto ownership and reference.
              </li>
              <li>
                <span className="overlay-em">Primitive:</span> Provenance itself becomes the creator
                market primitive: a composable, ownership-verified relation between tokens.
              </li>
              <li>
                <span className="overlay-em">Mechanism:</span> The minting process binds the
                verifiable provenance of NFTs a user already owns into a new token, making
                contextual rarity executable and material.
              </li>
            </ul>
            <p className="overlay-text">
              Builder mints snapshot live floor data to set the Feingehalt, deploy a per-mint
              royalty forwarder so the minter controls future splits, and generate a wallet-seeded
              paper clip sculpture (with QR) pinned to IPFS as the display image, plus a p5.js
              inspector capture of the cube at mint.
            </p>
            <p className="overlay-text">
              In this framework, rarity is no longer a property of images or traits. It is a
              property of relations.
            </p>
          </div>
        </div>
      </div>
      <div id="toast-root" className="toast-root" aria-live="polite" aria-atomic="true"></div>
      <div id="confetti-root" className="confetti-root" aria-hidden="true"></div>
      <div id="wallet-picker" className="wallet-picker is-hidden" role="dialog" aria-modal="true">
        <div className="wallet-picker-card">
          <div className="wallet-picker-head">
            <div className="wallet-picker-title">Choose a wallet</div>
            <button id="wallet-picker-close" className="wallet-picker-close" type="button">
              Close
            </button>
          </div>
          <div id="wallet-picker-list" className="wallet-picker-list"></div>
          <div className="wallet-picker-note">
            Select a browser wallet to connect. WalletConnect is used when no browser wallets are
            detected.
          </div>
        </div>
      </div>
      <div
        id="network-picker"
        className="network-picker is-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="network-picker-card">
          <div className="network-picker-head">
            <div className="network-picker-title">Choose a network</div>
            <button id="network-picker-close" className="network-picker-close" type="button">
              Close
            </button>
          </div>
          <div id="network-picker-list" className="network-picker-list"></div>
          <div className="network-picker-note">
            Your selection controls which chain is used for NFTs, minting, and metadata.
          </div>
        </div>
      </div>
      <div
        id="mint-confirm"
        className="mint-confirm is-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mint-confirm-title"
      >
        <div className="mint-confirm-card">
          <div className="mint-confirm-head">
            <div id="mint-confirm-title" className="mint-confirm-title">
              Mint flow
            </div>
            <button id="mint-confirm-close" className="mint-confirm-close" type="button">
              Not yet
            </button>
          </div>
          <div className="mint-confirm-sub">
            Expect a mix of wallet prompts and short waits:
          </div>
          <ol className="mint-confirm-steps">
            <li>
              Confirm the commit transaction{" "}
              <span className="mint-confirm-fee">(only network fee)</span>.
            </li>
            <li className="mint-confirm-wait">Wait for the reveal block to open.</li>
            <li>
              Sign the metadata pin request{" "}
              <span className="mint-confirm-fee">(signature only)</span>.
            </li>
            <li>
              Confirm the metadata commit transaction{" "}
              <span className="mint-confirm-fee">(only network fee)</span>.
            </li>
            <li className="mint-confirm-wait">Wait for metadata confirmation.</li>
            <li>
              Confirm the final mint transaction{" "}
              <span className="mint-confirm-fee">(mint fee + network fee)</span>.
            </li>
            <li className="mint-confirm-wait">Wait for mint confirmation.</li>
          </ol>
          <div className="mint-confirm-actions">
            <button
              id="mint-confirm-continue"
              className="overlay-button is-glow"
              type="button"
            >
              Let's do it
            </button>
          </div>
        </div>
      </div>
      {!isBuilder ? (
        <>
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
        </>
      ) : null}
      <div id="base-mint-hud" className="base-mint-hud is-hidden" aria-hidden="true">
        <div className="base-mint-hud-label">Base mint (original)</div>
        <div id="base-mint-hud-value" className="base-mint-hud-value">
          Mint price: —
        </div>
        <div className="base-mint-hud-note">Immutable linear pricing.</div>
      </div>
      <div id="token-view-status" className="token-view-status is-hidden">
        Loading token...
      </div>
      <div id="ui" className="ui-panel">
        <div className="ui-title is-logotype" aria-label="cubixles_">
          <span className="logo-mark" aria-hidden="true">
            {"\uE000"}
          </span>
          <span className="sr-only">cubixles_</span>
        </div>
        <div className="ui-sub">
          {isBuilder
            ? "Builder mint: price is 10% of snapshot floor totals (0.001 ETH min per face)."
            : "Mint cubixles_: NFTs linked to interactive p5.js artwork whose provenance is tethered to NFTs you already own."}
        </div>
        <div className="ui-row">
          <button id="wallet-connect" className="ui-button ui-button--hook" type="button">
            <span className="ui-button-label">Connect Wallet</span>
            <span className="ui-button-hook" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="ui-button-hook-icon" focusable="false">
                <path d="M5 3v5a3 3 0 0 0 3 3h4" />
              </svg>
            </span>
          </button>
          <button id="wallet-disconnect" className="ui-button is-ghost" type="button">
            Disconnect
          </button>
        </div>
        <div id="wallet-status" className="ui-hint">
          Wallet: not connected.
        </div>
        <div id="network-status" className="ui-hint">
          Network: —
        </div>
        <div className="ui-row">
          <button id="network-select" className="ui-button is-ghost ui-button--stacked" type="button">
            <span className="ui-button-label">Choose network</span>
            <span id="network-select-subtitle" className="ui-button-subtitle">
              currently connected to: —
            </span>
          </button>
        </div>
        <div className="ui-row">
          <button id="leaderboard-open" className="ui-button is-ghost is-hidden" type="button">
            Leaderboard
          </button>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">NFT picker</div>
          <div id="nft-status" className="ui-hint">
            Connect your wallet to load NFTs.
          </div>
          <div className="ui-row">
            <button id="nft-refresh" className="ui-button is-ghost" type="button">
              Refresh NFTs
            </button>
            <button id="nft-clear" className="ui-button is-ghost" type="button">
              Clear selection
            </button>
            <button id="nft-apply" className="ui-button ui-button--hook" type="button">
              <span className="ui-button-label">Apply to cube</span>
              <span className="ui-button-hook" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="ui-button-hook-icon" focusable="false">
                  <path d="M5 3v5a3 3 0 0 0 3 3h4" />
                </svg>
              </span>
            </button>
            <button id="ui-preview" className="ui-button ui-preview-btn is-preview-dark" type="button">
              Preview
            </button>
          </div>
          <div id="nft-selection" className="ui-hint">
            Selected 0 / 6
          </div>
          <div id="nft-grid" className="ui-grid"></div>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">{isBuilder ? "Builder mint" : "Mint"}</div>
          <div id="mint-status" className="ui-hint">
            Connect your wallet to mint.
          </div>
          <div id="commit-progress" className="commit-progress">
            <div className="commit-progress-bar"></div>
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
            <button id="mint-submit" className="ui-button ui-button--hook" type="button">
              <span className="ui-button-label">Mint NFT</span>
              <span className="ui-button-hook" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="ui-button-hook-icon" focusable="false">
                  <path d="M5 3v5a3 3 0 0 0 3 3h4" />
                </svg>
              </span>
            </button>
          </div>
          <div className="ui-row">
            <button
              id="mint-cancel-commit"
              className="ui-button is-ghost is-hidden"
              type="button"
            >
              Cancel commit
            </button>
          </div>
          <div id="mint-price" className="ui-hint">
            Mint price: —
          </div>
          <div id="mint-price-note" className="ui-hint is-accent">
            {isBuilder ? (
              "Builder price is based on current collection floors (signed quote required)."
            ) : (
              <>
                Mint price rises as{" "}
                <a
                  className="ui-link"
                  href="https://less.ripe.wtf/about"
                  target="_blank"
                  rel="noreferrer"
                >
                  $LESS
                </a>{" "}
                supply drops.
              </>
            )}
          </div>
        </div>
        {isBuilder ? (
          <div className="ui-section">
            <div id="builder-error" className="ui-hint is-error is-hidden">
              —
            </div>
          </div>
        ) : null}
        <div className="ui-row">
          <button id="ui-landing" className="ui-button is-ghost" type="button">
            Landing
          </button>
          {isBuilder ? (
            <button id="paperclip-open" className="ui-button is-ghost" type="button">
              View paper clip
            </button>
          ) : null}
        </div>
        <div className="ui-row minted-links">
          <div id="minted-banner" className="minted-banner is-hidden">
            <a
              className="minted-link"
              href="https://opensea.io/collection/cubixles"
              target="_blank"
              rel="noreferrer"
            >
              <img src="https://static.seadn.io/logos/Logomark-Blue.png" alt="OpenSea" />
            </a>
          </div>
          <a
            className="deepwiki-badge"
            href="https://deepwiki.com/danyel-ii/cubixles_"
            target="_blank"
            rel="noreferrer"
          >
            <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" />
          </a>
        </div>
      </div>
      <div id="preview-bar" className="preview-bar is-hidden">
        <button id="preview-back" className="ui-button is-ghost" type="button">
          Back to controls
        </button>
      </div>
      <div id="leaderboard" className="ui-panel is-hidden">
        <div className="ui-title">Leaderboard</div>
        <div className="ui-sub">
          {isBuilder
            ? "Builder leaderboard ranked by Feingehalt (snapshot mint price)."
            : "Mint history powered by $LESS supply snapshots."}
        </div>
        <div className="ui-section">
          <div className="ui-section-title">
            {isBuilder ? "Feingehalt + Royalties" : "$LESS + Minting"}
          </div>
          {isBuilder ? (
            <p className="ui-text">
              Builder mints set Feingehalt at 10% of snapshot floor totals (0.001 ETH min per
              face). Each mint deploys a royalty forwarder owned by the minter so they can set
              splits and update future royalty recipients.
            </p>
          ) : (
            <p className="ui-text">
              Mint fees and resale royalties route through the RoyaltySplitter. When swaps are
              enabled, 25% of the ETH is sent to the owner, 25% is swapped to $LESS (sent to the
              owner), and 50% is swapped to $PNKSTR (sent to the owner). If swaps are disabled or
              fail, all ETH is forwarded to the owner.
            </p>
          )}
        </div>
        <div className="ui-section">
          <div className="ui-section-title">How the leaderboard works</div>
          {isBuilder ? (
            <p className="ui-text">
              Each builder token stores its Feingehalt at mint time. The leaderboard ranks tokens
              by highest Feingehalt (snapshot floor totals), so higher-value cubes surface first.
            </p>
          ) : (
            <p className="ui-text">
              Each mint snapshots total $LESS supply. The leaderboard ranks tokens by ΔLESS — the
              drop in total supply since the token’s last transfer. Earlier mint and longer holds
              contribute to bigger ΔLESS.
            </p>
          )}
        </div>
        <div className="ui-section">
          <div className="ui-section-title">Contract</div>
          <div id="leaderboard-contract" className="ui-hint"></div>
          <div id="leaderboard-chain" className="ui-hint"></div>
          <div id="leaderboard-supply" className="ui-hint"></div>
          <div id="leaderboard-updated" className="ui-hint"></div>
        </div>
        <div className="ui-section">
          <div className="ui-section-title">{isBuilder ? "Top Feingehalt" : "Top ΔLESS"}</div>
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
      {isBuilder ? (
        <div
          id="paperclip-panel"
          className="paperclip-panel is-hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="paperclip-backdrop" data-paperclip-close="true"></div>
          <div className="paperclip-card">
            <div className="paperclip-head">
              <div className="paperclip-title">CubesPaperClip</div>
              <button id="paperclip-close" className="paperclip-close" type="button">
                Close
              </button>
            </div>
            <div id="paperclip-status" className="paperclip-status">
              Connect your wallet to render the sculpture.
            </div>
            <div className="paperclip-canvas-wrap">
              <canvas id="paperclip-canvas" className="paperclip-canvas"></canvas>
            </div>
          </div>
        </div>
      ) : null}
      <main id="app"></main>
    </>
  );
}
