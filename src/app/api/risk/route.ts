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
const PA = parseAbi(["function liquidity() view returns (uint128)"]);
const Z = "0x0000000000000000000000000000000000000000" as const;

async function checkDexLiquidity(collateral: string, loan: string): Promise<boolean> {
  try {
    const pool = await rpc.readContract({
      address: SUSHI_V3_FACTORY as Address,
      abi: FA,
      functionName: "getPool",
      args: [collateral as Address, loan as Address, 3000],
    });
    if (!pool || pool === Z) return false;
    const liq = await rpc.readContract({ address: pool, abi: PA, functionName: "liquidity" });
    return liq > BigInt(0);
  } catch {
    return false;
  }
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

    // Only RPC calls: DEX liquidity checks for markets with collateral
    const dexChecks = markets.map(async (m: MarketRiskData) => {
      if (!m.collateralToken) return;
      const hasLiq = await checkDexLiquidity(m.collateralToken.address, m.loanToken.address);
      m.hasDexLiquidity = hasLiq;
      m.dexPoolCount = hasLiq ? 1 : 0;
    });
    await Promise.all(dexChecks);

    // Apply collateral risk tiers from constants
    for (const m of markets) {
      const cs = m.collateralToken?.symbol ?? "N/A";
      const ri = COLLATERAL_RISK[cs];
      if (ri) {
        m.collateralRiskTier = ri.tier;
        m.collateralRiskLabel = ri.label;
      }
    }

    // Calculate risk scores
    const act = markets.filter((m: MarketRiskData) => m.collateralToken);
    const atM = markets.filter((m: MarketRiskData) => m.utilization >= 0.99).length;
    const rec = markets.some((m: MarketRiskData) => m.isRecursive);
    const avS = markets.reduce((x: number, m: MarketRiskData) => x + Number(m.availableLiquidity), 0);
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

    return NextResponse.json({
      address: v,
      name: detail.name,
      symbol: detail.symbol,
      asset: detail.asset,
      fee: detail.fee,
      tvlFormatted: detail.tvlFormatted,
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
