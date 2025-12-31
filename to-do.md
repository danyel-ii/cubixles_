# cubixles_ — Planned Work (Draft)

Last updated: 2025-12-31

## Asset + IPFS plan
- Upload 10,000 in-wallet images to IPFS.
- Include a manifest JSON inside the same folder that maps random indices to filenames.
- Manifest will also include extra metadata fields to be merged into token metadata.
- Keep manifest CID immutable; treat it as source of truth.
- Images folder CID: `bafybeidguhrhckx2uvywlpvlb5ly7ams46ghtrz6afcfal5kf5ujkxtmyi`.
- Manifest CID: `bafybeihsvhetu5dhggwjxlqzq3anncamjbtnbawvrufxphjvpyvz5uvecm`.

## Metadata strategy
- Preserve current metadata (provenance, refs, animation_url, attributes).
- Merge new manifest fields into a combined metadata JSON at mint time.
- Standardize `image` for all tokens to a single shared GIF/MP4 (marketplace preview).
- Keep unique `animation_url` per token (IPFS cube viewer).

## Mint flow + randomness
- Move to streamlined commit-reveal.
- Auto-trigger commit tx, then auto-trigger reveal/mint tx.
- Use selected refs as the commit secret (no extra user input).
- Add a reasonable commit timeout/expiry.
- Explain the two transactions in human-readable terms in the wallet signing view.

## Contract + app updates
- Update contracts to support commit-reveal and onchain random index generation.
- Keep offchain manifest mapping (no full mapping onchain).
- Update app to use manifest CID + index for image resolution.
- Update deployment config after new CID is available.

## Auditing + tests
- Run a full security audit after contract changes.
- Add tests for:
  - Commit -> reveal happy path.
  - Timeout/expiry reverts.
  - Mismatched reveal (wrong refs/salt) reverts.
  - Random index bounds (0..9999).
  - Metadata merge integrity (no loss of current fields).

## Docs + Farcaster
- Update docs after passing audit.
- Update Farcaster manifest with new image URLs/metadata references.

## Gallery requirement
- Keep a persistent record of all pinned cube `animation_url`s.
- Build a `gallery.html` later with:
  - Grid layout.
  - Infinite scroll.
  - Lightbox with next/prev controls.
  - Lazy-loaded previews.

## Naming
- Rename application to "cubixles_" (scope includes UI strings, metadata, and docs).
