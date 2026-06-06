import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { quoteResponse, userPublicKey } = await req.json();

    if (!quoteResponse || !userPublicKey) {
      return new Response("Missing parameters", { status: 400 });
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

    const data = await res.json();

    if (!data?.swapTransaction) {
      return new Response("Failed to get swapTransaction", { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Jupiter swap error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
