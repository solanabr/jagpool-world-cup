"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { InfoPanel, InfoPanelProps } from "./InfoPanel";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { TokenInputBlock } from "./TokenInputBlock";
import { HeaderMetrics } from "./HeaderMetrics";
import { getConnection } from "@/lib/solana/connection";
import { getSanctumTokens } from "@/lib/staking/getSanctumTokens";
import { supportedTokens, Token } from "@/lib/staking/tokens";
import { TriangleAlert } from "lucide-react";
import { Toaster } from "react-hot-toast";

const JAGSOL_MINT = process.env.NEXT_PUBLIC_JAGSOL_MINT ?? "";
const MAX_DECIMALS = 9;

export default function StakeTerminal() {
  const { publicKey } = useWallet();
  const [tokenList, setTokenList] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [conversionAmount, setConversionAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [jagsolBalance, setJagsolBalance] = useState<number | null>(null);
  const [walletSymbol, setWalletSymbol] = useState("SOL");
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isConversionLoading, setIsConversionLoading] = useState(false);
  const [tooSmall, setTooSmall] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<InfoPanelProps>({
    rate: null, priceImpactPct: null, routerLabel: null, feeAmount: null,
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const quoteSeq = useRef(0);
  const latestInput = useRef<string>("");
  const lastRateRef = useRef<number | null>(null);

  const formatBalance = (balance: number): string => {
    if (balance === 0) return "0";
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 0.01) return balance.toFixed(4);
    if (balance < 1) return balance.toFixed(3);
    return balance.toFixed(2);
  };

  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setWalletBalance(null);
      setJagsolBalance(null);
      setIsRefreshingBalances(false);
      return;
    }

    setIsRefreshingBalances(true);
    const connection = getConnection();

    try {
      if (selectedToken) {
        setWalletSymbol(selectedToken.symbol);
        if (selectedToken.address === "So11111111111111111111111111111111111111112") {
          const lamports = await connection.getBalance(publicKey);
          setWalletBalance(lamports / 1e9);
        } else {
          const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: new PublicKey(selectedToken.address),
          });
          const total = accounts.value.reduce((sum, acc) => {
            const info = acc.account.data.parsed.info;
            return sum + parseFloat(info.tokenAmount.uiAmountString ?? "0");
          }, 0);
          setWalletBalance(total);
        }
      }

      if (JAGSOL_MINT) {
        const jagAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(JAGSOL_MINT),
        });
        const total = jagAccounts.value.reduce((sum, acc) => {
          const info = acc.account.data.parsed.info;
          return sum + parseFloat(info.tokenAmount.uiAmountString ?? "0");
        }, 0);
        setJagsolBalance(total);
      }
    } catch (error) {
      console.error("Balance fetch error:", error);
    } finally {
      setIsRefreshingBalances(false);
    }
  }, [publicKey, selectedToken]);

  const handleStakeComplete = useCallback(async () => {
    setAmount("");
    setConversionAmount("");
    setTimeout(() => { refreshBalances(); }, 500);
  }, [refreshBalances]);

  const limitDecimals = (value: string, limit: number) => {
    if (!value || !value.includes(".")) return value;
    const [i, d] = value.split(".");
    return `${i}.${d.slice(0, limit)}`;
  };

  const inDecimals = useMemo(() => {
    if (!selectedToken) return 9;
    return Math.min(selectedToken.decimals, MAX_DECIMALS);
  }, [selectedToken]);

  const minHumanUnit = useMemo(() => 1 / Math.pow(10, inDecimals), [inDecimals]);

  const handleAmountChange = (v: string) => {
    const val = limitDecimals(v.replace(",", "."), MAX_DECIMALS);
    setAmount(val);
    const num = parseFloat(val);
    if (!val || isNaN(num)) { quoteSeq.current++; setConversionAmount(""); setIsConversionLoading(false); setTooSmall(false); return; }
    if (num > 0 && num < minHumanUnit) { quoteSeq.current++; setTooSmall(true); setConversionAmount("0"); setIsConversionLoading(false); return; }
    setTooSmall(false);
    setIsConversionLoading(true);
  };

  const isAbortError = (e: unknown): boolean => e instanceof Error && e.name === "AbortError";

  const fetchQuote = useCallback(
    async (inputAmount: number, isInitialQuote = false) => {
      if (!selectedToken || !JAGSOL_MINT) return;
      if (isInitialQuote) setIsInitialLoading(true);
      const mySeq = ++quoteSeq.current;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const baseAmount = BigInt(Math.floor(inputAmount * Math.pow(10, inDecimals)));

        const res = await fetch(
          `/api/jagsol/quote?inputMint=${selectedToken.address}&outputMint=${JAGSOL_MINT}&amount=${baseAmount}`,
          { signal: controller.signal, cache: "no-store", redirect: "manual" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (mySeq !== quoteSeq.current) return;

        if (data?.outAmount != null) {
          const outUnits = BigInt(data.outAmount);

          if (outUnits === BigInt(0)) {
            setTooSmall(true);
            if (!isInitialQuote) setConversionAmount("0");
            setQuoteInfo((q) => ({
              ...q,
              rate: lastRateRef.current ?? q.rate,
              priceImpactPct: data.priceImpactPct?.toString() ?? q.priceImpactPct,
              routerLabel: data.routePlan?.[0]?.swapInfo?.label ?? q.routerLabel,
              feeAmount: data.routePlan?.[0]?.swapInfo?.feeAmount?.toString() ?? q.feeAmount,
            }));
            return;
          }

          setTooSmall(false);
          const outAdjusted = Number(data.outAmount) / Math.pow(10, 9);
          const rateVal = outAdjusted / inputAmount;
          lastRateRef.current = rateVal;

          if (!isInitialQuote) setConversionAmount(outAdjusted.toFixed(Math.min(9, 9)));

          setQuoteInfo({
            rate: rateVal,
            priceImpactPct: data.priceImpactPct?.toString() ?? "0",
            routerLabel: data.routePlan?.[0]?.swapInfo?.label ?? "none",
            feeAmount: data.routePlan?.[0]?.swapInfo?.feeAmount?.toString() ?? "0",
          });
        }
      } catch (err: unknown) {
        if (isAbortError(err)) return;
        console.error(err);
      } finally {
        clearTimeout(timeout);
        if (isInitialQuote) setIsInitialLoading(false);
        if (!isInitialQuote && mySeq === quoteSeq.current) setIsConversionLoading(false);
      }
    },
    [selectedToken, inDecimals]
  );

  useEffect(() => { latestInput.current = amount; }, [amount]);

  useEffect(() => {
    if (selectedToken && (!amount || amount === "0")) fetchQuote(1, true);
  }, [selectedToken, amount, fetchQuote]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const num = parseFloat(amount);
      if (!amount || isNaN(num) || num === 0 || tooSmall) { setConversionAmount("0"); return; }
      fetchQuote(num);
    }, 500);
  }, [amount, tooSmall, fetchQuote]);

  useEffect(() => {
    if (!selectedToken) return;
    const id = setInterval(() => {
      const s = latestInput.current;
      const n = parseFloat(s as string);
      if (!s || Number.isNaN(n) || n === 0 || tooSmall) {
        setConversionAmount("0");
        setQuoteInfo((q) => ({ ...q, rate: lastRateRef.current ?? q.rate }));
        return;
      }
      fetchQuote(n);
    }, 10000);
    return () => clearInterval(id);
  }, [selectedToken, tooSmall, fetchQuote]);

  useEffect(() => {
    async function fetchTokens() {
      if (!publicKey) {
        setTokenList(supportedTokens);
        setSelectedToken(supportedTokens[0] ?? null);
        return;
      }
      try {
        const connection = getConnection();
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });

        const uniqueMints = tokenAccounts.value
          .map((acc) => acc.account.data.parsed.info.mint as string)
          .filter((mint, idx, arr) =>
            arr.indexOf(mint) === idx &&
            !supportedTokens.some((t) => t.address === mint)
          );

        const sanctumTokens = await getSanctumTokens(uniqueMints);
        const filteredSanctum = sanctumTokens.filter((t) => t.address !== JAGSOL_MINT);
        const allTokens = [...supportedTokens, ...filteredSanctum];
        setTokenList(allTokens);
        setSelectedToken(allTokens[0] ?? null);
      } catch {
        setTokenList(supportedTokens);
        setSelectedToken(supportedTokens[0] ?? null);
      }
    }
    fetchTokens();
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) refreshBalances();
    else setIsRefreshingBalances(false);
  }, [publicKey, selectedToken, refreshBalances]);

  useEffect(() => {
    if (selectedToken?.address === JAGSOL_MINT) {
      const first = tokenList.find((t) => t.address !== JAGSOL_MINT) ?? null;
      setSelectedToken(first);
    }
  }, [tokenList, selectedToken]);

  useEffect(() => {
    setAmount("");
    setConversionAmount("");
  }, [selectedToken]);

  const jagsolToken = useMemo<Token>(() => ({
    address: JAGSOL_MINT,
    symbol: "JagSOL",
    decimals: 9,
    chainId: 101,
    name: "JagSOL",
    logoURI: "/brand/logomark-white.png",
  }), []);

  const selectableTokens = useMemo(
    () => tokenList.filter((t) => t.address !== JAGSOL_MINT),
    [tokenList]
  );

  const tokensReady = !!selectedToken?.address && !!jagsolToken.address;
  const canStake =
    tokensReady &&
    parseFloat(amount || "0") > 0 &&
    parseFloat(conversionAmount || "0") > 0 &&
    !tooSmall;

  return (
    <>
    <Toaster position="top-center" />
    <div className="p-5 xl:p-6 w-full mx-auto flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#0e0e0e] shadow-[0_0_30px_rgba(0,0,0,0.4)]">
        <HeaderMetrics
          outputAmount={conversionAmount}
          isCalculatingRewards={isInitialLoading || !conversionAmount || conversionAmount === "0"}
        />

        <div className="flex flex-col gap-2">
          <TokenInputBlock
            label="You're staking"
            value={amount}
            onChange={handleAmountChange}
            readOnly={false}
            isJagSol={false}
            token={selectedToken ?? undefined}
            onSelectToken={setSelectedToken}
            balance={
              walletBalance !== null
                ? `${formatBalance(walletBalance)} ${walletSymbol}`
                : undefined
            }
            isBalanceLoading={isRefreshingBalances}
            tokens={selectableTokens}
          />

          <TokenInputBlock
            label="To receive"
            value={conversionAmount}
            onChange={undefined}
            readOnly
            isLoading={isConversionLoading}
            isJagSol
            balance={
              jagsolBalance !== null
                ? `${formatBalance(jagsolBalance)} JagSOL`
                : undefined
            }
            isBalanceLoading={isRefreshingBalances}
          />
        </div>

        <div className="flex flex-col gap-2">
          <InfoPanel
            {...quoteInfo}
            inputSymbol={selectedToken?.symbol ?? null}
            outputSymbol="JagSOL"
            isLoading={isInitialLoading}
          />
          {tooSmall && (
            <p className="text-xs text-foreground/40 flex items-center gap-1.5 px-1">
              <TriangleAlert className="size-3" />
              Amount is below the minimum swap size for this route.
            </p>
          )}
        </div>

        <ConnectWalletButton
          amount={parseFloat(amount)}
          selectedToken={tokensReady ? selectedToken : null}
          targetToken={tokensReady ? jagsolToken : null}
          blocked={!canStake}
          onStakeComplete={handleStakeComplete}
        />
      </div>
    </>
  );
}
