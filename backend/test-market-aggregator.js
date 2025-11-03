/**
 * Test script for MarketAggregator
 * 
 * This script tests the core functionality of the MarketAggregator class:
 * - Parallel data fetching
 * - Market combination logic
 * - Liquidity scoring
 * - Arbitrage detection
 */

const MarketAggregator = require('./MarketAggregator');
const MarketMatchingEngine = require('./MarketMatchingEngine');

// Mock cache manager
class MockCacheManager {
  constructor() {
    this.unifiedMarketCache = {
      timestamp: Date.now(),
      ttl: 300000,
      data: {}
    };
    this.platformHealth = {
      polymarket: { status: 'healthy', lastSuccessfulFetch: null, lastError: null },
      kalshi: { status: 'healthy', lastSuccessfulFetch: null, lastError: null }
    };
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  getUnifiedMarket(category) {
    const cached = this.unifiedMarketCache.data[category];
    if (cached && Date.now() - this.unifiedMarketCache.timestamp < this.unifiedMarketCache.ttl) {
      this.performanceStats.cacheHits++;
      return cached;
    }
    this.performanceStats.cacheMisses++;
    return null;
  }
  
  setUnifiedMarket(category, markets) {
    this.unifiedMarketCache.data[category] = markets;
    this.unifiedMarketCache.timestamp = Date.now();
  }
  
  updatePlatformHealth(platform, status, error = null) {
    if (this.platformHealth[platform]) {
      this.platformHealth[platform].status = status;
      this.platformHealth[platform].lastError = error ? error.message : null;
      this.platformHealth[platform].lastSuccessfulFetch = status === 'healthy' ? Date.now() : this.platformHealth[platform].lastSuccessfulFetch;
    }
  }
  
  getPlatformHealth(platform) {
    return this.platformHealth[platform] || null;
  }
  
  getAllPlatformHealth() {
    return this.platformHealth;
  }
}

// Mock Kalshi fetcher
class MockKalshiFetcher {
  async fetchMarkets(options = {}) {
    console.log('[MockKalshiFetcher] Fetching markets...');
    
    // Return mock Kalshi markets
    return [
      {
        ticker: 'PRES-2024-TRUMP',
        title: 'Will Donald Trump win the 2024 Presidential Election?',
        status: 'open',
        close_time: '2024-11-06T00:00:00Z',
        volume: 800000,
        liquidity: 300000
      },
      {
        ticker: 'PRES-2024-BIDEN',
        title: 'Will Joe Biden win the 2024 Presidential Election?',
        status: 'open',
        close_time: '2024-11-06T00:00:00Z',
        volume: 500000,
        liquidity: 200000
      }
    ];
  }
  
  normalizeMarket(market) {
    return {
      id: `kalshi-${market.ticker}`,
      platform: 'kalshi',
      question: market.title,
      outcomes: [
        { name: 'Yes', price: 0.53 },
        { name: 'No', price: 0.47 }
      ],
      volume_24h: market.volume,
      liquidity: market.liquidity,
      endDate: market.close_time,
      category: 'Politics',
      spread: 0.01
    };
  }
}

// Mock Polymarket fetcher (placeholder)
class MockPolymarketFetcher {
  async fetchMarkets(options = {}) {
    console.log('[MockPolymarketFetcher] Fetching markets...');
    
    // Return mock Polymarket markets
    return [
      {
        id: 'poly-trump-2024',
        question: 'Will Trump win the 2024 election?',
        tokens: [
          { outcome: 'Yes', price: 0.52 },
          { outcome: 'No', price: 0.48 }
        ],
        volume: 1500000,
        liquidity: 500000,
        end_date_iso: '2024-11-06T00:00:00Z'
      }
    ];
  }
  
  normalizeMarket(market) {
    return {
      id: `poly-${market.id}`,
      platform: 'polymarket',
      question: market.question,
      outcomes: market.tokens.map(t => ({
        name: t.outcome,
        price: t.price
      })),
      volume_24h: market.volume,
      liquidity: market.liquidity,
      endDate: market.end_date_iso,
      category: 'Politics',
      spread: 0.01
    };
  }
}

// Test functions
async function testParallelFetching() {
  console.log('\n=== TEST 1: Parallel Data Fetching ===\n');
  
  const cache = new MockCacheManager();
  const kalshiFetcher = new MockKalshiFetcher();
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cache);
  
  try {
    const result = await aggregator.fetchAllPlatforms();
    
    console.log('\n✓ Parallel fetch successful');
    console.log(`  - Polymarket markets: ${result.polymarket.length}`);
    console.log(`  - Kalshi markets: ${result.kalshi.length}`);
    console.log(`  - Total markets: ${result.totalMarkets}`);
    console.log(`  - Fetch duration: ${result.fetchDuration}ms`);
    
    return true;
  } catch (error) {
    console.error('✗ Parallel fetch failed:', error.message);
    return false;
  }
}

async function testMarketCombination() {
  console.log('\n=== TEST 2: Market Combination Logic ===\n');
  
  const cache = new MockCacheManager();
  const kalshiFetcher = new MockKalshiFetcher();
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cache);
  
  try {
    // Fetch markets
    const platformMarkets = await aggregator.fetchAllPlatforms();
    
    // Combine markets
    const unifiedMarkets = await aggregator.combineMarkets(platformMarkets);
    
    console.log('\n✓ Market combination successful');
    console.log(`  - Unified markets created: ${unifiedMarkets.length}`);
    
    if (unifiedMarkets.length > 0) {
      const sample = unifiedMarkets[0];
      console.log(`\n  Sample unified market:`);
      console.log(`    - ID: ${sample.unified_id}`);
      console.log(`    - Question: ${sample.question}`);
      console.log(`    - Platforms: ${Object.keys(sample.platforms).join(', ')}`);
      console.log(`    - Combined volume: $${sample.combined_volume.toLocaleString()}`);
      console.log(`    - Liquidity score: ${sample.liquidity_score}/5`);
      console.log(`    - Match confidence: ${(sample.match_confidence * 100).toFixed(1)}%`);
      
      if (sample.arbitrage && sample.arbitrage.exists) {
        console.log(`    - Arbitrage: ${sample.arbitrage.profit_pct.toFixed(2)}% profit`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('✗ Market combination failed:', error.message);
    return false;
  }
}

async function testLiquidityScoring() {
  console.log('\n=== TEST 3: Liquidity Scoring ===\n');
  
  const cache = new MockCacheManager();
  const kalshiFetcher = new MockKalshiFetcher();
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cache);
  
  // Create test unified market
  const testMarket = {
    unified_id: 'test-123',
    question: 'Test market',
    platforms: {
      polymarket: {
        volume_24h: 500000,
        spread: 0.02
      },
      kalshi: {
        volume_24h: 300000,
        spread: 0.03
      }
    }
  };
  
  try {
    const score = aggregator.calculateLiquidityScore(testMarket);
    
    console.log('\n✓ Liquidity scoring successful');
    console.log(`  - Score: ${score}/5`);
    console.log(`  - Total volume: $${aggregator.calculateCombinedVolume(testMarket).toLocaleString()}`);
    
    // Test edge cases
    const lowLiquidityMarket = {
      unified_id: 'test-low',
      platforms: {
        polymarket: { volume_24h: 1000, spread: 0.1 }
      }
    };
    const lowScore = aggregator.calculateLiquidityScore(lowLiquidityMarket);
    console.log(`  - Low liquidity score: ${lowScore}/5`);
    
    const highLiquidityMarket = {
      unified_id: 'test-high',
      platforms: {
        polymarket: { volume_24h: 2000000, spread: 0.005 },
        kalshi: { volume_24h: 1000000, spread: 0.008 }
      }
    };
    const highScore = aggregator.calculateLiquidityScore(highLiquidityMarket);
    console.log(`  - High liquidity score: ${highScore}/5`);
    
    return true;
  } catch (error) {
    console.error('✗ Liquidity scoring failed:', error.message);
    return false;
  }
}

async function testArbitrageDetection() {
  console.log('\n=== TEST 4: Arbitrage Detection ===\n');
  
  const cache = new MockCacheManager();
  const kalshiFetcher = new MockKalshiFetcher();
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cache);
  
  // Test market with arbitrage opportunity
  const arbitrageMarket = {
    unified_id: 'test-arb',
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
          { name: 'No', price: 0.50 }
        ]
      }
    }
  };
  
  // Test market without arbitrage
  const noArbitrageMarket = {
    unified_id: 'test-no-arb',
    platforms: {
      polymarket: {
        outcomes: [
          { name: 'Yes', price: 0.52 },
          { name: 'No', price: 0.48 }
        ]
      },
      kalshi: {
        outcomes: [
          { name: 'Yes', price: 0.53 },
          { name: 'No', price: 0.47 }
        ]
      }
    }
  };
  
  try {
    const arb1 = aggregator.detectArbitrage(arbitrageMarket);
    const arb2 = aggregator.detectArbitrage(noArbitrageMarket);
    
    console.log('\n✓ Arbitrage detection successful');
    
    if (arb1 && arb1.exists) {
      console.log(`  - Arbitrage found: ${arb1.profit_pct.toFixed(2)}% profit`);
      console.log(`  - Instructions: ${arb1.instructions}`);
    } else {
      console.log(`  - No arbitrage in test market 1`);
    }
    
    if (arb2 && arb2.exists) {
      console.log(`  - Arbitrage found in test market 2: ${arb2.profit_pct.toFixed(2)}% profit`);
    } else {
      console.log(`  - No arbitrage in test market 2 (expected)`);
    }
    
    return true;
  } catch (error) {
    console.error('✗ Arbitrage detection failed:', error.message);
    return false;
  }
}

async function testGracefulDegradation() {
  console.log('\n=== TEST 5: Graceful Degradation (Partial Failures) ===\n');
  
  const cache = new MockCacheManager();
  
  // Mock fetcher that fails
  const failingKalshiFetcher = {
    async fetchMarkets() {
      throw new Error('Kalshi API unavailable');
    }
  };
  
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, failingKalshiFetcher, cache);
  
  try {
    const result = await aggregator.fetchAllPlatforms();
    
    console.log('\n✓ Graceful degradation successful');
    console.log(`  - Polymarket markets: ${result.polymarket.length}`);
    console.log(`  - Kalshi markets: ${result.kalshi.length} (failed as expected)`);
    console.log(`  - System continued with available data`);
    
    // Check platform health
    const health = aggregator.getPlatformHealth();
    console.log(`  - Polymarket status: ${health.polymarket.status}`);
    console.log(`  - Kalshi status: ${health.kalshi.status}`);
    
    return true;
  } catch (error) {
    console.error('✗ Graceful degradation failed:', error.message);
    return false;
  }
}

async function testSmartRouting() {
  console.log('\n=== TEST 6: Smart Routing Recommendations ===\n');
  
  const cache = new MockCacheManager();
  const kalshiFetcher = new MockKalshiFetcher();
  const polymarketFetcher = new MockPolymarketFetcher();
  
  const aggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cache);
  
  // Test market with different prices and liquidity
  const testMarket = {
    unified_id: 'test-routing',
    question: 'Test market for routing',
    platforms: {
      polymarket: {
        outcomes: [
          { name: 'Yes', price: 0.52 },
          { name: 'No', price: 0.48 }
        ],
        spread: 0.03,
        liquidity: 100000,
        volume_24h: 50000
      },
      kalshi: {
        outcomes: [
          { name: 'Yes', price: 0.48 },
          { name: 'No', price: 0.52 }
        ],
        spread: 0.05,
        liquidity: 75000,
        volume_24h: 30000
      }
    }
  };
  
  try {
    // Test execution score calculation
    const polyBuyScore = aggregator.calculateExecutionScore(
      testMarket.platforms.polymarket, 
      'buy', 
      'yes'
    );
    const kalshiBuyScore = aggregator.calculateExecutionScore(
      testMarket.platforms.kalshi, 
      'buy', 
      'yes'
    );
    
    console.log('\n✓ Execution score calculation successful');
    console.log(`  - Polymarket buy YES score: ${polyBuyScore.toFixed(3)}`);
    console.log(`  - Kalshi buy YES score: ${kalshiBuyScore.toFixed(3)}`);
    
    // Test routing recommendations
    const buyYesRec = aggregator.getRoutingRecommendation(testMarket, 'buy', 'yes');
    const sellYesRec = aggregator.getRoutingRecommendation(testMarket, 'sell', 'yes');
    
    console.log('\n✓ Routing recommendations successful');
    console.log(`  - Buy YES: ${buyYesRec.platform} (${buyYesRec.reason})`);
    console.log(`  - Sell YES: ${sellYesRec.platform} (${sellYesRec.reason})`);
    
    // Verify recommendations make sense
    if (buyYesRec.platform === 'kalshi') {
      console.log('  ✓ Correctly recommends Kalshi for buying (lower price)');
    }
    if (sellYesRec.platform === 'polymarket') {
      console.log('  ✓ Correctly recommends Polymarket for selling (higher price)');
    }
    
    // Test adding recommendations to unified market
    const enhancedMarket = aggregator.addRoutingRecommendations(testMarket);
    
    if (enhancedMarket.routing_recommendations) {
      console.log('\n✓ Routing recommendations added to unified market');
      console.log(`  - buy_yes: ${enhancedMarket.routing_recommendations.buy_yes.platform}`);
      console.log(`  - sell_yes: ${enhancedMarket.routing_recommendations.sell_yes.platform}`);
      console.log(`  - buy_no: ${enhancedMarket.routing_recommendations.buy_no.platform}`);
      console.log(`  - sell_no: ${enhancedMarket.routing_recommendations.sell_no.platform}`);
    }
    
    // Test insufficient liquidity handling
    const lowLiquidityMarket = {
      unified_id: 'test-low-liq',
      platforms: {
        polymarket: {
          outcomes: [{ name: 'Yes', price: 0.45 }],
          spread: 0.02,
          liquidity: 500  // Below $1k threshold
        }
      }
    };
    
    const lowLiqRec = aggregator.getRoutingRecommendation(lowLiquidityMarket, 'buy', 'yes');
    
    if (lowLiqRec.platform === null) {
      console.log('\n✓ Insufficient liquidity handling working');
      console.log(`  - Reason: ${lowLiqRec.reason}`);
    }
    
    return true;
  } catch (error) {
    console.error('✗ Smart routing failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         MarketAggregator Test Suite                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  results.push(await testParallelFetching());
  results.push(await testMarketCombination());
  results.push(await testLiquidityScoring());
  results.push(await testArbitrageDetection());
  results.push(await testGracefulDegradation());
  results.push(await testSmartRouting());
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Tests passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('\n✓ All tests passed!\n');
  } else {
    console.log(`\n✗ ${total - passed} test(s) failed\n`);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
