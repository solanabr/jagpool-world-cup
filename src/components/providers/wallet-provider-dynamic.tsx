"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const WalletContextProvider = dynamic(
  () => import("./wallet-provider").then((m) => ({ default: m.WalletContextProvider })),
  { ssr: false },
);

export function DynamicWalletProvider({ children }: { children: ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
