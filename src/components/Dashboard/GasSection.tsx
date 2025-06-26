import React, { useState, useEffect } from 'react';
import Card from '../UI/Card';
import { Zap } from 'lucide-react';
import { getGasOverviewData, getGasUsageHistory, getTransactionByHash, getBlockByNumber, getTransactionReceipt } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../App';
import { TopContractsSection } from './TopContractsSection';
import Modal from '../UI/Modal';

const GasSection: React.FC = () => {
  const [gasOverview, setGasOverview] = useState<{ baseFee: string, priorityFee: string, highGasTxs: any[] } | null>(null);
  const [gasHistory, setGasHistory] = useState<{ time: string, gasUsed: number }[]>([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const { darkMode } = useTheme();
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedBlockTimestamp, setSelectedBlockTimestamp] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [persistedHighGasTxs, setPersistedHighGasTxs] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const isValidGasOverview = (overview: any) => {
      if (!overview) return false;
      return (
        parseFloat(overview.baseFee) > 0 ||
        parseFloat(overview.priorityFee) > 0 ||
        (overview.highGasTxs && overview.highGasTxs.length > 0)
      );
    };
    const isValidGasHistory = (history: any) => {
      return Array.isArray(history) && history.length > 0;
    };
    const fetchOverview = async () => {
      setIsOverviewLoading(true);
      try {
        const overview = await getGasOverviewData();
        if (overview && isMounted && isValidGasOverview(overview)) {
          setGasOverview(overview);
          // Merge new highGasTxs with persisted ones, deduplicate by hash, keep latest 12
          setPersistedHighGasTxs(prev => {
            const txMap = new Map();
            // Add new first (so they're most recent)
            overview.highGasTxs.forEach(tx => txMap.set(tx.hash, { ...tx }));
            prev.forEach(tx => {
              if (!txMap.has(tx.hash)) txMap.set(tx.hash, tx);
            });
            return Array.from(txMap.values()).slice(0, 12);
          });
        }
      } catch (error) {
        console.error('Failed to fetch gas overview', error);
      } finally {
        setIsOverviewLoading(false);
      }
    };
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const history = await getGasUsageHistory(10);
        if (isMounted && isValidGasHistory(history)) {
          setGasHistory(history);
        }
      } catch (error) {
        console.error('Failed to fetch gas history', error);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    fetchOverview();
    fetchHistory();
    const interval = setInterval(() => {
      fetchOverview();
      fetchHistory();
    }, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const hexToDecimal = (hex: string) => hex ? parseInt(hex, 16).toLocaleString() : 'N/A';
  const hexToGwei = (hex: string) => hex ? (parseInt(hex, 16) / 1e9).toFixed(2) + ' Gwei' : 'N/A';

  const handleTxClick = async (tx: any) => {
    try {
      const fullTx = await getTransactionByHash(tx.hash);
      const receipt = await getTransactionReceipt(tx.hash);
      let blockTimestamp = '';
      let gasLimit = fullTx && fullTx.gas ? fullTx.gas : undefined;
      let gasUsed = receipt && receipt.gasUsed ? receipt.gasUsed : undefined;
      let effectiveGasPrice = receipt && receipt.effectiveGasPrice ? receipt.effectiveGasPrice : undefined;
      let txType = fullTx && (fullTx as any).type !== undefined ? Number((fullTx as any).type) : 0;
      let status = receipt && receipt.status !== undefined ? (typeof receipt.status === 'string' ? parseInt(receipt.status, 16) : Number(receipt.status)) : undefined;
      if (fullTx && fullTx.blockNumber) {
        const block = await getBlockByNumber(fullTx.blockNumber, false);
        if (block && block.timestamp) {
          const date = new Date(block.timestamp * 1000);
          blockTimestamp = date.toLocaleString();
        }
      }
      setSelectedBlockTimestamp(blockTimestamp);
      setSelectedTx({ ...tx, ...fullTx, ...receipt, gasLimit, gasUsed, effectiveGasPrice, txType, status } as any);
    } catch (error) {
      setSelectedTx(tx);
      setSelectedBlockTimestamp('');
    }
    setIsModalOpen(true);
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-1/2">
        <TopContractsSection />
      </div>
      <div className="w-full lg:w-1/2">
        <Card title="High Gas Transactions">
          {persistedHighGasTxs.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-2">Transaction</th>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Gas Used</th>
                    </tr>
                  </thead>
                </table>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="min-w-full">
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {persistedHighGasTxs.map((tx: any) => (
                        <tr key={tx.hash} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => handleTxClick(tx)}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-purple-500" title={tx.hash}>
                            {tx.hash.substring(0, 15)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {formatTimestamp(tx.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {tx.gasUsed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          ) : null}
        </Card>
        {selectedTx && (
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gas Transaction Details">
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
                      {selectedTx.hash}
                    </span>
                    {copied === selectedTx.hash && <span className="ml-2 text-xs text-green-500">Copied!</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Block Number</p>
                  <p>{selectedTx.blockNumber ? `#${hexToDecimal(selectedTx.blockNumber)}` : null}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Timestamp</p>
                  <p>{selectedBlockTimestamp || null}</p>
                </div>
                {selectedTx.gasLimit && (
                  <div>
                    <p className="text-sm text-gray-500">Gas Limit</p>
                    <p>{hexToDecimal(selectedTx.gasLimit)}</p>
                  </div>
                )}
                {selectedTx.gasUsed && (
                  <div>
                    <p className="text-sm text-gray-500">Gas Used</p>
                    <p>{hexToDecimal(selectedTx.gasUsed)}</p>
                  </div>
                )}
                {selectedTx.gasPrice && (
                  <div>
                    <p className="text-sm text-gray-500">Gas Price</p>
                    <p>{hexToGwei(selectedTx.gasPrice)}</p>
                  </div>
                )}
                {(selectedTx as any).effectiveGasPrice && (
                  <div>
                    <p className="text-sm text-gray-500">Effective Gas Price</p>
                    <p>{hexToGwei((selectedTx as any).effectiveGasPrice)}</p>
                  </div>
                )}
                {selectedTx.maxFeePerGas && (
                  <div>
                    <p className="text-sm text-gray-500">Max Fee Per Gas</p>
                    <p>{hexToGwei(selectedTx.maxFeePerGas)}</p>
                  </div>
                )}
                {selectedTx.maxPriorityFeePerGas && (
                  <div>
                    <p className="text-sm text-gray-500">Max Priority Fee Per Gas</p>
                    <p>{hexToGwei(selectedTx.maxPriorityFeePerGas)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p>{selectedTx.status === 1 ? 'Success' : 'Fail'}</p>
                </div>
                {selectedTx.txType !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Transaction Type</p>
                    <p>{
                      selectedTx.txType === 2 ? 'EIP-1559' :
                      selectedTx.txType === 1 ? 'EIP-2930' :
                      'Legacy'
                    }</p>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default GasSection;