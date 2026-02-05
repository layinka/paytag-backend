import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Chain,
  type Hash,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { namehash } from 'viem/ens';
import { mainnet, sepolia, holesky, base, baseSepolia } from 'viem/chains';

/**
 * Chain-specific ENS configuration
 * Each chain may have different ENS contract addresses
 */
interface ENSChainConfig {
  ensRegistry: Address;
  nameWrapper: Address;
  publicResolver: Address;
}

/**
 * ENS configuration for supported chains
 * Based on ENS documentation and deployments
 */
const ENS_CHAIN_CONFIGS: Record<number, ENSChainConfig> = {
  // Ethereum Mainnet
  [mainnet.id]: {
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
    publicResolver: '0xF29100983E058B709F3D539b0c765937B804AC15',
  },
  // Sepolia Testnet
  [sepolia.id]: {
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8',
    publicResolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5',
  },
  // Holesky Testnet
  [holesky.id]: {
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0xab50971078225D365994dc1Edcb9b7FD72Bb4862',
    publicResolver: '0xa6AC935D4971E3CD133b950aE053bECD16fE7f3b',
  },
  // Base Mainnet
  [base.id]: {
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
    publicResolver: '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63',
  },
  // Base Sepolia Testnet
  [baseSepolia.id]: {
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8',
    publicResolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5',
  },
};

/**
 * Supported chain instances
 */
const SUPPORTED_CHAINS: Record<string, Chain> = {
  mainnet,
  sepolia,
  holesky,
  base,
  baseSepolia,
};

// --- Minimal ABIs ---
const ensRegistryAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    // ENS Registry supports setSubnodeRecord(node,label,owner,resolver,ttl)
    type: 'function',
    name: 'setSubnodeRecord',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },      // parent node
      { name: 'label', type: 'bytes32' },     // keccak256(label)
      { name: 'owner', type: 'address' },     // new subname owner
      { name: 'resolver', type: 'address' },  // resolver contract
      { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

const nameWrapperAbi = [
  {
    type: 'function',
    name: 'setSubnodeRecord',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

const publicResolverAbi = [
  {
    type: 'function',
    name: 'setAddr',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'a', type: 'address' },
    ],
    outputs: [],
  },
] as const;

/**
 * ENS Service Configuration
 */
interface ENSServiceConfig {
  rpcUrl: string;
  signerPrivateKey: `0x${string}`;
  chainName: string;
  parentName?: string;
}

/**
 * Options for creating a subname
 */
interface CreateSubnameOptions {
  label: string;
  targetAddress: Address;
  subnameOwner?: Address;
}

/**
 * Result of creating a subname
 */
interface CreateSubnameResult {
  subname: string;
  subnameOwner: Address;
  targetAddress: Address;
  transactions: {
    setSubnodeRecord: Hash;
    setAddr: Hash;
  };
}

/**
 * ENS Service for managing ENS subnames
 * Supports multiple chains (Ethereum, Base, etc.)
 */
export class ENSService {
  private chain: Chain;
  private config: ENSChainConfig;
  private account: ReturnType<typeof privateKeyToAccount>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient>;
  private parentName: string;

  constructor(serviceConfig: ENSServiceConfig) {
    // Get chain from supported chains
    const chain = SUPPORTED_CHAINS[serviceConfig.chainName.toLowerCase()];
    if (!chain) {
      throw new Error(
        `Unsupported chain: ${serviceConfig.chainName}. Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`
      );
    }

    // Get ENS config for this chain
    const config = ENS_CHAIN_CONFIGS[chain.id];
    if (!config) {
      throw new Error(
        `ENS configuration not found for chain: ${serviceConfig.chainName} (ID: ${chain.id})`
      );
    }

    this.chain = chain;
    this.config = config;
    this.parentName = serviceConfig.parentName ?? 'paytag.eth';

    // Initialize account from private key
    this.account = privateKeyToAccount(serviceConfig.signerPrivateKey);

    // Initialize clients
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(serviceConfig.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(serviceConfig.rpcUrl),
    });
  }

  /**
   * Get the chain configuration
   */
  getChainInfo() {
    return {
      chainId: this.chain.id,
      chainName: this.chain.name,
      parentName: this.parentName,
      ensRegistry: this.config.ensRegistry,
      nameWrapper: this.config.nameWrapper,
      publicResolver: this.config.publicResolver,
    };
  }

  /**
   * Check if parent name is wrapped
   * @throws Error if parent name is not wrapped
   */
  private async verifyParentWrapped(): Promise<void> {
    const parentNode = namehash(this.parentName);

    const registryOwner = await this.publicClient.readContract({
      address: this.config.ensRegistry,
      abi: ensRegistryAbi,
      functionName: 'owner',
      args: [parentNode],
    });

    if (registryOwner.toLowerCase() !== this.config.nameWrapper.toLowerCase()) {
      throw new Error(
        `Parent name "${this.parentName}" is not wrapped (registry owner != NameWrapper). ` +
          `Please wrap it in the ENS manager first.`
      );
    }
  }

  /**
   * Create a subname and set it to resolve to the target address
   * 
   * @param options - Options for creating the subname
   * @returns Result containing subname and transaction hashes
   * 
   * @example
   * ```typescript
   * const result = await ensService.createSubname({
   *   label: 'alice',
   *   targetAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
   * });
   * // Creates: alice.paytag.eth -> 0x742d...
   * ```
   */
  async createSubname(options: CreateSubnameOptions): Promise<CreateSubnameResult> {
    const { label, targetAddress, subnameOwner } = options;

    // Verify parent is wrapped
    await this.verifyParentWrapped();

    const parentNode = namehash(this.parentName);
    const subname = `${label}.${this.parentName}`;
    const subNode = namehash(subname);

    // Default owner is the signer account
    const owner = subnameOwner ?? this.account.address;

    // Step 1: Create subname + set resolver in one tx (NameWrapper)
    // fuses=0, expiry=0 => no special restrictions
    const tx1Hash = await this.walletClient.writeContract({
        chain: this.chain,
        account: this.account,
      address: this.config.nameWrapper,
      abi: nameWrapperAbi,
      functionName: 'setSubnodeRecord',
      args: [
        parentNode,
        label,
        owner,
        this.config.publicResolver,
        0n, // ttl
        0,  // fuses
        0n, // expiry
      ],
    });

    // Wait for TX #1 to be mined
    await this.publicClient.waitForTransactionReceipt({ hash: tx1Hash });

    // Step 2: Set addr record -> target address (Public Resolver)
    const tx2Hash = await this.walletClient.writeContract({
      address: this.config.publicResolver,
      abi: publicResolverAbi,
      functionName: 'setAddr',
      args: [subNode, targetAddress],
      chain: this.chain,
      account: this.account,
    });

    // Wait for TX #2 to be mined
    await this.publicClient.waitForTransactionReceipt({ hash: tx2Hash });

    return {
      subname,
      subnameOwner: owner,
      targetAddress,
      transactions: {
        setSubnodeRecord: tx1Hash,
        setAddr: tx2Hash,
      },
    };
  }

  async createEnsSubname_Unwrapped(options: CreateSubnameOptions): Promise<CreateSubnameResult> {
    const { label, targetAddress, subnameOwner } = options;

   
    const parentNode = namehash(this.parentName);
    const labelHash = keccak256(toBytes(label));
    const subname = `${label}.${this.parentName}`;
    const subNode = namehash(subname);

    // Sanity check: confirm signer owns the parent in the registry
    const parentOwner = await this.publicClient.readContract({
        address: this.config.ensRegistry,
        abi: ensRegistryAbi,
        functionName: 'owner',
        args: [parentNode],
    });

    if (parentOwner.toLowerCase() !== this.account.address.toLowerCase()) {
        throw new Error(
        `Signer does not own ${this.parentName} in ENS Registry. Owner is ${parentOwner}, signer is ${this.account.address}`,
        );
    }

    const finalOwner = (subnameOwner ?? this.account.address) as Address;
    
    // TX #1: Create subname with SIGNER as initial owner + set resolver
    // (Must be signer to authorize the setAddr call)
    const tx1Hash = await this.walletClient.writeContract({
        address: this.config.ensRegistry,
        abi: ensRegistryAbi,
        functionName: 'setSubnodeRecord',
        args: [parentNode, labelHash, this.account.address, this.config.publicResolver, 0n],
        chain: this.chain,
        account: this.account,
    });

    // Wait for TX #1 to be mined before proceeding
    await this.publicClient.waitForTransactionReceipt({ hash: tx1Hash });

    // TX #2: Set address record on the resolver (signer is authorized now)
    const tx2Hash = await this.walletClient.writeContract({
        address: this.config.publicResolver,
        abi: publicResolverAbi,
        functionName: 'setAddr',
        args: [subNode, targetAddress],
        chain: this.chain,
        account: this.account,
    });

    // Wait for TX #2 to be mined
    await this.publicClient.waitForTransactionReceipt({ hash: tx2Hash });

    // TX #3: Transfer ownership if a different owner was specified
    let tx3Hash: Hash | undefined;
    if (finalOwner.toLowerCase() !== this.account.address.toLowerCase()) {
      tx3Hash = await this.walletClient.writeContract({
        address: this.config.ensRegistry,
        abi: [
          {
            type: 'function',
            name: 'setOwner',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'node', type: 'bytes32' },
              { name: 'owner', type: 'address' },
            ],
            outputs: [],
          },
        ] as const,
        functionName: 'setOwner',
        args: [subNode, finalOwner],
        chain: this.chain,
        account: this.account,
      });
      
      // Wait for TX #3 to be mined
      await this.publicClient.waitForTransactionReceipt({ hash: tx3Hash });
    }

    return {
      subname,
      subnameOwner: finalOwner,
      targetAddress,
      transactions: {
        setSubnodeRecord: tx1Hash,
        setAddr: tx2Hash,
        ...(tx3Hash && { setOwner: tx3Hash }),
      },
    };
}

  /**
   * Resolve a name to an address
   * 
   * @param name - ENS name to resolve
   * @returns Address or null if not set
   */
  async resolveAddress(name: string): Promise<Address | null> {
    const node = namehash(name);

    try {
      const address = await this.publicClient.readContract({
        address: this.config.publicResolver,
        abi: [
          {
            type: 'function',
            name: 'addr',
            stateMutability: 'view',
            inputs: [{ name: 'node', type: 'bytes32' }],
            outputs: [{ type: 'address' }],
          },
        ] as const,
        functionName: 'addr',
        args: [node],
      });

      // Return null for zero address
      if (address === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return address as Address;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the owner of a name
   * 
   * @param name - ENS name
   * @returns Owner address
   */
  async getOwner(name: string): Promise<Address> {
    const node = namehash(name);

    const owner = await this.publicClient.readContract({
      address: this.config.ensRegistry,
      abi: ensRegistryAbi,
      functionName: 'owner',
      args: [node],
    });

    return owner as Address;
  }
}

/**
 * Factory function to create an ENS service from environment variables
 * 
 * Required environment variables:
 * - ENS_PRIVATE_KEY: Private key of the wallet that owns the parent name
 * - ENS_RPC_URL: RPC URL for the chain
 * - ENS_CHAIN: Chain name (e.g., 'sepolia', 'mainnet', 'base')
 * - ENS_PARENT_NAME: (Optional) Parent name, defaults to 'paytag.eth'
 * 
 * @returns Configured ENS service instance
 */
export function createENSServiceFromEnv(): ENSService {
  const privateKey = process.env.ENS_PRIVATE_KEY;
  const rpcUrl = process.env.ENS_RPC_URL;
  const chainName = process.env.ENS_CHAIN || 'sepolia';
  const parentName = process.env.ENS_PARENT_NAME;

  if (!privateKey) {
    throw new Error('ENS_PRIVATE_KEY environment variable is required');
  }

  if (!rpcUrl) {
    throw new Error('ENS_RPC_URL environment variable is required');
  }

  // Ensure private key has 0x prefix
  const formattedKey = privateKey.startsWith('0x') 
    ? (privateKey as `0x${string}`) 
    : (`0x${privateKey}` as `0x${string}`);

  return new ENSService({
    rpcUrl,
    signerPrivateKey: formattedKey,
    chainName,
    parentName,
  });
}
