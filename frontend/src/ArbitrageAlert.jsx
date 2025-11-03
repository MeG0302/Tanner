import React, { useState } from 'react';

// --- ArbitrageAlert Component ---
export default function ArbitrageAlert({ arbitrage, theme = 'dark' }) {
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Don't show if no arbitrage or dismissed
  if (!arbitrage || !arbitrage.exists || isDismissed) {
    return null;
  }
  
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  
  // Parse instructions to extract steps
  const parseInstructions = (instructions) => {
    if (!instructions) return [];
    
    // Split by common delimiters and filter empty strings
    const steps = instructions
      .split(/\d+\.\s+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());
    
    return steps;
  };
  
  const steps = parseInstructions(arbitrage.instructions);
  
  return (
    <div className="mb-8">
      {/* Alert Banner */}
      <div
        className={`relative rounded-lg p-6 shadow-lg border-2 ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-red-900/40 to-orange-900/40 border-red-500'
            : 'bg-gradient-to-r from-red-100 to-orange-100 border-red-400'
        }`}
      >
        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              : 'bg-white hover:bg-gray-100 text-gray-600'
          }`}
          title="Dismiss alert"
        >
          ×
        </button>
        
        {/* Alert Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-4xl animate-pulse">🚨</div>
          <div>
            <h3 className={`text-2xl font-bold ${textPrimary}`}>
              Arbitrage Opportunity Detected!
            </h3>
            <p className={`text-lg ${textSecondary}`}>
              Potential profit: <span className="font-bold text-red-500">
                {arbitrage.profit_pct.toFixed(2)}%
              </span>
            </p>
          </div>
        </div>
        
        {/* Trading Instructions */}
        <div className={`${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white/70'} rounded-lg p-4 mb-4`}>
          <h4 className={`text-lg font-semibold mb-3 ${textPrimary}`}>
            Trading Instructions
          </h4>
          
          {steps.length > 0 ? (
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`flex-1 ${textSecondary}`}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={textSecondary}>{arbitrage.instructions}</p>
          )}
        </div>
        
        {/* Warning */}
        <div className={`flex items-start gap-2 p-3 rounded-lg ${
          theme === 'dark'
            ? 'bg-yellow-900/30 border border-yellow-700/50'
            : 'bg-yellow-50 border border-yellow-300'
        }`}>
          <span className="text-xl">⚠️</span>
          <div className={`text-sm ${textSecondary}`}>
            <p className="font-semibold mb-1">Important Considerations:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Trading fees may reduce or eliminate profit margins</li>
              <li>Prices can change rapidly - execute quickly</li>
              <li>Ensure sufficient liquidity on both platforms</li>
              <li>Consider slippage and execution risk</li>
              <li>This is not financial advice - trade at your own risk</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
