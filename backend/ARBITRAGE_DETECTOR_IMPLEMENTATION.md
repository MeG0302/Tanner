# ArbitrageDetector Implementation

## Overview

The `ArbitrageDetector` class identifies and analyzes arbitrage opportunities across multiple prediction market platforms. It detects price discrepancies that allow for risk-free profit through simultaneous buying and selling on different platforms.

## Requirements Addressed

- **Requirement 10.1**: Detect arbitrage when (platform_A_yes + platform_B_no) < 0.95
- **Requirement 10.2**: Calculate profit percentage
- **Requirement 10.3**: Display arbitrage badge with profit percentage
- **Requirement 10.4**: Generate clear trading instructions
- **Requirement 10.5**: Only flag opportunities with profit > 2% (accounting for fees)

## Architecture

### Core Algorithm

The arbitrage detection algorithm follows these steps:

1. **Find Best Prices**: Identify the lowest YES price and highest NO price across all platforms
2. **Check Threshold**: Verify if (yes_price + no_price) < 0.95
3. **Calculate Profit**: Compute profit percentage: ((1 - totalCost) / totalCost) × 100
4. **Apply Filter**: Only flag if profit > 2% to account for transaction fees
5. **Generate Instructions**: Create human-readable trading steps

### Key Components

#### 1. ArbitrageDetector Class

```javascript
class ArbitrageDetector {
  constructor(options = {}) {
    this.minProfitThreshold = options.minProfitThreshold || 2.0;  // 2% minimum
    this.maxCombinedPrice = options.maxCombinedPrice || 0.95;     // Fee threshold
  }
}
```

**Configuration Options:**
- `minProfitThreshold`: Minimum profit percentage to flag (default: 2%)
- `maxCombinedPrice`: Maximum combined price for arbitrage (default: 0.95)

#### 2. Detection Method

```javascript
detectArbitrage(unifiedMarket)
```

**Input**: Unified market object with multiple platform data

**Output**: Arbitrage data object or null
```javascript
{
  exists: true,
  profitPct: 5.26,
  totalCost: 0.90,
  yesBuy: { platform: 'polymarket', price: 0.45 },
  noSell: { platform: 'kalshi', price: 0.45 },
  detectedAt: 1699123456789
}
```

#### 3. Instruction Generation

```javascript
generateInstructions(arbitrageData, unifiedMarket)
```

**Output**: Formatted instructions object
```javascript
{
  exists: true,
  profitPct: 5.26,
  profitCents: '10.0',
  buyPlatform: 'polymarket',
  buyPrice: '45.0',
  sellPlatform: 'kalshi',
  sellPrice: '45.0',
  steps: [
    {
      step: 1,
      action: 'BUY',
      platform: 'polymarket',
      outcome: 'YES',
      price: '45.0',
      description: 'Buy YES on polymarket at 45.0¢'
    },
    {
      step: 2,
      action: 'SELL',
      platform: 'kalshi',
      outcome: 'YES',
      price: '45.0',
      description: 'Sell YES on kalshi at 45.0¢ (or buy NO at 55.0¢)'
    },
    {
      step: 3,
      action: 'PROFIT',
      amount: '10.0',
      percentage: '5.26',
      description: 'Collect profit of 10.0¢ per $1 invested (5.26% return)'
    }
  ],
  summary: 'Buy YES on polymarket at 45.0¢, Sell YES on kalshi at 45.0¢ for 5.26% profit',
  explanation: '...',
  warnings: [
    '⚠️ Arbitrage opportunities may disappear quickly...',
    '⚠️ Consider transaction fees...',
    // ... more warnings
  ],
  detectedAt: 1699123456789
}
```

## Integration with MarketAggregator

The `ArbitrageDetector` is integrated into the `MarketAggregator` class:

```javascript
class MarketAggregator {
  constructor(polymarketFetcher, kalshiFetcher, cacheManager) {
    // ... other initialization
    this.arbitrageDetector = new ArbitrageDetector({
      minProfitThreshold: 2.0,
      maxCombinedPrice: 0.95
    });
  }
  
  detectArbitrage(unifiedMarket) {
    const arbitrageData = this.arbitrageDetector.detectArbitrage(unifiedMarket);
    if (!arbitrageData || !arbitrageData.exists) return null;
    return this.arbitrageDetector.generateInstructions(arbitrageData, unifiedMarket);
  }
  
  async findArbitrageOpportunities() {
    const allMarkets = await this.getUnifiedMarkets('all');
    const opportunities = this.arbitrageDetector.detectBatchArbitrage(allMarkets);
    return opportunities.map(opp => ({
      ...opp.market,
      arbitrage: opp.arbitrage
    }));
  }
}
```

## Usage Examples

### Example 1: Detect Arbitrage in Single Market

```javascript
const detector = new ArbitrageDetector();

const unifiedMarket = {
  unified_id: 'market-123',
  question: 'Will Trump win 2024?',
  platforms: {
    polymarket: {
      outcomes: [
        { name: 'Yes', price: 0.45 },
        { name: 'No', price: 0.55 }
      ]
    },
    kalshi: {
      outcomes: [
        { name: 'Yes', price: 0.48 },
        { name: 'No', price: 0.48 }
      ]
    }
  }
};

const arbitrage = detector.detectArbitrage(unifiedMarket);
if (arbitrage && arbitrage.exists) {
  const instructions = detector.generateInstructions(arbitrage, unifiedMarket);
  console.log(instructions.summary);
  // Output: "Buy YES on polymarket at 45.0¢, Sell YES on kalshi at 48.0¢ for 5.26% profit"
}
```

### Example 2: Batch Processing

```javascript
const detector = new ArbitrageDetector();

const markets = [market1, market2, market3, ...];
const opportunities = detector.detectBatchArbitrage(markets);

// Get statistics
const stats = detector.getArbitrageStats(opportunities);
console.log(`Found ${stats.count} opportunities`);
console.log(`Average profit: ${stats.avgProfit.toFixed(2)}%`);
console.log(`Best opportunity: ${stats.maxProfit.toFixed(2)}%`);
```

### Example 3: Custom Configuration

```javascript
// More aggressive detection (lower threshold)
const aggressiveDetector = new ArbitrageDetector({
  minProfitThreshold: 1.0,  // 1% minimum
  maxCombinedPrice: 0.97     // Higher fee tolerance
});

// More conservative detection (higher threshold)
const conservativeDetector = new ArbitrageDetector({
  minProfitThreshold: 5.0,  // 5% minimum
  maxCombinedPrice: 0.93     // Lower fee tolerance
});
```

## Testing

Run the test suite to verify the implementation:

```bash
node backend/test-arbitrage-detector.js
```

### Test Scenarios

1. **Clear Arbitrage**: 5% profit opportunity (should detect)
2. **No Arbitrage**: Prices sum to > 0.95 (should not detect)
3. **Small Arbitrage**: < 2% profit (should ignore)
4. **Single Platform**: Only one platform (should skip)
5. **Large Arbitrage**: 10% profit (should detect with warning)
6. **Batch Processing**: Multiple markets (should find all opportunities)
7. **Statistics**: Aggregate statistics (should calculate correctly)

## API Endpoints

The arbitrage detection is exposed through the following API endpoints:

### GET /api/arbitrage-opportunities

Returns all markets with arbitrage opportunities, sorted by profit percentage.

**Response:**
```json
[
  {
    "unified_id": "market-123",
    "question": "Will Trump win 2024?",
    "platforms": { ... },
    "arbitrage": {
      "exists": true,
      "profitPct": 5.26,
      "buyPlatform": "polymarket",
      "buyPrice": "45.0",
      "sellPlatform": "kalshi",
      "sellPrice": "48.0",
      "steps": [ ... ],
      "summary": "Buy YES on polymarket at 45.0¢, Sell YES on kalshi at 48.0¢ for 5.26% profit",
      "warnings": [ ... ]
    }
  }
]
```

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Process multiple markets in a single pass
2. **Early Exit**: Skip markets with < 2 platforms immediately
3. **Price Validation**: Filter out invalid prices (≤ 0 or ≥ 1) early
4. **Caching**: Cache arbitrage results with short TTL (30 seconds)

### Complexity Analysis

- **Single Market Detection**: O(n) where n = number of platforms × outcomes
- **Batch Processing**: O(m × n) where m = number of markets
- **Sorting**: O(m log m) for sorting by profit

## Security & Risk Warnings

The system generates appropriate warnings for users:

1. **Speed Warning**: Opportunities may disappear quickly
2. **Fee Warning**: Consider 2-5% transaction fees
3. **Slippage Warning**: Account for low liquidity
4. **Funding Warning**: Ensure sufficient funds on both platforms
5. **Price Change Warning**: Prices may change during execution
6. **Low Margin Warning**: Fees may consume profit if < 3%
7. **High Margin Warning**: Verify data accuracy if > 10%

## Future Enhancements

### Potential Improvements

1. **Historical Tracking**: Track arbitrage opportunities over time
2. **Execution Simulation**: Estimate actual profit after fees
3. **Liquidity Analysis**: Factor in orderbook depth
4. **Multi-Leg Arbitrage**: Detect opportunities across 3+ platforms
5. **Alert System**: Real-time notifications for high-profit opportunities
6. **Fee Calculator**: Platform-specific fee calculations
7. **Risk Scoring**: Assign risk scores based on market characteristics

## Troubleshooting

### Common Issues

**Issue**: No arbitrage detected when expected
- **Solution**: Check if profit exceeds 2% threshold
- **Solution**: Verify prices sum to < 0.95

**Issue**: False positives
- **Solution**: Increase `minProfitThreshold`
- **Solution**: Decrease `maxCombinedPrice`

**Issue**: Missing opportunities
- **Solution**: Decrease `minProfitThreshold`
- **Solution**: Verify market data is current

## References

- Requirements Document: `.kiro/specs/unified-market-aggregation/requirements.md`
- Design Document: `.kiro/specs/unified-market-aggregation/design.md`
- Task List: `.kiro/specs/unified-market-aggregation/tasks.md`
- Test Suite: `backend/test-arbitrage-detector.js`

## Changelog

### Version 1.0.0 (Initial Implementation)
- Implemented core arbitrage detection algorithm
- Added instruction generation with step-by-step guidance
- Implemented batch processing for multiple markets
- Added comprehensive warning system
- Created test suite with 7 test scenarios
- Integrated with MarketAggregator class
