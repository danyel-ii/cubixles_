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
        <div className="overlay-sub">Setting Your Builder Royalty Forwarder</div>
        <p className="overlay-text">
          This primer explains how to set resale royalty splits for a builder mint after you have
          minted a cubixles_ builder token. The builder mint deploys a per-token
          BuilderRoyaltyForwarder that you (the minter) own. You can update the split at any time.
        </p>
        <p className="overlay-text">
          If you minted via the legacy/bootleg flow, this document does not apply. That flow uses
          the shared RoyaltySplitter; see{" "}
          <code className="overlay-inline-code">docs/royalty_setter.md</code>.
        </p>

        <div className="overlay-section">
          <div className="overlay-section-title">What gets created at mint</div>
          <ul className="overlay-steps">
            <li>A BuilderRoyaltyForwarder is cloned for your token.</li>
            <li>
              The token&apos;s ERC-2981 royalty receiver is set to that forwarder at 10% (1000
              bps).
            </li>
            <li>The forwarder owner is the wallet that minted the token.</li>
            <li>If no splits are set, 100% of royalties accrue to the owner.</li>
          </ul>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Step-by-step (Etherscan UI)</div>
          <ol className="overlay-steps">
            <li>
              Find your token id. Use the mint confirmation modal, the mint transaction, or your
              wallet&apos;s NFT view.
            </li>
            <li>
              Open the mainnet builder minter contract:{" "}
              <code className="overlay-inline-code">
                0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA
              </code>
              .
            </li>
            <li>
              Read the forwarder address: in Etherscan &quot;Read Contract&quot;, call{" "}
              <code className="overlay-inline-code">royaltyForwarderByTokenId(tokenId)</code>.
            </li>
            <li>Open the forwarder address in Etherscan.</li>
            <li>Connect the same wallet that minted the builder token.</li>
            <li>
              In &quot;Write Contract&quot;, call{" "}
              <code className="overlay-inline-code">setSplits(recipients, bps)</code>.{" "}
              <code className="overlay-inline-code">recipients</code> is an array of addresses.{" "}
              <code className="overlay-inline-code">bps</code> is an array of uint16 values in
              basis points. The sum of <code className="overlay-inline-code">bps</code> must be{" "}
              &lt;= 10000 (100%). Any remainder (if sum &lt; 10000) goes to the forwarder owner.
            </li>
            <li>
              Verify with <code className="overlay-inline-code">getSplits()</code> or{" "}
              <code className="overlay-inline-code">pending(address)</code>.
            </li>
          </ol>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Step-by-step (CLI with cast)</div>
          <ol className="overlay-steps">
            <li>
              Export your RPC URL and token id:
              <pre className="overlay-code">
                <code>{`export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export TOKEN_ID="4186"
export BUILDER_MINTER="0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA"`}</code>
              </pre>
            </li>
            <li>
              Read the forwarder address:
              <pre className="overlay-code">
                <code>{`cast call \\
  --rpc-url "$RPC_URL" \\
  "$BUILDER_MINTER" \\
  "royaltyForwarderByTokenId(uint256)(address)" \\
  "$TOKEN_ID"`}</code>
              </pre>
            </li>
            <li>
              Set splits (example below), signing with the minting wallet:
              <pre className="overlay-code">
                <code>{`export FORWARDER="0xYourForwarderAddress"
cast send \\
  --rpc-url "$RPC_URL" \\
  --private-key "$WALLET_PRIVATE_KEY" \\
  "$FORWARDER" \\
  "setSplits(address[],uint16[])" \\
  "[0xAlice...,0xBob...,0xTreasury...]" \\
  "[6000,2500,1500]"`}</code>
              </pre>
            </li>
            <li>
              Confirm the splits:
              <pre className="overlay-code">
                <code>{`cast call \\
  --rpc-url "$RPC_URL" \\
  "$FORWARDER" \\
  "getSplits()(address[],uint16[])"`}</code>
              </pre>
            </li>
          </ol>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Example split</div>
          <p className="overlay-text">Suppose you want:</p>
          <ul className="overlay-steps">
            <li>60% to Alice</li>
            <li>25% to Bob</li>
            <li>15% to Treasury</li>
          </ul>
          <p className="overlay-text">Use:</p>
          <ul className="overlay-steps">
            <li>
              <code className="overlay-inline-code">
                recipients = [alice, bob, treasury]
              </code>
            </li>
            <li>
              <code className="overlay-inline-code">bps = [6000, 2500, 1500]</code>
            </li>
          </ul>
          <p className="overlay-text">
            If you instead set <code className="overlay-inline-code">[6000, 2500]</code>, the
            remaining 15% automatically accrues to the forwarder owner.
          </p>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Withdrawing accrued royalties</div>
          <p className="overlay-text">
            Royalties are credited to <code className="overlay-inline-code">pending(address)</code>{" "}
            for each recipient. Each recipient withdraws their own balance by calling{" "}
            <code className="overlay-inline-code">withdrawPending()</code> from their wallet.
          </p>
        </div>

        <div className="overlay-section">
          <div className="overlay-section-title">Reset to 100% to the owner</div>
          <p className="overlay-text">
            To remove all splits and revert to the default (100% to the owner), call:
          </p>
          <pre className="overlay-code">
            <code>{`cast send \\
  --rpc-url "$RPC_URL" \\
  --private-key "$WALLET_PRIVATE_KEY" \\
  "$FORWARDER" \\
  "setSplits(address[],uint16[])" \\
  "[]" \\
  "[]"`}</code>
          </pre>
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
