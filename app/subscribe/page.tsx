"use client";
// app/subscribe/page.tsx
// Newsletter subscription page.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"en" | "np">("en");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "You're subscribed!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Stay informed
          </h1>
          <p className="text-muted-foreground text-sm">
            Get a daily bilingual briefing — Nepal and the world — straight to
            your inbox. No spam, ever.
          </p>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">
              Watch for your first briefing from Ekjhalak.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={status === "loading"}
                className="w-full"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Preferred language
              </p>
              <div className="flex gap-2">
                {(["en", "np"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className="flex-1"
                  >
                    <Badge
                      variant={lang === l ? "default" : "outline"}
                      className="w-full justify-center py-1.5 cursor-pointer text-sm"
                    >
                      {l === "en" ? "English" : "नेपाली"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {status === "error" && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={status === "loading" || !email.trim()}
            >
              {status === "loading" ? "Subscribing…" : "Subscribe for free"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By subscribing, you agree to receive email updates from Ekjhalak.
              Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
