import { useMemo, useState } from "react";
import { Search, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Channel } from "@/lib/m3u";
import { cn } from "@/lib/utils";

type Props = {
  channels: Channel[];
  selectedId?: string;
  onSelect: (c: Channel) => void;
  loading?: boolean;
};

export function ChannelList({ channels, selectedId, onSelect, loading = false }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("Всички");

  const groups = useMemo(() => {
    const s = new Set<string>();
    channels.forEach((c) => c.group && s.add(c.group));
    return ["Всички", ...Array.from(s).sort()];
  }, [channels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (group !== "Всички" && c.group !== group) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, query, group]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси канали..."
            className="h-10 rounded-lg border-border bg-input/50 pl-9 text-sm"
          />
        </div>

        {groups.length > 1 && (
          <div className="scrollbar-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  group === g
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <p className="mt-2 text-[11px] text-muted-foreground">
          {loading && channels.length === 0 ? "Зареждане..." : `${filtered.length} канала`}
        </p>
      </div>

      {/* List */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {loading && channels.length === 0 ? (
          <ul className="p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-md border border-border bg-surface" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <Tv className="h-8 w-8 opacity-50" />
            <p className="text-sm">Няма намерени канали</p>
          </div>
        ) : (
          <ul className="p-2">
            {filtered.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-all",
                      active
                        ? "bg-primary/15 ring-1 ring-primary/40"
                        : "hover:bg-surface-elevated"
                    )}
                  >
                    <div
                      className={cn(
                        "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface",
                        active && "border-primary/50"
                      )}
                    >
                      {c.logo ? (
                        <img
                          src={c.logo}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          loading="lazy"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            t.style.display = "none";
                          }}
                        />
                      ) : (
                        <Tv className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-foreground" : "text-foreground/90"
                        )}
                      >
                        {c.name}
                      </p>
                      {c.group && (
                        <p className="truncate text-[11px] text-muted-foreground">{c.group}</p>
                      )}
                    </div>
                    {active && (
                    <Badge className="bg-primary text-[10px] text-primary-foreground">
                        <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        НА ЖИВО
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
