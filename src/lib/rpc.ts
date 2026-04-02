import { createPublicClient, http, formatUnits, type Address } from "viem";
import { katana, TOKENS } from "./constants";
import { metaMorphoAbi, erc20Abi } from "./abis";

const client = createPublicClient({
  chain: katana,
  transport: http(katana.rpcUrls.default.http[0], { timeout: 15_000 }),
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function getTokenInfo(address: string): Promise<{ symbol: string; decimals: number }> {
  const lower = address.toLowerCase();
  for (const [addr, info] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === lower) return { symbol: info.symbol, decimals: info.decimals };
  }
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address: address as Address, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: address as Address, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return { symbol, decimals };
  } catch {
    return { symbol: "???", decimals: 18 };
  }
}

export interface VaultListItem {
  address: string;
  name: string;
  symbol: string;
  asset: { address: string; symbol: string; decimals: number };
  curator: string;
  tvl: string;
  fee: string;
}

export async function fetchVaultList(): Promise<VaultListItem[]> {
  const knownVaults: Address[] = [
    "0x61D4F9D3797BA4dA152238c53a6f93Fb665C3c1d",
    "0x1445A01a57D7B7663CfD7B4EE0a8Ec03B379aabD",
    "0x82c4C641CCc38719ae1f0FBd16A64808d838fDfD",
    "0xdE6a4F28Acfe431DD1CfA2D9c7A3d8301624a841",
    "0xE4248e2105508FcBad3fe95691551d1AF14015f7",
    "0x1ecDC3F2B5E90bfB55fF45a7476FF98A8957388E",
    "0xC5e7AB07030305fc925175b25B93b285d40dCdFf",
    "0xf243523996ADbb273F0B237B53f30017C4364bBC",
    "0x9540441C503D763094921dbE4f13268E6d1d3B56",
    "0xFaDe0C546f44e33C134c4036207B314AC643dc2E",
    "0xCE2b8e464Fc7b5E58710C24b7e5EBFB6027f29D7",
    "0x8ED68f91AfbE5871dCE31ae007a936ebE8511d47",
    "0xe107cCdeb8e20E499545C813f98Cc90619b29859",
    "0xEF77F8C53af95f3348CeE0FB2a02eE02aB9Cdca5",
    "0x9aF031182fCe8BF0b296145f2e1f1Df5C3feCDE7",
    "0x4fd2FDDC8973077B95D614980Fd298B120f3148B",
    "0x6680D2993fAadC9204Bd614a53e0c7a3f20c8ca5",
    "0xAA0C0f9CDf571e2767Aa897f1DbA10f1E681c990",
  ];

  const calls = knownVaults.flatMap((addr) => [
    { address: addr, abi: metaMorphoAbi, functionName: "name" as const, args: [] as const },
    { address: addr, abi: metaMorphoAbi, functionName: "symbol" as const, args: [] as const },
    { address: addr, abi: metaMorphoAbi, functionName: "asset" as const, args: [] as const },
    { address: addr, abi: metaMorphoAbi, functionName: "totalAssets" as const, args: [] as const },
    { address: addr, abi: metaMorphoAbi, functionName: "fee" as const, args: [] as const },
    { address: addr, abi: metaMorphoAbi, functionName: "curator" as const, args: [] as const },
  ]);

  const results = await client.multicall({ contracts: calls });

  const vaults: VaultListItem[] = [];
  for (let i = 0; i < knownVaults.length; i++) {
    const base = i * 6;
    const name = results[base].status === "success" ? (results[base].result as string) : "Unknown";
    const symbol = results[base + 1].status === "success" ? (results[base + 1].result as string) : "???";
    const assetAddr = results[base + 2].status === "success" ? (results[base + 2].result as string) : ZERO_ADDRESS;
    const totalAssets = results[base + 3].status === "success" ? (results[base + 3].result as bigint) : BigInt(0);
    const feeRaw = results[base + 4].status === "success" ? (results[base + 4].result as bigint) : BigInt(0);
    const curator = results[base + 5].status === "success" ? (results[base + 5].result as string) : ZERO_ADDRESS;

    const assetInfo = await getTokenInfo(assetAddr);
    const tvlFormatted = formatUnits(totalAssets, assetInfo.decimals);
    const feePct = Number(feeRaw) / 1e18 * 100;

    if (Number(tvlFormatted) < 1) continue;

    vaults.push({
      address: knownVaults[i],
      name, symbol,
      asset: { address: assetAddr, ...assetInfo },
      curator,
      tvl: tvlFormatted,
      fee: `${feePct.toFixed(0)}%`,
    });
  }

  return vaults.sort((a, b) => Number(b.tvl) - Number(a.tvl));
}
