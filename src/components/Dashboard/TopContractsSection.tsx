import React, { useState, useEffect } from 'react';
import { List } from 'lucide-react';
import Card from '../UI/Card';
import { getTopContracts, getContractInfo } from '../../services/api';
import { motion } from 'framer-motion';
import Modal from '../UI/Modal';

interface Contract {
  address: string;
  name: string;
  transactions: number;
}

export function TopContractsSection() {
  const [contracts, setContracts] = useState<Contract[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastTopContracts');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const topContracts = await getTopContracts();
        if (Array.isArray(topContracts) && topContracts.length > 0) {
          setContracts(topContracts);
          if (typeof window !== 'undefined') {
            localStorage.setItem('lastTopContracts', JSON.stringify(topContracts));
          }
        }
        // else, keep showing last known data (do not update state)
      } catch (e) {
        // On error, keep showing last known data
      }
    };

    fetchContracts();
    const interval = setInterval(fetchContracts, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRowClick = async (address: string, txCount: number) => {
    setSelectedContract(address);
    setIsModalOpen(true);
    setIsDetailsLoading(true);
    try {
      const details = await getContractInfo(address);
      setContractDetails({ ...details, txCount });
    } catch (e) {
      setContractDetails({ address, txCount });
    } finally {
      setIsDetailsLoading(false);
    }
  };

  return (
    <Card title="Top Contracts in Last 10 Blocks">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contract
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Transactions
              </th>
            </tr>
          </thead>
        </table>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <table className="min-w-full">
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {contracts.map((contract, index) => (
                <motion.tr 
                  key={contract.address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => handleRowClick(contract.address, contract.transactions)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{contract.name || contract.address}</div>
                    {!contract.name && <div className="text-xs text-gray-500 dark:text-gray-400 truncate" style={{ maxWidth: '150px' }}>{contract.address}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-300">
                    {contract.transactions.toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setContractDetails(null); setSelectedContract(null); }} title="Contract Details">
        {isDetailsLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : contractDetails ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Contract Address</p>
              <p className="font-mono break-all">{contractDetails.address || selectedContract}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Transactions in Last 10 Blocks</p>
              <p>{contractDetails.txCount}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
} 