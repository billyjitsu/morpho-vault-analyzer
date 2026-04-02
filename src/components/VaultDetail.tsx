"use client";

import { RiskBadge, UtilizationGauge } from "./RiskBadge";

interface SerializedMarketRisk {
  id: string;
  loanToken: { symbol: string };
  collateralToken: { symbol: string } | null;
  lltv: number;
  utilization: number;
  totalSupply: string;
  totalBorrow: string;
  availableLiquidity: string;
  vaultSupplyAssets: string;
  collateralRiskTier: string;
  collateralRiskLabel: string;
  isRecursive: boolean;
  hasDexLiquidity: boolean;
  dexPoolCount: number;
  utilizationRisk: string;
  lltvRisk: string;
}

interface VaultAnalysis {
  address: string;
  name: string;
  symbol: string;
  asset: { symbol: string };
  curator: string;
  fee: number;
  tvlFormatted: string;
  markets: SerializedMarketRisk[];
  overallRisk: string;
  withdrawalLiquidity: {
    totalAvailableFormatted: string;
    percentAvailable: number;
    marketsAtMax: number;
  };
  worstCollateralTier: string;
  hasRecursiveRisk: boolean;
  avgUtilization: number;
}

function formatNum(s: string): string {
  const n = Number(s);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function DexBadge({ has, count }: { has: boolean; count: number }) {
  if (!has) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">
        NO DEX LIQUIDITY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
      {count} pool{count > 1 ? "s" : ""}
    </span>
  );
}

export function VaultDetail({ data, onClose }: { data: VaultAnalysis; onClose: () => void }) {
  const activeMarkets = data.markets.filter((m) => m.collateralToken);
  const idleMarkets = data.markets.filter((m) => !m.collateralToken);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8 pb-20">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{data.name}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {data.symbol} &middot; {data.asset.symbol} &middot; {data.fee.toFixed(0)}% fee
            </p>
            <p className="text-xs text-zinc-600 mt-1 font-mono">{data.address}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
            Close
          </button>
        </div>

        {/* Risk Summary */}
        <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Overall Risk</p>
            <RiskBadge level={data.overallRisk as "low" | "medium" | "high" | "critical"} size="lg" />
          </div>
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">TVL</p>
            <p className="text-lg font-mono font-semibold text-zinc-100">${formatNum(data.tvlFormatted)}</p>
          </div>
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Withdrawable</p>
            <p className="text-lg font-mono font-semibold text-zinc-100">
              {data.withdrawalLiquidity.percentAvailable.toFixed(1)}%
            </p>
            <p className="text-[10px] text-zinc-500">${formatNum(data.withdrawalLiquidity.totalAvailableFormatted)}</p>
          </div>
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Avg Utilization</p>
            <p className="text-lg font-mono font-semibold text-zinc-100">{(data.avgUtilization * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="px-6 space-y-2">
          {data.withdrawalLiquidity.marketsAtMax > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/20 p-3">
              <span className="text-red-400 text-sm shrink-0">!!!</span>
              <p className="text-sm text-red-300">
                <strong>{data.withdrawalLiquidity.marketsAtMax}</strong> market{data.withdrawalLiquidity.marketsAtMax > 1 ? "s" : ""} at 100% utilization — funds locked until borrowers repay
              </p>
            </div>
          )}
          {data.hasRecursiveRisk && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
              <span className="text-orange-400 text-sm shrink-0">!!!</span>
              <p className="text-sm text-orange-300">
                Vault-on-vault collateral detected — cascading liquidation risk if underlying vault depegs
              </p>
            </div>
          )}
          {data.withdrawalLiquidity.percentAvailable < 10 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <span className="text-amber-400 text-sm shrink-0">!!!</span>
              <p className="text-sm text-amber-300">
                Less than 10% of vault TVL is withdrawable — high exit risk
              </p>
            </div>
          )}
        </div>

        {/* Active Markets */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">
            Active Markets ({activeMarkets.length})
          </h3>
          <div className="space-y-3">
            {activeMarkets.map((m) => (
              <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200 text-sm">
                      {m.loanToken.symbol} / {m.collateralToken?.symbol}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      LLTV {(m.lltv * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={m.collateralRiskTier as "low" | "medium" | "high" | "extreme"} />
                    {m.collateralToken && <DexBadge has={m.hasDexLiquidity} count={m.dexPoolCount} />}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3 sm:grid-cols-4">
                  <div>
                    <p className="text-zinc-500">Total Supply</p>
                    <p className="font-mono text-zinc-300">{formatNum(m.totalSupply)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Total Borrow</p>
                    <p className="font-mono text-zinc-300">{formatNum(m.totalBorrow)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Available</p>
                    <p className="font-mono text-zinc-300">{formatNum(m.availableLiquidity)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Vault Supplied</p>
                    <p className="font-mono text-zinc-300">{formatNum(m.vaultSupplyAssets)}</p>
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-[10px] text-zinc-500 mb-1">Utilization</p>
                  <UtilizationGauge utilization={m.utilization} />
                </div>

                <p className="text-[10px] text-zinc-600">{m.collateralRiskLabel}</p>

                {m.isRecursive && (
                  <div className="mt-2 rounded bg-orange-500/5 px-2 py-1">
                    <p className="text-[10px] text-orange-400 font-semibold">RECURSIVE: Collateral is itself a vault token</p>
                  </div>
                )}
                {!m.hasDexLiquidity && m.collateralToken && (
                  <div className="mt-2 rounded bg-red-500/5 px-2 py-1">
                    <p className="text-[10px] text-red-400 font-semibold">No direct Sushi V3 pool — liquidators may not be able to sell collateral efficiently</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Idle Markets */}
        {idleMarkets.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">
              Idle Allocations ({idleMarkets.length})
            </h3>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              {idleMarkets.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-zinc-400">{m.loanToken.symbol} idle supply</span>
                  <span className="text-sm font-mono text-emerald-400">{formatNum(m.vaultSupplyAssets)}</span>
                </div>
              ))}
              <p className="text-[10px] text-zinc-600 mt-2">Idle allocations are risk-free — immediately withdrawable</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
