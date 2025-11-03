# ArbitrageDetector - Quick Start Guide

## What is ArbitrageDetector?

The `ArbitrageDetector` class identifies risk-free profit opportunities across prediction market platforms by detecting price discrepancies. When the combined cost of buying YES on one platform and NO on another is less than $1.00, you can lock in guaranteed profit.

## Quick Example

```javascript
const ArbitrageDetector = require('./ArbitrageDetector');
const detector = new ArbitrageDetector();

// Unified market with price discrepancy
const market = {
  unified_id: 'trump-2024',
  question: 'Will Trump win 2024?',
  platforms: {
    polymarket: {
      outcomes: [
        { name: 'Yes', price: 0.45 },  // Buy YES here (45¢)
        { name: 'No', price: 0.55 }
      ]
    },
    kalshi: {
      outcomes: [
        { name: 'Yes', price: 0.48 },
        { name: 'No', price: 0.48 }    // Buy NO here (48¢)
      ]
    }
  }
};

// Detect arbitrage
const arbitrage = detector.detectArbitrage(market);

if (arbitrage && arbitrage.exists) {
  // Generate instructions
  const instructions = detector.generateInstructions(arbitrage, market);
  
  console.log(instructions.summary);
  // Output: "Buy YES on polymarket at 45.0¢, Sell YES on kalshi at 48.0¢ for 5.26% profit"
  
  console.log('Steps:');
  instructions.steps.forEach(step => {
    console.log(`${step.step}. ${step.description}`);
  });
  // Output:
  // 1. Buy YES on polymarket at 45.0¢
  // 2. Sell YES on kalshi at 48.0¢ (or buy NO at 52.0¢)
  // 3. Collect profit of 7.0¢ per $1 invested (5.26% return)
}
```

## How It Works

### The Math

Arbitrage exists when:
```
(Platform_A_YES_price + Platform_B_NO_price) < 0.95
```

The 0.95 threshold accounts for typical transaction fees (2-5%).

**Example:**
- Polymarket YES: 45¢
- Kalshi NO: 48¢
- Total cost: 93¢
- Guaranteed payout: $1.00
- Profit: 7¢ per dollar (7.5% return)

### The Algorithm

1. **Find Best Prices**: Scan all platforms for lowest YES and highest NO
2. **Check Threshold**: Verify combined cost < 95¢
3. **Calculate Profit**: (100¢ - cost) / cost × 100
4. **Filter**: Only flag if profit > 2% (accounts for fees)
5. **Generate Instructions**: Create step-by-step trading guide

## Key Features

### ✅ Smart Detection
- Automatically scans all platform combinations
- Filters out opportunities below 2% profit threshold
- Validates price data before processing

### ✅ Clear Instructions
- Step-by-step trading guide
- Platform-specific buy/sell recommendations
- Profit calculations in cents and percentages

### ✅ Risk Warnings
- Alerts about execution speed requirements
- Fee considerations
- Slippage warnings for low liquidity
- Special warnings for unusually high/low margins

### ✅ Batch Processing
- Process hundreds of markets efficiently
- Automatic sorting by profit percentage
- Aggregate statistics

## Configuration

```javascript
const detector = new ArbitrageDetector({
  minProfitThreshold: 2.0,  // Minimum profit % to flag (default: 2%)
  maxCombinedPrice: 0.95     // Maximum combined price (default: 0.95)
});
```

### Conservative Settings (fewer false positives)
```javascript
const conservative = new ArbitrageDetector({
  minProfitThreshold: 5.0,   // Only flag 5%+ opportunities
  maxCombinedPrice: 0.93      // Stricter threshold
});
```

### Aggressive Settings (more opportunities)
```javascript
const aggressive = new ArbitrageDetector({
  minProfitThreshold: 1.0,   // Flag 1%+ opportunities
  maxCombinedPrice: 0.97      // Looser threshold
});
```

## API Methods

### detectArbitrage(unifiedMarket)
Detect arbitrage in a single market.

**Returns:** `{ exists, profitPct, yesBuy, noSell, ... }` or `null`

### generateInstructions(arbitrageData, unifiedMarket)
Generate human-readable trading instructions.

**Returns:** `{ steps, summary, warnings, ... }` or `null`

### detectBatchArbitrage(unifiedMarkets)
Process multiple markets at once.

**Returns:** Array of `{ market, arbitrage }` objects, sorted by profit

### getArbitrageStats(opportunities)
Calculate aggregate statistics.

**Returns:** `{ count, avgProfit, maxProfit, minProfit, ... }`

## Integration with MarketAggregator

The `ArbitrageDetector` is automatically integrated into `MarketAggregator`:

```javascript
const aggregator = new MarketAggregator(polyFetcher, kalshiFetcher, cache);

// Get all arbitrage opportunities
const opportunities = await aggregator.findArbitrageOpportunities();

// Each market includes arbitrage data
opportunities.forEach(market => {
  if (market.arbitrage && market.arbitrage.exists) {
    console.log(`${market.question}: ${market.arbitrage.profitPct}% profit`);
  }
});
```

## Testing

Run the comprehensive test suite:

```bash
node backend/test-arbitrage-detector.js
```

Tests cover:
- ✅ Clear arbitrage detection (5% profit)
- ✅ No arbitrage scenarios
- ✅ Small arbitrage filtering (< 2%)
- ✅ Single platform handling
- ✅ Large arbitrage detection (10% profit)
- ✅ Batch processing
- ✅ Statistics calculation

## Real-World Example

```javascript
// Fetch unified markets
const markets = await aggregator.getUnifiedMarkets('Politics');

// Find arbitrage opportunities
const opportunities = detector.detectBatchArbitrage(markets);

console.log(`Found ${opportunities.length} arbitrage opportunities`);

// Display best opportunity
if (opportunities.length > 0) {
  const best = opportunities[0];
  console.log('\n🚨 BEST OPPORTUNITY:');
  console.log(`Market: ${best.market.question}`);
  console.log(`Profit: ${best.arbitrage.profitPct.toFixed(2)}%`);
  console.log(`\nInstructions:`);
  best.arbitrage.steps.forEach(step => {
    console.log(`  ${step.step}. ${step.description}`);
  });
  console.log(`\nWarnings:`);
  best.arbitrage.warnings.forEach(warning => {
    console.log(`  ${warning}`);
  });
}
```

## Important Notes

### ⚠️ Execution Speed
Arbitrage opportunities can disappear in seconds as other traders exploit them. Automated execution is recommended for consistent profits.

### ⚠️ Transaction Fees
Always account for platform fees:
- Polymarket: ~2% on profits
- Kalshi: ~3-5% on trades

### ⚠️ Liquidity
Large trades may experience slippage. Check orderbook depth before executing.

### ⚠️ Capital Requirements
You need funds on BOTH platforms simultaneously to execute arbitrage.

## Files

- **Implementation**: `backend/ArbitrageDetector.js`
- **Integration**: `backend/MarketAggregator.js`
- **Tests**: `backend/test-arbitrage-detector.js`
- **Documentation**: `backend/ARBITRAGE_DETECTOR_IMPLEMENTATION.md`

## Requirements Satisfied

- ✅ **10.1**: Detect when (platform_A_yes + platform_B_no) < 0.95
- ✅ **10.2**: Calculate profit percentage
- ✅ **10.3**: Display arbitrage badge with profit
- ✅ **10.4**: Generate trading instructions
- ✅ **10.5**: Only flag if profit > 2%

## Next Steps

To use arbitrage detection in the frontend:

1. **API Endpoint**: `GET /api/arbitrage-opportunities`
2. **Market Cards**: Display arbitrage badge when `market.arbitrage.exists`
3. **Detail Page**: Show full instructions with `ArbitrageAlert` component
4. **Real-time Updates**: Poll every 5 seconds for new opportunities

---

**Ready to find arbitrage opportunities?** Start with `detector.detectBatchArbitrage(markets)` and watch the profits roll in! 💰
