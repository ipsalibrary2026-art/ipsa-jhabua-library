"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppCard() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    function handlePrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Smartphone className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-900">Install the library app</p>
          <p className="mt-0.5 max-w-lg text-sm leading-relaxed text-slate-600">
            {installed
              ? "IPSA College Library is installed on this device and opens like a native app."
              : "Add IPSA College Library to your home screen for faster access to issued books and due dates."}
          </p>
          {!installed && !promptEvent ? (
            <p className="mt-1 text-xs text-slate-500">
              On Android, open the browser menu and choose “Install app” or “Add to Home screen”.
            </p>
          ) : null}
        </div>
      </div>
      {installed ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Installed
        </span>
      ) : (
        <Button onClick={handleInstall} disabled={!promptEvent} className="w-fit">
          <Download className="size-4" /> Install app
        </Button>
      )}
    </div>
  );
}
