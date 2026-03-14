import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Digital Portfolio - Next.js Migration</h1>
      <p>
        This app is a migration target running in parallel with your existing
        Vite client.
      </p>

      <div className="grid cols-2">
        <section className="card">
          <h2>Auth flow</h2>
          <p>Use server cookies and `/auth/session` for route guarding.</p>
          <Link href="/login">Go to login page</Link>
        </section>

        <section className="card">
          <h2>Protected area</h2>
          <p>
            Dashboard checks the active session from your current Express API.
          </p>
          <Link href="/dashboard">Open dashboard</Link>
        </section>
      </div>
    </main>
  );
}
