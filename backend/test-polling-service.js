/**
 * Test script for PollingService
 * 
 * This script tests the real-time data synchronization functionality:
 * - Polling intervals (5s for Polymarket, 10s for Kalshi)
 * - Data update logic
 * - Staleness detection
 */

const PollingService = require('./PollingService');

// Mock cache manager
class MockCacheManager {
  constructor() {
    this.platformHealth = {
      polymarket: { status: 'unknown', lastSuccessfulFetch: null, lastError: null },
      kalshi: { status: 'unknown', lastSuccessfulFetch: null, lastError: null }
    };
    this.unifiedMarkets = [];
  }
  
  updatePlatformHealth(platform, status, error = null) {
    console.log(`[MockCache] Platform health updated: ${platform} = ${status}`);
    this.platformHealth[platform].status = status;
    if (status === 'healthy') {
      this.platformHealth[platform].lastSuccessfulFetch = Date.now();
      this.platformHealth[platform].lastError = null;
    } else if (error) {
      this.platformHealth[platform].lastError = error.message;
    }
  }
  
  getAllUnifiedMarkets() {
    return this.unifiedMarkets;
  }
  
  setUnifiedMarket(id, market) {
    console.log(`[MockCache] Unified market updated: ${id}`);
    const index = this.unifiedMarkets.findIndex(m => m.unified_id === id);
    if (index >= 0) {
      this.unifiedMarkets[index] = market;
    } else {
      this.unifiedMarkets.push(market);
    }
  }
}

// Mock market aggregator
class MockMarketAggregator {
  constructor() {
    this.polymarketCallCount = 0;
    this.kalshiCallCount = 0;
  }
  
  async fetchPolymarketMarkets() {
    this.polymarketCallCount++;
    console.log(`[MockAggregator] Polymarket fetch #${this.polymarketCallCount}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock data
    return [
      {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Test Market 1',
        outcomes: [
          { name: 'Yes', price: 0.52 + (Math.random() * 0.02 - 0.01) },
          { name: 'No', price: 0.48 + (Math.random() * 0.02 - 0.01) }
        ],
        volume_24h: 100000,
        liquidity: 50000
      }
    ];
  }
  
  async fetchKalshiMarkets() {
    this.kalshiCallCount++;
    console.log(`[MockAggregator] Kalshi fetch #${this.kalshiCallCount}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Return mock data
    return [
      {
        id: 'kalshi-1',
        platform: 'kalshi',
        question: 'Test Market 1',
        outcomes: [
          { name: 'Yes', price: 0.53 + (Math.random() * 0.02 - 0.01) },
          { name: 'No', price: 0.47 + (Math.random() * 0.02 - 0.01) }
        ],
        volume_24h: 80000,
        liquidity: 40000
      }
    ];
  }
  
  enhanceUnifiedMarket(market) {
    // Simple enhancement - just return the market
    return {
      ...market,
      combined_volume: 180000,
      liquidity_score: 4
    };
  }
}

// ====================================================================
// TEST FUNCTIONS
// ====================================================================

async function testPollingIntervals() {
  console.log('\n=== TEST 1: Polling Intervals ===\n');
  
  const mockCache = new MockCacheManager();
  const mockAggregator = new MockMarketAggregator();
  const pollingService = new PollingService(mockAggregator, mockCache);
  
  // Start polling
  pollingService.start();
  
  // Wait 12 seconds to observe polling behavior
  // Expected: Polymarket should poll ~2-3 times (5s interval)
  //           Kalshi should poll ~1-2 times (10s interval)
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  // Stop polling
  pollingService.stop();
  
  // Check results
  const stats = pollingService.getStats();
  console.log('\n--- Polling Statistics ---');
  console.log(`Polymarket: ${stats.polymarket.totalPolls} polls, ${stats.polymarket.successfulPolls} successful`);
  console.log(`Kalshi: ${stats.kalshi.totalPolls} polls, ${stats.kalshi.successfulPolls} successful`);
  
  // Verify intervals
  const polymarketExpected = 2; // Should be at least 2 polls in 12 seconds (5s interval)
  const kalshiExpected = 1; // Should be at least 1 poll in 12 seconds (10s interval)
  
  if (stats.polymarket.totalPolls >= polymarketExpected) {
    console.log('✓ Polymarket polling interval correct');
  } else {
    console.log(`✗ Polymarket polling interval incorrect (expected >= ${polymarketExpected}, got ${stats.polymarket.totalPolls})`);
  }
  
  if (stats.kalshi.totalPolls >= kalshiExpected) {
    console.log('✓ Kalshi polling interval correct');
  } else {
    console.log(`✗ Kalshi polling interval incorrect (expected >= ${kalshiExpected}, got ${stats.kalshi.totalPolls})`);
  }
}

async function testStalenessDetection() {
  console.log('\n=== TEST 2: Staleness Detection ===\n');
  
  const mockCache = new MockCacheManager();
  const mockAggregator = new MockMarketAggregator();
  const pollingService = new PollingService(mockAggregator, mockCache);
  
  // Initially, data should be stale (no fetches yet)
  let staleness = pollingService.getStalenessStatus();
  console.log('Initial staleness (before any fetches):');
  console.log(`  Polymarket: ${staleness.polymarket.isStale ? 'STALE' : 'FRESH'}`);
  console.log(`  Kalshi: ${staleness.kalshi.isStale ? 'STALE' : 'FRESH'}`);
  
  if (staleness.polymarket.isStale && staleness.kalshi.isStale) {
    console.log('✓ Initial staleness detection correct');
  } else {
    console.log('✗ Initial staleness detection incorrect');
  }
  
  // Start polling
  pollingService.start();
  
  // Wait 2 seconds for initial fetches
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check staleness after fetches
  staleness = pollingService.getStalenessStatus();
  console.log('\nStaleness after initial fetches:');
  console.log(`  Polymarket: ${staleness.polymarket.isStale ? 'STALE' : 'FRESH'} (${staleness.polymarket.timeSinceLastFetch}ms ago)`);
  console.log(`  Kalshi: ${staleness.kalshi.isStale ? 'STALE' : 'FRESH'} (${staleness.kalshi.timeSinceLastFetch}ms ago)`);
  
  if (!staleness.polymarket.isStale && !staleness.kalshi.isStale) {
    console.log('✓ Data is fresh after fetches');
  } else {
    console.log('✗ Data should be fresh after fetches');
  }
  
  // Stop polling
  pollingService.stop();
  
  // Wait 65 seconds to make data stale
  console.log('\nWaiting 65 seconds to make data stale...');
  await new Promise(resolve => setTimeout(resolve, 65000));
  
  // Check staleness after 65 seconds
  staleness = pollingService.getStalenessStatus();
  console.log('\nStaleness after 65 seconds:');
  console.log(`  Polymarket: ${staleness.polymarket.isStale ? 'STALE' : 'FRESH'} (${Math.round(staleness.polymarket.timeSinceLastFetch / 1000)}s ago)`);
  console.log(`  Kalshi: ${staleness.kalshi.isStale ? 'STALE' : 'FRESH'} (${Math.round(staleness.kalshi.timeSinceLastFetch / 1000)}s ago)`);
  
  if (staleness.polymarket.isStale && staleness.kalshi.isStale) {
    console.log('✓ Staleness detection after 60s correct');
  } else {
    console.log('✗ Data should be stale after 60s');
  }
}

async function testDataUpdateLogic() {
  console.log('\n=== TEST 3: Data Update Logic ===\n');
  
  const mockCache = new MockCacheManager();
  const mockAggregator = new MockMarketAggregator();
  const pollingService = new PollingService(mockAggregator, mockCache);
  
  // Add a mock unified market to cache
  mockCache.unifiedMarkets = [
    {
      unified_id: 'unified-1',
      question: 'Test Market 1',
      platforms: {
        polymarket: {
          id: 'poly-1',
          outcomes: [
            { name: 'Yes', price: 0.50 },
            { name: 'No', price: 0.50 }
          ],
          volume_24h: 100000
        }
      }
    }
  ];
  
  console.log('Initial market price: YES=0.50, NO=0.50');
  
  // Start polling
  pollingService.start();
  
  // Wait 6 seconds for at least one Polymarket poll
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Stop polling
  pollingService.stop();
  
  // Check if market was updated
  const updatedMarket = mockCache.unifiedMarkets[0];
  const newYesPrice = updatedMarket.platforms.polymarket.outcomes[0].price;
  const newNoPrice = updatedMarket.platforms.polymarket.outcomes[1].price;
  
  console.log(`Updated market price: YES=${newYesPrice.toFixed(4)}, NO=${newNoPrice.toFixed(4)}`);
  
  // Prices should have changed (mock data adds random variation)
  if (Math.abs(newYesPrice - 0.50) > 0.001 || Math.abs(newNoPrice - 0.50) > 0.001) {
    console.log('✓ Market data was updated');
  } else {
    console.log('✗ Market data was not updated');
  }
}

async function testGracefulShutdown() {
  console.log('\n=== TEST 4: Graceful Shutdown ===\n');
  
  const mockCache = new MockCacheManager();
  const mockAggregator = new MockMarketAggregator();
  const pollingService = new PollingService(mockAggregator, mockCache);
  
  // Start polling
  pollingService.start();
  console.log('Polling started');
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Stop polling
  pollingService.stop();
  console.log('Polling stopped');
  
  // Record poll counts
  const pollsBeforeStop = mockAggregator.polymarketCallCount;
  
  // Wait 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check that no more polls occurred
  const pollsAfterStop = mockAggregator.polymarketCallCount;
  
  console.log(`Polls before stop: ${pollsBeforeStop}`);
  console.log(`Polls after stop: ${pollsAfterStop}`);
  
  if (pollsBeforeStop === pollsAfterStop) {
    console.log('✓ Polling stopped correctly (no new polls after stop)');
  } else {
    console.log('✗ Polling did not stop correctly (polls continued after stop)');
  }
}

// ====================================================================
// RUN TESTS
// ====================================================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PollingService Test Suite                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Polling intervals
    await testPollingIntervals();
    
    // Test 2: Staleness detection (SKIPPED - takes 65 seconds)
    // Uncomment to run full staleness test
    // await testStalenessDetection();
    console.log('\n=== TEST 2: Staleness Detection ===');
    console.log('(Skipped - takes 65 seconds. Run manually if needed)');
    
    // Test 3: Data update logic
    await testDataUpdateLogic();
    
    // Test 4: Graceful shutdown
    await testGracefulShutdown();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         All Tests Complete                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
runAllTests();
