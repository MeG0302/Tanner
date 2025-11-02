import React from 'react';

// --- Semicircular Gauge Component ---
function SemicircularGauge({ percentage, theme = 'dark' }) {
  const isGreen = percentage >= 50;
  const gaugeColor = isGreen ? '#10B981' : '#EF4444'; // Green or Red
  const rotation = (percentage / 100) * 180; // 0-180 degrees

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={theme === 'dark' ? '#374151' : '#D1D5DB'}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(rotation / 180) * 157} 157`}
        />
      </svg>
      {/* Percentage text */}
      <div className="text-center -mt-8">
        <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {percentage.toFixed(0)}%
        </div>
        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          chance
        </div>
      </div>
    </div>
  );
}

// Helper function to get platform logo
function getLogo(platform) {
  const logos = {
    'Polymarket': 'https://polymarket.com/favicon.ico',
    'Kalshi': 'https://kalshi.com/favicon.ico',
    'Limitless': 'https://limitless.exchange/favicon.ico'
  };
  return logos[platform] || 'https://via.placeholder.com/32';
}

// Market Image Component
function MarketImage({ imageUrl, alt, size = 'small', theme = 'dark' }) {
  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`w-full ${size === 'small' ? 'h-32' : 'h-48'} object-cover rounded-lg`}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

// --- MarketCard Component (REDESIGNED) ---
export default function MarketCardRedesigned({ market, onMarketClick, theme = 'dark' }) {
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  
  // Find Yes/No for binary markets
  const yesOutcome = outcomes.find(o => o.name === 'Yes');
  const noOutcome = outcomes.find(o => o.name === 'No');
  const isBinary = yesOutcome && noOutcome;

  // Theme-aware text colors
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const textVolumeLabel = theme === 'dark' ? 'text-gray-400' : 'text-gray-400';
  const textVolumeValue = theme === 'dark' ? 'text-white' : 'text-gray-700';

  if (outcomes.length === 0) {
    return (
      <div className={`rounded-lg shadow-sm p-4 h-auto ${theme === 'dark' ? 'bg-[#1A2332] border border-gray-700' : 'bg-[#95b89b] border border-[#7a9c7f]'}`}>
        <span className={`text-xs uppercase ${textSecondary}`}>{market.category}</span>
        <h3 className={`text-sm font-medium mt-2 ${textPrimary}`}>{market.shortTitle || market.title}</h3>
        <span className={`text-xs ${textSecondary}`}>Loading...</span>
      </div>
    );
  }

  // Format volume
  const formattedVolume = market.volume_24h 
    ? `${Math.round(market.volume_24h).toLocaleString()}` 
    : '$0';

  // Handler to open trade panel
  const handleTradeClick = (e, outcome, side) => {
    e.stopPropagation();
    onMarketClick(market, outcome, side);
  };

  return (
    <div
      className={`rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 h-auto ${theme === 'dark' ? 'bg-[#1A2332] border border-gray-700 hover:border-blue-500/50' : 'bg-[#95b89b] border border-[#7a9c7f] hover:border-[#6b8a70]'}`}
      onClick={() => onMarketClick(market)}
      title={market.title}
    >
      {/* Market Image */}
      {market.image && (
        <div className="mb-3">
          <MarketImage 
            imageUrl={market.image} 
            alt={market.title}
            size="small"
            theme={theme}
          />
        </div>
      )}

      {/* Category and Multi-Outcome Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs uppercase ${textSecondary}`}>{market.category}</span>
        {market.isMultiOutcome && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            theme === 'dark' 
              ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50' 
              : 'bg-purple-100 text-purple-700 border border-purple-300'
          }`}>
            {market.outcomeCount} outcomes
          </span>
        )}
      </div>

      {/* Header: Platform logo and title */}
      <div className="flex items-start gap-2 mb-3">
        <img
          src={getLogo(market.platform)}
          alt={market.platform}
          className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          style={market.platform === 'Kalshi' ? { backgroundColor: 'white', padding: '2px' } : {}}
        />
        <h3 className={`text-sm font-medium line-clamp-2 leading-tight flex-1 ${textPrimary}`}>
          {market.shortTitle || market.title}
        </h3>
      </div>

      {/* Outcomes Section */}
      <div className="mb-3">
        {isBinary ? (
          // Binary Market - Semicircular Gauge Design
          <div className="flex flex-col items-center">
            {/* Semicircular Gauge */}
            <SemicircularGauge percentage={yesOutcome.price * 100} theme={theme} />
            
            {/* Prices */}
            <div className="flex justify-between w-full px-4 mb-3">
              <span className={`text-sm ${textSecondary}`}>{(yesOutcome.price * 100).toFixed(1)}¢</span>
              <span className={`text-sm ${textSecondary}`}>{(noOutcome.price * 100).toFixed(1)}¢</span>
            </div>
            
            {/* Large Yes/No Buttons */}
            <div className="flex gap-2 w-full">
              <button 
                onClick={(e) => handleTradeClick(e, yesOutcome, 'YES')}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                Yes
              </button>
              <button 
                onClick={(e) => handleTradeClick(e, noOutcome, 'NO')}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          // Multi-outcome Market - List Format
          <div className="space-y-2">
            {outcomes.slice(0, 3).map((outcome, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className={`text-sm ${textPrimary} truncate max-w-[120px]`}>{outcome.name}</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>{(outcome.price * 100).toFixed(0)}%</span>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    onClick={(e) => handleTradeClick(e, outcome, 'YES')}
                    className="px-2.5 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors"
                  >
                    Yes
                  </button>
                  <button 
                    onClick={(e) => handleTradeClick(e, outcome, 'NO')}
                    className="px-2.5 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors"
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Historic Volume */}
      <div className={`flex items-center justify-between pt-2 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex flex-col">
          <span className={`text-xs ${textVolumeLabel}`}>Historic Volume</span>
          <span className={`text-sm font-semibold ${textVolumeValue}`}>{formattedVolume}</span>
        </div>
        <button className={`w-5 h-5 rounded-full border flex items-center justify-center ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'}`}>
          <span className={`text-xs ${textSecondary}`}>+</span>
        </button>
      </div>
    </div>
  );
}
