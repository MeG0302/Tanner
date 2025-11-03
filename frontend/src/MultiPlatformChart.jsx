import React, { useState, useMemo } from 'react';

// --- Helper Functions ---

// Get platform color
function getPlatformColor(platform, opacity = 1) {
  const colors = {
    'polymarket': `rgba(99, 102, 241, ${opacity})`, // Indigo
    'kalshi': `rgba(16, 185, 129, ${opacity})` // Green
  };
  return colors[platform.toLowerCase()] || `rgba(156, 163, 175, ${opacity})`;
}

// Format time label
function formatTime(timestamp, timeframe) {
  const d = new Date(timestamp);
  
  if (timeframe === '1H' || timeframe === '6H') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (timeframe === '1D') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Multi-Platform Chart Component ---
export default function MultiPlatformChart({ unifiedMarket, theme = 'dark' }) {
  const [timeframe, setTimeframe] = useState('1D');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  const { platforms } = unifiedMarket;
  
  // Prepare chart data from all platforms
  const chartData = useMemo(() => {
    const datasets = [];
    
    Object.entries(platforms).forEach(([platformName, platformData]) => {
      if (platformData.history && platformData.history.length > 0) {
        datasets.push({
          platform: platformName,
          data: platformData.history,
          color: getPlatformColor(platformName)
        });
      }
    });
    
    return datasets;
  }, [platforms, timeframe]);
  
  // Filter history based on timeframe
  const getFilteredHistory = (history) => {
    if (!history || history.length === 0) return [];
    
    const now = Date.now();
    let cutoff;
    
    switch(timeframe) {
      case '1H': cutoff = now - 3600000; break;
      case '6H': cutoff = now - 21600000; break;
      case '1D': cutoff = now - 86400000; break;
      case '1W': cutoff = now - 604800000; break;
      case '1Y': cutoff = now - 31536000000; break;
      default: return history;
    }
    
    return history.filter(p => p.timestamp >= cutoff);
  };
  
  // Chart dimensions
  const width = 800;
  const height = 400;
  const pad = { top: 20, right: 120, bottom: 60, left: 60 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  
  // Get all time points from all platforms
  const allTimes = chartData.flatMap(dataset => 
    getFilteredHistory(dataset.data).map(h => h.timestamp)
  );
  
  if (allTimes.length === 0) {
    return (
      <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        No historical data available for selected timeframe
      </div>
    );
  }
  
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const timeRange = maxTime - minTime || 1;
  
  // Scale functions
  const scaleX = (time) => pad.left + ((time - minTime) / timeRange) * chartW;
  const scaleY = (price) => pad.top + chartH - (price * chartH);
  
  // Generate SVG path for platform
  const makePath = (history) => {
    const filtered = getFilteredHistory(history);
    if (filtered.length === 0) return '';
    
    return filtered.map((p, i) => {
      const x = scaleX(p.timestamp);
      const y = scaleY(p.price);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };
  
  // Detect price divergences (> 5% difference)
  const detectDivergences = () => {
    if (chartData.length < 2) return [];
    
    const divergences = [];
    const timestamps = new Set();
    
    // Collect all timestamps
    chartData.forEach(dataset => {
      getFilteredHistory(dataset.data).forEach(point => {
        timestamps.add(point.timestamp);
      });
    });
    
    // Check each timestamp for divergence
    Array.from(timestamps).forEach(timestamp => {
      const prices = [];
      
      chartData.forEach(dataset => {
        const point = getFilteredHistory(dataset.data).find(p => 
          Math.abs(p.timestamp - timestamp) < 60000 // Within 1 minute
        );
        if (point) prices.push(point.price);
      });
      
      if (prices.length >= 2) {
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const diff = maxPrice - minPrice;
        
        if (diff > 0.05) { // 5% divergence
          divergences.push({
            timestamp,
            x: scaleX(timestamp),
            diff: (diff * 100).toFixed(1)
          });
        }
      }
    });
    
    return divergences;
  };
  
  const divergences = detectDivergences();
  
  // Y-axis labels (0% to 100%)
  const yLabels = [0, 0.25, 0.5, 0.75, 1.0];
  
  // X-axis labels (5 points)
  const xLabels = Array.from({ length: 5 }, (_, i) => 
    minTime + (timeRange * i / 4)
  );
  
  // Theme colors
  const bg = theme === 'dark' ? '#0a0e1a' : '#ffffff';
  const grid = theme === 'dark' ? '#1f2937' : '#e5e7eb';
  const text = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const axis = theme === 'dark' ? '#374151' : '#d1d5db';
  
  const timeframes = ['1H', '6H', '1D', '1W', '1Y', 'ALL'];
  
  return (
    <div className="w-full mb-8">
      <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Price History
      </h2>
      
      {/* Timeframe Buttons */}
      <div className="flex gap-2 mb-4 justify-end">
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              timeframe === tf
                ? theme === 'dark'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      
      {/* Chart SVG */}
      <div className="relative">
        <svg 
          width={width} 
          height={height} 
          className="w-full h-auto"
          style={{ backgroundColor: bg }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Find closest data point
            let closestPoint = null;
            let minDist = Infinity;
            
            chartData.forEach(dataset => {
              getFilteredHistory(dataset.data).forEach(point => {
                const px = scaleX(point.timestamp);
                const py = scaleY(point.price);
                const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                
                if (dist < minDist && dist < 20) {
                  minDist = dist;
                  closestPoint = {
                    ...point,
                    platform: dataset.platform,
                    x: px,
                    y: py
                  };
                }
              });
            });
            
            setHoveredPoint(closestPoint);
          }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Grid lines */}
          {yLabels.map(val => (
            <line
              key={`y-${val}`}
              x1={pad.left}
              y1={scaleY(val)}
              x2={width - pad.right}
              y2={scaleY(val)}
              stroke={grid}
              strokeWidth="1"
            />
          ))}
          
          {xLabels.map((time, i) => (
            <line
              key={`x-${i}`}
              x1={scaleX(time)}
              y1={pad.top}
              x2={scaleX(time)}
              y2={height - pad.bottom}
              stroke={grid}
              strokeWidth="1"
            />
          ))}
          
          {/* Axes */}
          <line
            x1={pad.left}
            y1={height - pad.bottom}
            x2={width - pad.right}
            y2={height - pad.bottom}
            stroke={axis}
            strokeWidth="2"
          />
          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={height - pad.bottom}
            stroke={axis}
            strokeWidth="2"
          />
          
          {/* Y-axis labels */}
          {yLabels.map(val => (
            <text
              key={`y-label-${val}`}
              x={pad.left - 10}
              y={scaleY(val) + 4}
              textAnchor="end"
              fill={text}
              fontSize="12"
            >
              {(val * 100).toFixed(0)}%
            </text>
          ))}
          
          {/* X-axis labels */}
          {xLabels.map((time, i) => (
            <text
              key={`x-label-${i}`}
              x={scaleX(time)}
              y={height - pad.bottom + 20}
              textAnchor="middle"
              fill={text}
              fontSize="12"
            >
              {formatTime(time, timeframe)}
            </text>
          ))}
          
          {/* Divergence highlights */}
          {divergences.map((div, i) => (
            <g key={`div-${i}`}>
              <line
                x1={div.x}
                y1={pad.top}
                x2={div.x}
                y2={height - pad.bottom}
                stroke="rgba(239, 68, 68, 0.3)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <text
                x={div.x}
                y={pad.top - 5}
                textAnchor="middle"
                fill="#ef4444"
                fontSize="10"
              >
                {div.diff}% diff
              </text>
            </g>
          ))}
          
          {/* Plot lines for each platform */}
          {chartData.map(dataset => (
            <path
              key={dataset.platform}
              d={makePath(dataset.data)}
              fill="none"
              stroke={dataset.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          
          {/* Hovered point indicator */}
          {hoveredPoint && (
            <g>
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill={getPlatformColor(hoveredPoint.platform)}
                stroke={bg}
                strokeWidth="2"
              />
            </g>
          )}
          
          {/* Legend */}
          {chartData.map((dataset, i) => (
            <g key={`legend-${dataset.platform}`} transform={`translate(${width - pad.right + 10}, ${pad.top + i * 25})`}>
              <line
                x1="0"
                y1="0"
                x2="20"
                y2="0"
                stroke={dataset.color}
                strokeWidth="2"
              />
              <text
                x="25"
                y="4"
                fill={text}
                fontSize="12"
              >
                {dataset.platform.charAt(0).toUpperCase() + dataset.platform.slice(1)}
              </text>
            </g>
          ))}
        </svg>
        
        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className={`absolute pointer-events-none p-2 rounded shadow-lg ${
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
            style={{
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 40,
              border: `2px solid ${getPlatformColor(hoveredPoint.platform)}`
            }}
          >
            <div className="text-xs font-semibold">
              {hoveredPoint.platform.charAt(0).toUpperCase() + hoveredPoint.platform.slice(1)}
            </div>
            <div className="text-sm">
              {(hoveredPoint.price * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">
              {formatTime(hoveredPoint.timestamp, timeframe)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
