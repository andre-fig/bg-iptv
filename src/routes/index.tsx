import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ListVideo } from "lucide-react";
import { parseM3U, type Channel } from "@/lib/m3u";
import { VideoPlayer } from "@/components/video-player";
import { ChannelList } from "@/components/channel-list";
import { PlaylistDialog } from "@/components/playlist-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const DEFAULT_PLAYLIST = "https://raw.githubusercontent.com/andre-fig/bg-iptv-script/main/playlist.m3u8";
const STORAGE_KEY = "bg-iptv:playlist-url";
const AUTO_RELOAD_MS = 5 * 60 * 1000; // 5 min

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BG IPTV — Телевизия на живо" },
      { name: "description", content: "Гледайте български телевизионни канали на живо чрез M3U плейлисти в модерен, оптимизиран за мобилни устройства плейър." },
      { property: "og:title", content: "BG IPTV — Телевизия на живо" },
      { property: "og:description", content: "Модерен IPTV плейър с поддръжка на M3U плейлисти." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [playlistUrl, setPlaylistUrl] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_PLAYLIST;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Migrate legacy URL that pointed to the old repo
    if (!stored || stored.includes("/bg-iptv/main/")) return DEFAULT_PLAYLIST;
    return stored;
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, playlistUrl);
    }
  }, [playlistUrl]);

  useEffect(() => {
    let cancelled = false;
    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(playlistUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const parsed = parseM3U(text);
        if (cancelled) return;
        setChannels(parsed);
        setSelected((prev) => (prev && parsed.find((c) => c.id === prev.id) ? prev : parsed[0] ?? null));
      } catch {
        if (!cancelled && !silent) {
          setError("Плейлистата не може да бъде заредена. Моля, проверете URL адреса.");
          setChannels([]);
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };
    load();
    const interval = window.setInterval(() => load(true), AUTO_RELOAD_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [playlistUrl]);

  const handleSelect = (c: Channel) => {
    setSelected(c);
    setDrawerOpen(false);
  };

  const headerCount = useMemo(() => channels.length, [channels]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="glass z-30 shrink-0 border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg font-bold text-primary-foreground shadow-[0_8px_24px_-8px_var(--brand)]">
              BG
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-base font-bold tracking-tight sm:text-lg">
                <span className="text-brand-gradient">BG</span> IPTV
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Българска телевизия на живо
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* Main — fills remaining height, no page scroll */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:gap-6">
        {/* Player column — fixed, internal stacking */}
        <section className="flex min-w-0 flex-1 flex-col gap-4 min-h-0">
          <VideoPlayer channel={selected} />

          {error && !channels.length && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Inline channel list — visible on all sizes when viewport is tall enough */}
          <div className="hidden min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card [@media(min-height:680px)_and_(max-aspect-ratio:1/1)]:flex">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Канали
                </h2>
                <div className="hidden lg:block">
                  <PlaylistDialog />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ChannelList
                  channels={channels}
                  selectedId={selected?.id}
                  onSelect={handleSelect}
                  loading={loading}
                />
              </div>
            </div>
          </div>

          {/* Drawer fallback — when viewport is too short for inline list */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="brand-gradient fixed bottom-4 left-1/2 z-20 flex h-12 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-full text-base font-semibold text-primary-foreground shadow-[0_12px_40px_-8px_var(--brand)] [@media(min-height:680px)_and_(max-aspect-ratio:1/1)]:hidden"
              >
                <ListVideo className="h-5 w-5" />
                Канали {channels.length > 0 && <span className="opacity-80">({channels.length})</span>}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-auto flex h-[85dvh] w-full max-w-lg flex-col gap-0 rounded-t-2xl border-border bg-background p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="font-display">Канали</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ChannelList
                  channels={channels}
                  selectedId={selected?.id}
                  onSelect={handleSelect}
                  loading={loading}
                />
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </main>
    </div>
  );
}
