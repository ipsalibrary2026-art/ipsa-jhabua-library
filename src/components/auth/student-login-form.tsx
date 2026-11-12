"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StudentLoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [collegeCode, setCollegeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const lookup = await fetch("/api/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeCode }),
      });
      const lookupData = (await lookup.json()) as { email?: string; error?: string };

      if (!lookup.ok || !lookupData.email) {
        setError(lookupData.error ?? "We could not find that college code.");
        return;
      }

      const result = await authClient.signIn.email({
        email: lookupData.email,
        password,
      });

      if (result.error) {
        setError(
          result.error.status === 401
            ? "Incorrect password. Check your password and try again."
            : (result.error.message ?? "Unable to sign in right now."),
        );
        return;
      }

      if (result.data?.user.role !== "student") {
        await authClient.signOut();
        setError("This is not a student account.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="collegeCode">College code</Label>
          <Input
            id="collegeCode"
            name="collegeCode"
            value={collegeCode}
            onChange={(event) => setCollegeCode(event.target.value)}
            placeholder="IPSA2024001"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className="h-11 text-base uppercase placeholder:normal-case"
          />
          <p className="text-xs text-slate-500">
            Your college code was issued by the library administrator.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-11 pr-11 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in to my library <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3.5 text-sm">
        <p className="font-medium text-blue-950">Demo student access</p>
        <p className="mt-0.5 text-blue-800">
          College code <span className="font-mono text-xs font-semibold">IPSA2024001</span> · Password{" "}
          <span className="font-mono text-xs font-semibold">Student@123</span>
        </p>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-5 text-sm">
        <p className="text-slate-600">
          Library staff?{" "}
          <Link href="/admin/login" className="font-medium text-blue-700 hover:underline">
            Go to administrator login
          </Link>
        </p>
        <p className="text-xs leading-relaxed text-slate-500">
          Student accounts are created by the library administrator. Self-registration is not
          available.
        </p>
      </div>
    </div>
  );
}
