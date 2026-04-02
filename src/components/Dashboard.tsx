"use client";

import { useState, useEffect, useCallback } from "react";
import { VaultCard } from "./VaultCard";
import { VaultDetail } from "./VaultDetail";

interface VaultListItem {
  address: string;
  name: string;
  symbol: string;
  asset: { symbol: string };
  curator: string;
  tvl: string;
  fee: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VaultAnalysis = any;

export function Dashboard() {
  const [vaults, setVaults] = useState<VaultListItem[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, VaultAnalysis>>({});
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/vaults")
      .then((r) => r.json())
      .then((d) => {
        setVaults(d.vaults ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const analyzeVault = useCallback(async (address: string) => {
    if (analyses[address]) {
      setSelectedVault(address);
      return;
    }

    setAnalyzing(address);
    try {
      const r = await fetch(`/api/risk?vault=${address}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAnalyses((prev) => ({ ...prev, [address]: data }));
      setSelectedVault(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(null);
    }
  }, [analyses]);

  const filteredVaults = vaults.filter((v) => {
    if (filter === "all") return true;
    return v.asset.symbol.toLowerCase().includes(filter.toLowerCase());
  });

  const uniqueAssets = [...new Set(vaults.map((v) => v.asset.symbol))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          <p className="mt-3 text-sm text-zinc-500">Loading vaults from Katana...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-red-400 font-semibold">Error</p>
        <p className="text-sm text-red-300 mt-1">{error}</p>
        <button onClick={() => { setError(null); window.location.reload(); }} className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          All ({vaults.length})
        </button>
        {uniqueAssets.map((asset) => (
          <button
            key={asset}
            onClick={() => setFilter(asset)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === asset ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {asset} ({vaults.filter((v) => v.asset.symbol === asset).length})
          </button>
        ))}
      </div>

      {/* Vault Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVaults.map((v) => (
          <div key={v.address} className="relative">
            <VaultCard
              vault={v}
              onClick={() => analyzeVault(v.address)}
              analysis={analyses[v.address] ?? null}
            />
            {analyzing === v.address && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
                  <p className="mt-2 text-xs text-zinc-400">Analyzing markets...</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredVaults.length === 0 && (
        <p className="text-center text-zinc-500 py-12">No vaults found for this filter.</p>
      )}

      {/* Detail Modal */}
      {selectedVault && analyses[selectedVault] && (
        <VaultDetail data={analyses[selectedVault]} onClose={() => setSelectedVault(null)} />
      )}
    </>
  );
}
