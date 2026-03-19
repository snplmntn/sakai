"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GuideSummary } from "@/lib/guides";
import { GuideCard } from "@/components/GuideCard";

interface GuidesExplorerProps {
  guides: GuideSummary[];
}

export function GuidesExplorer({ guides }: GuidesExplorerProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredGuides = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return guides.filter((guide) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        guide.searchText.includes(normalizedQuery);

      return matchesQuery;
    });
  }, [deferredQuery, guides]);

  return (
    <section className="space-y-6">
      <div className="guide-toolbar card-surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <label className="guide-search">
            <Search size={18} style={{ color: "var(--text-sub)" }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jeepney, bus, fare tips, train cards..."
              aria-label="Search guides"
            />
          </label>
        </div>
      </div>

      {filteredGuides.length > 0 ? (
        <div className="guide-grid">
          {filteredGuides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      ) : (
        <div className="card-surface rounded-[28px] p-8 text-center">
          <h2
            className="text-xl font-semibold"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
            }}
          >
            No guides matched that search
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-sub)" }}>
            Try a vehicle name like Jeepney or Taxi, or clear the search.
          </p>
          <Link
            href="/guides"
            className="inline-flex mt-4 text-sm font-medium accent-color"
          >
            Reset guide search
          </Link>
        </div>
      )}
    </section>
  );
}
