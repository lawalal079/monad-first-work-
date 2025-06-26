import React, { useState, useEffect, useRef } from 'react';
import Card from '../UI/Card';
import Modal from '../UI/Modal';
import { ArrowLeftRight } from 'lucide-react';
import { getLatestTransactions, Transaction, getBlockByNumber, batchBlockVisionData } from '../../services/api';

const TransactionsSection: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const seenTxHashes = useRef(new Set<string>());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const latestBlock = await getBlockByNumber('latest', true);
        if (!latestBlock || !latestBlock.transactions || latestBlock.transactions.length === 0) {
            return;
        }

        const txHashes = (latestBlock.transactions as any[]).map(tx => tx.hash).filter(Boolean);
        if (txHashes.length === 0) return;

        const newTxHashes = txHashes.filter(hash => !seenTxHashes.current.has(hash));
        if (newTxHashes.length === 0) return;

        const receiptRequests = newTxHashes.map(hash => ({
            method: 'eth_getTransactionReceipt',
            params: [hash]
        }));
        const txRequests = newTxHashes.map(hash => ({
            method: 'eth_getTransactionByHash',
            params: [hash]
        }));

        const receipts = await batchBlockVisionData(receiptRequests);
        const txs = await batchBlockVisionData(txRequests);

        const newTransactions: Transaction[] = [];
        for (let i = 0; i < newTxHashes.length; i++) {
            if (txs[i] && receipts[i] && receipts[i].status !== null) {
                const tx = txs[i];
                const receipt = receipts[i];
                newTransactions.push({
                    ...tx,
                    timestamp: latestBlock.timestamp,
                    status: parseInt(receipt.status, 16),
                    value: (parseInt(tx.value, 16) / 1e18).toFixed(4),
                });
            }
        }
        
        if(newTransactions.length > 0) {
          newTransactions.forEach(tx => seenTxHashes.current.add(tx.hash));
          setTransactions(prevTxs => [...newTransactions, ...prevTxs].slice(0, 50));
        }

      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        if(isLoading) setIsLoading(false);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleTxClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '...';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1200);
  };

  const renderContent = () => {
    if (isLoading && transactions.length === 0) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="text-gray-500 dark:text-gray-400">Waiting for new transactions...</div>
        </div>
      );
    }
    return (
      <div className="overflow-auto h-80">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Txn Hash</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((tx, index) => (
              <tr key={tx.hash || index} onClick={() => handleTxClick(tx)} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center font-mono text-sm text-gray-900 dark:text-gray-100">
                    <ArrowLeftRight className="w-5 h-5 text-purple-500 mr-3" />
                    <span>{(tx.hash || 'N/A').substring(0, 15)}...</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-500 dark:text-gray-300">{(tx.from || 'N/A').substring(0, 15)}...</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate" title={tx.to ?? undefined}>
                  {tx.to ? `${tx.to.substring(0, 15)}...` : 'Contract Creation'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{parseFloat(tx.value || '0').toFixed(4)} MON</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    tx.status === 1 ? 'bg-green-100 text-green-800' : 
                    tx.status === 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tx.status === 1 ? 'Success' : tx.status === 0 ? 'Failure' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Card title="Live Txs">
        {renderContent()}
      </Card>
      {selectedTx && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Transaction Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-all">
              <div>
                <p className="text-sm text-gray-500">Txn Hash</p>
                <p>
                  <span
                    className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                    onClick={() => handleCopy(selectedTx.hash)}
                    title="Click to copy"
                  >
                    {selectedTx.hash || 'N/A'}
                  </span>
                  {copied === selectedTx.hash && <span className="ml-2 text-xs text-green-500">Copied!</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p>
                  <span
                    className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                    onClick={() => handleCopy(selectedTx.from)}
                    title="Click to copy"
                  >
                    {selectedTx.from || 'N/A'}
                  </span>
                  {copied === selectedTx.from && <span className="ml-2 text-xs text-green-500">Copied!</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">To</p>
                <p>
                  <span
                    className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                    onClick={() => handleCopy(selectedTx.to || 'Contract Creation')}
                    title="Click to copy"
                  >
                    {selectedTx.to || 'Contract Creation'}
                  </span>
                  {copied === selectedTx.to && <span className="ml-2 text-xs text-green-500">Copied!</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Value</p>
                <p>{selectedTx.value} MON</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`font-semibold ${
                    selectedTx.status === 1 ? 'text-green-600' : 
                    selectedTx.status === 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {selectedTx.status === 1 ? 'Success' : selectedTx.status === 0 ? 'Failure' : 'Pending'}
                </p>
              </div>
               <div>
                <p className="text-sm text-gray-500">Timestamp</p>
                <p>{formatTimestamp(selectedTx.timestamp)}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default TransactionsSection;