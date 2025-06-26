import React, { useEffect, useState } from 'react';
import { Bell, AlertCircle, CheckCircle, Info, RefreshCw, X, Copy } from 'lucide-react';
import { useTheme } from '../../App';
import Card from '../UI/Card';
import Modal from '../UI/Modal';
import { getRecentEvents, getNewEventsSince, getLatestBlockNumber, Event, getLatestBlocksWithTransactions } from '../../services/api';

const EventsLog = () => {
  const { darkMode } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBlockNumber, setLastBlockNumber] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  const fetchInitialEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const [initialEvents, latestBlock] = await Promise.all([
        getRecentEvents(2),
        getLatestBlockNumber()
      ]);
      setEvents(initialEvents);
      setLastBlockNumber(latestBlock);
      setVisibleCount(5);
    } catch (err) {
      console.error('Error fetching initial events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkForNewEvents = async () => {
    try {
      const newEvents = await getNewEventsSince(lastBlockNumber);
      if (newEvents.length > 0) {
        setEvents(prevEvents => {
          const combined = [...newEvents, ...prevEvents];
          const uniqueEvents = combined.filter((event, index, self) =>
            index === self.findIndex(e => e.id === event.id)
          );
          return uniqueEvents.slice(0, 20);
        });
        const latestBlock = await getLatestBlockNumber();
        setLastBlockNumber(latestBlock);
        setVisibleCount(5);
      }
    } catch (err) {
      console.error('Error checking for new events:', err);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchInitialEvents();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInitialEvents();
  }, []);

  useEffect(() => {
    // Always auto-refresh every 30 seconds
    const interval = setInterval(checkForNewEvents, 30000);
    return () => clearInterval(interval);
  }, [lastBlockNumber]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1200);
  };

  const getEventIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      default:
        return <Bell size={16} className="text-gray-500" />;
    }
  };

  const getEventClass = (status: string, darkMode: boolean) => {
    switch (status) {
      case 'success':
        return darkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200';
      case 'warning':
        return darkMode ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200';
      case 'error':
        return darkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200';
      case 'info':
        return darkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200';
      default:
        return darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    if (address.length > 42) {
      return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card title="Events Log">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Events Log">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Real-time blockchain events</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-500">Live</span>
          </div>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className={`p-2 rounded-lg transition-colors ${
            darkMode 
              ? 'hover:bg-gray-700 disabled:opacity-50' 
              : 'hover:bg-gray-100 disabled:opacity-50'
          }`}
        >
          <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Bell size={24} className="mx-auto mb-2 opacity-50" />
            <p>No events found</p>
            <p className="text-xs mt-1">Events will appear here as they occur on the blockchain</p>
          </div>
        ) : (
          events.slice(0, visibleCount).map(event => (
            <div
              key={event.id}
              className={`p-4 rounded-lg border ${getEventClass(event.status, darkMode)} flex items-start transition-all duration-200 hover:shadow-md cursor-pointer`}
              onClick={() => setSelectedEvent(event)}
              tabIndex={0}
              role="button"
              aria-label="View event details"
            >
              <div className="mr-4 mt-1">{getEventIcon(event.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium truncate">{event.type}</h4>
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex-shrink-0 ml-2`}>
                    {formatTime(event.time)}
                  </span>
                </div>
                <p className="text-sm mt-1 font-mono">{formatAddress(event.address)}</p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {event.details.replace(/ETH/g, 'MON')}
                </p>
                {event.blockNumber && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Block: {event.blockNumber.toLocaleString()}
                    </span>
                    {event.gasUsed && (
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Gas: {Number(event.gasUsed).toLocaleString()}
                      </span>
                    )}
                    {event.value && (
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Value: {Number(event.value).toString()} wei
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {events.length > visibleCount && visibleCount < 10 && (
        <div className="flex justify-center mt-2">
          <button
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition"
            onClick={() => setVisibleCount(c => Math.min(c + 5, 10))}
          >
            Load more
          </button>
        </div>
      )}

      <div className={`mt-4 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-end text-xs">
          <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{events.length} events</span>
        </div>
      </div>

      {/* Modal for event details */}
      <Modal 
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? selectedEvent.type + ' Details' : ''}
      >
        {selectedEvent && (
          <div className="p-0 min-w-[320px] max-w-[420px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {getEventIcon(selectedEvent.status)}
                {selectedEvent.type}
              </h3>
            </div>
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">{formatTime(selectedEvent.time)}</div>
            <div className="mb-2">
              <div className="font-mono text-sm flex items-center gap-2">
                <span>Tx Hash:</span>
                <span className="truncate max-w-[180px]">{selectedEvent.transactionHash || selectedEvent.address}</span>
                <button onClick={e => { e.stopPropagation(); handleCopy(selectedEvent.transactionHash || selectedEvent.address); }} title="Copy Tx Hash">
                  <Copy size={14} className="ml-1" />
                </button>
                {copied === (selectedEvent.transactionHash || selectedEvent.address) && <span className="text-green-500 ml-1">Copied!</span>}
              </div>
            </div>
            {selectedEvent.blockNumber && (
              <div className="mb-2 text-sm">
                <span className="font-medium">Block:</span> #{selectedEvent.blockNumber}
              </div>
            )}
            {selectedEvent.address && (
              <div className="mb-2 text-sm">
                <span className="font-medium">To:</span> {selectedEvent.address}
                <button onClick={e => { e.stopPropagation(); handleCopy(selectedEvent.address); }} title="Copy Address">
                  <Copy size={14} className="ml-1" />
                </button>
                {copied === selectedEvent.address && <span className="text-green-500 ml-1">Copied!</span>}
              </div>
            )}
            {selectedEvent.value && (
              <div className="mb-2 text-sm">
                <span className="font-medium">Value:</span> {Number(selectedEvent.value).toFixed(4)} MON
              </div>
            )}
            {selectedEvent.gasUsed && (
              <div className="mb-2 text-sm">
                <span className="font-medium">Gas Used:</span> {Number(selectedEvent.gasUsed).toLocaleString()}
              </div>
            )}
            {/* Add more details as needed */}
            {selectedEvent.details && (
              <div className="mb-2 text-sm">
                <span className="font-medium">Details:</span> {selectedEvent.details.replace(/ETH/g, 'MON')}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default EventsLog;