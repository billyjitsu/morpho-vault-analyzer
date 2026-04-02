"use client";

import { RiskBadge } from "./RiskBadge";

interface VaultListItem {
  address: string;
  name: string;
  symbol: string;
  asset: { symbol: string };
  curator: string;
  tvl: string;
  fee: string;
}

function formatTvl(tvl: string): string {
  const n = Number(tvl);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function curatorName(curator: string): string {
  const map: Record<string, string> = {
    "0x827e86072b06674a077f592a531dce4590adecdb": "Steakhouse",
    "0xb5c5b5d7a64d43bb91dab63ff3095f7fcb869b4e": "Gauntlet",
    "0x90d0f26025571295d18a6c041e47450b81886b51": "Yearn",
    "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef": "Clearstar",
    "0x75178137d3b4b9a0f771e0e149b00fb8167ba325": "Hyperithm",
    "0xd8b0f4e54a8dac04e0a57392f5a630cedb99c940": "Re7",
  };
  return map[curator.toLowerCase()] ?? `${curator.slice(0, 6)}...${curator.slice(-4)}`;
}

export function VaultCard({
  vault,
  onClick,
  analysis,
}: {
  vault: VaultListItem;
  onClick: () => void;
  analysis?: { overallRisk: string; avgUtilization: number; withdrawalLiquidity: { percentAvailable: number }; hasRecursiveRisk: boolean } | null;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate">{vault.name}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {curatorName(vault.curator)} &middot; {vault.fee} fee &middot; {vault.asset.symbol}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-lg font-semibold text-zinc-100">{formatTvl(vault.tvl)}</p>
          <p className="text-xs text-zinc-500">TVL</p>
        </div>
      </div>

      {analysis && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Risk</p>
            <RiskBadge level={analysis.overallRisk as "low" | "medium" | "high" | "critical"} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Avg Util</p>
            <p className="text-sm font-mono text-zinc-200">{(analysis.avgUtilization * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Withdrawable</p>
            <p className="text-sm font-mono text-zinc-200">{analysis.withdrawalLiquidity.percentAvailable.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {analysis?.hasRecursiveRisk && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-500/5 px-2 py-1">
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">Recursive vault-on-vault collateral detected</span>
        </div>
      )}

      {!analysis && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-600">Click to analyze risk</p>
        </div>
      )}
    </button>
  );
}
