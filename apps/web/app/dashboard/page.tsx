"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { SessionResponse, SessionUser } from "@/types/api";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data, unauthorized } =
        await apiFetch<SessionResponse>("/auth/session");

      if (unauthorized || !data?.success || !data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);
      setLoading(false);
    };

    void run();
  }, [router]);

  if (loading) {
    return (
      <main>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          Signed in as:{" "}
          <strong>{user?.username || user?.name || "Unknown"}</strong>
        </p>
        <p>
          Role: <strong>{user?.role || "unknown"}</strong>
        </p>
        <p>
          Email: <strong>{user?.email || "not provided"}</strong>
        </p>
      </div>

      <p style={{ marginTop: "1rem" }}>
        <Link href="/">Back to migration home</Link>
      </p>
    </main>
  );
}
