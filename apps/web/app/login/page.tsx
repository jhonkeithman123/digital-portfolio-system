"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface LoginResponse {
  success?: boolean;
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, ok } = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password, role }),
    });

    setLoading(false);

    if (!ok || !data?.success) {
      setError(data?.error || "Login failed");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main>
      <h1>Sign in</h1>
      <form className="card grid" onSubmit={onSubmit}>
        <label>
          Email or username
          <input
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "student" | "teacher")}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>

        {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
