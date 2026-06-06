"use client";

import { Token } from "@/lib/staking/tokens";
import { AmountInput } from "./AmountInput";
import TokenSelect from "./TokenSelect";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface TokenInputBlockProps {
  label: string;
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  isLoading?: boolean;
  balance?: string;
  isBalanceLoading?: boolean;
  token?: Token;
  onSelectToken?: (token: Token) => void;
  isJagSol?: boolean;
  tokens?: Token[];
}

const MAX_AMOUNT = 99_999_999;

export function TokenInputBlock({
  label,
  value,
  onChange,
  readOnly,
  isLoading,
  balance,
  isBalanceLoading,
  token,
  onSelectToken,
  isJagSol,
  tokens,
}: TokenInputBlockProps) {
  const sanitize = (raw: string) => {
    let s = (raw || "").replace(/[^\d.]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    return s;
  };

  const handleChange = (v: string) => {
    const s = sanitize(v);
    if (s === "") { onChange?.(""); return; }

    const hasDot = s.includes(".");
    const [intStrRaw, decStr = ""] = s.split(".");
    const intStr = intStrRaw.replace(/^0+(?=\d)/, "");

    if (hasDot) { onChange?.(`${intStr || "0"}.${decStr}`); return; }

    const intNum = intStr === "" ? 0 : Number(intStr);
    if (Number.isFinite(intNum) && intNum > MAX_AMOUNT) return;

    onChange?.(intStr || "0");
  };

  const handleClickBalance = () => {
    const numeric = (balance?.split(" ")[0] || "0").replace(/,/g, "");
    const s = sanitize(numeric);
    const [intStrRaw, decStr] = s.split(".");
    const intStr = intStrRaw || "0";
    const intNum = Number(intStr);
    const capped = intNum > MAX_AMOUNT ? String(MAX_AMOUNT) : String(intNum);
    onChange?.(decStr !== undefined ? `${capped}.${decStr}` : capped);
  };

  return (
    <div className="p-4 rounded-xl flex flex-col gap-1 border border-white/8 bg-white/3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-normal text-foreground/50">{label}</label>
        {isBalanceLoading ? (
          <div className="flex items-center gap-1.5 text-sm text-foreground/35">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading...
          </div>
        ) : balance ? (
          <button
            onClick={handleClickBalance}
            className="text-sm text-foreground/50 hover:text-foreground/80 transition-colors"
          >
            {balance}
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <div className={isLoading ? "opacity-0 pointer-events-none" : undefined}>
            <AmountInput value={value} onChange={handleChange} readOnly={readOnly} />
          </div>
          {isLoading && (
            <div className="absolute inset-0 flex items-center">
              <Loader2 className="size-7 animate-spin text-foreground/25" />
            </div>
          )}
        </div>

        {isJagSol ? (
          <div className="flex items-center gap-2 shrink-0">
            <Image
              src="/brand/logomark-white.png"
              alt="JagSOL"
              width={28}
              height={28}
              quality={100}
              priority
              className="rounded-full"
            />
            <span className="text-sm font-medium text-foreground/70">JagSOL</span>
          </div>
        ) : token && onSelectToken ? (
          <div className="shrink-0 h-10 flex items-center">
            <TokenSelect token={token} onSelect={onSelectToken} tokens={tokens || []} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
