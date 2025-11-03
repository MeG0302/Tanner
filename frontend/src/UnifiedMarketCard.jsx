import React from 'react';

// --- Helper Functions ---

// Get platform logo URL
function getPlatformLogo(platform) {
  const logos = {
    'polymarket': 'https://polymarket.com/favicon.ico',
    'kalshi': 'https://kalshi.com/favicon.ico'
  };
  return logos[platform.toLowerCase()] || 'https://via.placeholder.com/32';
}

// Format volume to readable string
function formatVolume(volume) {
  if (!volume) return '$0';
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${Math.round(volume).toLocaleString()}`;
}

// --- Liquidity Score Component (Star Rating) ---
function LiquidityScore({ score, theme = 'dark' }) {
  const fullStars = Math.floor(score);
  const hasHalfStar = score % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  const starColor = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500';
  const emptyStarColor = theme === 'dark' ? 'text-gray-600' : 'text-gray-300';
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} className={starColor}>⭐</span>
      ))}
      {hasHalfStar && <span className={starColor}>⭐</span>}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} className={emptyStarColor}>☆</span>
      ))}
    </div>
  );
}

// --- Platform Indicator Display Component ---
function PlatformIndicators({ platforms, platformHealth, theme = 'dark' }) {
  const availablePlatforms = Object.keys(platforms);
  const isMultiPlatform = availablePlatforms.length > 1;
  
  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Platform Logos */}
      <div className="flex items-center gap-1">
        {availablePlatforms.map(platform => {
          const health = platformHealth?.[platform];
          const isDegraded = health?.status === 'degraded';
          
          return (
            <div key={platform} className="relative">
              <img
                src={getPlatformLogo(platform)}
                alt={platform}
                className="w-5 h-5 rounded-full"
                style={platform === 'kalshi' ? { backgroundColor: 'white', padding: '2px' } : {}}
                title={`${platform.charAt(0).toUpperCase() + platform.slice(1)}${isDegraded ? ' (Degraded)' : ''}`}
              />
              {/* Warning icon for degraded platforms */}
              {isDegraded && (
                <span 
                  className="absolute -top-1 -right-1 text-xs"
                  title="Platform data may be stale"
                >
                  ⚠️
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Multi-Platform Badge */}
      {isMultiPlatform && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          theme === 'dark' 
            ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50' 
            : 'bg-blue-100 text-blue-700 border border-blue-300'
        }`}>
          Multi-Platform
        </span>
      )}
    </div>
  );
}

// --- Best Price Display Component ---
function BestPriceDisplay({ bestPrice, theme = 'dark' }) {
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  
  return (
    <div className="flex justify-between items-center mb-3">
      {/* Best YES Price */}
      <div className="flex flex-col items-start">
        <span className={`text-xs ${textSecondary}`}>Best YES</span>
        <div className="flex items-center gap-1">
          <span className={`text-lg font-bold ${textPrimary}`}>
            {(bestPrice.yes.price * 100).toFixed(0)}¢
          </span>
          <span className={`text-xs ${textSecondary}`}>
            {bestPrice.yes.platform}
          </span>
        </div>
      </div>
      
      {/* Best NO Price */}
      <div className="flex flex-col items-end">
        <span className={`text-xs ${textSecondary}`}>Best NO</span>
        <div className="flex items-center gap-1">
          <span className={`text-xs ${textSecondary}`}>
            {bestPrice.no.platform}
          </span>
          <span className={`text-lg font-bold ${textPrimary}`}>
            {(bestPrice.no.price * 100).toFixed(0)}¢
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Arbitrage Badge Component ---
function ArbitrageBadge({ arbitrage, theme = 'dark' }) {
  if (!arbitrage || !arbitrage.exists) return null;
  
  return (
    <div 
      className={`absolute top-2 right-2 px-2 py-1 rounded-lg font-bold text-xs shadow-lg cursor-pointer ${
        theme === 'dark'
          ? 'bg-red-600 text-white border border-red-500'
          : 'bg-red-500 text-white border border-red-400'
      }`}
      title={arbitrage.instructions}
    >
      🚨 Arbitrage {arbitrage.profit_pct.toFixed(1)}%
    </div>
  );
}

// --- Main UnifiedMarketCard Component ---
export default function UnifiedMarketCard({ unifiedMarket, onMarketClick, platformHealth, theme = 'dark' }) {
  const { 
    unified_id, 
    question, 
    category, 
    platforms, 
    best_price, 
    combined_volume, 
    liquidity_score, 
    arbitrage 
  } = unifiedMarket;
  
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const textVolumeLabel = theme === 'dark' ? 'text-gray-400' : 'text-gray-400';
  const textVolumeValue = theme === 'dark' ? 'text-white' : 'text-gray-700';
  
  // Get image from first available platform (prioritize Polymarket)
  const marketImage = platforms.polymarket?.image || platforms.kalshi?.image;
  
  return (
    <div
      className={`relative rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 h-auto ${
        theme === 'dark' 
          ? 'bg-[#1A2332] border border-gray-700 hover:border-blue-500/50' 
          : 'bg-[#95b89b] border border-[#7a9c7f] hover:border-[#6b8a70]'
      }`}
      onClick={() => onMarketClick(unifiedMarket)}
      title={question}
    >
      {/* Arbitrage Badge */}
      <ArbitrageBadge arbitrage={arbitrage} theme={theme} />
      
      {/* Market Image */}
      {marketImage && (
        <div className="mb-3">
          <img
            src={marketImage}
            alt={question}
            className="w-full h-32 object-cover rounded-lg"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}
      
      {/* Category */}
      <span className={`text-xs uppercase ${textSecondary}`}>{category}</span>
      
      {/* Platform Indicators */}
      <PlatformIndicators 
        platforms={platforms} 
        platformHealth={platformHealth}
        theme={theme} 
      />
      
      {/* Market Question */}
      <h3 className={`text-sm font-medium line-clamp-2 leading-tight mb-3 ${textPrimary}`}>
        {question}
      </h3>
      
      {/* Best Prices */}
      <BestPriceDisplay bestPrice={best_price} theme={theme} />
      
      {/* Footer: Combined Volume and Liquidity Score */}
      <div className={`flex items-center justify-between pt-2 border-t ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
      }`}>
        <div className="flex flex-col">
          <span className={`text-xs ${textVolumeLabel}`}>Combined Volume</span>
          <span className={`text-sm font-semibold ${textVolumeValue}`}>
            {formatVolume(combined_volume)}
          </span>
        </div>
        
        <div className="flex flex-col items-end">
          <span className={`text-xs ${textVolumeLabel} mb-1`}>Liquidity</span>
          <LiquidityScore score={liquidity_score} theme={theme} />
        </div>
      </div>
    </div>
  );
}
