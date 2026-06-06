import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SanctumLST {
  symbol: string;
  mint: string;
  name: string;
  decimals: number;
  latestApy?: number;
  avgApy?: number;
  tvl?: number;
  solValue?: number;
}

interface SanctumResponse {
  data: SanctumLST[];
}

export async function GET() {
  const jagsolMint = process.env.NEXT_PUBLIC_JAGSOL_MINT;

  if (!jagsolMint) {
    return NextResponse.json({ apy: null, error: "Mint not configured" }, { status: 200 });
  }

  try {
    const apiKey = process.env.SANCTUM_API_KEY;
    if (!apiKey) throw new Error("No Sanctum API key");

    const response = await fetch(
      `https://sanctum-api.ironforge.network/lsts?apiKey=${apiKey}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 28800 },
      }
    );

    if (!response.ok) throw new Error(`Sanctum API error: ${response.status}`);

    const data: SanctumResponse = await response.json();
    const jagsol = data.data?.find((lst) => lst.mint === jagsolMint);

    if (!jagsol) throw new Error("JagSOL not found in Sanctum LST list");

    const apy = jagsol.latestApy
      ? jagsol.latestApy < 1
        ? jagsol.latestApy * 100
        : jagsol.latestApy
      : null;

    return NextResponse.json(
      { apy, avgApy: jagsol.avgApy ?? null, tvl: jagsol.tvl ?? null, mint: jagsolMint },
      { headers: { "Cache-Control": "public, s-maxage=28800, stale-while-revalidate=57600" } }
    );
  } catch (error) {
    console.error("JagSOL APY fetch error:", error);
    return NextResponse.json(
      { apy: null, error: "Failed to fetch APY" },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  }
}
