"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import CubixlesText from "../_components/CubixlesText.jsx";

function readBoolParam(params, key) {
  if (!params?.has(key)) {
    return false;
  }
  const value = params.get(key);
  if (value === null || value === "") {
    return true;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}

export default function AppShell({ mode = "mint" }) {
  const isBuilder = mode === "builder";
  const searchParams = useSearchParams();
  const skipOverlay = readBoolParam(searchParams, "skipOverlay");
  const overlayHidden = isBuilder || skipOverlay;
  const mintConfirmTitle = isBuilder ? "Builder mint flow" : "Mint flow";
  const mintConfirmSub = isBuilder
    ? "Expect a couple of signatures and a final on-chain mint:"
    : "Expect a mix of wallet prompts and short waits:";
  const mintConfirmSteps = isBuilder ? (
    <>
      <li>Review the signed builder quote (no wallet prompt).</li>
      <li>
        Sign the builder asset pin request{" "}
        <span className="mint-confirm-fee">(signature only)</span>.
      </li>
      <li>
        Sign the builder metadata pin request{" "}
        <span className="mint-confirm-fee">(signature only)</span>.
      </li>
      <li>
        Confirm the builder mint transaction{" "}
        <span className="mint-confirm-fee">(mint fee + network fee)</span>.
      </li>
      <li className="mint-confirm-wait">Wait for mint confirmation.</li>
    </>
  ) : (
    <>
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
    </>
  );

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
      <div id="overlay" className={`overlay${overlayHidden ? " is-hidden" : ""}`}>
        <div className="overlay-card">
          <div className="overlay-title is-logotype" aria-label="cubixles_">
            <span className="logo-mark" aria-hidden="true">
              {"\uE000"}
            </span>
            <span className="sr-only">cubixles_</span>
          </div>
          <div className="overlay-sub">
            <CubixlesText text="cubixles_ is an ERC-721 experiment in defining and exercising productive rights in NFT ownership:" />
          </div>
          <p className="overlay-text">
            <CubixlesText text="In cubixles_, ownership functions as the right to compose, curate, and externalize context without transferring or encumbering the originals." />
          </p>
          <p className="overlay-text">
            Each cubixle is an ERC-721 whose artistic identity is defined by, and whose provenance
            is anchored to, an ownership-verified configuration of existing NFTs you already own.
          </p>
          <div className="overlay-section">
            <div className="overlay-section-title">How it works</div>
            <ol className="overlay-steps">
              <li>Connect your wallet.</li>
              <li>Select 1–6 NFTs you own.</li>
              <li>We snapshot key metadata (and collection floors when available).</li>
              <li>The interactive artwork and metadata are pinned to IPFS.</li>
              <li>You sign the mint transaction on the selected network.</li>
            </ol>
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">What gets minted</div>
            {isBuilder ? (
              <>
                <p className="overlay-text">An ERC-721 with:</p>
                <ul className="overlay-steps">
                  <li>hosted metadata pinned during the mint flow, and</li>
                  <li>
                    an <span className="overlay-em">external_url</span> pointing to your IPFS-hosted
                    interactive cube,
                  </li>
                  <li>and your right to set future royalties in the splitter contract.</li>
                </ul>
                <p className="overlay-text">
                  <CubixlesText text="The referenced NFTs remain fully independent assets. The cubixle does not contain, escrow, or substitute them -- cubixles_ record their configuration." />
                </p>
              </>
            ) : (
              <>
                <p className="overlay-text">An ERC-721 with:</p>
                <ul className="overlay-steps">
                  <li>hosted metadata pinned during the mint flow, and</li>
                  <li>
                    an <span className="overlay-em">external_url</span> pointing to your IPFS-hosted
                    interactive cube.
                  </li>
                </ul>
                <p className="overlay-text">
                  <CubixlesText text="The referenced NFTs remain fully independent assets. The cubixle does not contain, escrow, or substitute them -- cubixles_ record their configuration." />
                </p>
              </>
            )}
          </div>
          <div className="overlay-section">
            <div className="overlay-section-title">Mint pricing</div>
            {isBuilder ? (
              <>
                <p className="overlay-text">
                  <span className="overlay-em">Builder mints</span>
                </p>
                <p className="overlay-text">
                  0.0055 ETH + 5% of snapshot floor totals (0.01 ETH fallback per face).
                </p>
                <ul className="overlay-steps">
                  <li>Each referenced NFT receives 8.5% of the total mint price.</li>
                  <li>Remaining value routes to the builder payout address.</li>
                  <li>Builder mints deploy a per-token royalty forwarder owned by the minter.</li>
                </ul>
                <p className="overlay-text">
                  <span className="overlay-em">Bootlegger mints</span>
                </p>
                <p className="overlay-text">Use an alternative pricing and royalty model.</p>
              </>
            ) : (
              <>
                <p className="overlay-text">
                  Legacy mints follow the CubixlesMinter pricing model (LESS supply-based pricing
                  on mainnet, linear step pricing on Base, or fixed pricing when configured).
                </p>
                <p className="overlay-text">
                  Resale royalties default to 5% and route to the shared RoyaltySplitter.
                </p>
              </>
            )}
          </div>
          <div className="overlay-actions">
            <a id="overlay-build" className="overlay-button overlay-button--dig" href="/build">
              Mint
            </a>
            <a id="overlay-inspect" className="overlay-button is-ghost" href="/shaolin_deck">
              Inspect
            </a>
            <a
              id="enter-btn"
              className="overlay-button is-ghost overlay-button--bootleg"
              href="/inspecta_deck"
            >
              Bootleg it
            </a>
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
              Builder mints snapshot live floor data to set the Feingehalt, route 8.5% of the total
              mint price to each referenced NFT royalty receiver, deploy a per-mint royalty
              forwarder so the minter controls future splits, and generate a wallet-seeded paper
              clip sculpture (with QR) pinned to IPFS as the display image, plus a p5.js inspector
              capture of the cube at mint.
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
              {mintConfirmTitle}
            </div>
            <button id="mint-confirm-close" className="mint-confirm-close" type="button">
              Not yet
            </button>
          </div>
          <div className="mint-confirm-sub">{mintConfirmSub}</div>
          <ol className="mint-confirm-steps">{mintConfirmSteps}</ol>
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
      {isBuilder ? (
        <div
          id="builder-mint-success"
          className="mint-confirm is-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="builder-mint-success-title"
        >
          <div className="mint-confirm-card">
            <div className="mint-confirm-head">
              <div id="builder-mint-success-title" className="mint-confirm-title">
                Builder mint confirmed
              </div>
              <button
                id="builder-mint-success-close"
                className="mint-confirm-close"
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mint-confirm-sub">Your builder cubixle is minted.</div>
            <ol className="mint-confirm-steps">
              <li>
                <a
                  id="builder-mint-success-link"
                  className="ui-link"
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on Etherscan
                </a>
              </li>
              <li>
                Call{" "}
                <code
                  id="builder-mint-success-forwarder-call"
                  className="mint-confirm-code"
                ></code>{" "}
                on CubixlesBuilderMinter to find your royalty forwarder.
              </li>
            </ol>
          </div>
        </div>
      ) : null}
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
          {isBuilder ? (
            "Builder mint: price is 0.0055 ETH + 5% of snapshot floor totals (0.01 ETH fallback per face)."
          ) : (
            <CubixlesText text="Mint cubixles_: NFTs linked to interactive p5.js artwork whose provenance is tethered to NFTs you already own." />
          )}
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
              Builder mints set Feingehalt at 0.0055 ETH + 5% of snapshot floor totals (0.01 ETH
              fallback per face). Each referenced NFT receives 8.5% of the total mint price, and
              each mint deploys a royalty forwarder owned by the minter so they can set splits and
              update future royalty recipients.
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
