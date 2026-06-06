"use client";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Token } from "@/lib/staking/tokens";

interface Props {
  token: Token;
  onSelect: (token: Token) => void;
  tokens: Token[];
}

export default function TokenSelect({ token, onSelect, tokens = [] }: Props) {
  if (!token) return null;

  return (
    <Select
      value={token.address}
      onValueChange={(value) => {
        const selected = tokens.find((t) => t.address === value);
        if (selected) onSelect(selected);
      }}
    >
      <SelectTrigger className="font-normal w-auto h-auto p-0 border-0 bg-transparent cursor-pointer shadow-none focus:ring-0 focus:outline-none">
        <SelectValue aria-label={token.symbol} className="cursor-pointer">
          {token.logoURI && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.logoURI}
              alt={token.symbol}
              width={24}
              height={24}
              className="rounded-full cursor-pointer"
            />
          )}
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="w-40 max-h-50 p-1">
        {tokens.map((t) => (
          <SelectItem key={t.address} value={t.address}>
            <div className="flex items-center gap-2 min-w-0">
              {t.logoURI && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logoURI}
                  alt={t.symbol}
                  width={20}
                  height={20}
                  className="rounded-full shrink-0"
                />
              )}
              <span className="text-sm truncate">{t.symbol}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
