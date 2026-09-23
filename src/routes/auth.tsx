import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Page } from "@/components/wire/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Wire Tap" },
      {
        name: "description",
        content:
          "Sign in to Wire Tap to ask the waiver advisor about your roster and keep every answer saved to your account.",
      },
      { property: "og:title", content: "Sign in to Wire Tap" },
      {
        property: "og:description",
        content: "Save your waiver questions and advisor answers to your Wire Tap account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ask" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/ask` },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice("Check your email for a confirmation link, then come back and sign in.");
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate({ to: "/ask" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in didn't complete. Try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/ask" });
  }

  return (
    <Page format="ppr">
      <section className="mx-auto max-w-sm space-y-5 rounded-xl border border-border bg-card p-5">
        <div>
          <h1 className="font-display text-2xl uppercase leading-none">
            {mode === "signin" ? "Sign in" : "Create an account"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Your waiver questions and the advisor's answers are saved to your account, so you can
            look them up any week from any device.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full font-bold uppercase tracking-tight"
        >
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-wide">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-wide">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={busy}
            className="w-full font-bold uppercase tracking-tight"
          >
            {mode === "signin" ? "Sign in with email" : "Sign up with email"}
          </Button>
        </form>

        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}

        <button
          type="button"
          className="w-full text-[11px] font-bold uppercase tracking-wide text-turf underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </Page>
  );
}
