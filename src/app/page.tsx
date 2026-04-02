import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Morpho Vault Risk Analyzer
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time risk analysis for MetaMorpho vaults on Katana — withdrawal liquidity, market utilization, collateral quality, and DEX exit depth.
        </p>
      </div>

      <Dashboard />
    </main>
  );
}
