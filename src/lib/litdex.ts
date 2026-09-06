import { ethers } from "ethers";

export type ChainConfig = {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
};

export const BASE_SEPOLIA: ChainConfig = {
  chainId: 84532,
  chainIdHex: "0x14a34",
  chainName: "Base Sepolia",
  rpcUrls: ["https://sepolia.base.org"],
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

export const LITVM: ChainConfig = {
  chainId: 4441,
  chainIdHex: "0x1159",
  chainName: "LitVM",
  rpcUrls: ["https://liteforge.rpc.caldera.xyz/http"],
  nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 },
  blockExplorerUrls: ["https://liteforge.explorer.caldera.xyz"],
};

export const KNOWN_CHAINS: ChainConfig[] = [BASE_SEPOLIA, LITVM];

export function chainName(chainId: number | null): string {
  if (chainId === null) return "Unknown";
  return KNOWN_CHAINS.find((c) => c.chainId === chainId)?.chainName ?? `Chain ${chainId}`;
}

export const BASE_CHAIN_ID = BASE_SEPOLIA.chainId;
export const BASE_CHAIN_HEX = BASE_SEPOLIA.chainIdHex;
export const BASE_RPC_URL = BASE_SEPOLIA.rpcUrls[0]!;
export const BASE_SEPOLIA_CHAIN_ID = BASE_CHAIN_ID;
export const BASE_SEPOLIA_HEX = BASE_CHAIN_HEX;

export const USDT_ADDRESS = "0x02b8b8090dFFb61dE134A9e639577E9c153Ac871";
export const POINTS_ADDRESS = "0x904b369740813dc56dE2fc457F60F832354427e0";
export const NFT_ADDRESS = "0xd7E5A73D66D202CD211290536eab5096E8a5114F";

export const API_BASE = "https://litdex-nft.test-hub.xyz";

/** Predictable artwork URL served by the metadata API — lets us show art without an RPC round-trip. */
export function artworkUrl(tokenId: bigint | number | string): string {
  return `${API_BASE}/metadata/${tokenId.toString()}/image`;
}

export const USDT_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const POINTS_ABI = [
  "function balance(address) view returns (uint256)",
  "function claimed(address) view returns (uint256)",
  "function claim(uint256 totalEarned, uint256 expiry, bytes signature) external",
];

export const NFT_ABI = [
  "function mint() external",
  "function mintBatch(uint256 quantity) external",
  "function mintWithVoucher((address wallet,uint256 discountBps,bytes32 nonce) voucher, bytes signature) external",
  "function mintWithVouchersBatch((address wallet,uint256 discountBps,bytes32 nonce)[] vouchers, bytes[] signatures) external",
  "function levelUp(uint256 tokenId) external",
  "function promote(uint256 tokenId) external",
  "function repair(uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenState(uint256 tokenId) view returns (uint8 rarity, uint8 level, bool damaged, uint32 gamesAtMaxLevel)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function nextTokenId() view returns (uint256)",
  "function pointsPerLevel(uint8 level) view returns (uint256)",
  "function commonSupplyCap() view returns (uint256)",
  "function rarityMinted(uint8 rarity) view returns (uint256)",
  "function mintPriceUSDT() view returns (uint256)",
  "function config(bytes32 key) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function approve(address to, uint256 tokenId) external",
];

export const CONFIG_REPAIR_COST = ethers.keccak256(ethers.toUtf8Bytes("repairCostUSDT"));
export const CONFIG_GAMES_REQUIRED = ethers.keccak256(
  ethers.toUtf8Bytes("gamesRequiredForPromotion"),
);

export const RARITY_NAMES = ["Common", "Rare", "Epic", "Legend"] as const;
export const MAX_LEVEL = 9;

export const RARITY_CLASS: Record<number, string> = {
  0: "bg-secondary text-secondary-foreground",
  1: "bg-primary/20 text-primary",
  2: "bg-accent/25 text-accent",
  3: "bg-chart-3/25 text-chart-3",
};

export function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatUsdt(value: bigint) {
  const whole = value / 1_000_000n;
  const frac = value % 1_000_000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

export function formatPoints(value: bigint | string) {
  const v = typeof value === "string" ? value : value.toString();
  return v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function openSeaUrl(tokenId: string | bigint) {
  return `https://testnets.opensea.io/assets/base-sepolia/${NFT_ADDRESS}/${tokenId.toString()}`;
}

export function parseWalletError(err: unknown, fallback: string) {
  const e = err as { code?: string | number; shortMessage?: string; message?: string };
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "Transaction rejected in wallet.";
  return fallback;
}

export type Voucher = {
  category: string;
  wallet: string;
  discountBps: number;
  nonce: string;
  signature: string;
};

export type VoucherResponse = {
  wallet: string;
  totalVouchers: number;
  vouchers: Voucher[];
};

export function voucherCategoryId(category: string): number {
  const i = RARITY_NAMES.findIndex((r) => r.toLowerCase() === category.toLowerCase());
  return i >= 0 ? i : 0;
}

export function discountLabel(discountBps: number) {
  return `${discountBps / 100}%`;
}

export function discountedPrice(price: bigint, discountBps: number) {
  return (price * BigInt(10000 - discountBps)) / 10000n;
}

export type OwnedNft = {
  tokenId: bigint;
  rarity: number;
  level: number;
  damaged: boolean;
  gamesAtMaxLevel: number;
};

type Tx = ethers.ContractTransactionResponse;

export interface NftContract extends ethers.BaseContract {
  mint(): Promise<Tx>;
  mintBatch(quantity: number): Promise<Tx>;
  mintWithVoucher(
    voucher: [string, number, string],
    signature: string,
  ): Promise<Tx>;
  mintWithVouchersBatch(
    vouchers: [string, number, string][],
    signatures: string[],
  ): Promise<Tx>;
  levelUp(tokenId: bigint): Promise<Tx>;
  promote(tokenId: bigint): Promise<Tx>;
  repair(tokenId: bigint): Promise<Tx>;
  transferFrom(from: string, to: string, tokenId: bigint): Promise<Tx>;
  ownerOf(tokenId: bigint): Promise<string>;
  balanceOf(owner: string): Promise<bigint>;
  tokenState(tokenId: bigint): Promise<[bigint, bigint, boolean, bigint]>;
  tokenURI(tokenId: bigint): Promise<string>;
  nextTokenId(): Promise<bigint>;
  pointsPerLevel(level: number): Promise<bigint>;
  commonSupplyCap(): Promise<bigint>;
  rarityMinted(rarity: number): Promise<bigint>;
  mintPriceUSDT(): Promise<bigint>;
  config(key: string): Promise<bigint>;
}

export interface PointsContract extends ethers.BaseContract {
  balance(account: string): Promise<bigint>;
  claimed(account: string): Promise<bigint>;
  claim(totalEarned: string, expiry: string, signature: string): Promise<Tx>;
}

export interface UsdtContract extends ethers.BaseContract {
  approve(spender: string, amount: bigint): Promise<Tx>;
  balanceOf(account: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
}

export function nftContract(runner: ethers.ContractRunner): NftContract {
  return new ethers.Contract(NFT_ADDRESS, NFT_ABI, runner) as unknown as NftContract;
}
export function pointsContract(runner: ethers.ContractRunner): PointsContract {
  return new ethers.Contract(POINTS_ADDRESS, POINTS_ABI, runner) as unknown as PointsContract;
}
export function usdtContract(runner: ethers.ContractRunner): UsdtContract {
  return new ethers.Contract(USDT_ADDRESS, USDT_ABI, runner) as unknown as UsdtContract;
}
