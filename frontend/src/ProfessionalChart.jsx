import React, { useState } from 'react';

// Professional Multi-Line Chart Component
export function ProfessionalMultiLineChart({ outcomes, theme = 'dark' }) {
  const [timeframe, setTimeframe] = useState('ALL');
  
  const svgWidth = 800;
  const svgHeight = 400;
  const padding = { top: 20, right: 80, bottom: 40, left: 50 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  if (!outcomes || outcomes.length === 0) {
    return <div className="text-gray-400 text-center py-8">No data available</div>;
  }

  // Filter history data based on timeframe
  const filterHistoryByTimeframe = (history) => {
    if (!history || history.length === 0) return history;
    
    const now = Date.now() / 1000;
    let cutoffTime;
    
    switch(timeframe) {
      case '1H':
        cutoffTime = now - (60 * 60);
        break;
      case '6H':
        cutoffTime = now - (6 * 60 * 60);
        break;
      case '1D':
        cutoffTime = now - (24 * 60 * 60);
        break;
      case '1W':
        cutoffTime = now - (7 * 24 * 60 * 60);
        break;
      case 'ALL':
      default:
        return history;
    }
    
    return history.filter(point => point.time >= cutoffTime);
  };

  // Get min/max values for scaling
  const minPrice = 0;
  const maxPrice = 100;
  const priceRange = maxPrice - minPrice;

  // Get time range
  const allTimes = outcomes.flatMap(o => filterHistoryByTimeframe(o.history || []).map(h => h.time));
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const timeRange = maxTime - minTime || 1;

  // Scale functions
  const scaleX = (time) => padding.left + ((time - minTime) / timeRange) * chartWidth;
  const scaleY = (price) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  // Generate path for each outcome
  const generatePath = (history) => {
    const filteredHistory = filterHistoryByTimeframe(history || []);
    if (filteredHistory.length === 0) return '';
    
    return filteredHistory.map((point, i) => {
      const x = scaleX(point.time);
      const y = scaleY(point.value * 100);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Format time for x-axis labels
  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    if (timeframe === '1H' || timeframe === '6H') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (timeframe === '1D') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Generate Y-axis labels
  const yAxisLabels = [0, 25, 50, 75, 100];
  
  // Generate X-axis labels
  const xAxisLabels = [];
  for (let i = 0; i < 5; i++) {
    const time = minTime + (timeRange * i / 4);
    xAxisLabels.push(time);
  }

  const bgColor = theme === 'dark' ? '#0a0e1a' : '#ffffff';
  const gridColor = theme === 'dark' ? '#1f2937' : '#e5e7eb';
  const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const axisColor = theme === 'dark' ? '#374151' : '#d1d5db';

  const timeframeButtons = ['1H', '6H', '1D', '1W', 'ALL'];

  return (
    <div className="w-full">
      {/* Timeframe Buttons */}
      <div className="flex gap-2 mb-4 justify-end">
        {timeframeButtons.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeframe === tf
                ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-[#95b89b] text-white')
                : (theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ background: bgColor }}>
        {/* Grid lines (horizontal) */}
        {yAxisLabels.map(label => (
          <g key={`grid-y-${label}`}>
            <line
              x1={padding.left}
              y1={scaleY(label)}
              x2={svgWidth - padding.right}
              y2={scaleY(label)}
              stroke={gridColor}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={scaleY(label)}
              textAnchor="end"
              alignmentBaseline="middle"
              fill={textColor}
              fontSize="12"
            >
              {label}%
            </text>
          </g>
        ))}

        {/* Grid lines (vertical) */}
        {xAxisLabels.map((time, i) => (
          <g key={`grid-x-${i}`}>
            <line
              x1={scaleX(time)}
              y1={padding.top}
              x2={scaleX(time)}
              y2={svgHeight - padding.bottom}
              stroke={gridColor}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={scaleX(time)}
              y={svgHeight - padding.bottom + 20}
              textAnchor="middle"
              fill={textColor}
              fontSize="11"
            >
              {formatTime(time)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={svgHeight - padding.bottom}
          stroke={axisColor}
          strokeWidth="2"
        />
        <line
          x1={padding.left}
          y1={svgHeight - padding.bottom}
          x2={svgWidth - padding.right}
          y2={svgHeight - padding.bottom}
          stroke={axisColor}
          strokeWidth="2"
        />

        {/* Draw lines for each outcome */}
        {outcomes.map((outcome, index) => {
          const path = generatePath(outcome.history);
          const filteredHistory = filterHistoryByTimeframe(outcome.history || []);
          const lastPoint = filteredHistory[filteredHistory.length - 1];
          
          if (!lastPoint) return null;
          
          const lastX = scaleX(lastPoint.time);
          const lastY = scaleY(lastPoint.value * 100);
          
          return (
            <g key={`outcome-${index}`}>
              {/* Line */}
              <path
                d={path}
                fill="none"
                stroke={outcome.color || '#3B82F6'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Circle at end of line */}
              <circle
                cx={lastX}
                cy={lastY}
                r="6"
                fill={outcome.color || '#3B82F6'}
                stroke={bgColor}
                strokeWidth="2"
              />
              
              {/* Outcome label at end */}
              <text
                x={svgWidth - padding.right + 10}
                y={lastY}
                fill={outcome.color || '#3B82F6'}
                fontSize="12"
                fontWeight="600"
                alignmentBaseline="middle"
              >
                {outcome.name} {(lastPoint.value * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {outcomes.map((outcome, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: outcome.color || '#3B82F6' }}
            />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              {outcome.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
