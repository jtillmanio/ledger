export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main style={{ maxWidth: "22rem", paddingTop: "20vh" }}>
      <h1>Ledger</h1>
      <form action="/api/login" method="post">
        <input type="hidden" name="next" value={next} />
        <input type="password" name="passcode" placeholder="Passcode" autoFocus
               aria-label="Passcode" autoComplete="current-password" />
        {error && <p className="small tag-held" style={{ marginTop: "0.5rem" }}>
          That passcode didn&apos;t match.
        </p>}
        <p style={{ marginTop: "0.75rem" }}>
          <button className="primary" type="submit">Open ledger</button>
        </p>
      </form>
    </main>
  );
}
