/**
 * useStalenessWarning - React hook for detecting stale platform data
 * 
 * Checks time since last successful fetch and displays warnings
 * if data is > 60 seconds old.
 * 
 * Requirements: 11.5, 12.4
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook to check for stale data warnings
 * 
 * @param {number} refreshInterval How often to check staleness (default: 5000ms)
 * @returns {Object} Staleness status for all platforms
 */
export function useStalenessWarning(refreshInterval = 5000) {
  const [stalenessStatus, setStalenessStatus] = useState({
    polymarket: {
      isStale: false,
      lastFetch: null,
      timeSinceLastFetch: null
    },
    kalshi: {
      isStale: false,
      lastFetch: null,
      timeSinceLastFetch: null
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStalenessStatus = async () => {
      try {
        const response = await fetch('http://92.246.141.205:3001/api/staleness-status');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted) {
          setStalenessStatus(data.status);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          console.error('Staleness status fetch error:', err);
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchStalenessStatus();

    // Set up interval for auto-refresh
    const interval = setInterval(fetchStalenessStatus, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return { stalenessStatus, isLoading, error };
}

/**
 * Component to display staleness warning icon
 * 
 * @param {Object} props Component props
 * @param {string} props.platform Platform name ('polymarket' or 'kalshi')
 * @param {boolean} props.isStale Whether data is stale
 * @param {number} props.timeSinceLastFetch Time since last fetch in ms
 * @param {string} props.theme Theme ('dark' or 'light')
 * @returns {JSX.Element|null} Warning icon or null
 */
export function StalenessWarningIcon({ platform, isStale, timeSinceLastFetch, theme = 'dark' }) {
  if (!isStale) {
    return null;
  }

  const secondsSinceLastFetch = timeSinceLastFetch 
    ? Math.round(timeSinceLastFetch / 1000) 
    : null;

  const iconColor = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
  const tooltipBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const tooltipText = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  const tooltipBorder = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';

  return (
    <div className="relative group inline-block">
      {/* Warning Icon */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={`h-5 w-5 ${iconColor}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
      
      {/* Tooltip */}
      <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 ${tooltipBg} ${tooltipText} text-xs rounded-lg border ${tooltipBorder} shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50`}>
        <div className="font-semibold mb-1">⚠️ Data may be stale</div>
        <div>{platform} data is {secondsSinceLastFetch}s old</div>
        <div className="text-gray-400 mt-1">Last update &gt; 60s ago</div>
        {/* Arrow */}
        <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 ${theme === 'dark' ? 'border-t-gray-800' : 'border-t-white'} border-l-transparent border-r-transparent`}></div>
      </div>
    </div>
  );
}

/**
 * Component to display staleness warning banner
 * 
 * @param {Object} props Component props
 * @param {Object} props.stalenessStatus Staleness status object
 * @param {string} props.theme Theme ('dark' or 'light')
 * @returns {JSX.Element|null} Warning banner or null
 */
export function StalenessWarningBanner({ stalenessStatus, theme = 'dark' }) {
  const stalePlatforms = [];
  
  if (stalenessStatus.polymarket?.isStale) {
    stalePlatforms.push({
      name: 'Polymarket',
      timeSinceLastFetch: stalenessStatus.polymarket.timeSinceLastFetch
    });
  }
  
  if (stalenessStatus.kalshi?.isStale) {
    stalePlatforms.push({
      name: 'Kalshi',
      timeSinceLastFetch: stalenessStatus.kalshi.timeSinceLastFetch
    });
  }

  if (stalePlatforms.length === 0) {
    return null;
  }

  const bannerBg = theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-100';
  const bannerBorder = theme === 'dark' ? 'border-yellow-700' : 'border-yellow-400';
  const bannerText = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800';

  return (
    <div className={`${bannerBg} border ${bannerBorder} ${bannerText} px-4 py-3 rounded-lg mb-4`}>
      <div className="flex items-start">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
        <div>
          <div className="font-semibold mb-1">Data may be stale</div>
          <div className="text-sm">
            {stalePlatforms.map((platform, index) => {
              const seconds = Math.round(platform.timeSinceLastFetch / 1000);
              return (
                <div key={platform.name}>
                  {platform.name} data is {seconds}s old
                  {index < stalePlatforms.length - 1 && ', '}
                </div>
              );
            })}
          </div>
          <div className="text-xs mt-1 opacity-75">
            Prices and volumes may not reflect current market conditions
          </div>
        </div>
      </div>
    </div>
  );
}
