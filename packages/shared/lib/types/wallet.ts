export type Wallet = {
  id: string;
  name: string;
  address: string; // Payment address (for created/imported wallets) or spoofed address
  stakeAddress: string; // Stake address (permanent account identifier)
  network: 'Mainnet' | 'Preprod';
  balance: string; // In Lovelaces
  assets: Asset[];
  type: 'HD' | 'SPOOFED';
  hasPassword: boolean;
  // Encrypted seed phrase for HD, null for SPOOFED
  seedPhrase: string | null;
  // Encrypted root key for HD, null for SPOOFED (encrypted if password is provided)
  rootKey: string | null;
};

export type Asset = {
  // Core identifiers
  unit: string; // Full unit (policyId + assetName)
  quantity: string; // Amount held

  // Extracted identifiers
  policyId: string; // Extracted policy ID
  assetName: string; // Asset name (hex)

  // Display info
  name: string; // Human-readable name
  ticker?: string; // Symbol (ADA, USDC, etc.)
  decimals?: number; // Decimal places (6 for ADA)
  description?: string; // Asset description

  // Metadata (CIP-25/CIP-68)
  image?: string; // IPFS hash or URL
  mediaType?: string; // image/png, etc.
  attributes?: Record<string, any>; // NFT traits

  // Registry data (from token registry)
  logo?: string; // Logo URL/hash
  website?: string; // Official website

  // On-chain info
  fingerprint?: string; // CIP-14 asset fingerprint
  firstMintTx?: string; // First mint transaction
  mintCount?: string; // Total ever minted
  burnCount?: string; // Total burned

  // Cache/performance
  lastUpdated?: number; // Timestamp of last fetch
  verified?: boolean; // From trusted registry
};
