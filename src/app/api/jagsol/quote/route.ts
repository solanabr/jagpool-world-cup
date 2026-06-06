import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const inputMint = req.nextUrl.searchParams.get("inputMint");
  const outputMint = req.nextUrl.searchParams.get("outputMint");
  const amount = req.nextUrl.searchParams.get("amount");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "Missing parameters" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50&restrictIntermediateTokens=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch quote" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
