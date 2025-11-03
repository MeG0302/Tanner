# MarketAggregator Integration Guide

## Quick Start

The `MarketAggregator` class is now ready to be integrated into the backend server. Follow these steps to complete the integration.

## Step 1: Import the MarketAggregator

Add to the top of `backend/server.js`:

```javascript
const MarketAggregator = require('./MarketAggregator');
```

## Step 2: Initialize the Aggregator

After initializing the cache manager and KalshiFetcher, add:

```javascript
// Initialize Market Aggregator
const marketAggregator = new MarketAggregator(
  null, // Polymarket fetcher (to be implemented)
  kalshiFetcher,
  cacheManager
);

console.log('[Server] MarketAggregator initialized');
```

## Step 3: Add API Endpoints

Add these new endpoints to `server.js`:

```javascript
// ====================================================================
// UNIFIED MARKET AGGREGATION ENDPOINTS
// ====================================================================

/**
 * GET /api/unified-markets/:category
 * Get unified markets for a specific category
 * Combines data from Polymarket and Kalshi
 */
app.get('/api/unified-markets/:category', async (req, res) => {
  const startTime = Date.now();
  const { category } = req.params;
  
  try {
    console.log(`[API] Fetching unified markets for category: ${category}`);
    
    const unifiedMarkets = await marketAggregator.getUnifiedMarkets(category);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Returned ${unifiedMarkets.length} unified markets in ${duration}ms`);
    
    res.json({
      success: true,
      category,
      count: unifiedMarkets.length,
      markets: unifiedMarkets,
      fetchTime: duration
    });
    
  } catch (error) {
    console.error(`[API] Error fetching unified markets for ${category}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unified markets',
      message: error.message
    });
  }
});

/**
 * GET /api/unified-market/:id
 * Get detailed information for a single unified market
 */
app.get('/api/unified-market/:id', async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  try {
    console.log(`[API] Fetching unified market details: ${id}`);
    
    const market = await marketAggregator.getUnifiedMarketDetails(id);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Returned unified market details in ${duration}ms`);
    
    res.json({
      success: true,
      market,
      fetchTime: duration
    });
    
  } catch (error) {
    console.error(`[API] Error fetching unified market ${id}:`, error.message);
    res.status(404).json({
      success: false,
      error: 'Market not found',
      message: error.message
    });
  }
});

/**
 * GET /api/arbitrage-opportunities
 * Find all arbitrage opportunities across platforms
 */
app.get('/api/arbitrage-opportunities', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('[API] Finding arbitrage opportunities...');
    
    const opportunities = await marketAggregator.findArbitrageOpportunities();
    
    const duration = Date.now() - startTime;
    console.log(`[API] Found ${opportunities.length} arbitrage opportunities in ${duration}ms`);
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities,
      fetchTime: duration
    });
    
  } catch (error) {
    console.error('[API] Error finding arbitrage opportunities:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to find arbitrage opportunities',
      message: error.message
    });
  }
});

/**
 * GET /api/platform-health
 * Get health status for all platforms
 */
app.get('/api/platform-health', async (req, res) => {
  try {
    const health = marketAggregator.getPlatformHealth();
    
    res.json({
      success: true,
      platforms: health,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[API] Error getting platform health:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform health',
      message: error.message
    });
  }
});

/**
 * GET /api/aggregator-metrics
 * Get performance metrics for the aggregator
 */
app.get('/api/aggregator-metrics', async (req, res) => {
  try {
    const metrics = marketAggregator.getPerformanceMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[API] Error getting aggregator metrics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});
```

## Step 4: Create PolymarketFetcher Class (Optional but Recommended)

For better code organization, create a `PolymarketFetcher` class similar to `KalshiFetcher`:

```javascript
/**
 * PolymarketFetcher - Handles Polymarket API integration
 */
class PolymarketFetcher {
  constructor(apiEndpoint, cacheManager) {
    this.apiEndpoint = apiEndpoint || 'https://gamma-api.polymarket.com';
    this.cache = cacheManager;
    this.rateLimit = 100; // requests per minute
  }
  
  async fetchMarkets(options = {}) {
    // Use existing fetchPolymarketData function
    const maxPages = options.maxPages || 2;
    const markets = await fetchPolymarketData(maxPages);
    return markets;
  }
  
  normalizeMarket(market) {
    // Use existing normalizePolymarket function
    return normalizePolymarket(market);
  }
}

// Initialize with cache manager
const polymarketFetcher = new PolymarketFetcher(
  API_ENDPOINTS.POLYMARKET,
  cacheManager
);
```

Then update the aggregator initialization:

```javascript
const marketAggregator = new MarketAggregator(
  polymarketFetcher,  // Now with actual fetcher
  kalshiFetcher,
  cacheManager
);
```

## Step 5: Test the Integration

### Test Unified Markets Endpoint
```bash
curl http://localhost:3001/api/unified-markets/Politics
```

Expected response:
```json
{
  "success": true,
  "category": "Politics",
  "count": 15,
  "markets": [
    {
      "unified_id": "unified-12345",
      "question": "Will Trump win the 2024 election?",
      "category": "Politics",
      "platforms": {
        "polymarket": { ... },
        "kalshi": { ... }
      },
      "combined_volume": 2300000,
      "best_price": {
        "yes": { "platform": "polymarket", "price": 0.52 },
        "no": { "platform": "kalshi", "price": 0.47 }
      },
      "liquidity_score": 4,
      "arbitrage": null
    }
  ]
}
```

### Test Arbitrage Endpoint
```bash
curl http://localhost:3001/api/arbitrage-opportunities
```

### Test Platform Health
```bash
curl http://localhost:3001/api/platform-health
```

## Step 6: Frontend Integration

Update the frontend to use the new unified endpoints:

```javascript
// In app.jsx or relevant component

async function fetchUnifiedMarkets(category) {
  const response = await fetch(`/api/unified-markets/${category}`);
  const data = await response.json();
  return data.markets;
}

async function fetchArbitrageOpportunities() {
  const response = await fetch('/api/arbitrage-opportunities');
  const data = await response.json();
  return data.opportunities;
}
```

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# Kalshi API Configuration
KALSHI_API_KEY=your_kalshi_api_key_here

# Cache Configuration
CACHE_TTL_UNIFIED=300000  # 5 minutes for unified markets
CACHE_TTL_METADATA=600000 # 10 minutes for metadata

# Aggregator Configuration
ENABLE_UNIFIED_MARKETS=true
ENABLE_ARBITRAGE_DETECTION=true
```

### Cache TTL Settings

The aggregator uses the existing cache manager's TTL settings:
- Unified markets: 5 minutes (300000ms)
- Match confidence: 10 minutes (600000ms)
- Platform health: Updated on each fetch

## Monitoring

### Performance Metrics

Monitor aggregator performance:

```javascript
// Get metrics
const metrics = marketAggregator.getPerformanceMetrics();

console.log('Fetch duration:', metrics.lastFetchDuration, 'ms');
console.log('Match duration:', metrics.lastMatchDuration, 'ms');
console.log('Total fetches:', metrics.totalFetches);
console.log('Cache hit rate:', 
  metrics.cacheStats.hits / (metrics.cacheStats.hits + metrics.cacheStats.misses)
);
```

### Platform Health

Monitor platform availability:

```javascript
const health = marketAggregator.getPlatformHealth();

if (health.polymarket.status === 'degraded') {
  console.warn('Polymarket is degraded:', health.polymarket.lastError);
}

if (health.kalshi.status === 'degraded') {
  console.warn('Kalshi is degraded:', health.kalshi.lastError);
}
```

## Troubleshooting

### Issue: No markets returned

**Possible causes:**
1. Both platforms are down
2. API keys are invalid
3. Network connectivity issues

**Solution:**
- Check platform health: `GET /api/platform-health`
- Verify API keys in environment variables
- Check server logs for error messages

### Issue: Slow response times

**Possible causes:**
1. Cache is not being used
2. Too many markets being fetched
3. Matching engine is slow

**Solution:**
- Check cache hit rate in metrics
- Reduce `maxPages` in fetch options
- Monitor `lastMatchDuration` in metrics

### Issue: No arbitrage opportunities found

**Possible causes:**
1. Markets are efficiently priced
2. Threshold is too high (2%)
3. Not enough multi-platform markets

**Solution:**
- This is normal - arbitrage is rare
- Lower threshold in `detectArbitrage()` if needed
- Ensure both platforms are fetching successfully

## Advanced Usage

### Custom Matching Threshold

Adjust the similarity threshold for matching:

```javascript
// In MarketMatchingEngine constructor
this.similarityThreshold = 0.80; // Lower = more matches (less strict)
```

### Custom Liquidity Formula

Modify the liquidity scoring formula:

```javascript
// In calculateLiquidityScore()
const rawScore = (volumeScore * 0.5) + (spreadScore * 0.5); // Equal weights
```

### Custom Arbitrage Threshold

Change the minimum profit percentage:

```javascript
// In detectArbitrage()
if (profit_pct > 1) { // Lower threshold = more opportunities
  return { ... };
}
```

## Next Steps

1. ✓ MarketAggregator class implemented
2. ✓ Test suite created
3. ⏳ Integrate into server.js (follow this guide)
4. ⏳ Create PolymarketFetcher class
5. ⏳ Add API endpoints
6. ⏳ Test with real data
7. ⏳ Update frontend components
8. ⏳ Deploy to production

## Support

For questions or issues:
1. Check the implementation documentation: `MARKET_AGGREGATOR_IMPLEMENTATION.md`
2. Review the test suite: `test-market-aggregator.js`
3. Check server logs for detailed error messages
4. Verify platform health status

## Summary

The MarketAggregator is a powerful service that:
- ✓ Fetches data from multiple platforms in parallel
- ✓ Intelligently matches markets across platforms
- ✓ Calculates combined metrics (volume, liquidity)
- ✓ Detects arbitrage opportunities
- ✓ Handles failures gracefully
- ✓ Provides comprehensive API methods

Follow this guide to integrate it into your backend server and start serving unified market data to your users!
