"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, go to home
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid username or password.");
      return;
    }

    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900/80 p-6 shadow-xl ring-1 ring-slate-800">
        <h1 className="text-xl font-semibold tracking-tight">
          Noonan Leave Tracker
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Sign in as admin or member.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Username</label>
            <input
              type="text"
              className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-900/20 rounded px-2 py-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500 disabled:bg-slate-700"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
