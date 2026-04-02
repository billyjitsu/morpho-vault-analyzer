import { NextResponse } from "next/server";
import { fetchVaultListFromAPI } from "@/lib/morpho-api";
import { fetchVaultList } from "@/lib/rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Use Morpho API first, fall back to RPC if it fails
    let vaults;
    try {
      vaults = await fetchVaultListFromAPI();
      console.log(`[vaults] fetched ${vaults.length} vaults from Morpho API`);
    } catch (apiErr) {
      console.warn("[vaults] Morpho API failed, falling back to RPC:", apiErr);
      vaults = await fetchVaultList();
    }
    return NextResponse.json({ vaults });
  } catch (e) {
    console.error("Failed to fetch vaults:", e);
    return NextResponse.json(
      { error: "Failed to fetch vault data" },
      { status: 500 }
    );
  }
}
