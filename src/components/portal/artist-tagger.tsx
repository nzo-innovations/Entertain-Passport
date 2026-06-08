"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Artist = { eventArtistId: string; id: string; name: string };
type Result = { id: string; name: string; type: string };

export function ArtistTagger({ eventId, initial }: { eventId: string; initial: Artist[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [artists, setArtists] = React.useState<Artist[]>(initial);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [open, setOpen] = React.useState(false);

  const search = async (term: string) => {
    setQ(term);
    if (term.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const res = await fetch(`/api/portal/artists/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
    const data = await res.json();
    setResults(data.artists ?? []);
    setOpen(true);
  };

  const add = async (org: Result) => {
    setOpen(false);
    setQ("");
    const res = await fetch(`/api/events/${eventId}/artists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't add artist", description: data?.error, variant: "destructive" });
      return;
    }
    setArtists((a) => [...a.filter((x) => x.id !== org.id), data.artist]);
    toast({ title: "Artist added", description: `${org.name} can now see this event on their dashboard.` });
    router.refresh();
  };

  const remove = async (a: Artist) => {
    const res = await fetch(`/api/events/${eventId}/artists`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventArtistId: a.eventArtistId }),
    });
    if (!res.ok) {
      toast({ title: "Couldn't remove artist", variant: "destructive" });
      return;
    }
    setArtists((list) => list.filter((x) => x.eventArtistId !== a.eventArtistId));
    router.refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Mic2 className="h-5 w-5 text-primary" /> Line-up / artists
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Search artists on the platform and add them. The event appears on each
        added artist&apos;s dashboard.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {artists.map((a) => (
          <Badge key={a.eventArtistId} variant="secondary" className="gap-1">
            {a.name}
            <button onClick={() => remove(a)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {artists.length === 0 && <span className="text-sm text-muted-foreground">No artists tagged yet.</span>}
      </div>

      <div className="relative mt-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search artist or artist manager…"
            className="h-9"
          />
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => add(r)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.type.replace("_", " ").toLowerCase()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
