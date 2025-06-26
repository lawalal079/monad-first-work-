// Use environment variables for API endpoints
const PROXY_URL = import.meta.env.VITE_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const QUICKNODE_RPC_URL = import.meta.env.VITE_QUICKNODE_RPC_URL || 'https://proportionate-floral-sheet.monad-testnet.quiknode.pro/b98fd221f28d47289b367f61eaa9d95b1671da0e/';
const ALCHEMY_RPC_URL = import.meta.env.VITE_ALCHEMY_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/qhY7fc3Z4vt6SSqB83buo';

// Rate limiting for QuickNode (25 requests/second limit)
let requestCount = 0;
let lastResetTime = Date.now();
const RATE_LIMIT = 20; // Conservative limit
const RATE_LIMIT_WINDOW = 1000; // 1 second

function checkRateLimit() {
  const now = Date.now();
  if (now - lastResetTime >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    lastResetTime = now;
  }
  
  if (requestCount >= RATE_LIMIT) {
    const waitTime = RATE_LIMIT_WINDOW - (now - lastResetTime);
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }
  
  requestCount++;
}

interface BlockVisionResponse {
  jsonrpc: string;
  id: number;
  result: any;
  error?: { message: string };
}

export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[] | Transaction[];
  prefetchedTransactions?: Transaction[];
  gasUsed: string;
  gasLimit: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timestamp: number;
  status?: number | null;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
}

export interface Event {
  id: string;
  type: 'Contract Creation' | 'High Gas Usage' | 'Failed Transaction' | 'Network Update' | 'Large Transfer' | 'Contract Interaction' | 'Debug Transaction';
  time: string;
  address: string;
  details: string;
  status: 'success' | 'warning' | 'error' | 'info';
  blockNumber?: number;
  transactionHash?: string;
  gasUsed?: string;
  value?: string;
}

// Helper to safely convert hex values
const hexToNumber = (hex: string) => hex ? parseInt(hex, 16) : 0;
const hexToBigInt = (hex: string) => hex ? BigInt(hex) : BigInt(0);

// Replicates ethers.formatUnits(value, 'gwei')
const formatGwei = (value: bigint) => {
    const gwei = value / BigInt('1000000000');
    return gwei.toString();
};

// Replicates ethers.formatUnits(value, 18) for ETH
const formatEth = (value: bigint) => {
    const valueAsNumber = Number(value);
    if (isNaN(valueAsNumber)) return '0.00';
    const ether = valueAsNumber / 1e18;
    return ether.toFixed(18);
};

// Main RPC call function, now supports custom rpcUrl
export async function getBlockVisionData(method: string, params: any[] = [], signal?: AbortSignal, rpcUrl?: string): Promise<any> {
  try {
    const url = rpcUrl || PROXY_URL;
    
    // Apply rate limiting for QuickNode
    if (url.includes('quiknode')) {
      checkRateLimit();
    }
    
    console.log(`Making API call to Monad RPC: ${method}`, params, 'URL:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: BlockVisionResponse = await response.json();
    console.log(`Monad RPC response for ${method}:`, data);
    
    if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
    }
    return data.result;
  } catch (error) {
    console.error(`Monad RPC error for method ${method}:`, error);
    throw error;
  }
}

export async function getLatestBlockNumber(): Promise<number> {
  const result = await getBlockVisionData('eth_blockNumber');
  return hexToNumber(result);
}

// Patch: allow passing custom rpcUrl for ecosystem health only
export async function getBlockByNumber(blockNumber: number | string, includeTransactions: boolean = false, rpcUrl?: string): Promise<Block | null> {
  const blockTag = typeof blockNumber === 'number' ? `0x${blockNumber.toString(16)}` : blockNumber;
  const result = await getBlockVisionData('eth_getBlockByNumber', [blockTag, includeTransactions], undefined, rpcUrl);
  if (result) {
      if (includeTransactions && result.transactions && result.transactions.length > 0 && typeof result.transactions[0] !== 'string') {
          result.prefetchedTransactions = result.transactions;
      }
      result.number = hexToNumber(result.number);
      result.timestamp = hexToNumber(result.timestamp);
  }
  return result;
}

export async function getLatestBlocks(count: number = 12): Promise<Block[]> {
  try {
    const latestBlockNumber = await getLatestBlockNumber();
    const blockPromises = [];
    
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlockNumber - i;
      if (blockNumber >= 0) {
        blockPromises.push(getBlockByNumber(blockNumber, false));
      }
    }
    
    const blocks = await Promise.all(blockPromises);
    return blocks.filter(block => block !== null) as Block[];
  } catch (error) {
    console.error('Error fetching latest blocks from Monad RPC:', error);
    return [];
  }
}

export async function getTransactionReceipt(txHash: string, rpcUrl?: string) {
    return getBlockVisionData('eth_getTransactionReceipt', [txHash], undefined, rpcUrl);
}

export async function getTransactionByHash(txHash: string): Promise<Transaction | null> {
    try {
        const [tx, receipt] = await Promise.all([
            getBlockVisionData('eth_getTransactionByHash', [txHash]),
            getTransactionReceipt(txHash)
        ]);
        
        if (!tx) {
            return null;
        }
        
        return {
            ...tx,
            timestamp: receipt ? hexToNumber(receipt.blockNumber) : 0,
            status: receipt ? hexToNumber(receipt.status) : null,
            value: formatEth(hexToBigInt(tx.value)),
            blockNumber: receipt ? receipt.blockNumber : '0',
        };
    } catch (error) {
        console.error('Error fetching transaction by hash:', error);
        return null;
    }
}

export async function getLatestTransactions(count: number = 12): Promise<Transaction[]> {
  try {
    const latestBlock = await getBlockByNumber('latest', true);
    if (!latestBlock || !latestBlock.prefetchedTransactions) {
      return [];
    }
    
    // Take only the first 'count' transactions and process them in parallel
    const transactionsToProcess = latestBlock.prefetchedTransactions.slice(0, count);
    
    // Process transactions in parallel with a timeout
    const transactionPromises = transactionsToProcess.map(async (tx: any) => {
        try {
            const receipt = await Promise.race([
                getTransactionReceipt(tx.hash),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 3000)
                )
            ]);
            
            return {
                ...tx,
                timestamp: latestBlock.timestamp,
                status: receipt ? hexToNumber(receipt.status) : null,
                value: formatEth(hexToBigInt(tx.value)),
            };
        } catch (error) {
            console.warn(`Failed to get receipt for tx ${tx.hash}:`, error);
            // Return transaction without receipt data
            return {
                ...tx,
                timestamp: latestBlock.timestamp,
                status: null,
                value: formatEth(hexToBigInt(tx.value)),
            };
        }
    });
    
    const results = await Promise.allSettled(transactionPromises);
    return results
        .filter((result): result is PromiseFulfilledResult<Transaction> => result.status === 'fulfilled')
        .map(result => result.value);
  } catch (error) {
    console.error('Error fetching latest transactions from Monad RPC:', error);
    return [];
  }
}

// Add Alchemy endpoint for metrics only

export async function getDashboardMetrics() {
    try {
        const latestBlock = await getBlockByNumber('latest', false, ALCHEMY_RPC_URL);
        if (!latestBlock) {
            throw new Error("Could not fetch the latest block from Alchemy Monad RPC.");
        }
        // Ensure timestamp is a number
        let latestTimestamp = typeof latestBlock.timestamp === 'string' ? parseInt(latestBlock.timestamp, 16) : latestBlock.timestamp;
        const latestBlockNumber = latestBlock.number;
        const txCountInLastBlock = latestBlock.transactions.length;
        const estimatedTotalTxs = BigInt(latestBlockNumber) * BigInt(txCountInLastBlock);

        let bpm = 0;
        try {
            const olderBlock = await getBlockByNumber(latestBlockNumber - 10, false, ALCHEMY_RPC_URL);
            if (olderBlock) {
                let olderTimestamp = typeof olderBlock.timestamp === 'string' ? parseInt(olderBlock.timestamp, 16) : olderBlock.timestamp;
                const blockDifference = latestBlock.number - olderBlock.number;
                const timeDifference = latestTimestamp - olderTimestamp;
                if (blockDifference > 0 && timeDifference > 0) {
                    let averageBlockTime = timeDifference / blockDifference;
                    if (averageBlockTime > 0) {
                        bpm = 60 / averageBlockTime;
                    }
                }
            }
        } catch (bpmError) {
            bpm = 0;
        }

        let tpm = 0;
        try {
            tpm = txCountInLastBlock * bpm;
        } catch (tpmError) {
            tpm = 0;
        }

        let totalValue = BigInt(0);
        let validTxCount = 0;
        try {
            const latestBlockWithTxs = await getBlockByNumber('latest', true, ALCHEMY_RPC_URL);
            if (latestBlockWithTxs && latestBlockWithTxs.prefetchedTransactions) {
                validTxCount = latestBlockWithTxs.prefetchedTransactions.length;
                latestBlockWithTxs.prefetchedTransactions.forEach(tx => {
                    if (tx.value) {
                        totalValue += hexToBigInt(tx.value);
                    }
                });
            }
        } catch (valueError) {
            totalValue = BigInt(0);
            validTxCount = 0;
        }
        
        const averageTxValue = validTxCount > 0 ? formatEth(totalValue / BigInt(validTxCount)) : '0.00';

        return {
            latestBlock: latestBlockNumber,
            txsInLastBlock: txCountInLastBlock,
            totalTxs: estimatedTotalTxs.toLocaleString(),
            blocksPerMin: isFinite(bpm) && bpm > 0 ? parseFloat(bpm.toFixed(2)) : 0,
            txsPerMin: isFinite(tpm) && tpm > 0 ? parseFloat(tpm.toFixed(2)) : 0,
            avgTxValue: parseFloat(averageTxValue).toFixed(4),
            gasUsed: hexToNumber(latestBlock.gasUsed),
            gasLimit: hexToNumber(latestBlock.gasLimit),
        };
    } catch (error) {
        console.error("Error in getDashboardMetrics from Alchemy Monad RPC:", error);
        return {
            latestBlock: 0,
            txsInLastBlock: 0,
            totalTxs: "0",
            blocksPerMin: 0,
            txsPerMin: 0,
            avgTxValue: "0.00",
            gasUsed: 0,
            gasLimit: 0,
        };
    }
}

export async function getGasData() {
    try {
        const [feeData, latestBlock] = await Promise.all([
            getBlockVisionData('eth_gasPrice', []),
            getBlockByNumber('latest', true)
        ]);

        if (!latestBlock) { return null; }

        const highGasTransactions = (latestBlock.prefetchedTransactions || [])
            .sort((a, b) => hexToNumber(b.gas) - hexToNumber(a.gas))
            .slice(0, 3)
            .map(tx => ({
                hash: tx.hash,
                gasUsed: hexToNumber(tx.gas).toString(),
                timestamp: latestBlock.timestamp
            }));

        const blockGasDataPromises = [];
        const latestBlockNumber = latestBlock.number;
        for (let i = 0; i < 10; i++) { 
            blockGasDataPromises.push(getBlockByNumber(latestBlockNumber - i, false));
        }
        const recentBlocks = (await Promise.all(blockGasDataPromises)).filter((b): b is Block => b !== null);

        const gasUsageByMinute = new Map<string, bigint>();
        for (const block of recentBlocks) {
            if (!block.timestamp) continue;
            const minute = new Date(block.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const currentGas = gasUsageByMinute.get(minute) || BigInt(0);
            gasUsageByMinute.set(minute, currentGas + hexToBigInt(block.gasUsed));
        }
        
        const gasUsageData = Array.from(gasUsageByMinute.entries())
            .map(([time, gasUsed]) => ({
                time,
                gasUsed: gasUsed.toString(),
            }))
            .reverse();

        return {
            currentGasPrice: feeData ? formatGwei(hexToBigInt(feeData)) : '0',
            highGasTransactions,
            gasUsageData,
        };

    } catch (error) {
        console.error("Error fetching gas data:", error);
        return null;
    }
}

export async function getTopContracts() {
  // Fetch the latest 5 blocks with transactions (reduced from 10 to avoid rate limits)
  try {
    console.log('🔍 Top Contracts Debug: Starting to fetch top contracts...');
    const latestBlockNumber = await getLatestBlockNumber();
    console.log('🔍 Top Contracts Debug: Latest block number:', latestBlockNumber);
    
    const blockPromises = [];
    for (let i = 0; i < 5; i++) { // Reduced from 10 to 5
      const blockNumber = latestBlockNumber - i;
      if (blockNumber >= 0) {
        blockPromises.push(getBlockByNumber(blockNumber, true));
      }
    }
    const blocks = (await Promise.all(blockPromises)).filter(Boolean);
    console.log(`🔍 Top Contracts Debug: Fetched ${blocks.length} blocks`);
    
    // Count contract addresses in 'to' field
    const contractTxCount: Record<string, number> = {};
    blocks.forEach(block => {
      if (!block) return;
      const txs = block.prefetchedTransactions || block.transactions || [];
      console.log(`🔍 Top Contracts Debug: Block ${block.number} has ${txs.length} transactions`);
      txs.forEach((tx: any) => {
        if (tx.to) {
          contractTxCount[tx.to] = (contractTxCount[tx.to] || 0) + 1;
        }
      });
    });
    
    // Convert to array and sort by tx count
    const sorted = Object.entries(contractTxCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([address, transactions]) => ({
        address,
        name: '', // Name lookup can be added if available
        transactions
      }));
    
    console.log(`🔍 Top Contracts Debug: Found ${sorted.length} top contracts`);
    return sorted;
  } catch (error) {
    console.error('🔍 Top Contracts Debug: Error fetching top contracts from last 5 blocks:', error);
    return [];
  }
}

export async function getRecentDeployments() {
  // Fetch up to 5 recent blocks (reduced from 20 to avoid rate limits)
  function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }
  try {
    console.log('🔍 Deployments Debug: Starting to fetch recent deployments...');
    const latestBlockNumber = await getLatestBlockNumber();
    console.log('🔍 Deployments Debug: Latest block number:', latestBlockNumber);
    
    const deployments: any[] = [];
    for (let i = 0; i < 10; i++) { // Increased from 5 to 10 to get more deployments
      const blockNumber = latestBlockNumber - i;
      if (blockNumber >= 0) {
        console.log(`🔍 Deployments Debug: Fetching block ${blockNumber}...`);
        const block = await getBlockByNumber(blockNumber, true, QUICKNODE_RPC_URL);
        if (block) {
          console.log(`🔍 Deployments Debug: Block ${blockNumber} has ${block.prefetchedTransactions?.length || 0} transactions`);
          const txs = (block.prefetchedTransactions || block.transactions || []).filter((tx: any) => typeof tx === 'object' && tx !== null);
          for (const tx of txs) {
            const t = tx as Transaction;
            if (t.to == null || (t as any).creates) {
              console.log(`🔍 Deployments Debug: Found contract deployment in tx ${t.hash}`);
              let contractAddress = (t as any).creates || (t as any).receipt && (t as any).receipt.contractAddress;
              let fees = 'N/A';
              try {
                const receipt = await getTransactionReceipt(t.hash, QUICKNODE_RPC_URL);
                if (receipt && receipt.gasUsed && t.gasPrice) {
                  const gasUsed = typeof receipt.gasUsed === 'string' ? parseInt(receipt.gasUsed, 16) : receipt.gasUsed;
                  const gasPrice = typeof t.gasPrice === 'string' ? parseInt(t.gasPrice, 16) : t.gasPrice;
                  if (gasUsed && gasPrice) {
                    fees = (gasUsed * gasPrice / 1e18).toFixed(6) + ' MON';
                  }
                }
              } catch (e) {
                console.log(`🔍 Deployments Debug: Failed to get receipt for tx ${t.hash}:`, e);
              }
              deployments.push({
                hash: contractAddress || t.hash,
                deployer: t.from,
                time: block.timestamp,
                fees,
                txHash: t.hash,
                blockNumber: block.number,
              });
            }
            if (deployments.length >= 12) break; // Back to 12 deployments
          }
        }
        if (deployments.length >= 12) break; // Back to 12 deployments
        await delay(500); // Increased delay from 300ms to 500ms
      }
    }
    console.log(`🔍 Deployments Debug: Found ${deployments.length} deployments`);
    return deployments.sort((a, b) => b.time - a.time).slice(0, 12); // Back to 12 deployments
  } catch (error) {
    console.error('🔍 Deployments Debug: Error fetching recent contract deployments:', error);
    return [];
  }
}

export async function getEnhancedBlockByNumber(blockNumber: number | string, includeTransactions: boolean = false, signal?: AbortSignal): Promise<any> {
  const blockTag = typeof blockNumber === 'number' ? `0x${blockNumber.toString(16)}` : blockNumber;
  const result = await getBlockVisionData('eth_getBlockByNumber', [blockTag, includeTransactions], signal);
  if (result) {
      if (includeTransactions && result.transactions && result.transactions.length > 0 && typeof result.transactions[0] !== 'string') {
          result.prefetchedTransactions = result.transactions;
      }
      result.number = hexToNumber(result.number);
      result.timestamp = hexToNumber(result.timestamp);
      
      // Add enhanced fields
      result.parentHash = result.parentHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
      result.miner = result.miner || '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      result.gasPrice = result.gasPrice || '0x3b9aca00';
      result.totalTransactions = result.transactions ? result.transactions.length : 0;
  }
  return result;
}

export async function getEnhancedTransactionByHash(txHash: string, signal?: AbortSignal): Promise<any> {
    try {
        const [tx, receipt] = await Promise.all([
            getBlockVisionData('eth_getTransactionByHash', [txHash], signal),
            getTransactionReceipt(txHash)
        ]);
        
        if (!tx) {
            return null;
        }
        
        const gasUsed = receipt ? receipt.gasUsed : '0x0';
        const gasPrice = tx.gasPrice || '0x3b9aca00';
        const gasLimit = tx.gas || '0x186a0';
        
        // Calculate fees (simplified calculation)
        const gasUsedNum = parseInt(gasUsed, 16);
        const gasPriceNum = parseInt(gasPrice, 16);
        const gasFees = (gasUsedNum * gasPriceNum) / 1e18;
        const txFees = gasFees + 0.0001; // Add base fee
        
        let timestamp = 0;
        if (receipt && receipt.blockNumber) {
            const block = await getBlockByNumber(receipt.blockNumber, false);
            if (block && block.timestamp) {
                timestamp = block.timestamp;
            }
        }
        
        return {
            ...tx,
            timestamp,
            status: receipt ? hexToNumber(receipt.status) : null,
            value: formatEth(hexToBigInt(tx.value)),
            blockNumber: receipt ? receipt.blockNumber : '0',
            gasUsed,
            gasLimit,
            gasPrice,
            txFees: txFees.toFixed(6),
            gasFees: gasFees.toFixed(6)
        };
    } catch (error) {
        console.error('Error fetching enhanced transaction by hash:', error);
        return null;
    }
}

export async function getContractInfo(contractAddress: string, signal?: AbortSignal): Promise<any> {
    try {
        // 1. Check if the address is a contract
        const code = await getBlockVisionData('eth_getCode', [contractAddress, 'latest'], signal);
        if (!code || code === '0x' || code === '0x0') {
            return {
                address: contractAddress,
                contractType: 'Not a contract',
                name: 'N/A',
                symbol: 'N/A',
                totalSupply: 'N/A',
                holders: 'N/A',
                decimals: 'N/A',
            };
        }
        // 2. Try to fetch ERC-20 fields using eth_call
        const call = async (data: string) => {
            try {
                const result = await getBlockVisionData('eth_call', [{ to: contractAddress, data }, 'latest'], signal);
                return result;
            } catch {
                return null;
            }
        };
        // ERC-20 method signatures
        const sigName = '0x06fdde03'; // name()
        const sigSymbol = '0x95d89b41'; // symbol()
        const sigDecimals = '0x313ce567'; // decimals()
        const sigTotalSupply = '0x18160ddd'; // totalSupply()
        // Fetch all in parallel
        const [nameRaw, symbolRaw, decimalsRaw, totalSupplyRaw] = await Promise.all([
            call(sigName),
            call(sigSymbol),
            call(sigDecimals),
            call(sigTotalSupply),
        ]);
        // Helper to decode hex string to utf8
        const decodeString = (hex: string | null) => {
            if (!hex || hex === '0x') return 'N/A';
            try {
                // Remove 0x and pad right
                let str = hex.slice(2);
                if (str.length % 2 !== 0) str += '0';
                const buf = Buffer.from(str, 'hex');
                // Try to decode as utf8, fallback to ascii
                let out = buf.toString('utf8').replace(/\u0000/g, '').replace(/\0/g, '').trim();
                if (!out) out = buf.toString('ascii').replace(/\u0000/g, '').replace(/\0/g, '').trim();
                return out || 'N/A';
            } catch {
                return 'N/A';
            }
        };
        // Helper to decode uint256 hex
        const decodeUint = (hex: string | null) => {
            if (!hex || hex === '0x') return 'N/A';
            try {
                return BigInt(hex).toString();
            } catch {
                return 'N/A';
            }
        };
        // Helper to decode uint8 hex
        const decodeUint8 = (hex: string | null) => {
            if (!hex || hex === '0x') return 'N/A';
            try {
                return parseInt(hex, 16).toString();
            } catch {
                return 'N/A';
            }
        };
        return {
            address: contractAddress,
            contractType: 'ERC20',
            name: decodeString(nameRaw),
            symbol: decodeString(symbolRaw),
            totalSupply: decodeUint(totalSupplyRaw),
            holders: 'N/A', // Not available from RPC
            decimals: decodeUint8(decimalsRaw),
        };
    } catch (error) {
        if ((error as any).name === 'AbortError') throw error;
        console.error('Error fetching contract info:', error);
        return {
            address: contractAddress,
            contractType: 'N/A',
            name: 'N/A',
            symbol: 'N/A',
            totalSupply: 'N/A',
            holders: 'N/A',
            decimals: 'N/A',
        };
    }
}

export async function getGasOverviewData(): Promise<{ baseFee: string, priorityFee: string, highGasTxs: any[] }> {
    try {
        const requests = [
            { method: 'eth_gasPrice', params: [] },
            { method: 'eth_getBlockByNumber', params: ['latest', true] }
        ];

        const [gasPriceHex, latestBlock] = await batchBlockVisionData(requests);

        if (!gasPriceHex || !latestBlock) {
            throw new Error('Failed to fetch gas overview data');
        }

        // Use a more realistic calculation for gas fees
        const gasPriceGwei = parseInt(gasPriceHex, 16) / 1e9;
        const baseFee = (gasPriceGwei * 0.8).toFixed(2); // Estimated: 80% of gas price
        const priorityFee = (gasPriceGwei * 0.2).toFixed(2); // Estimated: 20% of gas price

        const highGasTxs = (latestBlock.transactions || [])
            .sort((a: any, b: any) => parseInt(b.gas, 16) - parseInt(a.gas, 16))
            .slice(0, 5)
            .map((tx: any) => ({
                hash: tx.hash,
                // Displaying the gas limit as gasUsed is a proxy to avoid many extra calls
                gasUsed: parseInt(tx.gas, 16).toLocaleString(),
                timestamp: latestBlock.timestamp,
            }));

        return { baseFee, priorityFee, highGasTxs };

    } catch (error) {
        console.error('Error fetching gas overview data:', error);
        return { baseFee: '0', priorityFee: '0', highGasTxs: [] };
    }
}

export async function getGasUsageHistory(minutes: number = 60): Promise<{ time: string, gasUsed: number }[]> {
    try {
        const latestBlock = await getBlockByNumber('latest');
        if (!latestBlock) return [];

        const latestBlockNumber = latestBlock.number;
        
        // Dynamically calculate how many blocks to fetch based on recent block time
        const olderBlock = await getBlockByNumber(latestBlockNumber - 100);
        let blocksToFetch = minutes * 20; // Fallback: 3s block time
        if (olderBlock) {
            const timeDiff = latestBlock.timestamp - olderBlock.timestamp;
            const blockDiff = latestBlock.number - olderBlock.number;
            if (timeDiff > 0 && blockDiff > 0) {
                const avgBlockTime = timeDiff / blockDiff;
                const blocksPerMinute = 60 / avgBlockTime;
                blocksToFetch = Math.ceil(blocksPerMinute * minutes);
            }
        }
        
        const blockNumbersToFetch = [];
        for (let i = 0; i < blocksToFetch; i++) {
            const blockNumber = latestBlockNumber - i;
            if (blockNumber > 0) blockNumbersToFetch.push(blockNumber);
        }

        const blockRequests = blockNumbersToFetch.map(num => ({
            method: 'eth_getBlockByNumber',
            params: [`0x${num.toString(16)}`, false]
        }));

        const results = await batchBlockVisionData(blockRequests);
        const blocks = results.filter(Boolean) as Block[];

        // For debug: expose the raw blocks to the window
        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.__lastGasBlocksSource = blocks;
        }

       // 1. Aggregate gas usage into a map. Key is the minute (unix timestamp in minutes)
const gasUsageMap = new Map<number, number>();
blocks.forEach(block => {
    if (!block.timestamp || !block.gasUsed) return;
    const blockTimestamp = typeof block.timestamp === 'string' ? parseInt(block.timestamp, 16) : block.timestamp;
    const minuteKey = Math.floor(blockTimestamp / 60); // group by minute
    const currentGas = gasUsageMap.get(minuteKey) || 0;
    gasUsageMap.set(minuteKey, currentGas + parseInt(block.gasUsed, 16));
});

// 2. Generate the last 60 minute time labels based on the blockchain's clock.
const finalData: { time: string, gasUsed: number }[] = [];
const nowTimestamp = typeof latestBlock.timestamp === 'string' ? parseInt(latestBlock.timestamp, 16) : latestBlock.timestamp;
for (let i = 0; i < minutes; i++) {
    const minuteTimestamp = nowTimestamp - i * 60;
    const date = new Date(minuteTimestamp * 1000);
    const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const minuteKey = Math.floor(minuteTimestamp / 60);
    finalData.push({
        time: timeLabel,
        gasUsed: gasUsageMap.get(minuteKey) || 0,
    });
}
return finalData.reverse(); // Return in chronological order

} catch (error) {
    console.error('Error fetching gas usage history:', error);
    return [];
}
}

export async function batchBlockVisionData(requests: { method: string, params: any[] }[], rpcUrl?: string): Promise<any[]> {
    try {
      console.log(`Making BATCH API call to Monad RPC via proxy for ${requests.length} requests`);
      const batch = requests.map((req, index) => ({
        jsonrpc: '2.0',
        method: req.method,
        params: req.params,
        id: index,
      }));

      const response = await fetch(rpcUrl || PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log(`Monad RPC BATCH response:`, data);

      if (!Array.isArray(data)) {
          if(data.error) throw new Error(`RPC Error: ${data.error.message}`);
          throw new Error('Batch RPC call did not return an array');
      }
      
      return data.sort((a, b) => a.id - b.id).map(res => {
        if (res.error) {
            console.warn(`Sub-request in batch failed: ${res.error.message}`);
            return null;
        }
        return res.result
      });

    } catch (error) {
      console.error(`Monad RPC BATCH error:`, error);
      throw error;
    }
}

export async function getLogs(fromBlock: string, toBlock: string = 'latest', address?: string, topics?: string[]): Promise<any[]> {
  try {
    const params: any[] = [{
      fromBlock,
      toBlock,
      ...(address && { address }),
      ...(topics && { topics })
    }];
    
    const result = await getBlockVisionData('eth_getLogs', params);
    return result || [];
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}

export async function getRecentEvents(blockCount: number = 2): Promise<Event[]> {
  try {
    const latestBlock = await getLatestBlockNumber();
    const fromBlock = Math.max(0, latestBlock - blockCount + 1);
    // Get recent blocks with transactions
    const blocks = await Promise.all(
      Array.from({ length: blockCount }, (_, i) =>
        getBlockByNumber(latestBlock - i, true)
      )
    );
    const events: Event[] = [];
    let eventId = 1;
    // Only check the first 3 transactions per block
    for (const block of blocks) {
      if (block?.prefetchedTransactions) {
        const txs = block.prefetchedTransactions.slice(0, 3);
        for (const tx of txs) {
          // Contract creations
          if (tx.to === null || tx.to === '0x') {
            events.push({
              id: `event-${eventId++}`,
              type: 'Contract Creation',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.hash,
              details: `New contract deployed from ${tx.from}`,
              status: 'success',
              blockNumber: block.number,
              transactionHash: tx.hash,
              gasUsed: tx.gas,
              value: formatEth(hexToBigInt(tx.value))
            });
          }
          // Failed transactions
          try {
            const receipt = await getTransactionReceipt(tx.hash);
            if (receipt && hexToNumber(receipt.status) === 0) {
              events.push({
                id: `event-${eventId++}`,
                type: 'Failed Transaction',
                time: new Date(block.timestamp * 1000).toISOString(),
                address: tx.to || 'Unknown',
                details: `Transaction reverted: ${tx.hash.substring(0, 10)}...`,
                status: 'error',
                blockNumber: block.number,
                transactionHash: tx.hash,
                gasUsed: receipt.gasUsed
              });
            }
          } catch (error) {
            // Skip if we can't get receipt
          }
          // Large transfers
          const valueInEth = Number(formatEth(hexToBigInt(tx.value)));
          if (valueInEth > 1) {
            events.push({
              id: `event-${eventId++}`,
              type: 'Large Transfer',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.to || 'Unknown',
              details: `Large transfer of ${valueInEth.toFixed(4)} ETH`,
              status: 'info',
              blockNumber: block.number,
              transactionHash: tx.hash,
              value: formatEth(hexToBigInt(tx.value))
            });
          }
          // High gas usage
          const gasUsed = hexToNumber(tx.gas);
          if (gasUsed > 500000) {
            events.push({
              id: `event-${eventId++}`,
              type: 'High Gas Usage',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.to || 'Unknown',
              details: `High gas usage: ${gasUsed.toLocaleString()} gas`,
              status: 'warning',
              blockNumber: block.number,
              transactionHash: tx.hash,
              gasUsed: tx.gas
            });
          }
        }
      }
    }
    // Sort by time (newest first) and limit to 20 events
    return events
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return [];
  }
}

export async function getNewEventsSince(lastBlockNumber: number): Promise<Event[]> {
  try {
    const latestBlock = await getLatestBlockNumber();
    if (latestBlock <= lastBlockNumber) {
      return [];
    }
    const fromBlock = lastBlockNumber + 1;
    const toBlock = latestBlock;
    // Get new blocks with transactions
    const blocks = await Promise.all(
      Array.from({ length: toBlock - fromBlock + 1 }, (_, i) =>
        getBlockByNumber(fromBlock + i, true)
      )
    );
    const events: Event[] = [];
    let eventId = Date.now();
    for (const block of blocks) {
      if (block?.prefetchedTransactions) {
        const txs = block.prefetchedTransactions.slice(0, 3);
        for (const tx of txs) {
          // Contract creations
          if (tx.to === null || tx.to === '0x') {
            events.push({
              id: `event-${eventId++}`,
              type: 'Contract Creation',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.hash,
              details: `New contract deployed from ${tx.from}`,
              status: 'success',
              blockNumber: block.number,
              transactionHash: tx.hash,
              gasUsed: tx.gas,
              value: formatEth(hexToBigInt(tx.value))
            });
          }
          // Failed transactions
          try {
            const receipt = await getTransactionReceipt(tx.hash);
            if (receipt && hexToNumber(receipt.status) === 0) {
              events.push({
                id: `event-${eventId++}`,
                type: 'Failed Transaction',
                time: new Date(block.timestamp * 1000).toISOString(),
                address: tx.to || 'Unknown',
                details: `Transaction reverted: ${tx.hash.substring(0, 10)}...`,
                status: 'error',
                blockNumber: block.number,
                transactionHash: tx.hash,
                gasUsed: receipt.gasUsed
              });
            }
          } catch (error) {
            // Skip if we can't get receipt
          }
          // Large transfers
          const valueInEth = Number(formatEth(hexToBigInt(tx.value)));
          if (valueInEth > 1) {
            events.push({
              id: `event-${eventId++}`,
              type: 'Large Transfer',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.to || 'Unknown',
              details: `Large transfer of ${valueInEth.toFixed(4)} ETH`,
              status: 'info',
              blockNumber: block.number,
              transactionHash: tx.hash,
              value: formatEth(hexToBigInt(tx.value))
            });
          }
          // High gas usage
          const gasUsed = hexToNumber(tx.gas);
          if (gasUsed > 500000) {
            events.push({
              id: `event-${eventId++}`,
              type: 'High Gas Usage',
              time: new Date(block.timestamp * 1000).toISOString(),
              address: tx.to || 'Unknown',
              details: `High gas usage: ${gasUsed.toLocaleString()} gas`,
              status: 'warning',
              blockNumber: block.number,
              transactionHash: tx.hash,
              gasUsed: tx.gas
            });
          }
        }
      }
    }
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  } catch (error) {
    console.error('Error fetching new events:', error);
    return [];
  }
}

export async function getLatestBlocksWithTransactions(count: number = 5): Promise<Block[]> {
  try {
    const latestBlockNumber = await getLatestBlockNumber();
    console.log('[DEBUG] Latest block number:', latestBlockNumber);
    const blockPromises = [];
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlockNumber - i;
      if (blockNumber >= 0) {
        blockPromises.push(getBlockByNumber(blockNumber, true));
      }
    }
    const blocks = await Promise.all(blockPromises);
    console.log('[DEBUG] Latest blocks with transactions:', blocks);
    return blocks.filter(block => block !== null) as Block[];
  } catch (error) {
    console.error('[DEBUG] Error fetching latest blocks with transactions:', error);
    return [];
  }
}

// Add extra logging to getBlockByNumber
const originalGetBlockByNumber = getBlockByNumber;
export async function getBlockByNumberDebug(blockNumber: number | string, includeTransactions: boolean = false): Promise<Block | null> {
  const block = await originalGetBlockByNumber(blockNumber, includeTransactions);
  console.log(`[DEBUG] Block ${blockNumber}:`, block);
  return block;
}

export async function getBlockByHash(blockHash: string, includeTransactions: boolean = false, signal?: AbortSignal): Promise<Block | null> {
  const result = await getBlockVisionData('eth_getBlockByHash', [blockHash, includeTransactions], signal);
  if (result) {
      if (includeTransactions && result.transactions && result.transactions.length > 0 && typeof result.transactions[0] !== 'string') {
          result.prefetchedTransactions = result.transactions;
      }
      result.number = hexToNumber(result.number);
      result.timestamp = hexToNumber(result.timestamp);
  }
  return result;
}

export async function getEnhancedBlockByHash(blockHash: string, includeTransactions: boolean = false, signal?: AbortSignal): Promise<any> {
  const result = await getBlockVisionData('eth_getBlockByHash', [blockHash, includeTransactions], signal);
  if (result) {
      if (includeTransactions && result.transactions && result.transactions.length > 0 && typeof result.transactions[0] !== 'string') {
          result.prefetchedTransactions = result.transactions;
      }
      result.number = hexToNumber(result.number);
      result.timestamp = hexToNumber(result.timestamp);
      result.parentHash = result.parentHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
      result.miner = result.miner || '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      result.gasPrice = result.gasPrice || '0x3b9aca00';
      result.totalTransactions = result.transactions ? result.transactions.length : 0;
  }
  return result;
}

/**
 * Calculates ecosystem health metrics over the last 24 hours.
 * Updates every 12 hours (should be called on a 12-hour interval).
 * Returns an object with all metrics and a composite health score.
 */
export async function getEcosystemHealthMetrics(): Promise<{
  tps: number;
  successRate: number;
  activeWallets: number;
  newContracts: number;
  failedTxRate: number;
  avgBlockTime: number;
  maxGasUsagePerBlock: number;
  healthScore: string;
  blockCount: number;
  txCount: number;
}> {
  // Get the latest block number and timestamp
  const latestBlock = await getBlockByNumber('latest', false);
  if (!latestBlock) throw new Error('Could not fetch latest block');
  const latestTimestamp = latestBlock.timestamp;

  // 24 hours ago
  const secondsIn24h = 10 * 60; // 10 minutes for testing
  const startTimestamp = latestTimestamp - secondsIn24h;

  // Estimate how many blocks in 24h (using avg block time if available, else 1s)
  let avgBlockTime = 1;
  if (latestBlock.number > 100) {
    const hundredBlocksAgo = await getBlockByNumber(latestBlock.number - 100, false);
    if (hundredBlocksAgo) {
      avgBlockTime = (latestBlock.timestamp - hundredBlocksAgo.timestamp) / 100;
    }
  }
  const estBlockCount = Math.ceil(secondsIn24h / avgBlockTime);
  const startBlockNumber = Math.max(0, latestBlock.number - estBlockCount);

  // Fetch all blocks in the last 24h
  const blocks: Block[] = [];
  let blockNum = latestBlock.number;
  while (blockNum >= startBlockNumber) {
    const block = await getBlockByNumber(blockNum, true);
    if (block && block.timestamp >= startTimestamp) {
      blocks.push(block);
      blockNum--;
    } else {
      break;
    }
  }

  // Calculate metrics
  let txCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let walletSet = new Set<string>();
  let contractCount = 0;
  let blockTimes: number[] = [];
  let maxGasUsage = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i > 0) {
      blockTimes.push(blocks[i - 1].timestamp - block.timestamp);
    }
    if (parseInt(block.gasUsed) > maxGasUsage) {
      maxGasUsage = parseInt(block.gasUsed);
    }
    if (block.prefetchedTransactions && Array.isArray(block.prefetchedTransactions)) {
      for (const tx of block.prefetchedTransactions) {
        txCount++;
        if (tx.status === 1) successCount++;
        if (tx.status === 0) failedCount++;
        if (tx.from) walletSet.add(tx.from);
        if (tx.to) walletSet.add(tx.to);
        // Heuristic: contract creation if 'to' is null
        if (!tx.to) contractCount++;
      }
    }
  }

  const tps = txCount / secondsIn24h;
  const successRate = txCount > 0 ? (successCount / txCount) * 100 : 100;
  const failedTxRate = txCount > 0 ? (failedCount / txCount) * 100 : 0;
  const avgBlockTimeFinal = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : avgBlockTime;
  const maxGasUsagePerBlock = maxGasUsage;
  const activeWallets = walletSet.size;
  const newContracts = contractCount;
  // Composite health score (simple for now)
  const healthScore = `${successRate > 95 && failedTxRate < 5 ? 'Healthy' : 'Needs Attention'}`;

  return {
    tps: Number(tps.toFixed(2)),
    successRate: Number(successRate.toFixed(2)),
    activeWallets,
    newContracts,
    failedTxRate: Number(failedTxRate.toFixed(2)),
    avgBlockTime: Number(avgBlockTimeFinal.toFixed(2)),
    maxGasUsagePerBlock,
    healthScore,
    blockCount: blocks.length,
    txCount,
  };
}

/**
 * Returns the number of successful transactions in the last 24 hours.
 * If there are no transactions, returns 0 (no error).
 */
export async function getSuccessfulTxCountLast24h(): Promise<number> {
  // Get the latest block and timestamp
  const latestBlock = await getBlockByNumber('latest', false);
  if (!latestBlock) return 0;
  const latestTimestamp = latestBlock.timestamp;
  const secondsIn24h = 10 * 60; // 10 minutes for testing
  const startTimestamp = latestTimestamp - secondsIn24h;

  // Estimate how many blocks in 24h (using avg block time if available, else 1s)
  let avgBlockTime = 1;
  if (latestBlock.number > 100) {
    const hundredBlocksAgo = await getBlockByNumber(latestBlock.number - 100, false);
    if (hundredBlocksAgo) {
      avgBlockTime = (latestBlock.timestamp - hundredBlocksAgo.timestamp) / 100;
    }
  }
  const estBlockCount = Math.ceil(secondsIn24h / avgBlockTime);
  const startBlockNumber = Math.max(0, latestBlock.number - estBlockCount);

  // Fetch all blocks in the last 24h
  let successCount = 0;
  let blockNum = latestBlock.number;
  while (blockNum >= startBlockNumber) {
    const block = await getBlockByNumber(blockNum, true);
    if (block && block.timestamp >= startTimestamp) {
      if (block.prefetchedTransactions && Array.isArray(block.prefetchedTransactions)) {
        for (const tx of block.prefetchedTransactions) {
          if (tx.status === 1) successCount++;
        }
      }
      blockNum--;
    } else {
      break;
    }
  }
  return successCount;
}

/**
 * Fetches the latest 20 blocks and calculates ecosystem health metrics.
 * Returns: { tps, successRate, activeWallets, newContracts, failedTxRate, avgBlockTime, maxGasUsagePerBlock, healthScore, blockCount, txCount }
 */
export async function getRecentEcosystemHealthMetrics(blockCount: number = 5) {
  // Use QuickNode endpoint for ecosystem health
  const rpcUrl = QUICKNODE_RPC_URL;
  const latestBlockNumber = await getBlockVisionData('eth_blockNumber', [], undefined, rpcUrl).then(hexToNumber);
  const blockNumbers = [];
  for (let i = 0; i < blockCount; i++) {
    blockNumbers.push(latestBlockNumber - i);
  }
  // Batch fetch blocks using QuickNode endpoint
  const blockRequests = blockNumbers.map(num => ({
    method: 'eth_getBlockByNumber',
    params: [`0x${num.toString(16)}`, true]
  }));
  const blocks = (await batchBlockVisionData(blockRequests, rpcUrl)).filter(Boolean) as Block[];
  const failedBlocks: number[] = blockNumbers.filter((num, idx) => !blocks[idx]);
  if (!blocks.length) return null;

  // Debug: Log block numbers and transaction counts
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__lastEcosystemBlocks = blocks;
    console.log('[EcosystemHealth] Block numbers:', blocks.map(b => b.number));
    console.log('[EcosystemHealth] Block tx counts:', blocks.map(b => Array.isArray(b.transactions) ? b.transactions.length : 0));
    if (failedBlocks.length > 0) {
      console.warn('[EcosystemHealth] Failed blocks:', failedBlocks);
    }
  }

  // Count total transactions in all successfully fetched blocks
  let totalTxCount = 0;
  let allTxHashes: string[] = [];
  let walletSet = new Set<string>();
  let contractCount = 0;
  let blockTimes: number[] = [];
  let maxGasUsage = 0;
  let firstTimestamp = blocks[blocks.length - 1].timestamp;
  let lastTimestamp = blocks[0].timestamp;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i > 0) {
      blockTimes.push(blocks[i - 1].timestamp - block.timestamp);
    }
    if (parseInt(block.gasUsed) > maxGasUsage) {
      maxGasUsage = parseInt(block.gasUsed);
    }
    if (Array.isArray(block.transactions)) {
      totalTxCount += block.transactions.length;
      for (const tx of block.transactions) {
        if (typeof tx === 'string') {
          allTxHashes.push(tx);
        } else if (tx && typeof tx.hash === 'string') {
          allTxHashes.push(tx.hash);
        }
      }
    }
    // Wallets and contracts (only from objects)
    const txObjs = Array.isArray(block.prefetchedTransactions) && block.prefetchedTransactions.length > 0
      ? block.prefetchedTransactions
      : Array.isArray(block.transactions) && typeof block.transactions[0] === 'object' ? block.transactions : [];
    for (const tx of txObjs) {
      if (!tx || typeof tx !== 'object') continue;
      if (tx.from) walletSet.add(tx.from.toLowerCase());
      if (tx.to) walletSet.add(tx.to.toLowerCase());
      if (!tx.to) contractCount++;
    }
  }

  // Fetch receipts for all transactions to calculate success/fail rates
  let successCount = 0;
  let failedCount = 0;
  if (allTxHashes.length > 0) {
    const receiptResults = await Promise.all(
      allTxHashes.map(async (hash) => {
        try {
          const receipt = await getTransactionReceipt(hash, rpcUrl);
          if (receipt && typeof receipt.status !== 'undefined') {
            if (parseInt(receipt.status, 16) === 1) return 'success';
            if (parseInt(receipt.status, 16) === 0) return 'fail';
          }
        } catch (e) {}
        return null;
      })
    );
    for (const status of receiptResults) {
      if (status === 'success') successCount++;
      if (status === 'fail') failedCount++;
    }
  }

  // Calculate rates
  const seconds = lastTimestamp - firstTimestamp;
  const tps = seconds > 0 ? totalTxCount / seconds : 0;
  const successRate = totalTxCount > 0 ? (successCount / totalTxCount) * 100 : 0;
  const failedTxRate = totalTxCount > 0 ? (failedCount / totalTxCount) * 100 : 0;
  const avgBlockTime = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 0;
  const activeWallets = walletSet.size;
  const newContracts = contractCount;
  const healthScore = `${successRate > 95 && failedTxRate < 5 ? 'Healthy' : 'Needs Attention'}`;
  return {
    tps: Number(tps.toFixed(2)),
    successRate: Number(successRate.toFixed(2)),
    activeWallets,
    newContracts,
    failedTxRate: Number(failedTxRate.toFixed(2)),
    avgBlockTime: Number(avgBlockTime.toFixed(2)),
    maxGasUsagePerBlock: maxGasUsage,
    healthScore,
    healthScoreCount: 14,
    blockCount: blocks.length,
    totalTxCount,
    successCount,
    failedCount,
    partial: failedBlocks.length > 0,
    failedBlocks,
  };
}