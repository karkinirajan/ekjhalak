"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertCircle, CheckCircle2, Mail, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

type Status = "idle" | "loading" | "success" | "error";

interface SubscribeModalProps {
  triggerLabel?: string;
  triggerClassName?: string;
}

export function SubscribeModal({
  triggerLabel = "Subscribe",
  triggerClassName,
}: SubscribeModalProps) {
  const { palette, language, t } = useTheme();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"en" | "np">(language);
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
        setMessage(data.message ?? t.subscribeSuccess);
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <Button
            className={cn("rounded-xl", palette.accent, triggerClassName)}
          />
        }
      >
        {triggerLabel}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border p-0 shadow-[0_24px_80px_rgba(0,0,0,0.35)] outline-none",
            palette.shell,
          )}
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10">
            <div className={cn("border-b px-5 py-4", palette.panel)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl border",
                      palette.accent,
                    )}
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.22em]",
                        palette.muted,
                      )}
                    >
                      {t.newsletter}
                    </p>
                    <h2 className={cn("text-lg font-semibold", palette.text)}>
                      {t.stayInformed}
                    </h2>
                  </div>
                </div>

                <Dialog.Close
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn("rounded-full border", palette.ghost)}
                    />
                  }
                >
                  <XIcon />
                  <span className="sr-only">{t.close}</span>
                </Dialog.Close>
              </div>
            </div>

            <div className="px-5 py-5">
              {status === "success" ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-[#1f6a4f]" />
                  <p className={cn("font-semibold", palette.text)}>{message}</p>
                  <p className={cn("text-sm", palette.subtext)}>
                    {t.subscribeSuccessNote}
                  </p>
                  <Button
                    className={cn("mt-2 rounded-xl", palette.accent)}
                    onClick={() => setOpen(false)}
                  >
                    {t.done}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className={cn("text-sm leading-relaxed", palette.subtext)}>
                    {t.subscribePitch}
                  </p>

                  <div>
                    <label
                      htmlFor="subscribe-email"
                      className={cn(
                        "mb-1.5 block text-sm font-medium",
                        palette.text,
                      )}
                    >
                      {t.emailAddress}
                    </label>
                    <Input
                      id="subscribe-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={status === "loading"}
                      className="w-full rounded-xl"
                    />
                  </div>

                  <div>
                    <p className={cn("mb-2 text-sm font-medium", palette.text)}>
                      {t.preferredLanguage}
                    </p>
                    <div className="flex gap-2">
                      {(["en", "np"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLang(value)}
                          className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all"
                          style={
                            lang === value
                              ? {
                                  backgroundColor: "#c53030",
                                  borderColor: "#8f1f1f",
                                  color: "#ffffff",
                                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.18)",
                                }
                              : {
                                  backgroundColor: "transparent",
                                  borderColor: "#97cdb7",
                                  color: "#1f6a4f",
                                }
                          }
                        >
                          {value === "en" ? "English" : "नेपाली"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {status === "error" && (
                    <div className="flex items-center gap-2 rounded-xl border border-[#d87777] bg-[#ffeceb] px-3 py-2 text-sm text-[#b42323] dark:border-[#7c2e2e] dark:bg-[#2b1214] dark:text-[#ffb5b5]">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {message}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={cn("w-full rounded-xl", palette.accent)}
                    disabled={status === "loading" || !email.trim()}
                  >
                    {status === "loading" ? t.subscribing : t.subscribeForFree}
                  </Button>

                  <p className={cn("text-center text-xs", palette.muted)}>
                    {t.subscribeLegal}
                  </p>
                </form>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
