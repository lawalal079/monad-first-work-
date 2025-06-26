import React, { useState, useRef } from 'react';
import { Search, X as XIcon } from 'lucide-react';
import { 
    getEnhancedBlockByNumber, 
    getEnhancedTransactionByHash, 
    getContractInfo,
    getEnhancedBlockByHash
} from '../services/api';
import Modal from './UI/Modal';
import SearchResults, { 
  BlockSearchResult, 
  TransactionSearchResult, 
  ContractSearchResult, 
  ContractAddressSearchResult 
} from './SearchResults';

// NOTE: These functions are not yet implemented in api.ts
// We will need to add them there to restore search functionality
// import { getBlockByNumber, getTransactionByHash } from '../services/api';

type SearchResult = 
    | BlockSearchResult
    | TransactionSearchResult
    | ContractSearchResult
    | ContractAddressSearchResult
    | { type: 'address'; address: string; message: string }
    | { type: 'error'; message: string };

const SearchBar: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const getModalTitle = () => {
        if (isSearching) return 'Searching...';
        if (!searchResult) return '';
    
        switch (searchResult.type) {
            case 'block':
                return `Block #${searchResult.number}`;
            case 'transaction':
                return `Transaction Details`;
            case 'contract':
                return `Contract Deployment`;
            case 'contract_address':
                return `Contract Details`;
            case 'address':
                return 'Address Search';
            case 'error':
                return 'Search Error';
            default:
                return 'Search Results';
        }
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setIsModalOpen(true);
        setSearchResult(null);

        // Setup AbortController
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            let result: SearchResult | null = null;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Search timeout')), 8000)
            );
            
            if (/^0x([A-Fa-f0-9]{64})$/.test(query)) {
                // Try as block hash first
                const blockResult = await Promise.race([
                    getEnhancedBlockByHash(query, true, abortController.signal),
                    timeoutPromise
                ]);
                if (blockResult && typeof blockResult === 'object' && 'hash' in blockResult) {
                    const typedBlockResult = blockResult as any;
                    result = {
                        type: 'block',
                        number: typedBlockResult.number,
                        hash: typedBlockResult.hash,
                        parentHash: typedBlockResult.parentHash,
                        timestamp: typedBlockResult.timestamp,
                        transactions: typedBlockResult.transactions as string[],
                        gasUsed: typedBlockResult.gasUsed,
                        gasLimit: typedBlockResult.gasLimit,
                        gasPrice: typedBlockResult.gasPrice,
                        miner: typedBlockResult.miner,
                        totalTransactions: typedBlockResult.totalTransactions
                    } as BlockSearchResult;
                } else {
                    // Try as transaction hash if block not found
                    const txResult = await Promise.race([
                        getEnhancedTransactionByHash(query, abortController.signal),
                        timeoutPromise
                    ]);
                    if (txResult && typeof txResult === 'object' && 'hash' in txResult) {
                        if (!txResult.to) {
                            // Contract deployment
                            result = {
                                type: 'contract',
                                address: txResult.hash,
                                contractType: 'Unknown',
                                deploymentTime: txResult.timestamp,
                                gasUsed: txResult.gasUsed,
                                gasLimit: txResult.gasLimit,
                                fees: txResult.txFees,
                                totalTransactions: 1
                            } as ContractSearchResult;
                        } else {
                            result = {
                                type: 'transaction',
                                hash: txResult.hash,
                                from: txResult.from,
                                to: txResult.to,
                                status: txResult.status,
                                blockNumber: txResult.blockNumber,
                                timestamp: txResult.timestamp,
                                value: txResult.value,
                                gasUsed: txResult.gasUsed,
                                gasLimit: txResult.gasLimit,
                                gasPrice: txResult.gasPrice,
                                txFees: txResult.txFees,
                                gasFees: txResult.gasFees
                            } as TransactionSearchResult;
                        }
                    } else {
                        result = { type: 'error', message: 'No block or transaction found for this hash.' };
                    }
                }
            } else if (!isNaN(Number(query))) {
                // Looks like a block number
                console.log('Searching for block number:', query);
                const blockResult = await Promise.race([
                    getEnhancedBlockByNumber(parseInt(query), true, abortController.signal),
                    timeoutPromise
                ]);
                if (blockResult && typeof blockResult === 'object' && 'hash' in blockResult) {
                    const typedBlockResult = blockResult as any;
                    result = {
                        type: 'block',
                        number: typedBlockResult.number,
                        hash: typedBlockResult.hash,
                        parentHash: typedBlockResult.parentHash,
                        timestamp: typedBlockResult.timestamp,
                        transactions: typedBlockResult.transactions as string[],
                        gasUsed: typedBlockResult.gasUsed,
                        gasLimit: typedBlockResult.gasLimit,
                        gasPrice: typedBlockResult.gasPrice,
                        miner: typedBlockResult.miner,
                        totalTransactions: typedBlockResult.totalTransactions
                    } as BlockSearchResult;
                } else {
                    result = { type: 'error', message: 'No block found for this number.' };
                }
            } else if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
                // Looks like a contract address
                console.log('Searching for contract address:', query);
                const contractResult = await Promise.race([
                    getContractInfo(query, abortController.signal),
                    timeoutPromise
                ]);
                if (process.env.NODE_ENV === 'development') {
                    console.log('[SearchBar] getContractInfo result:', contractResult);
                }
                if (contractResult && typeof contractResult === 'object' && 'contractType' in contractResult) {
                    if (contractResult.contractType === 'Not a contract' || contractResult.contractType === 'N/A') {
                        result = { type: 'error', message: 'This address is not a contract on Monad.' };
                    } else {
                        const typedContractResult = contractResult as ContractAddressSearchResult;
                        result = {
                            type: 'contract_address',
                            address: typedContractResult.address,
                            contractType: typedContractResult.contractType,
                            name: typedContractResult.name,
                            symbol: typedContractResult.symbol,
                            totalSupply: typedContractResult.totalSupply,
                            holders: typedContractResult.holders,
                            decimals: typedContractResult.decimals,
                            totalTransactions: typedContractResult.totalTransactions || 0
                        } as ContractAddressSearchResult;
                    }
                } else {
                    result = { type: 'error', message: 'No contract found at this address.' };
                }
            } else {
                result = { type: 'error', message: 'Please enter a valid transaction hash, block number, or address.' };
            }
            
            setSearchResult(result);
        } catch (err: any) {
            console.error('Search error details:', err);
            if (err && err.message && err.message.includes('429')) {
                setSearchResult({ type: 'error', message: 'Too many requests. Please wait and try again.' });
            } else if (err && err.message && err.message.includes('timeout')) {
                setSearchResult({ type: 'error', message: 'Search timed out. Please try again.' });
            } else if (err && err.message && err.message.includes('Failed to fetch')) {
                setSearchResult({ type: 'error', message: 'Network error. Please check your connection and try again.' });
            } else if (err && err.message && err.message.includes('RPC Error')) {
                setSearchResult({ type: 'error', message: 'Invalid search query or data not found.' });
            } else {
                setSearchResult({ type: 'error', message: `Search failed: ${err?.message || 'Unknown error'}. Please try again.` });
            }
            setIsSearching(false);
        } finally {
            setIsSearching(false);
            abortControllerRef.current = null;
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsModalOpen(false);
        setIsSearching(false);
        setSearchResult(null);
    };

    const renderSearchResult = () => {
        if (isSearching) {
            return (
                <div className="flex flex-col justify-center items-center h-48 gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
                    <button
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                </div>
            );
        }

        if (!searchResult) return null;

        switch (searchResult.type) {
            case 'block':
            case 'transaction':
            case 'contract':
            case 'contract_address':
                return <SearchResults result={searchResult} />;
            case 'address':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Address Search</h3>
                        <p className="text-gray-600">{searchResult.message}</p>
                        <p className="font-mono text-sm">{searchResult.address}</p>
                    </div>
                );
            case 'error':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-red-600">Search Error</h3>
                        <p className="text-gray-600">{searchResult.message}</p>
                    </div>
                );
            default:
                return <p>No results found.</p>;
        }
    };

    return (
        <>
            <div className="mb-8">
                <form onSubmit={handleSearch} className="flex items-center max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-full shadow-lg relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by Txn Hash / Block Number / Block Hash"
                        className="w-full px-6 py-3 pr-14 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none rounded-full"
                        disabled={isSearching}
                        id="searchbar-input"
                    />
                    {query && !isSearching && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                setTimeout(() => {
                                    const input = document.getElementById('searchbar-input') as HTMLInputElement;
                                    if (input) input.focus();
                                }, 0);
                            }}
                            className="absolute right-16 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                            tabIndex={-1}
                            aria-label="Clear search"
                        >
                            <XIcon size={18} />
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSearching || !query.trim()}
                        className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed focus:outline-none mr-2"
                    >
                        <Search size={20} />
                    </button>
                </form>
            </div>
            
            {searchResult && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSearchResult(null);
                    }} 
                    title={getModalTitle()}
                >
                    {renderSearchResult()}
                </Modal>
            )}
        </>
    );
};

export default SearchBar;