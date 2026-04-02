"use client";

import { RiskBadge, UtilizationGauge } from "./RiskBadge";

interface PoolInfo {
  poolAddress: string;
  feeTier: number;
  feeLabel: string;
  token0: { symbol: string; balance: string };
  token1: { symbol: string; balance: string };
  tvlUsd: number;
  isRouteLeg: boolean;
  routeVia?: string;
}

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
  dexLiquidityType: string;
  dexRouteDetail: string;
  dexPoolCount: number;
  dexPools: PoolInfo[];
  totalBorrowUsd: number;
  utilizationRisk: string;
  lltvRisk: string;
}

interface PendingAction {
  type: string;
  validAt: number;
  description: string;
  marketLabel?: string;
  newValue?: string;
  txHash: string;
}

interface VaultAnalysis {
  address: string;
  name: string;
  symbol: string;
  asset: { symbol: string };
  curator: string;
  fee: number;
  timelock: number;
  tvlFormatted: string;
  markets: SerializedMarketRisk[];
  pendingActions: PendingAction[];
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
  if (n > 0 && n < 0.01) return "<0.01";
  return n.toFixed(2);
}

function feeColor(fee: number): string {
  if (fee <= 0) return "text-emerald-400";
  if (fee <= 2) return "text-emerald-300";
  if (fee <= 5) return "text-amber-400";
  if (fee <= 7) return "text-orange-400";
  return "text-red-400";
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0 && n < 1) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

function DexBadge({ has, type, routeDetail, count }: { has: boolean; type: string; routeDetail: string; count: number }) {
  if (!has) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">
        NO DEX LIQUIDITY
      </span>
    );
  }
  if (type === "routed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400" title={routeDetail}>
        ROUTED ({routeDetail})
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
              {data.symbol} &middot; {data.asset.symbol} &middot; <span className={feeColor(data.fee)}>{data.fee.toFixed(0)}% fee</span>
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

        {/* Pending Actions */}
        {data.pendingActions && data.pendingActions.length > 0 && (
          <div className="px-6 pt-2">
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
                </span>
                <h3 className="text-sm font-semibold text-violet-300">
                  {data.pendingActions.length} Pending Action{data.pendingActions.length > 1 ? "s" : ""}
                </h3>
                {data.timelock > 0 && (
                  <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                    Timelock: {data.timelock >= 86400 ? `${(data.timelock / 86400).toFixed(1)}d` : `${(data.timelock / 3600).toFixed(1)}h`}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {data.pendingActions.map((action) => {
                  const now = Date.now() / 1000;
                  const remaining = action.validAt - now;
                  const isReady = remaining <= 0;
                  const timeLabel = isReady
                    ? "Ready to execute"
                    : remaining >= 86400
                      ? `${(remaining / 86400).toFixed(0)}d ${Math.floor((remaining % 86400) / 3600)}h remaining`
                      : remaining >= 3600
                        ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m remaining`
                        : `${Math.floor(remaining / 60)}m remaining`;

                  return (
                    <div key={action.txHash} className="flex items-start justify-between gap-3 rounded-md bg-zinc-900/80 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-violet-400">{action.type.replace("Set", "Update ")}</span>
                          {action.marketLabel && (
                            <span className="text-xs text-zinc-400">{action.marketLabel}</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 mt-0.5">{action.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-mono font-semibold ${isReady ? "text-emerald-400" : "text-amber-400"}`}>
                          {timeLabel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
                    {m.collateralToken && <DexBadge has={m.hasDexLiquidity} type={m.dexLiquidityType} routeDetail={m.dexRouteDetail} count={m.dexPoolCount} />}
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
                {m.collateralToken && m.dexPools && m.dexPools.length > 0 && (() => {
                  const totalPoolUsd = m.dexPools.reduce((sum, p) => sum + p.tvlUsd, 0);
                  const borrowUsd = m.totalBorrowUsd;
                  const depthPct = borrowUsd > 0 ? (totalPoolUsd / borrowUsd) * 100 : 0;
                  const depthColor = depthPct >= 50 ? "text-emerald-400" : depthPct >= 10 ? "text-amber-400" : "text-red-400";

                  return (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                          DEX Liquidity — {m.dexLiquidityType === "routed" ? `Routed ${m.dexRouteDetail}` : "Direct"}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-semibold text-zinc-200">{formatUsd(totalPoolUsd)}</span>
                          {borrowUsd > 0 && (
                            <span className={`text-[10px] font-mono font-semibold ${depthColor}`}>
                              {depthPct > 999 ? ">999%" : `${depthPct.toFixed(1)}%`} of borrows
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {m.dexPools.map((pool) => (
                          <div key={pool.poolAddress} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">{pool.feeLabel}</span>
                              {pool.isRouteLeg && pool.routeVia && (
                                <span className="text-[10px] text-amber-500">via {pool.routeVia}</span>
                              )}
                              <span className="font-mono text-zinc-500">{formatUsd(pool.tvlUsd)}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-zinc-400">
                                <span className="text-zinc-600 text-[10px]">{pool.token0.symbol}</span>{" "}
                                <span className="text-zinc-300">{formatNum(pool.token0.balance)}</span>
                              </span>
                              <span className="text-zinc-700">/</span>
                              <span className="text-zinc-400">
                                <span className="text-zinc-600 text-[10px]">{pool.token1.symbol}</span>{" "}
                                <span className="text-zinc-300">{formatNum(pool.token1.balance)}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-700 mt-2 font-mono truncate">
                        {m.dexPools[0].poolAddress}
                      </p>
                    </div>
                  );
                })()}
                {!m.hasDexLiquidity && m.collateralToken && (
                  <div className="mt-2 rounded bg-red-500/5 px-2 py-1">
                    <p className="text-[10px] text-red-400 font-semibold">No Sushi V3 route found — liquidators may not be able to sell collateral efficiently</p>
                  </div>
                )}
                {m.dexLiquidityType === "routed" && m.collateralToken && (
                  <div className="mt-2 rounded bg-amber-500/5 px-2 py-1">
                    <p className="text-[10px] text-amber-400 font-semibold">No direct pool — routed {m.dexRouteDetail.toLowerCase()}, higher slippage for liquidations</p>
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
