import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { BrowserProvider, Contract, JsonRpcProvider, parseEther, formatEther } from "ethers";
import { ArrowLeftRight, ChevronDown, ExternalLink, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LITVM_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  RPC_URL,
  SEPOLIA_RPC_URL,
  EXPLORER_URL,
  SEPOLIA_EXPLORER_URL,
} from "@/lib/litdex-core-logic";

// ============== Constants ==============
const LIT_BRIDGE = "0x8F154dA71735869559D326306056430Db51e7233";
const SEPOLIA_BRIDGE = "0xc4807A6547339aE1c38EE1Cc4A27c5A7acb9c38C";
const WZKLTC_SEPOLIA = "0xBE9C63907d0Bfaa55EF8729907f37B9c60863fc7";
const LDEX_LITVM = "0xBAaba603e6298fbb76325a6B0d47Cd57154ca641";
const LDEX_SEPOLIA = "0x688dB3dbd582D9E394bdE138ad1d1dD162b18A07";

const LIT_BRIDGE_ABI = [
  "function lockZKLTC() payable",
  "function lockLDEX(uint256 amount)",
];
const SEPOLIA_BRIDGE_ABI = [
  "function lockETH() payable",
  "function lockWZKLTC(uint256 amount)",
  "function lockLDEX(uint256 amount)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns(bool)",
  "function allowance(address,address) view returns(uint256)",
  "function balanceOf(address) view returns(uint256)",
];

const ZKLTC_LOGO = "https://raw.githubusercontent.com/zorodas/friendly-greetings/main/public/coins/zkltc.jpg";
const ETH_LOGO = "https://raw.githubusercontent.com/zorodas/remix-of-remix-of-hello-world-connect/main/public/coins/sepolia_eth_logo.png";

type ChainKey = "litvm" | "sepolia";
type BridgeToken = {
  id: string;
  symbol: string;
  display: string;
  address: string | null; // null = native
  decimals: 18;
  destSymbol: string;
  max: number;
  logo: "zkltc" | "eth" | "ldex" | "wzkltc";
};

const TOKENS: Record<ChainKey, BridgeToken[]> = {
  litvm: [
    { id: "litvm-zkltc", symbol: "zkLTC", display: "zkLTC", address: null, decimals: 18, destSymbol: "WZKLTC", max: 1, logo: "zkltc" },
    { id: "litvm-ldex", symbol: "LDEX", display: "LDEX", address: LDEX_LITVM, decimals: 18, destSymbol: "LDEX", max: 1, logo: "ldex" },
  ],
  sepolia: [
    { id: "sep-eth", symbol: "ETH", display: "ETH", address: null, decimals: 18, destSymbol: "zkLTC", max: 1, logo: "eth" },
    { id: "sep-wzkltc", symbol: "WZKLTC", display: "WZKLTC", address: WZKLTC_SEPOLIA, decimals: 18, destSymbol: "zkLTC", max: 1, logo: "wzkltc" },
    { id: "sep-ldex", symbol: "LDEX", display: "LDEX", address: LDEX_SEPOLIA, decimals: 18, destSymbol: "LDEX", max: 1, logo: "ldex" },
  ],
};

const CHAIN_INFO: Record<ChainKey, { id: number; name: string; explorer: string; rpc: string; nativeSymbol: string; nativeName: string }> = {
  litvm: { id: LITVM_CHAIN_ID, name: "LitVM", explorer: EXPLORER_URL, rpc: RPC_URL, nativeSymbol: "zkLTC", nativeName: "zkLTC" },
  sepolia: { id: SEPOLIA_CHAIN_ID, name: "Sepolia", explorer: SEPOLIA_EXPLORER_URL, rpc: SEPOLIA_RPC_URL, nativeSymbol: "ETH", nativeName: "Sepolia ETH" },
};

const litvmProv = new JsonRpcProvider(RPC_URL);
const sepProv = new JsonRpcProvider(SEPOLIA_RPC_URL);

// ============== Token logo ==============
const LogoLD = ({ size = 14 }: { size?: number }) => (
  <div className="flex items-center justify-center font-black italic tracking-tighter" style={{ width: size, height: size }}>
    <span style={{ fontSize: size }} className="text-black leading-none">L</span>
    <span style={{ fontSize: size }} className="text-black leading-none -ml-[0.1em]">D</span>
  </div>
);

const TokenLogo = ({ logo, size = 24 }: { logo: BridgeToken["logo"]; size?: number }) => {
  if (logo === "ldex") {
    return (
      <div className="rounded-full bg-white flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <LogoLD size={size * 0.7} />
      </div>
    );
  }
  if (logo === "wzkltc") {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <img src={ZKLTC_LOGO} alt="WZKLTC" className="w-full h-full rounded-full object-cover border border-white/10" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <div className="absolute -bottom-0.5 -right-0.5 bg-[#FF6B00] text-black text-[8px] font-black rounded-full flex items-center justify-center border border-black" style={{ width: size * 0.45, height: size * 0.45 }}>W</div>
      </div>
    );
  }
  const src = logo === "eth" ? ETH_LOGO : ZKLTC_LOGO;
  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <img src={src} alt={logo} className="w-full h-full rounded-full object-cover border border-white/10" crossOrigin="anonymous" referrerPolicy="no-referrer" />
    </div>
  );
};

// ============== Chain selector card ==============
const ChainCard = ({ chain, label }: { chain: ChainKey; label: string }) => {
  const info = CHAIN_INFO[chain];
  return (
    <div className="flex-1 min-w-0 p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
          {chain === "litvm" ? <TokenLogo logo="zkltc" size={20} /> : <TokenLogo logo="eth" size={20} />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-white truncate">{info.name}</div>
          <div className="text-[9px] text-brand-text-muted uppercase tracking-wider truncate">Chain {info.id}</div>
        </div>
      </div>
    </div>
  );
};

// ============== Token dropdown ==============
const TokenDropdown = ({
  tokens,
  selected,
  onSelect,
}: {
  tokens: BridgeToken[];
  selected: BridgeToken;
  onSelect: (t: BridgeToken) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-brand-surface-2 border border-brand-border hover:border-white/30 transition-all text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <TokenLogo logo={selected.logo} size={24} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{selected.symbol}</div>
            <div className="text-[9px] text-brand-text-muted uppercase tracking-wider truncate">Bridge to {selected.destSymbol}</div>
          </div>
        </div>
        <ChevronDown size={14} className={cn("text-white/60 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 mt-2 rounded-xl border border-brand-border bg-brand-surface shadow-2xl backdrop-blur-xl overflow-hidden"
            style={{ zIndex: 9999, maxHeight: 240, overflowY: "auto" }}
          >
            {tokens.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  t.id === selected.id ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <TokenLogo logo={t.logo} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{t.symbol}</div>
                  <div className="text-[9px] text-brand-text-muted uppercase tracking-wider">→ {t.destSymbol}</div>
                </div>
                <div className="text-[9px] text-brand-text-muted uppercase tracking-wider">max {t.max}</div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============== Helpers ==============
async function readBalance(chain: ChainKey, token: BridgeToken, addr: string): Promise<bigint> {
  const prov = chain === "litvm" ? litvmProv : sepProv;
  if (token.address === null) return await prov.getBalance(addr);
  const c = new Contract(token.address, ERC20_ABI, prov);
  return (await c.balanceOf(addr)) as bigint;
}

async function ensureChain(chainId: number) {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet detected");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + chainId.toString(16) }] });
  } catch (e: any) {
    if (e?.code === 4902 || /Unrecognized chain/i.test(e?.message || "")) {
      const info = chainId === SEPOLIA_CHAIN_ID ? CHAIN_INFO.sepolia : CHAIN_INFO.litvm;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x" + chainId.toString(16),
          chainName: info.name,
          nativeCurrency: { name: info.nativeName, symbol: info.nativeSymbol, decimals: 18 },
          rpcUrls: [info.rpc],
          blockExplorerUrls: [info.explorer],
        }],
      });
    } else {
      throw e;
    }
  }
}

// ============== Progress Modal ==============
type StepState = "pending" | "active" | "complete";
type ProgressState = {
  open: boolean;
  steps: { key: string; label: string }[];
  current: number;
  done: boolean;
  failed: boolean;
  txHash: string | null;
  destChain: ChainKey;
  amount: string;
  destSymbol: string;
};

const Stepper = ({ steps, current, done }: { steps: { key: string; label: string }[]; current: number; done: boolean }) => (
  <div className="flex items-center justify-between w-full px-2">
    {steps.map((s, i) => {
      const state: StepState = done || i < current ? "complete" : i === current ? "active" : "pending";
      return (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                state === "pending" && "border-white/15 bg-white/[0.03] text-white/30",
                state === "active" && "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00] animate-pulse",
                state === "complete" && "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
              )}
            >
              {state === "complete" ? <Check size={14} strokeWidth={3} /> : state === "active" ? <Loader2 size={14} className="animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
            </div>
            <div className={cn("text-[8px] font-bold uppercase tracking-[0.15em] text-center max-w-[60px] leading-tight", state === "pending" ? "text-white/30" : state === "active" ? "text-[#FF6B00]" : "text-[#1D9E75]")}>
              {s.label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("flex-1 h-0.5 mx-1 transition-all", done || i < current ? "bg-[#1D9E75]" : "bg-white/10")} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const ProgressModal = ({ state, onClose, onBridgeAgain }: { state: ProgressState; onClose: () => void; onBridgeAgain: () => void }) => {
  const explorer = state.destChain === "sepolia" ? SEPOLIA_EXPLORER_URL : EXPLORER_URL;
  const sourceExplorer = state.destChain === "sepolia" ? EXPLORER_URL : SEPOLIA_EXPLORER_URL;
  return (
    <AnimatePresence>
      {state.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            // Not dismissible during bridging
            if (state.done || state.failed) onClose();
          }}
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full sm:max-w-md mx-auto p-6 sm:p-7"
            style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 16 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-text-muted">Cross-Chain Bridge</div>
                <div className="text-base font-black text-white mt-0.5">
                  {state.done ? "Bridge Complete" : state.failed ? "Bridge Failed" : "Bridging…"}
                </div>
              </div>
              {(state.done || state.failed) && (
                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="py-4">
              <Stepper steps={state.steps} current={state.current} done={state.done} />
            </div>

            {state.done && (
              <div className="mt-4 p-4 rounded-xl bg-[#1D9E75]/10 border border-[#1D9E75]/30">
                <div className="text-sm font-bold text-white">
                  ✅ {state.amount} {state.destSymbol} arrived on {CHAIN_INFO[state.destChain].name}!
                </div>
              </div>
            )}

            {state.failed && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="text-sm font-bold text-white">Bridge transaction failed. Please try again.</div>
              </div>
            )}

            {state.txHash && (
              <a
                href={`${sourceExplorer}/tx/${state.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 text-xs font-bold uppercase tracking-wider text-white transition-all"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            )}

            {(state.done || state.failed) && (
              <button
                onClick={onBridgeAgain}
                className="mt-3 w-full py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] hover:bg-white/90 transition-all"
              >
                Bridge Again
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============== Main Bridge Card ==============
export default function BridgeCard({ className = "" }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [fromChain, setFromChain] = React.useState<ChainKey>("litvm");
  const toChain: ChainKey = fromChain === "litvm" ? "sepolia" : "litvm";
  const [tokenId, setTokenId] = React.useState<string>(TOKENS.litvm[0].id);
  const [amount, setAmount] = React.useState<string>("");
  const [balance, setBalance] = React.useState<bigint>(0n);
  const [isBridging, setIsBridging] = React.useState(false);

  const tokens = TOKENS[fromChain];
  const selected = tokens.find((t) => t.id === tokenId) || tokens[0];

  // Reset token when chain swaps
  React.useEffect(() => {
    setTokenId(TOKENS[fromChain][0].id);
    setAmount("");
  }, [fromChain]);

  // Load balance
  React.useEffect(() => {
    let alive = true;
    if (!address) {
      setBalance(0n);
      return;
    }
    (async () => {
      try {
        const b = await readBalance(fromChain, selected, address);
        if (alive) setBalance(b);
      } catch {
        if (alive) setBalance(0n);
      }
    })();
    return () => { alive = false; };
  }, [address, fromChain, selected.id, isBridging]);

  const balanceStr = React.useMemo(() => {
    try {
      const n = Number(formatEther(balance));
      return n.toFixed(4);
    } catch { return "0.0000"; }
  }, [balance]);

  const swapChains = () => setFromChain((c) => (c === "litvm" ? "sepolia" : "litvm"));

  const setPct = (pct: number) => {
    const maxN = Math.min(selected.max, Number(formatEther(balance)));
    const v = (maxN * pct) / 100;
    setAmount(v > 0 ? v.toFixed(6).replace(/\.?0+$/, "") : "0");
  };

  const setMax = () => {
    const maxN = Math.min(selected.max, Number(formatEther(balance)));
    setAmount(maxN > 0 ? maxN.toFixed(6).replace(/\.?0+$/, "") : "0");
  };

  // Progress modal state
  const [progress, setProgress] = React.useState<ProgressState>({
    open: false,
    steps: [],
    current: 0,
    done: false,
    failed: false,
    txHash: null,
    destChain: "sepolia",
    amount: "0",
    destSymbol: "",
  });

  const closeProgress = () => setProgress((p) => ({ ...p, open: false }));
  const bridgeAgain = () => { closeProgress(); setAmount(""); };

  const handleBridge = async () => {
    if (!isConnected || !address) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > selected.max) {
      alert(`Max bridge amount is ${selected.max} ${selected.symbol}`);
      return;
    }

    const needsApproval = selected.address !== null;
    const steps = needsApproval
      ? [
          { key: "start", label: "Start" },
          { key: "approve", label: "Approve" },
          { key: "confirm", label: "Confirm" },
          { key: "bridging", label: "Bridging" },
          { key: "arrived", label: "Arrived" },
        ]
      : [
          { key: "start", label: "Start" },
          { key: "confirm", label: "Confirm" },
          { key: "bridging", label: "Bridging" },
          { key: "arrived", label: "Arrived" },
        ];

    setProgress({
      open: true,
      steps,
      current: 0,
      done: false,
      failed: false,
      txHash: null,
      destChain: toChain,
      amount: amount,
      destSymbol: selected.destSymbol,
    });
    setIsBridging(true);

    try {
      // Step 0 → 1: ensure chain
      const targetChainId = CHAIN_INFO[fromChain].id;
      await ensureChain(targetChainId);
      try { await switchChainAsync({ chainId: targetChainId }); } catch { /* ignore wagmi side */ }

      const eth = (window as any).ethereum;
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const amountWei = parseEther(amount);

      const bridgeAddr = fromChain === "litvm" ? LIT_BRIDGE : SEPOLIA_BRIDGE;

      // Approve if needed
      if (needsApproval && selected.address) {
        setProgress((p) => ({ ...p, current: 1 }));
        const erc = new Contract(selected.address, ERC20_ABI, signer);
        const cur = (await erc.allowance(address, bridgeAddr)) as bigint;
        if (cur < amountWei) {
          const tx = await erc.approve(bridgeAddr, amountWei);
          await tx.wait();
        }
      }

      // Confirm (send bridge tx)
      setProgress((p) => ({ ...p, current: needsApproval ? 2 : 1 }));
      let tx: any;
      if (fromChain === "litvm") {
        const bridge = new Contract(LIT_BRIDGE, LIT_BRIDGE_ABI, signer);
        if (selected.symbol === "zkLTC") {
          tx = await bridge.lockZKLTC({ value: amountWei });
        } else if (selected.symbol === "LDEX") {
          tx = await bridge.lockLDEX(amountWei);
        }
      } else {
        const bridge = new Contract(SEPOLIA_BRIDGE, SEPOLIA_BRIDGE_ABI, signer);
        if (selected.symbol === "ETH") {
          tx = await bridge.lockETH({ value: amountWei });
        } else if (selected.symbol === "WZKLTC") {
          tx = await bridge.lockWZKLTC(amountWei);
        } else if (selected.symbol === "LDEX") {
          tx = await bridge.lockLDEX(amountWei);
        }
      }
      if (!tx) throw new Error("Unsupported token");

      setProgress((p) => ({ ...p, current: needsApproval ? 3 : 2, txHash: tx.hash }));
      await tx.wait();

      // Bridging → Arrived
      setProgress((p) => ({ ...p, current: needsApproval ? 4 : 3, done: true }));
    } catch (err: any) {
      console.error(err);
      setProgress((p) => ({ ...p, failed: true }));
    } finally {
      setIsBridging(false);
    }
  };

  const canBridge = isConnected && !!amount && parseFloat(amount) > 0 && !isBridging;

  return (
    <div className={cn("w-full max-w-[480px] mx-auto", className)}>
      <div
        className="rounded-2xl bg-brand-surface border border-brand-border p-5 backdrop-blur-xl transition-all"
        style={{ ['--glow' as any]: '0 0 0 1px #FF6B00, 0 0 20px rgba(255,107,0,0.15)' }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px #FF6B00, 0 0 20px rgba(255,107,0,0.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-text-muted">Cross-Chain</div>
            <div className="text-lg font-black text-white italic">Bridge</div>
          </div>
          <div className="px-2 py-1 rounded-md bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[9px] font-bold uppercase tracking-widest text-[#FF6B00]">
            Testnet
          </div>
        </div>

        {/* From / Swap / To */}
        <div className="flex items-stretch gap-2 mb-4">
          <ChainCard chain={fromChain} label="From" />
          <button
            onClick={swapChains}
            className="self-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 flex items-center justify-center text-white shrink-0 transition-all"
            aria-label="Swap chains"
          >
            <ArrowLeftRight size={14} />
          </button>
          <ChainCard chain={toChain} label="To" />
        </div>

        {/* Token */}
        <div className="mb-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-1.5">Token</div>
          <TokenDropdown tokens={tokens} selected={selected} onSelect={(t) => setTokenId(t.id)} />
        </div>

        {/* Amount */}
        <div className="mb-3 p-3 rounded-xl bg-brand-surface-2 border border-brand-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-text-muted">Amount</div>
            <div className="text-[10px] text-brand-text-muted">
              Balance: <span className="text-white font-bold tabular-nums">{balanceStr}</span> {selected.symbol}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-black text-white outline-none tabular-nums placeholder:text-white/20"
            />
            <button
              onClick={setMax}
              className="px-2.5 py-1 rounded-md bg-white/10 border border-white/10 hover:border-white/30 text-[10px] font-black uppercase tracking-widest text-white"
            >
              Max
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setPct(p)}
                className="flex-1 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-[10px] font-bold text-white/80 transition-all"
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Rate */}
        <div className="mb-4 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-brand-text-muted flex items-center justify-between">
          <span>Rate</span>
          <span className="text-white font-bold">1 {selected.symbol} = 1 {selected.destSymbol}</span>
        </div>

        {/* Wrong chain warning */}
        {isConnected && chainId !== CHAIN_INFO[fromChain].id && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[10px] text-[#FF6B00] font-bold uppercase tracking-wider">
            Wallet on wrong network — will switch to {CHAIN_INFO[fromChain].name} on bridge
          </div>
        )}

        {/* Bridge button */}
        <button
          onClick={handleBridge}
          disabled={!canBridge}
          className={cn(
            "w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.25em] transition-all",
            canBridge
              ? "bg-white text-black hover:bg-white/90 cursor-pointer"
              : "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
          )}
        >
          {!isConnected ? "Connect Wallet" : isBridging ? "Bridging…" : `Bridge ${selected.symbol} → ${selected.destSymbol}`}
        </button>
      </div>

      <ProgressModal state={progress} onClose={closeProgress} onBridgeAgain={bridgeAgain} />
    </div>
  );
}
