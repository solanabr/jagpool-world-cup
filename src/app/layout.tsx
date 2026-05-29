import type { Metadata } from "next";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { WalletContextProvider } from "@/components/providers/wallet-provider";

export const metadata: Metadata = {
  title: "JagPool World Cup",
  description: "Predict, stake, win — JagPool x Superteam Brazil World Cup 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
