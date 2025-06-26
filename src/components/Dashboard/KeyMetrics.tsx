import React, { useState, useEffect } from 'react';
import { Cylinder, Zap, Boxes, ArrowRightLeft, Wallet, Landmark } from 'lucide-react';
import { getDashboardMetrics } from '../../services/api';

interface IStats {
  latestBlock: number;
  txsInLastBlock: number;
  totalTxs: string;
  blocksPerMin: number;
  txsPerMin: number;
  avgTxValue: string;
}

const KeyMetrics: React.FC = () => {
  const [stats, setStats] = useState<IStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    const isValidStats = (metrics: any) => {
      if (!metrics) return false;
      // Check if all values are zero or empty
      return (
        metrics.latestBlock > 0 ||
        metrics.txsInLastBlock > 0 ||
        Number(metrics.totalTxs.replace(/,/g, '')) > 0 ||
        metrics.blocksPerMin > 0 ||
        metrics.txsPerMin > 0 ||
        parseFloat(metrics.avgTxValue) > 0
      );
    };
    const fetchMetrics = async () => {
      try {
        const metrics = await getDashboardMetrics();
        if (isMounted && isValidStats(metrics)) {
          setStats(metrics);
        }
      } catch (error) {
        // Log error, but do not clear stats
        console.error('Error fetching dashboard metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // 5 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const renderMetric = (value: number | string | null, formatter: (v: any) => React.ReactNode) => {
    if (value === null || value === undefined) {
      return <span>...</span>;
    }
    return formatter(value);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4"><Boxes className="w-6 h-6 text-purple-500" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Blocks</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {renderMetric(stats?.latestBlock ?? null, v => `#${v.toLocaleString()}`)}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4"><ArrowRightLeft className="w-6 h-6 text-purple-500" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Txs in Last Block</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {renderMetric(stats?.txsInLastBlock ?? null, v => v.toLocaleString())}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4"><Cylinder className="w-6 h-6 text-purple-500" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Blocks/min</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {renderMetric(stats?.blocksPerMin ?? null, v => v.toFixed(1))}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4"><Zap className="w-6 h-6 text-purple-500" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Txs/min</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {renderMetric(stats?.txsPerMin ?? null, v => Math.round(v).toLocaleString())}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4"><Wallet className="w-6 h-6 text-purple-500" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Tx Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {renderMetric(stats?.avgTxValue ?? null, v => `${v} MON`)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyMetrics; 