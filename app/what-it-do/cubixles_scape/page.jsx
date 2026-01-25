import "../what-it-do.css";

const CUBIXLES_SCAPE_URL =
  process.env.NEXT_PUBLIC_CUBIXLES_SCAPE_DEV_URL ||
  "/what-it-do/cubixles_scape/index.html";

export const dynamic = "force-dynamic";

export default function GrandTheftPage() {
  return (
    <div className="where-to-page">
      <section className="where-to-stage">
        <div className="where-to-frame">
          <iframe
            title="cubixles_scape"
            src={CUBIXLES_SCAPE_URL}
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
