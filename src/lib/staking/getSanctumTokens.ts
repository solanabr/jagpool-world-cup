import { Token } from "./tokens";

interface SanctumLST {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri: string;
}

export async function getSanctumTokens(mints: string[]): Promise<Token[]> {
  try {
    const res = await fetch("https://extra-api.sanctum.so/v1/lsts");
    const data = await res.json();

    if (!data?.lsts || !Array.isArray(data.lsts)) {
      return [];
    }

    const lsts = data.lsts as SanctumLST[];

    return lsts
      .filter((lst) => mints.includes(lst.mint))
      .map((lst) => ({
        chainId: 101,
        symbol: lst.symbol,
        name: lst.name,
        address: lst.mint,
        decimals: lst.decimals,
        logoURI: lst.logo_uri,
      }));
  } catch {
    return [];
  }
}
