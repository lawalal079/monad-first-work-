import React, { useState, useEffect, useRef } from 'react';
import Card from '../UI/Card';
import Modal from '../UI/Modal';
import { Boxes } from 'lucide-react';
import { getLatestBlockNumber, getBlockByNumber, Block, batchBlockVisionData } from '../../services/api';

const BlocksSection: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const latestBlockNumberRef = useRef<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialBlocks = async () => {
      setIsLoading(true);
      try {
        const latestBlockNum = await getLatestBlockNumber();
        const blockRequests = [];
        for (let i = 0; i < 12; i++) {
            blockRequests.push({ method: 'eth_getBlockByNumber', params: [`0x${(latestBlockNum - i).toString(16)}`, false] });
        }
        const initialBlocks = (await batchBlockVisionData(blockRequests)).filter(Boolean) as Block[];
        
        if (initialBlocks && initialBlocks.length > 0) {
            initialBlocks.forEach(b => { b.number = parseInt(b.number as any, 16); b.timestamp = parseInt(b.timestamp as any, 16) });
            setBlocks(initialBlocks);
            latestBlockNumberRef.current = initialBlocks[0].number;
        }
      } catch (error) {
        console.error('Failed to fetch initial blocks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const pollForNewBlocks = async () => {
      if (latestBlockNumberRef.current === null) return;
      try {
        const newLatestBlockNumber = await getLatestBlockNumber();
        if (newLatestBlockNumber > latestBlockNumberRef.current) {
          const blockRequests = [];
          for (let i = latestBlockNumberRef.current + 1; i <= newLatestBlockNumber; i++) {
            blockRequests.push({ method: 'eth_getBlockByNumber', params: [`0x${i.toString(16)}`, false] });
          }
          const newBlocks = (await batchBlockVisionData(blockRequests)).filter(Boolean) as Block[];
          
          if (newBlocks.length > 0) {
            newBlocks.forEach(b => { b.number = parseInt(b.number as any, 16); b.timestamp = parseInt(b.timestamp as any, 16) });
            setBlocks(prevBlocks => [...newBlocks.reverse(), ...prevBlocks].slice(0, 12));
          }
          latestBlockNumberRef.current = newLatestBlockNumber;
        }
      } catch (error) {
        console.error('Error polling for new blocks:', error);
      }
    };

    fetchInitialBlocks();
    const interval = setInterval(pollForNewBlocks, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleBlockClick = async (block: Block) => {
    setIsBlockLoading(true);
    setIsModalOpen(true);
    try {
      const fullBlock = await getBlockByNumber(block.number, true);
      setSelectedBlock(fullBlock);
    } catch (error) {
      console.error('Failed to fetch full block details:', error);
      setSelectedBlock(block);
    } finally {
      setIsBlockLoading(false);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '...';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  const formatGasValue = (gas: any) => {
    if (typeof gas !== 'string' || !gas.startsWith('0x')) {
      return Number(gas).toLocaleString();
    }
    const decimal = parseInt(gas, 16);
    return isNaN(decimal) ? 'N/A' : decimal.toLocaleString();
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1200);
  };

  const renderContent = () => {
    if (isLoading && blocks.length === 0) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="text-gray-500 dark:text-gray-400">Waiting for new blocks...</div>
        </div>
      );
    }
    return (
      <div className="overflow-auto h-80">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">BLOCK NUMBER</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Txn Count</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {blocks.map((block) => (
              <tr key={block.number} onClick={() => handleBlockClick(block)} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900 dark:text-gray-100">
                    <Boxes className="w-5 h-5 text-purple-500 mr-3" />
                    <span>#{block.number}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatTimestamp(block.timestamp)}</td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-500 dark:text-gray-300">{block.transactions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Card title="Live Blocks">
        {renderContent()}
      </Card>
      {selectedBlock && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Block #${selectedBlock.number}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-all">
              <div>
                <p className="text-sm text-gray-500">Block Hash</p>
                <p>
                  <span
                    className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                    onClick={() => handleCopy(selectedBlock.hash)}
                    title="Click to copy"
                  >
                    {selectedBlock.hash}
                  </span>
                  {copied === selectedBlock.hash && <span className="ml-2 text-xs text-green-500">Copied!</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Timestamp</p>
                <p>{formatTimestamp(selectedBlock.timestamp)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Txn Found</p>
                <p>{selectedBlock.transactions.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gas Used</p>
                <p>{formatGasValue(selectedBlock.gasUsed)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gas Limit</p>
                <p>{formatGasValue(selectedBlock.gasLimit)}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default BlocksSection;