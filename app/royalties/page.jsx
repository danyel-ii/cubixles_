export default function RoyaltiesPage() {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-title is-logotype" aria-label="cubixles_">
          <span className="logo-mark" aria-hidden="true">
            {"\uE000"}
          </span>
          <span className="sr-only">cubixles_</span>
        </div>
        <div className="overlay-sub">Royalties</div>
        <p className="overlay-text">
          Royalties apply to secondary sales. Builder mints use a per-token royalty forwarder you
          can configure, while bootlegger mints follow the legacy royalty splitter defaults.
        </p>

        <div className="overlay-section">
          <div className="overlay-section-title">Builder mint defaults</div>
          <p className="overlay-text">
            Builder mints set ERC-2981 royalties at 10% (1000 bps). Each token deploys a{" "}
            <span className="overlay-em">BuilderRoyaltyForwarder</span> that receives resale
            royalties.
          </p>
          <ul className="overlay-steps">
            <li>Default split is 100% to the minting wallet (the forwarder owner).</li>
            <li>
              Find the forwarder with{" "}
              <span className="overlay-em">royaltyForwarderByTokenId(tokenId)</span> on the builder
              minter contract.
            </li>
            <li>
              Call <span className="overlay-em">setSplits(recipients, bps)</span> from the owner to
              define splits. Total bps must be &lt;= 10000; any remainder routes to the owner.
            </li>
            <li>
              Use <span className="overlay-em">getSplits()</span> to read splits,{" "}
              <span className="overlay-em">withdrawPending()</span> to claim ETH, and{" "}
              <span className="overlay-em">sweepToken(token, recipient)</span> to recover ERC-20s.
            </li>
          </ul>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Bootlegger mint defaults</div>
          <p className="overlay-text">
            Legacy CubixlesMinter mints set resale royalties at 5% (500 bps) and route them to the
            shared RoyaltySplitter contract.
          </p>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Mint-time payouts</div>
          <p className="overlay-text">
            Builder mint pricing is separate from resale royalties. Each referenced NFT receives
            8.5% of the total mint price when its ERC-2981 royaltyInfo is available; otherwise, that
            share routes to the builder payout address.
          </p>
        </div>

        <div className="overlay-actions">
          <a className="overlay-button is-ghost" href="/">
            Back to cubixles.xyz
          </a>
        </div>
      </div>
    </div>
  );
}
