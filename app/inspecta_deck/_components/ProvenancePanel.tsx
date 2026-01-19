"use client";

import PanelExplanation from "./PanelExplanation";
import type { FaceDefinition } from "../_data/landing-provenance";

type ProvenanceMode = "compositional" | "custody";

type ProvenancePanelProps = {
  mode: ProvenanceMode;
  onModeToggle: () => void;
  activeFace: FaceDefinition;
  visualFaces: FaceDefinition[];
  canonicalFaces: FaceDefinition[];
  ownershipHistory: string[];
  ownershipNote: string;
};

export default function ProvenancePanel({
  mode,
  onModeToggle,
  activeFace,
  visualFaces,
  canonicalFaces,
  ownershipHistory,
  ownershipNote,
}: ProvenancePanelProps) {
  const isCompositional = mode === "compositional";

  return (
    <section className="provenance-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Provenance disclosure</p>
          <h2 className="panel-title">
            {isCompositional ? "Compositional provenance" : "Custody provenance"}
          </h2>
        </div>
        <button type="button" className="panel-toggle" onClick={onModeToggle}>
          Switch to {isCompositional ? "custody" : "compositional"} provenance
        </button>
      </div>
      {isCompositional ? (
        <>
          <div className="panel-order-grid">
            <div className="panel-order-card">
              <div className="panel-label">
                Visual order · refsFaces
                <PanelExplanation
                  summary="The list mirrors the view you just saw."
                  description="Faces are sorted so the hero cube and the roster stay in sync, making the front face traceable back to its citation."
                />
              </div>
              <ul className="panel-list">
                {visualFaces.map((face) => (
                  <li key={face.id}>
                    <span className="panel-ref-title">{face.title}</span>
                    <span className="panel-ref-hash">{face.hash}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel-order-card">
              <div className="panel-label">
                Canonical order · refsCanonical
                <PanelExplanation
                  summary="The canonical ordering is deterministic."
                  description="It follows +X → −X → +Y → −Y → +Z → −Z so any reconstruction or audit can rehydrate the same sequence regardless of rotation."
                />
              </div>
              <ul className="panel-list">
                {canonicalFaces.map((face) => (
                  <li key={`canonical-${face.id}`}>
                    {face.title} · {face.hash}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="panel-active-face">
            <div className="panel-face-heading">
              <span className="panel-face-label">
                Active face
                <PanelExplanation
                  summary="This face is what you are seeing now."
                  description="When the cube spins, whichever face points toward you stays highlighted and retains the palette, hash, and lineage from its source NFT."
                />
              </span>
              <span className="panel-face-name">{activeFace.title}</span>
            </div>
            <p className="panel-face-hash">{activeFace.hash}</p>
            <p className="panel-face-desc">
              This face is derived from {activeFace.description}
            </p>
            <p className="panel-note">Full constituent metadata preserved.</p>
          </div>
        </>
      ) : (
        <div className="panel-custody">
          <p className="panel-label">
            Owner history (mock)
            <PanelExplanation
              summary="Custody tracks signatures, not why."
              description="This mock history shows the signing chain; it cannot express the creative choices or citations that fed the cube."
            />
          </p>
          <ul className="panel-list">
            {ownershipHistory.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          <p className="panel-note">{ownershipNote}</p>
        </div>
      )}
    </section>
  );
}
