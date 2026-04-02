const MORPHO_API = "https://blue-api.morpho.org/graphql";
const CHAIN_ID = 747474;

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Morpho API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ---------- Vault List ----------

const VAULT_LIST_QUERY = `
  query VaultList($chainId: [Int!]) {
    vaults(
      where: { chainId_in: $chainId }
      first: 100
      orderBy: TotalAssets
      orderDirection: Desc
    ) {
      items {
        address
        name
        symbol
        asset {
          address
          symbol
          decimals
        }
        state {
          totalAssets
          totalAssetsUsd
          fee
          curator
          apy
          netApy
        }
      }
    }
  }
`;

export interface VaultListItem {
  address: string;
  name: string;
  symbol: string;
  asset: { address: string; symbol: string; decimals: number };
  curator: string;
  tvl: string;
  fee: string;
}

interface VaultListResponse {
  vaults: {
    items: {
      address: string;
      name: string;
      symbol: string;
      asset: { address: string; symbol: string; decimals: number };
      state: {
        totalAssets: string;
        totalAssetsUsd: number | null;
        fee: number;
        curator: string;
        apy: number;
        netApy: number;
      } | null;
    }[];
  };
}

export async function fetchVaultListFromAPI(): Promise<VaultListItem[]> {
  const data = await gql<VaultListResponse>(VAULT_LIST_QUERY, { chainId: [CHAIN_ID] });

  return data.vaults.items
    .filter((v) => {
      if (!v.state) return false;
      const tvl = Number(v.state.totalAssets) / 10 ** v.asset.decimals;
      return tvl >= 1;
    })
    .map((v) => {
      const decimals = v.asset.decimals;
      const tvlRaw = BigInt(v.state!.totalAssets);
      const tvlStr = formatBigInt(tvlRaw, decimals);
      const feePct = (v.state!.fee * 100).toFixed(0);

      return {
        address: v.address,
        name: v.name,
        symbol: v.symbol,
        asset: { address: v.asset.address, symbol: v.asset.symbol, decimals },
        curator: v.state!.curator,
        tvl: tvlStr,
        fee: `${feePct}%`,
      };
    })
    .sort((a, b) => Number(b.tvl) - Number(a.tvl));
}

// ---------- Vault Risk / Detail ----------

const VAULT_DETAIL_QUERY = `
  query VaultDetail($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset {
        address
        symbol
        decimals
      }
      state {
        totalAssets
        fee
        curator
        allocation {
          market {
            marketId
            lltv
            loanAsset {
              address
              symbol
              decimals
            }
            collateralAsset {
              address
              symbol
              decimals
            }
            state {
              supplyAssets
              supplyShares
              borrowAssets
              borrowShares
              liquidityAssets
              utilization
            }
          }
          supplyAssets
          supplyShares
          supplyCap
        }
      }
    }
  }
`;

interface MarketAllocation {
  market: {
    marketId: string;
    lltv: string;
    loanAsset: { address: string; symbol: string; decimals: number };
    collateralAsset: { address: string; symbol: string; decimals: number } | null;
    state: {
      supplyAssets: string;
      supplyShares: string;
      borrowAssets: string;
      borrowShares: string;
      liquidityAssets: string;
      utilization: number;
    } | null;
  };
  supplyAssets: string;
  supplyShares: string;
  supplyCap: string;
}

interface VaultDetailResponse {
  vaultByAddress: {
    address: string;
    name: string;
    symbol: string;
    asset: { address: string; symbol: string; decimals: number };
    state: {
      totalAssets: string;
      fee: number;
      curator: string;
      allocation: MarketAllocation[];
    } | null;
  } | null;
}

export interface MarketRiskData {
  id: string;
  loanToken: { address: string; symbol: string; decimals: number };
  collateralToken: { address: string; symbol: string; decimals: number } | null;
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

export interface VaultRiskResult {
  address: string;
  name: string;
  symbol: string;
  asset: { address: string; symbol: string; decimals: number };
  fee: number;
  tvlFormatted: string;
  markets: MarketRiskData[];
}

export async function fetchVaultDetailFromAPI(vaultAddress: string): Promise<VaultRiskResult | null> {
  const data = await gql<VaultDetailResponse>(VAULT_DETAIL_QUERY, {
    address: vaultAddress,
    chainId: CHAIN_ID,
  });

  const v = data.vaultByAddress;
  if (!v || !v.state) return null;

  const decimals = v.asset.decimals;
  const tvl = formatBigInt(BigInt(v.state.totalAssets), decimals);

  const markets: MarketRiskData[] = v.state.allocation.map((alloc) => {
    const m = alloc.market;
    const ms = m.state;
    const loanDecimals = m.loanAsset.decimals;
    const lltv = Number(m.lltv) / 1e18;
    const ut = ms?.utilization ?? 0;
    const supplyAssets = ms ? BigInt(ms.supplyAssets) : BigInt(0);
    const borrowAssets = ms ? BigInt(ms.borrowAssets) : BigInt(0);
    const available = ms ? BigInt(ms.liquidityAssets) : BigInt(0);
    const vaultSupply = BigInt(alloc.supplyAssets);
    const cs = m.collateralAsset?.symbol ?? "N/A";

    return {
      id: m.marketId,
      loanToken: m.loanAsset,
      collateralToken: m.collateralAsset,
      lltv,
      utilization: ut,
      totalSupply: formatBigInt(supplyAssets, loanDecimals),
      totalBorrow: formatBigInt(borrowAssets, loanDecimals),
      availableLiquidity: formatBigInt(available, loanDecimals),
      vaultSupplyAssets: formatBigInt(vaultSupply, loanDecimals),
      collateralRiskTier: "unknown", // filled by caller with COLLATERAL_RISK
      collateralRiskLabel: "Unknown",
      isRecursive: cs.startsWith("yv") || cs.startsWith("PT-") || cs === "yUSD",
      hasDexLiquidity: false, // filled by caller via RPC
      dexPoolCount: 0,
      utilizationRisk: ut >= 0.99 ? "critical" : ut >= 0.9 ? "high" : ut >= 0.8 ? "medium" : "low",
      lltvRisk: lltv >= 0.9 ? "high" : lltv >= 0.8 ? "medium" : "low",
    };
  });

  return {
    address: v.address,
    name: v.name,
    symbol: v.symbol,
    asset: v.asset,
    fee: v.state.fee * 100,
    tvlFormatted: tvl,
    markets,
  };
}

// ---------- Helpers ----------

function formatBigInt(value: bigint, decimals: number): string {
  if (value === BigInt(0)) return "0";
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  if (remainder === BigInt(0)) return whole.toString();
  const fracStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
