import React, { useState } from 'react';

// Professional Multi-Line Market Chart Component
export function MarketChart({ outcomes, theme = 'dark' }) {
  const [timeframe, setTimeframe] = useState('ALL');

  if (!outcomes || outcomes.length === 0) {
    return (
      <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        No chart data available
      </div>
    );
  }

  // Filter history based on timeframe
  const getFilteredHistory = (history) => {
    if (!history || history.length === 0) return [];
    
    const now = Date.now() / 1000;
    let cutoff;
    
    switch(timeframe) {
      case '1H': cutoff = now - 3600; break;
      case '6H': cutoff = now - 21600; break;
      case '1D': cutoff = now - 86400; break;
      case '1W': cutoff = now - 604800; break;
      default: return history;
    }
    
    return history.filter(p => p.time >= cutoff);
  };

  // Chart dimensions
  const width = 800;
  const height = 400;
  const pad = { top: 20, right: 100, bottom: 40, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Get all time points
  const allTimes = outcomes.flatMap(o => getFilteredHistory(o.history || []).map(h => h.time));
  if (allTimes.length === 0) {
    return <div className="text-gray-400 text-center py-8">No data for selected timeframe</div>;
  }

  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const timeRange = maxTime - minTime || 1;

  // Scale functions
  const scaleX = (time) => pad.left + ((time - minTime) / timeRange) * chartW;
  const scaleY = (pct) => pad.top + chartH - (pct * chartH / 100);

  // Generate SVG path for outcome
  const makePath = (history) => {
    const filtered = getFilteredHistory(history);
    if (filtered.length === 0) return '';
    
    return filtered.map((p, i) => {
      const x = scaleX(p.time);
      const y = scaleY(p.value * 100);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Format time label
  const formatTime = (ts) => {
    const d = new Date(ts * 1000);
    if (timeframe === '1H' || timeframe === '6H') {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (timeframe === '1D') {
      return d.toLocaleTimeString('en-US', { hour: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];
  
  // X-axis labels (5 points)
  const xLabels = Array.from({ length: 5 }, (_, i) => minTime + (timeRange * i / 4));

  // Theme colors
  const bg = theme === 'dark' ? '#0a0e1a' : '#ffffff';
  const grid = theme === 'dark' ? '#1f2937' : '#e5e7eb';
  const text = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const axis = theme === 'dark' ? '#374151' : '#d1d5db';

  const timeframes = ['1H', '6H', '1D', '1W', 'ALL'];

  return (
    <div className="w-full">
      {/* Timeframe Buttons */}
      <div className="flex gap-2 mb-4 justify-end">
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              timeframe === tf
                ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-[#95b89b] text-white')
                : (theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart SVG */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ background: bg }}>
          {/* Horizontal grid lines */}
          {yLabels.map(y => (
            <g key={`y-${y}`}>
              <line
                x1={pad.left}
                y1={scaleY(y)}
                x2={width - pad.right}
                y2={scaleY(y)}
                stroke={grid}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={pad.left - 10}
                y={scaleY(y)}
                textAnchor="end"
                alignmentBaseline="middle"
                fill={text}
                fontSize="12"
              >
                {y}%
              </text>
            </g>
          ))}

          {/* Vertical grid lines */}
          {xLabels.map((t, i) => (
            <g key={`x-${i}`}>
              <line
                x1={scaleX(t)}
                y1={pad.top}
                x2={scaleX(t)}
                y2={height - pad.bottom}
                stroke={grid}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={scaleX(t)}
                y={height - pad.bottom + 20}
                textAnchor="middle"
                fill={text}
                fontSize="11"
              >
                {formatTime(t)}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={height - pad.bottom}
            stroke={axis}
            strokeWidth="2"
          />
          <line
            x1={pad.left}
            y1={height - pad.bottom}
            x2={width - pad.right}
            y2={height - pad.bottom}
            stroke={axis}
            strokeWidth="2"
          />

          {/* Draw lines for each outcome */}
          {outcomes.map((outcome, idx) => {
            const path = makePath(outcome.history);
            const filtered = getFilteredHistory(outcome.history || []);
            if (filtered.length === 0) return null;
            
            const last = filtered[filtered.length - 1];
            const lastX = scaleX(last.time);
            const lastY = scaleY(last.value * 100);
            const color = outcome.color || '#3B82F6';
            
            return (
              <g key={`line-${idx}`}>
                {/* Line */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* End circle */}
                <circle
                  cx={lastX}
                  cy={lastY}
                  r="6"
                  fill={color}
                  stroke={bg}
                  strokeWidth="2"
                />
                
                {/* Label */}
                <text
                  x={width - pad.right + 10}
                  y={lastY}
                  fill={color}
                  fontSize="12"
                  fontWeight="600"
                  alignmentBaseline="middle"
                >
                  {outcome.name} {(last.value * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {outcomes.map((outcome, idx) => (
          <div key={`legend-${idx}`} className="flex items-center gap-2">
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
