import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/reui-spinner";

import {
  nftRead,
  readProvider,
  useMintStatus,
  useNftArtwork,
  useRefreshAll,
  useVouchers,
  usdtRead,
} from "@/hooks/useLitdex";
import { useWallet } from "@/hooks/useWallet";
import { PASS_CARD_IMAGES } from "@/lib/images";
import {
  NFT_ADDRESS,
  discountLabel,
  discountedPrice,
  formatUsdt,
  nftContract,
  parseWalletError,
  payTokenContract,
  usdtContract,
  type PayToken,
  type Voucher,
} from "@/lib/litdex";

const WALLET_LIMIT = 2;

function formatCountdown(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function MintCard() {
  const { address, getSigner, correctNetwork, connect, connecting } = useWallet();
  const { data: mintStatus, isLoading, refetch: refetchStatus } = useMintStatus();
  const { data: voucherData, refetch: refetchVouchers } = useVouchers();
  const refreshAll = useRefreshAll();
  const [status, setStatus] = useState<string | null>(null);
  const [mintedId, setMintedId] = useState<bigint | null>(null);
  const { data: mintedArt, isLoading: mintedArtLoading } = useNftArtwork(
    mintedId ?? undefined,
  );

  const [passIndex, setPassIndex] = useState(0);
  const [loadedPasses, setLoadedPasses] = useState<string[]>([]);
  const markPassLoaded = useCallback(
    (label: string) =>
      setLoadedPasses((prev) =>
        prev.includes(label) ? prev : [...prev, label],
      ),
    [],
  );
  const passesReady = loadedPasses.length >= PASS_CARD_IMAGES.length;
  useEffect(() => {
    if (!passesReady) return;
    const timer = setInterval(
      () => setPassIndex((i) => (i + 1) % PASS_CARD_IMAGES.length),
      2600,
    );
    return () => clearInterval(timer);
  }, [passesReady]);
  const activePass =
    PASS_CARD_IMAGES[passIndex] ?? PASS_CARD_IMAGES[0] ?? null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const started = mintStatus?.publicMintStarted ?? false;
  const startsAt = (mintStatus?.publicMintStart ?? 0) * 1000;
  const countdown =
    startsAt > 0 ? formatCountdown(startsAt - now) : null;
  const price = mintStatus ? BigInt(mintStatus.priceUSDT) : null;
  const soldOut =
    !!mintStatus && mintStatus.supplyCap > 0 && mintStatus.totalMinted >= mintStatus.supplyCap;
  const busy = status !== null;
  const ownedCount = mintStatus?.walletPublicMintCount ?? 0;
  const limitReached = mintStatus?.walletLimitReached ?? false;
  const progress =
    mintStatus && mintStatus.supplyCap > 0
      ? (mintStatus.totalMinted / mintStatus.supplyCap) * 100
      : 0;

  const voucherGroups = (() => {
    const map = new Map<string, Voucher[]>();
    for (const v of voucherData?.vouchers ?? []) {
      const key = v.category.toUpperCase();
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  })();

  const [qtyByCategory, setQtyByCategory] = useState<Record<string, number>>({});
  const qtyFor = (category: string) => qtyByCategory[category] ?? 0;
  const setQty = (category: string, next: number, max: number) =>
    setQtyByCategory((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(next, max)),
    }));

  const selectedVouchers = voucherGroups.flatMap(([category, vouchers]) =>
    vouchers.slice(0, Math.min(qtyFor(category), vouchers.length)),
  );
  const selectedCost =
    price !== null
      ? selectedVouchers.reduce(
          (sum, v) => sum + discountedPrice(price, v.discountBps),
          0n,
        )
      : null;

  const remainingPublic = Math.max(0, WALLET_LIMIT - ownedCount);
  const [publicQty, setPublicQty] = useState(1);
  const publicQtyClamped = Math.max(1, Math.min(publicQty, Math.max(remainingPublic, 1)));
  const [payToken, setPayToken] = useState<PayToken>("USDT");

  async function handleMint(quantity: number) {
    if (!address || price === null || quantity < 1) return;
    const totalCost = price * BigInt(quantity);
    try {
      const token = payTokenContract(payToken, readProvider());
      const allowance = await token.allowance(address, NFT_ADDRESS);
      const signer = await getSigner();
      if (allowance < totalCost) {
        setStatus("Approving…");
        const approveTx = await payTokenContract(payToken, signer).approve(NFT_ADDRESS, totalCost);
        await approveTx.wait();
      }
      setStatus("Minting…");
      const nft = nftContract(signer);
      const tx =
        payToken === "USDC"
          ? await nft.mintBatchUSDC(quantity)
          : await nft.mintBatch(quantity);
      await tx.wait();
      try {
        const next = await nftRead().nextTokenId();
        if (next > 1n) setMintedId(next - 1n);
      } catch {
        // artwork is optional
      }
      await refreshAll();
      await refetchStatus();
      toast.success(
        quantity > 1 ? `${quantity} NFTs minted` : "NFT minted",
      );
    } catch (err) {
      toast.error(parseWalletError(err, "Mint failed, try again."));
    } finally {
      setStatus(null);
    }
  }

  async function handleVoucherMint(vouchers: Voucher[]) {
    if (!address || price === null || vouchers.length === 0) return;
    const totalCost = vouchers.reduce(
      (sum, v) => sum + discountedPrice(price, v.discountBps),
      0n,
    );
    try {
      const allowance = await usdtRead().allowance(address, NFT_ADDRESS);
      const signer = await getSigner();
      if (allowance < totalCost) {
        setStatus("Approving…");
        const approveTx = await usdtContract(signer).approve(NFT_ADDRESS, totalCost);
        await approveTx.wait();
      }
      setStatus("Minting…");
      const tx = await nftContract(signer).mintWithVouchersBatch(
        vouchers.map((v) => [v.wallet, v.discountBps, v.nonce]),
        vouchers.map((v) => v.signature),
      );
      await tx.wait();
      try {
        const next = await nftRead().nextTokenId();
        if (next > 1n) setMintedId(next - 1n);
      } catch {
        // artwork is optional
      }
      await refreshAll();
      await Promise.all([refetchStatus(), refetchVouchers()]);
      toast.success(
        `${vouchers.length} ${vouchers.length === 1 ? "NFT" : "NFTs"} minted with whitelist discounts`,
      );
    } catch (err) {
      toast.error(parseWalletError(err, "Voucher mint failed, try again."));
    } finally {
      setStatus(null);
    }
  }


  return (
    <div
      id="mint"
      className="grid scroll-mt-24 gap-6 rounded-[2rem] bg-[#F4F4F2] p-4 md:grid-cols-2 md:p-6"
    >
      <div className="relative">
        <div className="relative aspect-square w-full overflow-hidden rounded-[1.5rem] border-[3px] border-white bg-black/5 shadow-xl">
          {PASS_CARD_IMAGES.map((pass, i) => (
            <img
              key={pass.label}
              src={pass.src}
              alt={`Litdex pass card — ${pass.label}`}
              ref={(el) => {
                // SSR: image may finish before hydration attaches onLoad.
                if (el && el.complete) markPassLoaded(pass.label);
              }}
              onLoad={() => markPassLoaded(pass.label)}
              onError={() => markPassLoaded(pass.label)}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-[900ms] ease-in-out ${
                i === passIndex && passesReady ? "z-10 opacity-100" : "z-0 opacity-0"
              }`}
            />
          ))}
          {!passesReady && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#F4F4F2]">
              <Spinner className="size-8 text-[#0038FF]" />
              <p className="btn-text text-black/50">Loading pass cards…</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          {PASS_CARD_IMAGES.map((pass, i) => (
            <span
              key={pass.label}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === passIndex
                  ? "w-6 bg-[#0038FF]"
                  : "w-1.5 bg-black/20"
              }`}
            />
          ))}
          <span className="ml-2 font-mono text-[11px] font-bold uppercase tracking-wide text-black/50">
            {activePass?.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col p-2 md:p-4">
        <h3 className="btn-heading heading-ul text-black">Mint a champion</h3>
        <p className="btn-text mt-2 text-black/50">
          Common rarity to start · Base Sepolia
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="btn-text text-xs font-bold text-black/60">
              Items minted
            </p>
            <p className="btn-text text-xs font-bold text-black">
              {isLoading || !mintStatus
                ? "…"
                : `${mintStatus.totalMinted} / ${mintStatus.supplyCap}`}
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#0038FF] transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {address && voucherData && voucherData.totalVouchers > 0 && (
          <div className="mt-6 rounded-[1.25rem] border-2 border-[#0038FF]/20 bg-white p-4 md:p-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#CCFF00] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-black">
              Whitelist eligible · {voucherData.totalVouchers} discounted mint
              {voucherData.totalVouchers === 1 ? "" : "s"} available
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {voucherGroups.map(([category, vouchers]) => {
                const qty = Math.min(qtyFor(category), vouchers.length);
                const first = vouchers[0]!;
                return (
                  <div
                    key={category}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-[#F4F4F2] px-4 py-3"
                  >
                    <div>
                      <p className="btn-text text-sm font-bold uppercase text-black">
                        {category} x {vouchers.length}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-[#0038FF]">
                        {discountLabel(first.discountBps)} off
                        {price !== null
                          ? ` · $${formatUsdt(discountedPrice(price, first.discountBps))} USDT`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full bg-white px-2 py-1">
                        <button
                          aria-label={`Decrease ${category} quantity`}
                          disabled={qty <= 0 || busy}
                          onClick={() => setQty(category, qty - 1, vouchers.length)}
                          className="grid size-7 place-items-center rounded-full bg-black/5 text-black disabled:opacity-40"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-5 text-center font-mono text-sm font-bold text-black">
                          {qty}
                        </span>
                        <button
                          aria-label={`Increase ${category} quantity`}
                          disabled={qty >= vouchers.length || busy}
                          onClick={() => setQty(category, qty + 1, vouchers.length)}
                          className="grid size-7 place-items-center rounded-full bg-black/5 text-black disabled:opacity-40"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              disabled={
                !correctNetwork ||
                busy ||
                price === null ||
                selectedVouchers.length === 0
              }
              onClick={() => void handleVoucherMint(selectedVouchers)}
              className="btn fx-9 btn-pill btn-blue mt-4 w-full"
            >
              <span className="btn-label">
                {selectedVouchers.length === 0
                  ? "Select vouchers to mint"
                  : (status ??
                    `Mint ${selectedVouchers.length} in one transaction · $${
                      selectedCost !== null ? formatUsdt(selectedCost) : "…"
                    } USDT`)}
              </span>
            </button>
          </div>
        )}


        {!address && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-white p-4 md:p-5">
              <p className="btn-text font-bold text-black">Whitelist mint</p>
              <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#0038FF]">
                <span className="inline-block size-2 rounded-full bg-[#CCFF00] ring-2 ring-[#0038FF]/30" />
                Open
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-white p-4 md:p-5">
              <p className="btn-text font-bold text-black">Public mint</p>
              <p className="font-mono text-[11px] font-bold uppercase text-black/60">
                {started
                  ? "Live now"
                  : countdown
                    ? `Starts in ${countdown}`
                    : "Not scheduled"}
              </p>
            </div>
            <button
              onClick={() => void connect()}
              disabled={connecting}
              className="btn fx-9 btn-pill btn-blue w-full"
            >
              <span className="btn-label">
                {connecting ? "Connecting…" : "Connect wallet to mint"}
              </span>
            </button>
          </div>
        )}

        {address && (
          <div className="mt-6 rounded-[1.25rem] bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="btn-text font-bold text-black">Public stage</p>
                <p className="mt-1 font-mono text-sm font-bold text-black">
                  ${price !== null ? formatUsdt(price) : "…"} {payToken}
                </p>
                <div className="mt-2 flex items-center gap-1 rounded-full bg-[#F4F4F2] p-1">
                  <span className="pl-2 font-mono text-[10px] font-bold uppercase tracking-wide text-black/50">
                    Pay with
                  </span>
                  {(["USDT", "USDC"] as const).map((token) => (
                    <button
                      key={token}
                      type="button"
                      disabled={busy}
                      onClick={() => setPayToken(token)}
                      className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold transition-colors disabled:opacity-40 ${
                        payToken === token
                          ? "bg-[#0038FF] text-white"
                          : "text-black/60 hover:text-black"
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#0038FF]">
                  <span className="inline-block size-2 rounded-full bg-[#CCFF00] ring-2 ring-[#0038FF]/30" />
                  {started ? "MINTING NOW" : "NOT STARTED"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full bg-[#F4F4F2] px-2 py-1">
                  <button
                    aria-label="Decrease public mint quantity"
                    disabled={publicQtyClamped <= 1 || busy}
                    onClick={() => setPublicQty(publicQtyClamped - 1)}
                    className="grid size-7 place-items-center rounded-full bg-black/5 text-black disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-5 text-center font-mono text-sm font-bold text-black">
                    {publicQtyClamped}
                  </span>
                  <button
                    aria-label="Increase public mint quantity"
                    disabled={publicQtyClamped >= remainingPublic || busy}
                    onClick={() => setPublicQty(publicQtyClamped + 1)}
                    className="grid size-7 place-items-center rounded-full bg-black/5 text-black disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button
                  disabled={
                    !correctNetwork ||
                    soldOut ||
                    busy ||
                    !mintStatus ||
                    !started ||
                    limitReached
                  }
                  onClick={() => void handleMint(publicQtyClamped)}
                  className="btn fx-9 btn-pill btn-blue"
                >
                  <span className="btn-label">
                    {soldOut
                      ? "Sold out"
                      : !started
                        ? countdown
                          ? `Starts in ${countdown}`
                          : "Not started"
                        : limitReached
                          ? "Limit reached"
                          : (status ??
                            `Mint ${publicQtyClamped} · $${
                              price !== null
                                ? formatUsdt(price * BigInt(publicQtyClamped))
                                : "…"
                            } USDT`)}
                  </span>
                </button>
              </div>
            </div>
            <p className="mt-3 text-right font-mono text-[11px] font-bold tracking-wide text-black/40">
              LIMIT {WALLET_LIMIT} PER WALLET · YOU OWN {ownedCount}
            </p>
          </div>
        )}

        {mintedId !== null && (
          <p className="mt-4 font-mono text-xs font-bold text-black/60">
            {mintedArtLoading
              ? "Loading artwork…"
              : `Champion #${mintedId.toString()} minted!`}
          </p>
        )}
      </div>

    </div>
  );
}
