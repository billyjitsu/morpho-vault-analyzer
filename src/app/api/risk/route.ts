import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { katana, SUSHI_V3_FACTORY, COLLATERAL_RISK } from "@/lib/constants";
import { fetchVaultDetailFromAPI, type MarketRiskData } from "@/lib/morpho-api";

export const dynamic = "force-dynamic";

// RPC client — only used for DEX liquidity checks (no Sushi API for Katana)
const rpc = createPublicClient({
  chain: katana,
  transport: http(katana.rpcUrls.default.http[0], { timeout: 10_000 }),
});

const FA = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const PA = parseAbi([
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const Z = "0x0000000000000000000000000000000000000000" as const;
const FEE_TIERS = [500, 3000, 10000] as const;
const FEE_LABELS: Record<number, string> = { 500: "0.05%", 3000: "0.3%", 10000: "1%" };

// Approximate USD prices for known token classes — used to estimate pool TVL
const STABLECOINS = new Set(["vbUSDC", "vbUSDT", "AUSD", "dUSD", "frxUSD", "siUSD", "yUSD", "sYUSD", "wsrUSD", "sfrxUSD"]);
const BTC_TOKENS = new Set(["vbWBTC", "BTC.b", "LBTC"]);
const ETH_TOKENS = new Set(["vbETH", "wstETH", "weETH"]);
// Rough USD reference prices — updated periodically, only used for pool TVL estimates
const REF_PRICES: Record<string, number> = { BTC: 100000, ETH: 2500, SOL: 150, KAT: 1 };

function estimateTokenUsdPrice(symbol: string): number {
  if (STABLECOINS.has(symbol)) return 1;
  if (BTC_TOKENS.has(symbol)) return REF_PRICES.BTC;
  if (ETH_TOKENS.has(symbol)) return REF_PRICES.ETH;
  if (symbol === "uSOL" || symbol === "JitoSOL") return REF_PRICES.SOL;
  if (symbol === "KAT" || symbol === "avKAT") return REF_PRICES.KAT;
  return 0; // unknown — won't contribute to TVL estimate
}

export interface PoolDetail {
  poolAddress: string;
  feeTier: number;
  feeLabel: string;
  token0: { address: string; symbol: string; balance: string };
  token1: { address: string; symbol: string; balance: string };
  tvlUsd: number;
  isRouteLeg: boolean;
  routeVia?: string;
}

/** Get pool details for a token pair at a specific fee tier, or null if no pool */
async function getPoolDetail(
  tokenA: string,
  tokenB: string,
  fee: number,
  tokenSymbols: Map<string, { symbol: string; decimals: number }>,
): Promise<PoolDetail | null> {
  try {
    const pool = await rpc.readContract({
      address: SUSHI_V3_FACTORY as Address,
      abi: FA,
      functionName: "getPool",
      args: [tokenA as Address, tokenB as Address, fee],
    });
    if (!pool || pool === Z) return null;

    const liq = await rpc.readContract({ address: pool, abi: PA, functionName: "liquidity" });
    if (liq === BigInt(0)) return null;

    const [t0Addr, t1Addr] = await Promise.all([
      rpc.readContract({ address: pool, abi: PA, functionName: "token0" }),
      rpc.readContract({ address: pool, abi: PA, functionName: "token1" }),
    ]);

    const [bal0, bal1] = await Promise.all([
      rpc.readContract({ address: t0Addr as Address, abi: ERC20, functionName: "balanceOf", args: [pool] }),
      rpc.readContract({ address: t1Addr as Address, abi: ERC20, functionName: "balanceOf", args: [pool] }),
    ]);

    const t0Info = tokenSymbols.get((t0Addr as string).toLowerCase());
    const t1Info = tokenSymbols.get((t1Addr as string).toLowerCase());

    const formatBal = (raw: bigint, decimals: number) => {
      if (raw === BigInt(0)) return "0";
      const divisor = BigInt(10) ** BigInt(decimals);
      const whole = raw / divisor;
      const frac = raw % divisor;
      if (frac === BigInt(0)) return whole.toString();
      const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
      return `${whole}.${fracStr}`;
    };

    const t0Sym = t0Info?.symbol ?? "???";
    const t1Sym = t1Info?.symbol ?? "???";
    const t0Dec = t0Info?.decimals ?? 18;
    const t1Dec = t1Info?.decimals ?? 18;
    const bal0Num = Number(bal0 as bigint) / 10 ** t0Dec;
    const bal1Num = Number(bal1 as bigint) / 10 ** t1Dec;
    const tvlUsd = bal0Num * estimateTokenUsdPrice(t0Sym) + bal1Num * estimateTokenUsdPrice(t1Sym);

    return {
      poolAddress: pool as string,
      feeTier: fee,
      feeLabel: FEE_LABELS[fee] ?? `${fee / 10000}%`,
      token0: {
        address: t0Addr as string,
        symbol: t0Sym,
        balance: formatBal(bal0 as bigint, t0Dec),
      },
      token1: {
        address: t1Addr as string,
        symbol: t1Sym,
        balance: formatBal(bal1 as bigint, t1Dec),
      },
      tvlUsd,
      isRouteLeg: false,
    };
  } catch {
    return null;
  }
}

/** Find all live pools between two tokens across fee tiers */
async function findDirectPools(
  tokenA: string,
  tokenB: string,
  tokenSymbols: Map<string, { symbol: string; decimals: number }>,
): Promise<PoolDetail[]> {
  const results = await Promise.all(
    FEE_TIERS.map((fee) => getPoolDetail(tokenA, tokenB, fee, tokenSymbols)),
  );
  return results.filter((p): p is PoolDetail => p !== null);
}

interface DexCheckResult {
  hasLiquidity: boolean;
  type: "direct" | "routed" | "none";
  routeDetail: string;
  poolCount: number;
  pools: PoolDetail[];
}

/**
 * Check DEX liquidity: first direct pools across fee tiers,
 * then two-hop routes through any known intermediary token.
 */
async function checkDexLiquidity(
  collateral: string,
  loan: string,
  intermediaries: { address: string; symbol: string }[],
  tokenSymbols: Map<string, { symbol: string; decimals: number }>,
): Promise<DexCheckResult> {
  // 1. Check direct pools
  const directPools = await findDirectPools(collateral, loan, tokenSymbols);
  if (directPools.length > 0) {
    return {
      hasLiquidity: true,
      type: "direct",
      routeDetail: "Direct pool",
      poolCount: directPools.length,
      pools: directPools,
    };
  }

  // 2. Check two-hop routes through intermediary tokens
  for (const mid of intermediaries) {
    if (
      mid.address.toLowerCase() === collateral.toLowerCase() ||
      mid.address.toLowerCase() === loan.toLowerCase()
    ) continue;

    const [legA, legB] = await Promise.all([
      findDirectPools(collateral, mid.address, tokenSymbols),
      findDirectPools(mid.address, loan, tokenSymbols),
    ]);

    if (legA.length > 0 && legB.length > 0) {
      const routePools = [
        ...legA.map((p) => ({ ...p, isRouteLeg: true, routeVia: mid.symbol })),
        ...legB.map((p) => ({ ...p, isRouteLeg: true, routeVia: mid.symbol })),
      ];
      return {
        hasLiquidity: true,
        type: "routed",
        routeDetail: `Via ${mid.symbol}`,
        poolCount: routePools.length,
        pools: routePools,
      };
    }
  }

  return { hasLiquidity: false, type: "none", routeDetail: "", poolCount: 0, pools: [] };
}

export async function GET(request: Request) {
  const v = new URL(request.url).searchParams.get("vault");
  console.log("[risk] start", v);
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v))
    return NextResponse.json({ error: "bad" }, { status: 400 });

  try {
    // Fetch vault + market data from Morpho API (single HTTP call)
    const detail = await fetchVaultDetailFromAPI(v);
    if (!detail) return NextResponse.json({ error: "vault not found" }, { status: 404 });

    const { markets } = detail;
    const tvl = Number(detail.tvlFormatted);

    // Collect all unique tokens from markets as potential intermediaries
    const tokenMap = new Map<string, string>();
    const tokenSymbols = new Map<string, { symbol: string; decimals: number }>();
    for (const m of markets) {
      tokenMap.set(m.loanToken.address.toLowerCase(), m.loanToken.symbol);
      tokenSymbols.set(m.loanToken.address.toLowerCase(), { symbol: m.loanToken.symbol, decimals: m.loanToken.decimals });
      if (m.collateralToken) {
        tokenMap.set(m.collateralToken.address.toLowerCase(), m.collateralToken.symbol);
        tokenSymbols.set(m.collateralToken.address.toLowerCase(), { symbol: m.collateralToken.symbol, decimals: m.collateralToken.decimals });
      }
    }
    const intermediaries = Array.from(tokenMap.entries()).map(([address, symbol]) => ({ address, symbol }));

    // DEX liquidity checks: direct pools + multi-hop routes through known tokens
    const dexChecks = markets.map(async (m: MarketRiskData) => {
      if (!m.collateralToken) return;
      const result = await checkDexLiquidity(m.collateralToken.address, m.loanToken.address, intermediaries, tokenSymbols);
      m.hasDexLiquidity = result.hasLiquidity;
      m.dexLiquidityType = result.type;
      m.dexRouteDetail = result.routeDetail;
      m.dexPoolCount = result.poolCount;
      m.dexPools = result.pools;
    });
    await Promise.all(dexChecks);

    // Apply collateral risk tiers and USD borrow estimates
    for (const m of markets) {
      const cs = m.collateralToken?.symbol ?? "N/A";
      const ri = COLLATERAL_RISK[cs];
      if (ri) {
        m.collateralRiskTier = ri.tier;
        m.collateralRiskLabel = ri.label;
      }
      m.totalBorrowUsd = Number(m.totalBorrow) * estimateTokenUsdPrice(m.loanToken.symbol);
    }

    // Calculate risk scores
    const act = markets.filter((m: MarketRiskData) => m.collateralToken);
    const atM = markets.filter((m: MarketRiskData) => m.utilization >= 0.99).length;
    const rec = markets.some((m: MarketRiskData) => m.isRecursive);
    const avS = markets.reduce((x: number, m: MarketRiskData) => x + Math.min(Number(m.availableLiquidity), Number(m.vaultSupplyAssets)), 0);
    const pct = tvl > 0 ? (avS / tvl) * 100 : 0;

    let s = 0;
    if (pct < 5) s += 4;
    else if (pct < 15) s += 3;
    else if (pct < 30) s += 2;
    for (const m of act) {
      if (m.collateralRiskTier === "extreme") s += 3;
      else if (m.collateralRiskTier === "high") s += 2;
      else if (m.collateralRiskTier === "medium") s += 1;
    }
    if (rec) s += 2;
    s += atM * 2;
    s += act.filter((m: MarketRiskData) => m.lltvRisk === "high").length;
    s += act.filter((m: MarketRiskData) => !m.hasDexLiquidity).length * 2;
    s += act.filter((m: MarketRiskData) => m.dexLiquidityType === "routed").length;

    return NextResponse.json({
      address: v,
      name: detail.name,
      symbol: detail.symbol,
      asset: detail.asset,
      fee: detail.fee,
      timelock: detail.timelock,
      tvlFormatted: detail.tvlFormatted,
      pendingActions: detail.pendingActions,
      overallRisk: s >= 10 ? "critical" : s >= 6 ? "high" : s >= 3 ? "medium" : "low",
      hasRecursiveRisk: rec,
      avgUtilization: markets.length
        ? markets.reduce((x: number, m: MarketRiskData) => x + m.utilization, 0) / markets.length
        : 0,
      worstCollateralTier: act.reduce(
        (w: string, m: MarketRiskData) => {
          const o: Record<string, number> = { low: 0, medium: 1, high: 2, extreme: 3, unknown: 2 };
          return (o[m.collateralRiskTier] ?? 0) > (o[w] ?? 0) ? m.collateralRiskTier : w;
        },
        "low",
      ),
      markets,
      withdrawalLiquidity: {
        totalAvailableFormatted: avS.toFixed(2),
        percentAvailable: pct,
        marketsAtMax: atM,
      },
    });
  } catch (e) {
    console.error("[risk]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
