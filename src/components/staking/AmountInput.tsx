"use client";

import React, { useEffect, useMemo, useRef } from "react";

interface Props {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function AmountInput({ value, onChange, readOnly = false, placeholder = "0" }: Props) {
  const formatted = useMemo(() => {
    if (!value) return "";
    const [intPart, decimalPart] = value.split(".");
    const intNum = Number(intPart.replace(/\D/g, ""));
    const formattedInt = isNaN(intNum) ? "" : intNum.toLocaleString("en-US");
    return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
  }, [value]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = readOnly ? 0 : scrollRef.current.scrollWidth;
    }
  }, [formatted, readOnly]);

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const ev = e.nativeEvent as InputEvent;
    const ch = ev.data;
    if (ch === "," || ch === ".") {
      e.preventDefault();
      if (!value.includes(".")) {
        onChange?.(value ? `${value}.` : "0.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    let raw = e.target.value.replace(/,/g, "");
    raw = raw.replace(/[^\d.]/g, "");
    const firstDot = raw.indexOf(".");
    if (firstDot !== -1) {
      raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
    }
    onChange?.(raw);
  };

  const widthCh = Math.max((formatted || "0").length, 1) + 1;

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto overflow-y-hidden whitespace-nowrap">
      <input
        type="text"
        inputMode="decimal"
        value={formatted}
        onBeforeInput={handleBeforeInput}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{ minWidth: `${widthCh}ch` }}
        className={`bg-transparent text-white text-2xl sm:text-3xl md:text-4xl leading-tight font-normal outline-none border-none w-full
          [&::-webkit-inner-spin-button]:appearance-none
          [&::-webkit-outer-spin-button]:appearance-none
          ${readOnly ? "text-foreground/40 cursor-default" : "text-foreground placeholder:text-foreground/20"}`}
      />
    </div>
  );
}
