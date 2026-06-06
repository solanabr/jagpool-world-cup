export interface InfoPanelProps {
  rate: number | null;
  priceImpactPct: string | null;
  routerLabel: string | null;
  feeAmount: string | null;
  inputSymbol?: string | null;
  outputSymbol?: string | null;
  isLoading?: boolean;
}

export function InfoPanel({ rate, priceImpactPct, routerLabel, feeAmount, inputSymbol, outputSymbol }: InfoPanelProps) {
  return (
    <div className="text-sm flex flex-col gap-2 px-4 py-3 text-foreground/60 border border-white/8 rounded-xl bg-white/2">
      <p className="flex justify-between items-center">
        Rate{" "}
        <span className="text-foreground/40">
          {rate && inputSymbol && outputSymbol
            ? `1 ${inputSymbol} ≈ ${rate.toFixed(6)} ${outputSymbol}`
            : "—"}
        </span>
      </p>
      <p className="flex justify-between items-center">
        Price Impact{" "}
        <span className="text-foreground/40">
          {priceImpactPct !== null ? `${(parseFloat(priceImpactPct) * 100).toFixed(2)}%` : "—"}
        </span>
      </p>
      <p className="flex justify-between items-center">
        Router <span className="text-foreground/40">{routerLabel || "none"}</span>
      </p>
      <p className="flex justify-between items-center">
        Fee{" "}
        <span className="text-foreground/40">
          {feeAmount
            ? (parseFloat(feeAmount) / 1e9).toLocaleString(undefined, {
                minimumFractionDigits: 6,
                maximumFractionDigits: 9,
              })
            : "0"}
        </span>
      </p>
    </div>
  );
}
