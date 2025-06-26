import React, { useState, useEffect } from 'react';
import { Code, Search, Rocket, Copy } from 'lucide-react';
import { useTheme } from '../../App';
import Card from '../UI/Card';
import { getRecentDeployments } from '../../services/api';
import Modal from '../UI/Modal';

interface Deployment {
  hash: string;
  deployer: string;
  time: number;
  fees: string;
}

const DeploymentsSection = () => {
  const { darkMode } = useTheme();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment & { txHash?: string, blockNumber?: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 DeploymentsSection: Starting to fetch deployments...');
        const fetchedDeployments = await getRecentDeployments();
        console.log('🔍 DeploymentsSection: Fetched deployments:', fetchedDeployments.length);
        setDeployments(fetchedDeployments);
      } catch (error) {
        console.error('🔍 DeploymentsSection: Error fetching deployments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); 
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="w-full">
      <Card title="Recent Contract Deployments">
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contract Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deployer</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fees</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading deployments...
                    </td>
                  </tr>
                ) : deployments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No recent deployments found
                    </td>
                  </tr>
                ) : (
                  deployments.map((deployment) => (
                    <tr key={deployment.hash} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setSelectedDeployment(deployment); setIsModalOpen(true); }}>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900 dark:text-gray-100 flex items-center">
                        <Rocket className="w-5 h-5 text-purple-500 mr-3" />
                        <span>{deployment.hash.substring(0, 10)}...</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-500 dark:text-gray-300 text-left">{deployment.deployer.substring(0, 10)}...</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{formatTimestamp(deployment.time)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">{deployment.fees}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      {selectedDeployment && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Deployment Details">
          <div className="space-y-4">
            <div>
              <span className="font-semibold mr-2">Contract Address:</span>
              <span
                className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                onClick={() => handleCopy(selectedDeployment.hash)}
                title="Click to copy"
              >
                {selectedDeployment.hash}
              </span>
              {copied === selectedDeployment.hash && <span className="ml-2 text-xs text-green-500">Copied!</span>}
            </div>
            <div>
              <span className="font-semibold mr-2">Deployer:</span>
              <span
                className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                onClick={() => handleCopy(selectedDeployment.deployer)}
                title="Click to copy"
              >
                {selectedDeployment.deployer}
              </span>
              {copied === selectedDeployment.deployer && <span className="ml-2 text-xs text-green-500">Copied!</span>}
            </div>
            {selectedDeployment.txHash && (
              <div>
                <span className="font-semibold mr-2">Txn Hash:</span>
                <span
                  className="font-mono break-all cursor-pointer hover:underline text-blue-600"
                  onClick={() => handleCopy(selectedDeployment.txHash!)}
                  title="Click to copy"
                >
                  {selectedDeployment.txHash}
                </span>
                {copied === selectedDeployment.txHash && <span className="ml-2 text-xs text-green-500">Copied!</span>}
              </div>
            )}
            {selectedDeployment.blockNumber && (
              <div><span className="font-semibold mr-2">Block Number:</span> <span className="font-mono">#{selectedDeployment.blockNumber}</span></div>
            )}
            <div><span className="font-semibold mr-2">Timestamp:</span> {formatTimestamp(selectedDeployment.time)}</div>
            <div><span className="font-semibold mr-2">Fees:</span> {selectedDeployment.fees}</div>
          </div>
        </Modal>
      )}
      </Card>
    </div>
  );
};

export default DeploymentsSection;