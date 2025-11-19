import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Club = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
};

const TAB_FILTERS = [
  { label: "Primary", value: "primary" },
  { label: "General", value: "general" },
];

function Messaging() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("primary");
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const fetchClubs = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("clubs").select("id,name,description,cover_image_url").order("name");

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setClubs(data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchClubs();

    return () => {
      active = false;
    };
  }, []);

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => club.name.toLowerCase().includes(search.toLowerCase()));
  }, [clubs, search]);

  const renderThreads = () => {
    if (loading) {
      return (
        <div className="space-y-3 px-4 py-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load clubs: {error}
        </div>
      );
    }

    if (!filteredClubs.length) {
      return (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {search ? "No clubs match your search." : "No clubs available yet."}
        </p>
      );
    }

    return (
      <div className="space-y-1">
        {filteredClubs.map((club) => (
          <button
            key={club.id}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 hover:bg-secondary/40"
            onClick={() => setSelectedClub(club)}
          >
            <Avatar className="size-12 border">
              {club.cover_image_url ? (
                <img src={club.cover_image_url} alt={club.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {club.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">{club.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {club.description ?? "No description provided yet."}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connect Camp Direct</h2>
        <input
          type="search"
          placeholder="Search clubs"
          className="w-full max-w-xs rounded-full border bg-secondary/30 px-4 py-2 text-sm outline-none"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="flex h-[calc(100vh-180px)] rounded-3xl border bg-background shadow-sm">
        <div className="flex h-full w-[320px] flex-col border-r">
          <div className="border-b px-4">
            <div className="flex items-center justify-between py-3">
              <p className="text-sm font-semibold">Direct</p>
              <Button variant="ghost" size="icon" className="rounded-full">
                +
              </Button>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
              {TAB_FILTERS.map((tab) => (
                <button
                  key={tab.value}
                  className={cn(
                    "relative px-1 pb-2",
                    activeTab === tab.value ? "text-foreground" : "hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                  {activeTab === tab.value && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-0">{renderThreads()}</div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden bg-secondary/20">
          {selectedClub ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b bg-background/70 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full lg:hidden"
                    onClick={() => setSelectedClub(null)}
                  >
                    Back
                  </Button>
                  <div>
                    <p className="text-base font-semibold">{selectedClub.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {selectedClub.description ?? "Last seen recently"}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="hidden rounded-full lg:inline-flex">
                  Send Message
                </Button>
              </div>
              <div className="flex-1 overflow-hidden p-6">
                <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-3xl border bg-background p-6">
                  <div className="self-start rounded-3xl border px-4 py-3 text-sm">
                    Hi team, thanks for reaching out! How can the Connect Camp admin desk help today?
                  </div>
                  <div className="self-end rounded-3xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                    Hey! Just checking in to share our latest event plan and confirm approvals.
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    (Sample conversation wireframe. Integrate Supabase realtime messaging when ready.)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-muted-foreground/50">
                <svg viewBox="0 0 24 24" className="size-8 text-muted-foreground" fill="none" stroke="currentColor">
                  <path d="m22 2-7 20-4-9-9-4Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2 11 13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold">Your Messages</p>
                <p className="text-sm text-muted-foreground">
                  Select a club to view the conversation and keep the network connected.
                </p>
              </div>
              <Button variant="outline" className="rounded-full" onClick={() => setSelectedClub(clubs[0] ?? null)}>
                Send Message
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messaging;
