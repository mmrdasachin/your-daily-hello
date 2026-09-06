import { ethers } from "ethers";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingImage } from "@/components/LoadingImage";
import { Spinner } from "@/components/ui/reui-spinner";
import { COMMON_PFP, EPIC_PFP, LEGEND_PFP, PASS_CARD_IMAGES, RARE_PFP } from "@/lib/images";
import {
  usdtRead,
  useBasePoints,
  useGameConfig,
  useLevelCost,
  useNftArtwork,
  useRefreshAll,
} from "@/hooks/useLitdex";
import { useWallet } from "@/hooks/useWallet";
import {
  MAX_LEVEL,
  NFT_ADDRESS,
  RARITY_NAMES,
  formatPoints,
  formatUsdt,
  nftContract,
  openSeaUrl,
  parseWalletError,
  usdtContract,
  type OwnedNft,
} from "@/lib/litdex";

const RARITY_COLOR: Record<number, string> = {
  0: "#A8A0BE",
  1: "#4D9FFF",
  2: "#C24DFF",
  3: "#FFB833",
};

const RARITY_IMAGE: Record<number, string> = {
  0: COMMON_PFP,
  1: RARE_PFP,
  2: EPIC_PFP,
  3: LEGEND_PFP,
};

function PillButton({
  children,
  onClick,
  disabled,
  variant = "lime",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "lime" | "blue" | "ghost";
}) {
  const variantClass = {
    lime: "btn-lime",
    blue: "btn-blue",
    ghost: "btn-ghost",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn fx-9 btn-pill ${variantClass} w-full`}
    >
      <span className="btn-label">{children}</span>
    </button>
  );
}

export function NftCard({ nft, compact = false }: { nft: OwnedNft; compact?: boolean }) {
  const { address, getSigner, correctNetwork } = useWallet();
  const refreshAll = useRefreshAll();
  const { data: points } = useBasePoints();
  const { data: config } = useGameConfig();
  const { data: levelCost } = useLevelCost(nft.level);
  const { data: artwork, isLoading: artLoading } = useNftArtwork(nft.tokenId);
  const [busy, setBusy] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");

  const atMax = nft.level >= MAX_LEVEL;
  const canAfford = levelCost !== undefined && points !== undefined && points >= levelCost;
  const gamesRequired = config?.gamesRequired ?? null;
  const promoteReady =
    gamesRequired !== null && BigInt(nft.gamesAtMaxLevel) >= gamesRequired && atMax;

  async function run(label: string, fn: (signer: ethers.Signer) => Promise<void>, fallback: string) {
    if (!address) return;
    setBusy(label);
    try {
      const signer = await getSigner();
      await fn(signer);
      await refreshAll();
      toast.success(`${label} complete`);
    } catch (err) {
      toast.error(parseWalletError(err, fallback));
    } finally {
      setBusy(null);
    }
  }

  const nftWith = (signer: ethers.Signer) => nftContract(signer);

  const handleLevelUp = () =>
    run(
      "Level up",
      async (signer) => {
        const tx = await nftWith(signer).levelUp(nft.tokenId);
        await tx.wait();
      },
      "Level up failed, try again.",
    );

  const handlePromote = () =>
    run(
      "Promote",
      async (signer) => {
        const tx = await nftWith(signer).promote(nft.tokenId);
        await tx.wait();
      },
      "Promote failed, try again.",
    );

  const handleRepair = () =>
    run(
      "Repair",
      async (signer) => {
        const cost = config?.repairCost ?? 0n;
        const allowance = await usdtRead().allowance(address!, NFT_ADDRESS);
        if (allowance < cost) {
          const usdt = usdtContract(signer);
          const approveTx = await usdt.approve(NFT_ADDRESS, cost);
          await approveTx.wait();
        }
        const tx = await nftWith(signer).repair(nft.tokenId);
        await tx.wait();
      },
      "Repair failed, try again.",
    );

  const handleTransfer = () => {
    if (!ethers.isAddress(recipient)) {
      toast.error("Enter a valid recipient address.");
      return;
    }
    return run(
      "Transfer",
      async (signer) => {
        const tx = await nftWith(signer).transferFrom(address!, recipient, nft.tokenId);
        await tx.wait();
        setRecipient("");
      },
      "Transfer failed, try again.",
    );
  };

  const disabled = !correctNetwork || busy !== null;
  const rarityColor = RARITY_COLOR[nft.rarity] ?? "#A8A0BE";

  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-[#0038FF]/15 bg-[#0038FF]/5 p-6 shadow-xl backdrop-blur-md">

      {artLoading ? (
        <div className="flex aspect-square w-full items-center justify-center rounded-3xl border-[3px] border-white bg-black/5">
          <Spinner className="size-8 text-[#0038FF]" />
        </div>
      ) : artwork ? (
        <LoadingImage
          src={artwork}
          eager
          placeholderSrc={PASS_CARD_IMAGES[nft.rarity]?.src}
          alt={`Litdex champion #${nft.tokenId.toString()}`}
          wrapperClassName="aspect-square w-full overflow-hidden rounded-3xl border-[3px] border-white bg-black/5 shadow-md"
          className="size-full object-contain"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={RARITY_IMAGE[nft.rarity] ?? COMMON_PFP}
            alt={`${RARITY_NAMES[nft.rarity] ?? "Common"} rarity logo`}
            className="size-12 object-contain"
          />
          <div>
            <p className="btn-text text-black/50">#{nft.tokenId.toString().padStart(4, "0")}</p>
            <p className="btn-text text-black">TIER {nft.level}</p>
          </div>

        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="btn-text rounded-full px-3 py-1 text-white"
            style={{ backgroundColor: rarityColor }}
          >
            {RARITY_NAMES[nft.rarity] ?? "Unknown"}
          </span>
          {nft.damaged && (
            <span className="btn-text rounded-full bg-[#FF4D4D] px-3 py-1 text-white">
              Damaged
            </span>
          )}
        </div>
      </div>

      {!compact && (
      <div className="space-y-2 border-t border-black/10 pt-4">
        {atMax ? (
          <>
            <p className="btn-text text-black/60">Max level — promote instead</p>
            <p className="btn-text text-black/50">
              {nft.gamesAtMaxLevel}/{gamesRequired?.toString() ?? "…"} games
              {promoteReady ? " — ready" : ""}
            </p>
            <PillButton
              variant="blue"
              disabled={disabled || !promoteReady}
              onClick={() => void handlePromote()}
            >
              {busy === "Promote" ? "Promoting…" : "Promote"}
            </PillButton>
          </>
        ) : (
          <>
            <p className="btn-text text-black/60">
              Level up cost:{" "}
              <span className="btn-text text-black">
                {levelCost !== undefined ? formatPoints(levelCost) : "…"} pts
              </span>
            </p>
            <PillButton
              disabled={disabled || nft.damaged || !canAfford}
              onClick={() => void handleLevelUp()}
            >
              {busy === "Level up" ? "Leveling…" : "Level up"}
            </PillButton>
            {nft.damaged && <p className="btn-text text-[#FF4D4D]">Repair before leveling up.</p>}
            {!nft.damaged && !canAfford && (
              <p className="btn-text text-black/50">Not enough Base points.</p>
            )}
          </>
        )}


        {nft.damaged && (
          <PillButton variant="blue" disabled={disabled} onClick={() => void handleRepair()}>
            {busy === "Repair"
              ? "Repairing…"
              : `Repair · $${config ? formatUsdt(config.repairCost) : "…"} USDT`}
          </PillButton>
        )}
      </div>
      )}

      {!compact && (
      <div className="space-y-2 border-t border-black/10 pt-4">
        <p className="btn-text text-black/50">Transfer</p>
        <div className="flex gap-2">
          <input
            placeholder="0x recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={disabled}
            className="btn-text w-full rounded-full border border-black/20 bg-white px-4 py-2 text-black outline-none placeholder:text-black/40 focus:border-[#0038FF]"
          />
          <button
            onClick={() => void handleTransfer()}
            disabled={disabled}
            className="btn fx-9 btn-pill btn-lime shrink-0"
          >
            <span className="btn-label">{busy === "Transfer" ? "…" : "Send"}</span>
          </button>
        </div>
        <a
          href={openSeaUrl(nft.tokenId)}
          target="_blank"
          rel="noreferrer"
          className="btn-text inline-flex items-center gap-1 text-[#0038FF] hover:underline"
        >
          View on OpenSea <ExternalLink className="size-3" />
        </a>
      </div>
      )}
    </div>
  );
}
