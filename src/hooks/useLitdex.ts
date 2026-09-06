import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ethers } from "ethers";
import { useCallback } from "react";
import { useWallet } from "./useWallet";
import {
  API_BASE,
  BASE_CHAIN_ID,
  BASE_RPC_URL,
  CONFIG_GAMES_REQUIRED,
  CONFIG_REPAIR_COST,
  artworkUrl,
  nftContract,
  pointsContract,
  usdtContract,
  type OwnedNft,
  type VoucherResponse,
} from "@/lib/litdex";

const READ_RPC = BASE_RPC_URL;

export function readProvider() {
  return new ethers.JsonRpcProvider(READ_RPC, BASE_CHAIN_ID, { staticNetwork: true });
}

export const nftRead = () => nftContract(readProvider());
export const pointsRead = () => pointsContract(readProvider());
export const usdtRead = () => usdtContract(readProvider());

export function useBasePoints() {
  const { address } = useWallet();
  return useQuery({
    queryKey: ["basePoints", address],
    enabled: !!address,
    queryFn: async (): Promise<bigint> => pointsRead().balance(address!),
    refetchInterval: 20000,
  });
}

export function useMintInfo() {
  return useQuery({
    queryKey: ["mintInfo"],
    queryFn: async () => {
      const c = nftRead();
      const [price, cap, minted] = await Promise.all([
        c.mintPriceUSDT(),
        c.commonSupplyCap(),
        c.rarityMinted(0),
      ]);
      return { price, cap, minted };
    },
    refetchInterval: 30000,
  });
}

export type MintStatus = {
  totalMinted: number;
  supplyCap: number;
  publicMintStart: number;
  publicMintStarted: boolean;
  walletPublicMintCount: number;
  walletLimitReached: boolean;
  priceUSDT: string;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useMintStatus() {
  const { address } = useWallet();
  const target = address ?? ZERO_ADDRESS;
  return useQuery({
    queryKey: ["mintStatus", target],
    refetchInterval: 15000,
    retry: false,
    queryFn: async (): Promise<MintStatus> => {
      const res = await fetch(`${API_BASE}/mint-status/${target}`);
      const json = (await res.json()) as MintStatus & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "mint status failed");
      return json;
    },
  });
}


export function useVouchers() {
  const { address } = useWallet();
  return useQuery({
    queryKey: ["vouchers", address],
    enabled: !!address,
    refetchInterval: 30000,
    retry: false,
    queryFn: async (): Promise<VoucherResponse> => {
      const res = await fetch(`${API_BASE}/whitelist/vouchers/${address}`);
      const json = (await res.json()) as VoucherResponse & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "voucher fetch failed");
      return json;
    },
  });
}

export function useGameConfig() {
  return useQuery({
    queryKey: ["gameConfig"],
    queryFn: async () => {
      const c = nftRead();
      const [repairCost, gamesRequired] = await Promise.all([
        c.config(CONFIG_REPAIR_COST),
        c.config(CONFIG_GAMES_REQUIRED),
      ]);
      return { repairCost, gamesRequired };
    },
    staleTime: 5 * 60 * 1000,
  });
}

const OWNED_CACHE_PREFIX = "litdex:owned:";

type CachedNft = Omit<OwnedNft, "tokenId"> & { tokenId: string };

function readOwnedCache(address: string): OwnedNft[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(OWNED_CACHE_PREFIX + address.toLowerCase());
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedNft[];
    return parsed.map((n) => ({ ...n, tokenId: BigInt(n.tokenId) }));
  } catch {
    return undefined;
  }
}

function writeOwnedCache(address: string, nfts: OwnedNft[]) {
  if (typeof window === "undefined") return;
  try {
    const serialisable: CachedNft[] = nfts.map((n) => ({ ...n, tokenId: n.tokenId.toString() }));
    window.localStorage.setItem(
      OWNED_CACHE_PREFIX + address.toLowerCase(),
      JSON.stringify(serialisable),
    );
  } catch {
    /* storage full / private mode — ignore */
  }
}

export function useOwnedNfts() {
  const { address } = useWallet();
  return useQuery({
    queryKey: ["ownedNfts", address],
    enabled: !!address,
    // Show the last known list instantly, then refresh in the background.
    initialData: () => (address ? readOwnedCache(address) : undefined),
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<OwnedNft[]> => {
      const c = nftRead();
      const next = await c.nextTokenId();
      const ids: bigint[] = [];
      for (let i = 1n; i < next; i++) ids.push(i);

      const owners = await Promise.all(
        ids.map(async (id) => {
          try {
            return await c.ownerOf(id);
          } catch {
            return null;
          }
        }),
      );
      const mine = ids.filter((_, i) => {
        const owner = owners[i];
        return !!owner && owner.toLowerCase() === address!.toLowerCase();
      });

      const result = await Promise.all(
        mine.map(async (tokenId) => {
          const s = await c.tokenState(tokenId);
          return {
            tokenId,
            rarity: Number(s[0]),
            level: Number(s[1]),
            damaged: Boolean(s[2]),
            gamesAtMaxLevel: Number(s[3]),
          };
        }),
      );
      writeOwnedCache(address!, result);
      return result;
    },
    refetchInterval: 30000,
  });
}

export function useLevelCost(level: number) {
  const nextLevel = level + 1;
  return useQuery({
    queryKey: ["levelCost", nextLevel],
    enabled: nextLevel <= 9,
    queryFn: async (): Promise<bigint> => nftRead().pointsPerLevel(nextLevel),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Resolves the artwork for a token. The predictable API URL is returned
 * immediately as placeholder data so the image starts downloading at once;
 * the on-chain tokenURI is resolved in the background and only swaps the
 * source if it points somewhere else.
 */
export function useNftArtwork(tokenId: bigint | undefined) {
  return useQuery({
    queryKey: ["nftArtwork", tokenId?.toString()],
    enabled: tokenId !== undefined,
    retry: false,
    staleTime: Infinity,
    placeholderData: tokenId !== undefined ? artworkUrl(tokenId) : undefined,
    queryFn: async (): Promise<string | null> => {
      const uri = await nftRead().tokenURI(tokenId!);
      const httpUri = uri.startsWith("ipfs://")
        ? uri.replace("ipfs://", "https://ipfs.io/ipfs/")
        : uri;
      let image: string | null = null;
      if (httpUri.startsWith("data:application/json")) {
        const json = JSON.parse(atob(httpUri.split(",")[1] ?? ""));
        image = json.image ?? null;
      } else {
        const res = await fetch(httpUri);
        if (!res.ok) return artworkUrl(tokenId!);
        const json = await res.json();
        image = json.image ?? null;
      }
      if (image && image.startsWith("ipfs://")) {
        image = image.replace("ipfs://", "https://ipfs.io/ipfs/");
      }
      return image ?? artworkUrl(tokenId!);
    },
  });
}

/** Warm the browser cache for a batch of token artworks. */
export function prefetchArtwork(tokenIds: bigint[]) {
  if (typeof window === "undefined") return;
  for (const id of tokenIds) {
    const img = new Image();
    img.decoding = "async";
    img.src = artworkUrl(id);
  }
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await qc.invalidateQueries();
  }, [qc]);
}
