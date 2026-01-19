"use client";

import { useEffect, useId, useState } from "react";

export default function DigItOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="landing-button secondary landing-button-dig"
        onClick={() => setIsOpen(true)}
      >
        Dig it
      </button>
      {isOpen && (
        <div className="dig-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            className="dig-overlay-backdrop"
            aria-label="Close overlay"
            onClick={() => setIsOpen(false)}
          />
          <div className="dig-overlay-panel">
            <div className="dig-overlay-header">
              <h2 className="dig-overlay-title" id={titleId}>
                Contextualized Rarity as Inversion
              </h2>
              <button
                type="button"
                className="dig-overlay-close"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="dig-overlay-body">
              <p>
                NFT-native digital art forces a reconsideration of rarity. In a medium where
                images are infinitely replicable and traits are algorithmically enumerable,
                scarcity at the level of form is largely synthetic.
              </p>
              <p>
                Cubixles starts from a different premise: the only element that is
                conceptually rare in NFT space is contextualized provenance.
              </p>
              <div className="dig-overlay-staccato">
                <span>Images can be copied.</span>
                <span>Styles can be forked.</span>
                <span>Traits can be regenerated.</span>
              </div>
              <p>
                But the specific, verifiable context of ownership relations - who owned
                what, when, and how those works were brought into relation - is irreducible.
              </p>
              <p>Cubixles consolidates this insight into three aligned layers:</p>
              <dl className="dig-overlay-layers">
                <div>
                  <dt>Principle</dt>
                  <dd>
                    Rarity in NFTs does not emerge from visual uniqueness, but from
                    contextualized lineage - the historically specific configuration of
                    ownership and reference.
                  </dd>
                </div>
                <div>
                  <dt>Primitive</dt>
                  <dd>
                    Provenance itself becomes the creator market primitive: a composable,
                    ownership-verified relation between tokens.
                  </dd>
                </div>
                <div>
                  <dt>Mechanism</dt>
                  <dd>
                    The minting process binds the verifiable provenance of NFTs a user
                    already owns into a new token, making contextual rarity executable and
                    material.
                  </dd>
                </div>
              </dl>
              <p>
                In this framework, rarity is no longer a property of images or traits. It is
                a property of relations.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
