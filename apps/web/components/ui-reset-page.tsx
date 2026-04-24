import Link from "next/link";

export function UiResetPage({
  title,
  description = "This web screen was intentionally removed. It will be rebuilt from scratch later.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1rem",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "40rem",
          padding: "1.5rem",
          border: "1px solid #d8e1ec",
          borderRadius: "1rem",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#2563eb",
          }}
        >
          Web UI removed
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: "0.9rem 0 0",
            color: "#5f6f85",
            lineHeight: 1.65,
          }}
        >
          {description}
        </p>
        <p style={{ margin: "1rem 0 0", color: "#5f6f85" }}>
          Available routes can be redesigned later without the previous UI
          layer.
        </p>
        <p style={{ margin: "1rem 0 0" }}>
          <Link href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
            Return home
          </Link>
        </p>
      </section>
    </main>
  );
}
