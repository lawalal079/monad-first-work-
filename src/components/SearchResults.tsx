import React from 'react';
import { 
  Copy
} from 'lucide-react';

export interface BlockSearchResult {
  type: 'block';
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  gasPrice: string;
  miner: string;
  totalTransactions: number;
}

export interface TransactionSearchResult {
  type: 'transaction';
  hash: string;
  from: string;
  to: string;
  status: number;
  blockNumber: string;
  timestamp: number;
  value: string;
  gasUsed: string;
  gasLimit: string;
  gasPrice: string;
  txFees: string;
  gasFees: string;
}

export interface ContractSearchResult {
  type: 'contract';
  address: string;
  contractType: 'ERC20' | 'ERC721' | 'Unknown';
  totalSupply?: string;
  totalTransactions: number;
  holders?: number;
  decimals?: number;
  name?: string;
  symbol?: string;
  deploymentTime: number;
  gasUsed: string;
  gasLimit: string;
  fees: string;
}

export interface ContractAddressSearchResult {
  type: 'contract_address';
  address: string;
  contractType: 'ERC20' | 'ERC721' | 'Unknown';
  totalSupply?: string;
  totalTransactions: number;
  holders?: number;
  decimals?: number;
  name?: string;
  symbol?: string;
}

type SearchResult = BlockSearchResult | TransactionSearchResult | ContractSearchResult | ContractAddressSearchResult;

interface SearchResultsProps {
  result: SearchResult;
}

const SearchResults: React.FC<SearchResultsProps> = ({ result }) => {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatGasValue = (hexValue: string) => {
    return parseInt(hexValue, 16).toLocaleString();
  };

  const formatValue = (value: string) => {
    return parseFloat(value).toFixed(6);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  const DetailItem: React.FC<{ label: string; value: React.ReactNode; fullWidth?: boolean }> = ({ label, value, fullWidth = false }) => (
    <div className={`${fullWidth ? 'md:col-span-2' : ''}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-center space-x-2">
            <p className="font-mono text-sm break-words">{value}</p>
        </div>
    </div>
  );

  const AddressItem: React.FC<{ label: string; address: string; fullWidth?: boolean }> = ({ label, address, fullWidth = false }) => (
    <div className={`${fullWidth ? 'md:col-span-2' : ''}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-center space-x-2">
            <p className="font-mono text-sm break-all">{address}</p>
            <button 
                onClick={() => copyToClipboard(address)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
                <Copy className="w-3 h-3" />
            </button>
        </div>
    </div>
  );

  const renderBlockResult = (block: BlockSearchResult) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailItem label="Transactions found in the block" value={block.totalTransactions} />
        <DetailItem label="Txn Type" value="Block" />
        <DetailItem label="Timestamp" value={formatTimestamp(block.timestamp)} />
        <DetailItem label="Gas Used" value={formatGasValue(block.gasUsed)} />
        <DetailItem label="Gas Limit" value={formatGasValue(block.gasLimit)} />
        <DetailItem label="Gas Price" value={`${formatGasValue(block.gasPrice)} Gwei`} />
        <AddressItem label="Miner" address={block.miner} fullWidth />
        <AddressItem label="Hash" address={block.hash} fullWidth />
        <AddressItem label="Parent Hash" address={block.parentHash} fullWidth />
    </div>
  );

  const renderTransactionResult = (tx: TransactionSearchResult) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AddressItem label="From" address={tx.from} />
        <AddressItem label="To" address={tx.to} />
        <DetailItem label="Status" value={tx.status === 1 ? 'Success' : 'Failure'} />
        <DetailItem label="Block Number" value={parseInt(tx.blockNumber, 16)} />
        <DetailItem label="Timestamp" value={formatTimestamp(tx.timestamp)} />
        <DetailItem label="Value" value={`${formatValue(tx.value)} MON`} />
        <DetailItem label="Txn Fees" value={`${tx.txFees} MON`} />
        <DetailItem label="Gas Fees" value={`${tx.gasFees} MON`} />
        <AddressItem label="Txn Hash" address={tx.hash} fullWidth />
    </div>
  );

  const renderContractResult = (contract: ContractSearchResult) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AddressItem label="Txn Hash" address={contract.address} fullWidth />
        <DetailItem label="Txn Type" value="Contract" />
        <DetailItem label="Deployment Time" value={formatTimestamp(contract.deploymentTime)} />
        <DetailItem label="Gas Used" value={formatGasValue(contract.gasUsed)} />
        <DetailItem label="Gas Limit" value={formatGasValue(contract.gasLimit)} />
        <DetailItem label="Fees" value={`${contract.fees} MON`} />
    </div>
  );

  const renderContractAddressResult = (contract: ContractAddressSearchResult) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailItem label="Contract Address" value={contract.address || 'N/A'} />
        <DetailItem label="Contract Type" value={contract.contractType === 'ERC20' ? 'ERC20 [token]' : contract.contractType === 'ERC721' ? 'ERC721 [nft]' : contract.contractType || 'N/A'} />
        <DetailItem label="Contract Name" value={contract.name || 'N/A'} />
        <DetailItem label="Total Supply" value={contract.totalSupply || 'N/A'} />
        <DetailItem label="Total Txn Found" value={contract.totalTransactions !== undefined ? contract.totalTransactions : 'N/A'} />
        <DetailItem label="Holders" value={contract.holders || 'N/A'} />
        <DetailItem label="Decimals" value={contract.decimals || (contract.contractType === 'ERC20' ? '18' : 'N/A')} />
    </div>
  );

  const AllResults = () => {
    switch (result.type) {
      case 'block': return renderBlockResult(result);
      case 'transaction': return renderTransactionResult(result);
      case 'contract': return renderContractResult(result);
      case 'contract_address': return renderContractAddressResult(result);
      default: return null;
    }
  }

  return (
    <div className="overflow-y-auto h-96 pr-4">
      <AllResults />
    </div>
  );
};

export default SearchResults;
