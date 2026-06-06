import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { quoteResponse, userPublicKey } = await req.json();

    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const res = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1000000,
            priorityLevel: "veryHigh",
          },
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Jupiter swap request failed" },
        { status: 502 },
      );
    }

    const data = await res.json();

    if (!data?.swapTransaction) {
      return NextResponse.json(
        { error: "No swap transaction returned" },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Jupiter swap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
