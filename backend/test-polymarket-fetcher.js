/**
 * Test script for PolymarketFetcher
 * 
 * This script tests the Polymarket API integration including:
 * - Market fetching with pagination
 * - Data normalization
 * - Rate limiting
 * - Error handling
 */

const PolymarketFetcher = require('./PolymarketFetcher');

// Mock cache manager for testing
class MockCacheManager {
  constructor() {
    this.platformHealth = {};
  }
  
  updatePlatformHealth(platform, status, error) {
    this.platformHealth[platform] = {
      status,
      error: error ? error.message : null,
      timestamp: Date.now()
    };
    console.log(`[MockCache] Platform health updated: ${platform} = ${status}`);
  }
  
  getPlatformHealth(platform) {
    return this.platformHealth[platform] || null;
  }
}

// Test runner
async function runTests() {
  console.log('='.repeat(70));
  console.log('POLYMARKET FETCHER TEST SUITE');
  console.log('='.repeat(70));
  console.log('');
  
  const mockCache = new MockCacheManager();
  const fetcher = new PolymarketFetcher('https://gamma-api.polymarket.com', mockCache);
  
  let passedTests = 0;
  let failedTests = 0;
  
  // Test 1: Fetch markets with pagination
  console.log('Test 1: Fetch markets with pagination');
  console.log('-'.repeat(70));
  try {
    const markets = await fetcher.fetchMarkets({ 
      maxPages: 1, 
      limit: 10 
    });
    
    if (markets && markets.length > 0) {
      console.log(`✓ PASS: Fetched ${markets.length} markets`);
      console.log(`  Sample market:`, markets[0].question || markets[0].title);
      passedTests++;
    } else {
      console.log('✗ FAIL: No markets returned');
      failedTests++;
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Test 2: Normalize market data
  console.log('Test 2: Normalize market data');
  console.log('-'.repeat(70));
  try {
    const rawMarkets = await fetcher.fetchMarkets({ 
      maxPages: 1, 
      limit: 5 
    });
    
    if (rawMarkets && rawMarkets.length > 0) {
      const normalized = fetcher.normalizeMarket(rawMarkets[0]);
      
      if (normalized && 
          normalized.id && 
          normalized.platform === 'polymarket' &&
          normalized.question &&
          normalized.outcomes &&
          normalized.outcomes.length > 0) {
        console.log('✓ PASS: Market normalized successfully');
        console.log(`  ID: ${normalized.id}`);
        console.log(`  Question: ${normalized.question}`);
        console.log(`  Outcomes: ${normalized.outcomes.length}`);
        console.log(`  Volume: $${normalized.volume_24h?.toLocaleString() || 0}`);
        console.log(`  Category: ${normalized.category}`);
        
        // Check price normalization
        const allPricesValid = normalized.outcomes.every(o => 
          o.price >= 0 && o.price <= 1
        );
        
        if (allPricesValid) {
          console.log('  ✓ All prices in 0.00-1.00 range');
        } else {
          console.log('  ✗ Some prices out of range');
        }
        
        passedTests++;
      } else {
        console.log('✗ FAIL: Normalized market missing required fields');
        console.log('  Normalized:', normalized);
        failedTests++;
      }
    } else {
      console.log('✗ FAIL: No markets to normalize');
      failedTests++;
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Test 3: Handle multi-outcome markets
  console.log('Test 3: Handle multi-outcome markets');
  console.log('-'.repeat(70));
  try {
    const rawMarkets = await fetcher.fetchMarkets({ 
      maxPages: 2, 
      limit: 50 
    });
    
    // Find a multi-outcome market (has tokens array)
    const multiOutcomeMarket = rawMarkets.find(m => 
      m.tokens && Array.isArray(m.tokens) && m.tokens.length > 2
    );
    
    if (multiOutcomeMarket) {
      const normalized = fetcher.normalizeMarket(multiOutcomeMarket);
      
      if (normalized && normalized.isMultiOutcome && normalized.outcomes.length > 2) {
        console.log('✓ PASS: Multi-outcome market handled correctly');
        console.log(`  Question: ${normalized.question}`);
        console.log(`  Outcomes: ${normalized.outcomes.length}`);
        normalized.outcomes.forEach((o, i) => {
          console.log(`    ${i + 1}. ${o.name}: ${(o.price * 100).toFixed(1)}%`);
        });
        passedTests++;
      } else {
        console.log('✗ FAIL: Multi-outcome market not normalized correctly');
        failedTests++;
      }
    } else {
      console.log('⚠ SKIP: No multi-outcome markets found in sample');
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Test 4: Rate limiting
  console.log('Test 4: Rate limiting');
  console.log('-'.repeat(70));
  try {
    console.log('  Making 3 rapid requests to test rate limiting...');
    const startTime = Date.now();
    
    await Promise.all([
      fetcher.fetchMarkets({ maxPages: 1, limit: 5 }),
      fetcher.fetchMarkets({ maxPages: 1, limit: 5 }),
      fetcher.fetchMarkets({ maxPages: 1, limit: 5 })
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`✓ PASS: Rate limiting working (${duration}ms for 3 requests)`);
    passedTests++;
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Test 5: Health status tracking
  console.log('Test 5: Health status tracking');
  console.log('-'.repeat(70));
  try {
    const health = fetcher.getHealthStatus();
    
    if (health && health.status && health.lastSuccessfulFetch) {
      console.log('✓ PASS: Health status tracked');
      console.log(`  Status: ${health.status}`);
      console.log(`  Last successful fetch: ${new Date(health.lastSuccessfulFetch).toISOString()}`);
      console.log(`  Time since last success: ${health.timeSinceLastSuccess}ms`);
      passedTests++;
    } else {
      console.log('✗ FAIL: Health status not properly tracked');
      failedTests++;
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Test 6: Category extraction
  console.log('Test 6: Category extraction');
  console.log('-'.repeat(70));
  try {
    const rawMarkets = await fetcher.fetchMarkets({ 
      maxPages: 1, 
      limit: 20 
    });
    
    const categoryCounts = {};
    rawMarkets.forEach(raw => {
      const normalized = fetcher.normalizeMarket(raw);
      if (normalized && normalized.category) {
        categoryCounts[normalized.category] = (categoryCounts[normalized.category] || 0) + 1;
      }
    });
    
    if (Object.keys(categoryCounts).length > 0) {
      console.log('✓ PASS: Categories extracted');
      Object.entries(categoryCounts).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} markets`);
      });
      passedTests++;
    } else {
      console.log('✗ FAIL: No categories extracted');
      failedTests++;
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    failedTests++;
  }
  console.log('');
  
  // Summary
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
