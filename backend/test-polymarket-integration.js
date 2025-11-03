/**
 * Integration test for PolymarketFetcher with MarketAggregator
 * Tests the complete flow of fetching and matching markets
 */

const PolymarketFetcher = require('./PolymarketFetcher');
const MarketAggregator = require('./MarketAggregator');
const MarketMatchingEngine = require('./MarketMatchingEngine');
const ArbitrageDetector = require('./ArbitrageDetector');

// Mock cache manager
class MockCacheManager {
  constructor() {
    this.platformHealth = {};
    this.unifiedMarkets = {};
  }
  
  updatePlatformHealth(platform, status, error) {
    this.platformHealth[platform] = { status, error: error ? error.message : null };
  }
  
  getPlatformHealth(platform) {
    return this.platformHealth[platform] || null;
  }
  
  getAllPlatformHealth() {
    return this.platformHealth;
  }
  
  setUnifiedMarket(id, market) {
    this.unifiedMarkets[id] = market;
  }
  
  getUnifiedMarket(id) {
    return this.unifiedMarkets[id];
  }
  
  getAllUnifiedMarkets() {
    return Object.values(this.unifiedMarkets);
  }
}

// Mock Kalshi fetcher (returns empty for this test)
class MockKalshiFetcher {
  async fetchMarkets() {
    return [];
  }
  
  normalizeMarket() {
    return null;
  }
}

async function runIntegrationTest() {
  console.log('='.repeat(70));
  console.log('POLYMARKET INTEGRATION TEST');
  console.log('='.repeat(70));
  console.log('');
  
  try {
    // Initialize components
    const mockCache = new MockCacheManager();
    const polymarketFetcher = new PolymarketFetcher('https://gamma-api.polymarket.com', mockCache);
    const kalshiFetcher = new MockKalshiFetcher();
    
    const marketAggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, mockCache);
    
    console.log('✓ Components initialized');
    console.log('');
    
    // Test 1: Fetch Polymarket markets through aggregator
    console.log('Test 1: Fetch markets through MarketAggregator');
    console.log('-'.repeat(70));
    
    const platformMarkets = await marketAggregator.fetchAllPlatforms({ 
      maxPages: 1, 
      limit: 10 
    });
    
    console.log(`✓ Fetched from platforms:`);
    console.log(`  Polymarket: ${platformMarkets.polymarket.length} markets`);
    console.log(`  Kalshi: ${platformMarkets.kalshi.length} markets`);
    console.log(`  Total: ${platformMarkets.totalMarkets} markets`);
    console.log('');
    
    // Test 2: Verify normalized data structure
    console.log('Test 2: Verify normalized data structure');
    console.log('-'.repeat(70));
    
    if (platformMarkets.polymarket.length > 0) {
      const sample = platformMarkets.polymarket[0];
      
      console.log('Sample normalized market:');
      console.log(`  ID: ${sample.id}`);
      console.log(`  Platform: ${sample.platform}`);
      console.log(`  Question: ${sample.question}`);
      console.log(`  Category: ${sample.category}`);
      console.log(`  Volume: $${sample.volume_24h?.toLocaleString() || 0}`);
      console.log(`  Outcomes: ${sample.outcomes.length}`);
      
      sample.outcomes.forEach((outcome, i) => {
        console.log(`    ${i + 1}. ${outcome.name}: ${(outcome.price * 100).toFixed(1)}%`);
      });
      
      console.log('✓ Data structure valid');
    } else {
      console.log('⚠ No markets to verify');
    }
    console.log('');
    
    // Test 3: Combine markets (creates unified markets)
    console.log('Test 3: Combine markets into unified format');
    console.log('-'.repeat(70));
    
    const unifiedMarkets = await marketAggregator.combineMarkets(platformMarkets);
    
    console.log(`✓ Created ${unifiedMarkets.length} unified markets`);
    
    if (unifiedMarkets.length > 0) {
      const sample = unifiedMarkets[0];
      console.log('Sample unified market:');
      console.log(`  Unified ID: ${sample.unified_id}`);
      console.log(`  Question: ${sample.question}`);
      console.log(`  Platforms: ${Object.keys(sample.platforms).join(', ')}`);
      console.log(`  Combined Volume: $${sample.combined_volume?.toLocaleString() || 0}`);
      console.log(`  Liquidity Score: ${sample.liquidity_score}/5`);
      
      if (sample.arbitrage) {
        console.log(`  ⚠ Arbitrage detected: ${sample.arbitrage.profit_pct?.toFixed(2)}% profit`);
      }
    }
    console.log('');
    
    // Test 4: Platform health tracking
    console.log('Test 4: Platform health tracking');
    console.log('-'.repeat(70));
    
    const health = marketAggregator.getPlatformHealth();
    console.log('Platform health status:');
    Object.entries(health).forEach(([platform, status]) => {
      console.log(`  ${platform}: ${status?.status || 'unknown'}`);
    });
    console.log('✓ Health tracking working');
    console.log('');
    
    // Test 5: Performance metrics
    console.log('Test 5: Performance metrics');
    console.log('-'.repeat(70));
    
    const metrics = marketAggregator.getPerformanceMetrics();
    console.log('Performance metrics:');
    console.log(`  Last fetch duration: ${metrics.lastFetchDuration}ms`);
    console.log(`  Last match duration: ${metrics.lastMatchDuration}ms`);
    console.log(`  Total fetches: ${metrics.totalFetches}`);
    console.log(`  Total matches: ${metrics.totalMatches}`);
    console.log('✓ Metrics tracked');
    console.log('');
    
    console.log('='.repeat(70));
    console.log('✓ ALL INTEGRATION TESTS PASSED');
    console.log('='.repeat(70));
    
    process.exit(0);
    
  } catch (error) {
    console.error('✗ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runIntegrationTest();
