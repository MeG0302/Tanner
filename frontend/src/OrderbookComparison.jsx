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

// Format price
function formatPrice(price) {
  return `${(price * 100).toFixed(1)}¢`;
}

// Format size
function formatSize(size) {
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  return size.toFixed(0);
}

// --- Orderbook Display Component ---
function OrderbookDisplay({ platformName, orderbook, theme = 'dark' }) {
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const bgCard = theme === 'dark' ? 'bg-[#1A2332]' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  
  // Check if orderbook exists
  if (!orderbook || (!orderbook.asks && !orderbook.bids)) {
    return (
      <div className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
        {/* Platform Header */}
        <div className="flex items-center gap-2 mb-4">
          <img
            src={getPlatformLogo(platformName)}
            alt={platformName}
            className="w-6 h-6 rounded-full"
            style={platformName === 'kalshi' ? { backgroundColor: 'white', padding: '2px' } : {}}
          />
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {platformName.charAt(0).toUpperCase() + platformName.slice(1)}
          </h3>
        </div>
        
        {/* Unavailable Message */}
        <div className={`text-center py-8 ${textSecondary}`}>
          <div className="text-2xl mb-2">📊</div>
          <div className="font-medium">Orderbook unavailable</div>
          <div className="text-xs mt-1">
            This platform may not provide orderbook data via API
          </div>
        </div>
      </div>
    );
  }
  
  const asks = orderbook.asks?.slice(0, 10) || [];
  const bids = orderbook.bids?.slice(0, 10) || [];
  
  // Calculate spread
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  const isHighSpread = spread && spread > 0.10;
  
  return (
    <div className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img
            src={getPlatformLogo(platformName)}
            alt={platformName}
            className="w-6 h-6 rounded-full"
            style={platformName === 'kalshi' ? { backgroundColor: 'white', padding: '2px' } : {}}
          />
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {platformName.charAt(0).toUpperCase() + platformName.slice(1)}
          </h3>
        </div>
        
        {/* Spread Indicator */}
        {spread !== null && (
          <div className={`text-sm ${isHighSpread ? 'text-red-500' : textSecondary}`}>
            Spread: {formatPrice(spread)}
            {isHighSpread && ' ⚠️'}
          </div>
        )}
      </div>
      
      {/* Orderbook Table */}
      <div className="space-y-4">
        {/* Asks (Sell Orders) */}
        <div>
          <div className={`text-xs font-semibold ${textSecondary} mb-2 flex justify-between px-2`}>
            <span>ASKS (Sell)</span>
            <span className="text-red-500">↑</span>
          </div>
          <div className="space-y-1">
            {asks.length > 0 ? (
              asks.map((ask, i) => {
                const total = ask.price * ask.size;
                return (
                  <div
                    key={`ask-${i}`}
                    className={`flex justify-between px-2 py-1 rounded text-sm ${
                      theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                    }`}
                  >
                    <span className="text-red-500 font-medium">
                      {formatPrice(ask.price)}
                    </span>
                    <span className={textSecondary}>
                      {formatSize(ask.size)}
                    </span>
                    <span className={textPrimary}>
                      ${total.toFixed(0)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={`text-center py-2 text-xs ${textSecondary}`}>
                No asks available
              </div>
            )}
          </div>
        </div>
        
        {/* Spread Divider */}
        {spread !== null && (
          <div className={`text-center py-2 border-y ${borderColor}`}>
            <span className={`text-sm font-semibold ${isHighSpread ? 'text-red-500' : textSecondary}`}>
              Spread: {formatPrice(spread)}
            </span>
          </div>
        )}
        
        {/* Bids (Buy Orders) */}
        <div>
          <div className={`text-xs font-semibold ${textSecondary} mb-2 flex justify-between px-2`}>
            <span>BIDS (Buy)</span>
            <span className="text-green-500">↓</span>
          </div>
          <div className="space-y-1">
            {bids.length > 0 ? (
              bids.map((bid, i) => {
                const total = bid.price * bid.size;
                return (
                  <div
                    key={`bid-${i}`}
                    className={`flex justify-between px-2 py-1 rounded text-sm ${
                      theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                    }`}
                  >
                    <span className="text-green-500 font-medium">
                      {formatPrice(bid.price)}
                    </span>
                    <span className={textSecondary}>
                      {formatSize(bid.size)}
                    </span>
                    <span className={textPrimary}>
                      ${total.toFixed(0)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={`text-center py-2 text-xs ${textSecondary}`}>
                No bids available
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Column Headers (at bottom for reference) */}
      <div className={`flex justify-between px-2 mt-4 pt-2 border-t ${borderColor} text-xs ${textSecondary}`}>
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
    </div>
  );
}

// --- Main OrderbookComparison Component ---
export default function OrderbookComparison({ unifiedMarket, theme = 'dark' }) {
  const { platforms } = unifiedMarket;
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  
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
        Orderbook Comparison
      </h2>
      
      {/* Orderbook Grid */}
      <div className={`grid gap-4 ${
        availablePlatforms.length === 1 
          ? 'grid-cols-1 max-w-md' 
          : 'grid-cols-1 md:grid-cols-2'
      }`}>
        {availablePlatforms.map(platformName => (
          <OrderbookDisplay
            key={platformName}
            platformName={platformName}
            orderbook={platforms[platformName].orderbook}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
