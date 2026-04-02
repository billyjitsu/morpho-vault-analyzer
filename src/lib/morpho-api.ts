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
        timelock
        pendingConfigs {
          items {
            validAt
            functionName
            decodedData {
              ... on VaultSetCapPendingData {
                market {
                  marketId
                  loanAsset { symbol }
                  collateralAsset { symbol }
                }
                supplyCap
              }
              ... on VaultSetTimelockPendingData {
                timelock
              }
              ... on VaultSetGuardianPendingData {
                guardian { address }
              }
              ... on VaultRemoveMarketPendingData {
                market {
                  marketId
                  loanAsset { symbol }
                  collateralAsset { symbol }
                }
              }
            }
            txHash
          }
        }
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
          pendingSupplyCap
          pendingSupplyCapValidAt
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
  pendingSupplyCap: string | null;
  pendingSupplyCapValidAt: string | null;
}

interface PendingConfigItem {
  validAt: string;
  functionName: string;
  decodedData: {
    market?: { marketId: string; loanAsset: { symbol: string }; collateralAsset: { symbol: string } | null };
    supplyCap?: string;
    timelock?: string;
    guardian?: { address: string };
  } | null;
  txHash: string;
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
      timelock: string;
      pendingConfigs: { items: PendingConfigItem[] };
      allocation: MarketAllocation[];
    } | null;
  } | null;
}

export interface DexPoolInfo {
  poolAddress: string;
  feeTier: number;
  feeLabel: string;
  token0: { address: string; symbol: string; balance: string };
  token1: { address: string; symbol: string; balance: string };
  isRouteLeg: boolean;
  routeVia?: string;
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
  dexLiquidityType: "direct" | "routed" | "none";
  dexRouteDetail: string;
  dexPoolCount: number;
  dexPools: DexPoolInfo[];
  totalBorrowUsd: number;
  utilizationRisk: string;
  lltvRisk: string;
}

export interface PendingAction {
  type: "SetCap" | "SetTimelock" | "SetGuardian" | "RemoveMarket" | string;
  validAt: number; // unix seconds
  description: string;
  marketLabel?: string;
  newValue?: string;
  txHash: string;
}

export interface VaultRiskResult {
  address: string;
  name: string;
  symbol: string;
  asset: { address: string; symbol: string; decimals: number };
  fee: number;
  timelock: number;
  tvlFormatted: string;
  markets: MarketRiskData[];
  pendingActions: PendingAction[];
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
  const timelockSecs = Number(v.state.timelock ?? 0);

  // Parse pending actions from the API
  const pendingActions: PendingAction[] = (v.state.pendingConfigs?.items ?? []).map((item) => {
    const dd = item.decodedData;
    const mktLabel = dd?.market
      ? `${dd.market.loanAsset.symbol} / ${dd.market.collateralAsset?.symbol ?? "Idle"}`
      : undefined;

    let description = item.functionName;
    let newValue: string | undefined;

    if (item.functionName === "SetCap" && dd?.supplyCap != null) {
      const capNum = Number(BigInt(dd.supplyCap)) / 10 ** decimals;
      newValue = `$${capNum >= 1_000_000 ? `${(capNum / 1_000_000).toFixed(2)}M` : capNum >= 1_000 ? `${(capNum / 1_000).toFixed(1)}K` : capNum.toFixed(2)}`;
      description = `New supply cap → ${newValue}`;
    } else if (item.functionName === "SetTimelock" && dd?.timelock != null) {
      const hrs = Number(dd.timelock) / 3600;
      newValue = hrs >= 24 ? `${(hrs / 24).toFixed(1)}d` : `${hrs.toFixed(1)}h`;
      description = `New timelock → ${newValue}`;
    } else if (item.functionName === "SetGuardian" && dd?.guardian) {
      const addr = dd.guardian.address;
      newValue = addr;
      description = `New guardian → ${addr.slice(0, 6)}…${addr.slice(-4)}`;
    } else if (item.functionName === "RemoveMarket") {
      description = "Remove market";
    }

    return {
      type: item.functionName,
      validAt: Number(item.validAt),
      description,
      marketLabel: mktLabel,
      newValue,
      txHash: item.txHash,
    };
  });

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
      dexLiquidityType: "none" as const,
      dexRouteDetail: "",
      dexPoolCount: 0,
      dexPools: [],
      totalBorrowUsd: 0, // filled by caller with price estimation
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
    timelock: timelockSecs,
    tvlFormatted: tvl,
    markets,
    pendingActions,
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
