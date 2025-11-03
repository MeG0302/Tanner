import React from 'react';
import { useStalenessWarning, StalenessWarningIcon, StalenessWarningBanner } from './useStalenessWarning';

// --- Helper Functions ---

// Get platform logo URL
function getPlatformLogo(platform) {
  const logos = {
    'polymarket': 'https://polymarket.com/favicon.ico',
    'kalshi': 'https://kalshi.com/favicon.ico'
  };
  return logos[platform.toLowerCase()] || 'https://via.placeholder.com/32';
}

// Format time ago
function getTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Format volume
function formatVolume(volume) {
  if (!volume) return '$0';
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${Math.round(volume).toLocaleString()}`;
}

// Check if platform has best price
function isBestPrice(platformName, unifiedMarket) {
  const { best_price } = unifiedMarket;
  return best_price.yes.platform === platformName || best_price.no.platform === platformName;
}

// Check if platform has best liquidity
function isBestLiquidity(platformName, unifiedMarket) {
  const { platforms } = unifiedMarket;
  const platformData = platforms[platformName];
  
  if (!platformData) return false;
  
  // Find platform with highest liquidity
  let maxLiquidity = 0;
  let bestPlatform = null;
  
  Object.entries(platforms).forEach(([name, data]) => {
    if (data.liquidity > maxLiquidity) {
      maxLiquidity = data.liquidity;
      bestPlatform = name;
    }
  });
  
  return bestPlatform === platformName;
}

// Check if platform is recommended for a specific action
function isRecommended(platformName, unifiedMarket, action) {
  const { routing_recommendations } = unifiedMarket;
  if (!routing_recommendations) return false;
  
  const recommendation = routing_recommendations[action];
  return recommendation && recommendation.platform === platformName;
}

// Get recommendation reason
function getRecommendationReason(platformName, unifiedMarket, action) {
  const { routing_recommendations } = unifiedMarket;
  if (!routing_recommendations) return null;
  
  const recommendation = routing_recommendations[action];
  if (recommendation && recommendation.platform === platformName) {
    return recommendation.reason;
  }
  return null;
}

// --- Platform Section Component ---
function PlatformSection({ platformName, platformData, unifiedMarket, stalenessStatus, theme = 'dark' }) {
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const bgCard = theme === 'dark' ? 'bg-[#1A2332]' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  
  const hasBestPrice = isBestPrice(platformName, unifiedMarket);
  const hasBestLiquidity = isBestLiquidity(platformName, unifiedMarket);
  
  // Check routing recommendations
  const isRecommendedBuyYes = isRecommended(platformName, unifiedMarket, 'buy_yes');
  const isRecommendedSellYes = isRecommended(platformName, unifiedMarket, 'sell_yes');
  const hasRecommendation = isRecommendedBuyYes || isRecommendedSellYes;
  const recommendationReason = isRecommendedBuyYes 
    ? getRecommendationReason(platformName, unifiedMarket, 'buy_yes')
    : isRecommendedSellYes 
      ? getRecommendationReason(platformName, unifiedMarket, 'sell_yes')
      : null;
  
  // Find YES and NO outcomes
  const yesOutcome = platformData.outcomes?.find(o => o.name === 'Yes');
  const noOutcome = platformData.outcomes?.find(o => o.name === 'No');
  
  // Calculate spread
  const spread = platformData.spread || 0;
  const isHighSpread = spread > 0.10;
  
  // Get staleness info for this platform
  const platformStaleness = stalenessStatus?.[platformName.toLowerCase()];
  const isStale = platformStaleness?.isStale || false;
  const timeSinceLastFetch = platformStaleness?.timeSinceLastFetch;
  
  return (
    <div className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img
            src={getPlatformLogo(platformName)}
            alt={platformName}
            className="w-8 h-8 rounded-full"
            style={platformName === 'kalshi' ? { backgroundColor: 'white', padding: '3px' } : {}}
          />
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {platformName.charAt(0).toUpperCase() + platformName.slice(1)}
          </h3>
          {/* Staleness Warning Icon */}
          {isStale && (
            <StalenessWarningIcon
              platform={platformName}
              isStale={isStale}
              timeSinceLastFetch={timeSinceLastFetch}
              theme={theme}
            />
          )}
        </div>
        
        {/* Last Update */}
        {platformData.lastUpdate && (
          <span className={`text-xs ${textSecondary}`}>
            Updated {getTimeAgo(platformData.lastUpdate)}
          </span>
        )}
      </div>
      
      {/* Prices */}
      <div className="mb-4">
        <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Prices</h4>
        <div className="grid grid-cols-2 gap-3">
          {yesOutcome && (
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <span className={`text-xs ${textSecondary}`}>YES</span>
              <div className={`text-2xl font-bold ${textPrimary}`}>
                {(yesOutcome.price * 100).toFixed(1)}¢
              </div>
            </div>
          )}
          {noOutcome && (
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <span className={`text-xs ${textSecondary}`}>NO</span>
              <div className={`text-2xl font-bold ${textPrimary}`}>
                {(noOutcome.price * 100).toFixed(1)}¢
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Spread */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className={`text-sm ${textSecondary}`}>Spread</span>
          <span className={`text-sm font-semibold ${isHighSpread ? 'text-red-500' : textPrimary}`}>
            {(spread * 100).toFixed(1)}¢
            {isHighSpread && ' ⚠️'}
          </span>
        </div>
      </div>
      
      {/* Volume & Liquidity */}
      <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="flex justify-between mb-2">
          <span className={`text-xs ${textSecondary}`}>24h Volume</span>
          <span className={`text-sm font-semibold ${textPrimary}`}>
            {formatVolume(platformData.volume_24h)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={`text-xs ${textSecondary}`}>Liquidity</span>
          <span className={`text-sm font-semibold ${textPrimary}`}>
            {formatVolume(platformData.liquidity)}
          </span>
        </div>
      </div>
      
      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {hasRecommendation && (
          <span 
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              theme === 'dark'
                ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50'
                : 'bg-purple-100 text-purple-700 border border-purple-300'
            }`}
            title={recommendationReason}
          >
            ⭐ Recommended
          </span>
        )}
        {hasBestPrice && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            theme === 'dark'
              ? 'bg-green-900/30 text-green-300 border border-green-700/50'
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            ✓ Best Price
          </span>
        )}
        {hasBestLiquidity && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            theme === 'dark'
              ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50'
              : 'bg-blue-100 text-blue-700 border border-blue-300'
          }`}>
            ✓ Best Liquidity
          </span>
        )}
      </div>
      
      {/* Recommendation Explanation */}
      {hasRecommendation && recommendationReason && (
        <div className={`mb-4 p-3 rounded-lg ${
          theme === 'dark' ? 'bg-purple-900/20 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'
        }`}>
          <div className={`text-xs ${textSecondary} mb-1`}>Why recommended:</div>
          <div className={`text-sm ${textPrimary}`}>{recommendationReason}</div>
        </div>
      )}
      
      {/* Trade Button */}
      <button 
        className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
        onClick={() => window.open(platformData.url || '#', '_blank')}
      >
        Trade on {platformName.charAt(0).toUpperCase() + platformName.slice(1)}
      </button>
    </div>
  );
}

// --- Main PlatformComparison Component ---
export default function PlatformComparison({ unifiedMarket, theme = 'dark' }) {
  const { platforms } = unifiedMarket;
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  
  // Use staleness warning hook
  const { stalenessStatus, isLoading, error } = useStalenessWarning(5000);
  
  const availablePlatforms = Object.keys(platforms);
  
  if (availablePlatforms.length === 0) {
    return (
      <div className={`text-center py-8 ${textPrimary}`}>
        No platform data available
      </div>
    );
  }
  
  return (
    <div className="mb-8">
      <h2 className={`text-2xl font-bold mb-4 ${textPrimary}`}>
        Platform Comparison
      </h2>
      
      {/* Staleness Warning Banner */}
      {!isLoading && !error && (
        <StalenessWarningBanner stalenessStatus={stalenessStatus} theme={theme} />
      )}
      
      {/* Platform Grid */}
      <div className={`grid gap-4 ${
        availablePlatforms.length === 1 
          ? 'grid-cols-1 max-w-md' 
          : 'grid-cols-1 md:grid-cols-2'
      }`}>
        {availablePlatforms.map(platformName => (
          <PlatformSection
            key={platformName}
            platformName={platformName}
            platformData={platforms[platformName]}
            unifiedMarket={unifiedMarket}
            stalenessStatus={stalenessStatus}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
