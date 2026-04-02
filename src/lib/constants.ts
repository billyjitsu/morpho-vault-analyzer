import { defineChain } from "viem";

export const katana = defineChain({
  id: 747474,
  name: "Katana",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.katana.network"] },
  },
  blockExplorers: {
    default: { name: "Katana Explorer", url: "https://explorer.katana.network" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

// Morpho Blue singleton (Katana)
export const MORPHO_BLUE = "0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc" as const;

// MetaMorpho Factory (Katana)
export const META_MORPHO_FACTORY = "0x1c8de6889acee12257899bfeaa2b7e534de32e16" as const;

// SushiSwap V3 contracts (Katana)
export const SUSHI_V3_FACTORY = "0x203e8740894c8955cB8950759876d7E7E45E04c1" as const;
export const SUSHI_QUOTER_V2 = "0x92dea23ED1C683940fF1a2f8fE23FE98C5d3041c" as const;

// Known token addresses
export const TOKENS: Record<string, { address: string; symbol: string; decimals: number }> = {
  "0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62": { address: "0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62", symbol: "vbETH", decimals: 18 },
  "0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36": { address: "0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36", symbol: "vbUSDC", decimals: 6 },
  "0x2DCa96907fde857dd3D816880A0df407eeB2D2F2": { address: "0x2DCa96907fde857dd3D816880A0df407eeB2D2F2", symbol: "vbUSDT", decimals: 6 },
  "0x0913DA6Da4b42f538B445599b46Bb4622342Cf52": { address: "0x0913DA6Da4b42f538B445599b46Bb4622342Cf52", symbol: "vbWBTC", decimals: 8 },
  "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a": { address: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a", symbol: "AUSD", decimals: 6 },
  "0x9B8Df6E244526ab5F6e6400d331DB28C8fdDdb55": { address: "0x9B8Df6E244526ab5F6e6400d331DB28C8fdDdb55", symbol: "uSOL", decimals: 18 },
  "0x80Eede496655FB9047dd39d9f418d5483ED600df": { address: "0x80Eede496655FB9047dd39d9f418d5483ED600df", symbol: "frxUSD", decimals: 18 },
  "0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072": { address: "0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072", symbol: "BTC.b", decimals: 8 },
  "0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d": { address: "0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d", symbol: "KAT", decimals: 18 },
  "0xcA52d08737E6Af8763a2bF6034B3B03868f24DDA": { address: "0xcA52d08737E6Af8763a2bF6034B3B03868f24DDA", symbol: "dUSD", decimals: 18 },
};

// Collateral risk tiers
export const COLLATERAL_RISK: Record<string, { tier: "low" | "medium" | "high" | "extreme"; label: string }> = {
  vbETH: { tier: "low", label: "Native ETH wrapper" },
  vbWBTC: { tier: "low", label: "Native BTC wrapper" },
  vbUSDC: { tier: "low", label: "Native USDC wrapper" },
  vbUSDT: { tier: "low", label: "Native USDT wrapper" },
  wstETH: { tier: "medium", label: "Lido staked ETH — LST depeg risk" },
  weETH: { tier: "medium", label: "EtherFi restaked ETH — LST depeg risk" },
  LBTC: { tier: "medium", label: "Lombard BTC — bridge/wrapper risk" },
  "BTC.b": { tier: "high", label: "Bridged BTC — bridge risk" },
  AUSD: { tier: "medium", label: "Agora stablecoin" },
  yvvbUSDC: { tier: "high", label: "Yearn vault token — recursive vault risk" },
  yvvbUSDT: { tier: "high", label: "Yearn vault token — recursive vault risk" },
  yvvbETH: { tier: "high", label: "Yearn vault token — recursive vault risk" },
  yvvbWBTC: { tier: "high", label: "Yearn vault token — recursive vault risk" },
  yvAUSD: { tier: "high", label: "Yearn vault token — recursive vault risk" },
  uSOL: { tier: "high", label: "Universal SOL — cross-chain bridge risk" },
  POL: { tier: "high", label: "Polygon token — volatile" },
  KAT: { tier: "extreme", label: "Katana governance — highly volatile" },
  mHYPER: { tier: "extreme", label: "Wrapped HYPER — thin liquidity" },
  yUSD: { tier: "high", label: "Yearn USD — vault token risk" },
  siUSD: { tier: "high", label: "Synthetix USD — synthetic asset risk" },
  dUSD: { tier: "medium", label: "d3nity USD stablecoin" },
  wsrUSD: { tier: "medium", label: "Wrapped srUSD" },
  sfrxUSD: { tier: "medium", label: "Staked Frax USD" },
  avKAT: { tier: "extreme", label: "Voting-escrowed KAT — illiquid" },
  JitoSOL: { tier: "high", label: "Jito staked SOL — cross-chain + LST risk" },
  sYUSD: { tier: "high", label: "Staked yUSD — nested yield risk" },
  yUTY: { tier: "extreme", label: "Yearn utility token — highly volatile" },
  MERC: { tier: "extreme", label: "Mercury token — thin liquidity" },
};
