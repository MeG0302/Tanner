/**
 * Integration Tests for Unified Market API Endpoints
 * 
 * This script tests the HTTP API endpoints for unified market aggregation:
 * - GET /api/unified-markets/:category
 * - GET /api/unified-market/:id
 * - GET /api/arbitrage-opportunities
 * - GET /api/platform-health
 * 
 * Tests cover:
 * - Successful responses
 * - Error handling
 * - Edge cases
 * - Response structure validation
 */

const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 10000; // 10 seconds

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make HTTP GET request
 * @param {string} path API endpoint path
 * @returns {Promise<Object>} Response object with status, headers, and body
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Assert helper function
 * @param {boolean} condition Condition to check
 * @param {string} message Error message if condition is false
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Run a test and track results
 * @param {string} name Test name
 * @param {Function} testFn Test function
 */
async function runTest(name, testFn) {
  console.log(`\n▶ Running: ${name}`);
  
  try {
    await testFn();
    console.log(`  ✓ PASSED`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`  ✗ FAILED: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
  }
}

// ====================================================================
// TEST SUITE 1: /api/unified-markets/:category
// ====================================================================

async function testUnifiedMarketsByCategory() {
  const response = await makeRequest('/api/unified-markets/Politics');
  
  // Check status code
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Check response structure
  assert(response.body !== null, 'Response body should not be null');
  assert(typeof response.body === 'object', 'Response body should be an object');
  
  // Check required fields
  assert('category' in response.body, 'Response should have category field');
  assert('markets' in response.body, 'Response should have markets field');
  assert('count' in response.body, 'Response should have count field');
  assert('platformDistribution' in response.body, 'Response should have platformDistribution field');
  assert('timestamp' in response.body, 'Response should have timestamp field');
  
  // Check markets array
  assert(Array.isArray(response.body.markets), 'Markets should be an array');
  assert(response.body.count === response.body.markets.length, 'Count should match markets array length');
  
  // Check platform distribution
  const dist = response.body.platformDistribution;
  assert(typeof dist.polymarket === 'number', 'Platform distribution should have polymarket count');
  assert(typeof dist.kalshi === 'number', 'Platform distribution should have kalshi count');
  assert(typeof dist.both === 'number', 'Platform distribution should have both count');
  
  // Verify distribution adds up
  const totalDist = dist.polymarket + dist.kalshi + dist.both;
  assert(totalDist === response.body.count, 'Platform distribution should add up to total count');
  
  // If markets exist, validate structure
  if (response.body.markets.length > 0) {
    const market = response.body.markets[0];
    assert('unified_id' in market, 'Market should have unified_id');
    assert('question' in market, 'Market should have question');
    assert('platforms' in market, 'Market should have platforms');
    assert(typeof market.platforms === 'object', 'Platforms should be an object');
  }
  
  console.log(`  - Returned ${response.body.count} markets`);
  console.log(`  - Distribution: ${dist.polymarket} Polymarket, ${dist.kalshi} Kalshi, ${dist.both} Both`);
}

async function testUnifiedMarketsInvalidCategory() {
  const response = await makeRequest('/api/unified-markets/NonExistentCategory');
  
  // Should still return 200 with empty array
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  assert(response.body !== null, 'Response body should not be null');
  assert(Array.isArray(response.body.markets), 'Markets should be an array');
  
  console.log(`  - Returned ${response.body.count} markets for invalid category (expected 0 or few)`);
}

async function testUnifiedMarketsMultipleCategories() {
  const categories = ['Politics', 'Sports', 'Crypto'];
  
  for (const category of categories) {
    const response = await makeRequest(`/api/unified-markets/${category}`);
    assert(response.status === 200, `Expected status 200 for ${category}, got ${response.status}`);
    assert(response.body.category === category, `Expected category ${category}, got ${response.body.category}`);
    console.log(`  - ${category}: ${response.body.count} markets`);
  }
}

// ====================================================================
// TEST SUITE 2: /api/unified-market/:id
// ====================================================================

async function testUnifiedMarketById() {
  // First, get a list of markets to find a valid ID
  const listResponse = await makeRequest('/api/unified-markets/Politics');
  
  if (listResponse.body.markets.length === 0) {
    console.log('  ⚠ Skipping test: No markets available');
    return;
  }
  
  const marketId = listResponse.body.markets[0].unified_id;
  const response = await makeRequest(`/api/unified-market/${marketId}`);
  
  // Check status code
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Check response structure
  assert(response.body !== null, 'Response body should not be null');
  assert('market' in response.body, 'Response should have market field');
  assert('timestamp' in response.body, 'Response should have timestamp field');
  
  // Check market structure
  const market = response.body.market;
  assert(market.unified_id === marketId, `Expected unified_id ${marketId}, got ${market.unified_id}`);
  assert('question' in market, 'Market should have question');
  assert('platforms' in market, 'Market should have platforms');
  assert('combined_volume' in market, 'Market should have combined_volume');
  assert('best_price' in market, 'Market should have best_price');
  assert('liquidity_score' in market, 'Market should have liquidity_score');
  
  // Check best_price structure
  assert('yes' in market.best_price, 'Best price should have yes field');
  assert('no' in market.best_price, 'Best price should have no field');
  assert('platform' in market.best_price.yes, 'Best yes price should have platform');
  assert('price' in market.best_price.yes, 'Best yes price should have price');
  
  console.log(`  - Market ID: ${marketId}`);
  console.log(`  - Question: ${market.question.substring(0, 50)}...`);
  console.log(`  - Platforms: ${Object.keys(market.platforms).join(', ')}`);
}

async function testUnifiedMarketNotFound() {
  const response = await makeRequest('/api/unified-market/non-existent-id-12345');
  
  // Should return 404
  assert(response.status === 404, `Expected status 404, got ${response.status}`);
  assert(response.body !== null, 'Response body should not be null');
  assert('error' in response.body, 'Response should have error field');
  
  console.log(`  - Error message: ${response.body.error}`);
}

async function testUnifiedMarketDetailsComplete() {
  // Get a market and verify all expected fields are present
  const listResponse = await makeRequest('/api/unified-markets/Politics');
  
  if (listResponse.body.markets.length === 0) {
    console.log('  ⚠ Skipping test: No markets available');
    return;
  }
  
  const marketId = listResponse.body.markets[0].unified_id;
  const response = await makeRequest(`/api/unified-market/${marketId}`);
  
  const market = response.body.market;
  
  // Verify platform-specific data
  for (const [platformName, platformData] of Object.entries(market.platforms)) {
    assert('id' in platformData, `Platform ${platformName} should have id`);
    assert('platform' in platformData, `Platform ${platformName} should have platform field`);
    assert('question' in platformData, `Platform ${platformName} should have question`);
    assert('outcomes' in platformData, `Platform ${platformName} should have outcomes`);
    assert(Array.isArray(platformData.outcomes), `Platform ${platformName} outcomes should be array`);
    
    // Check outcomes structure
    if (platformData.outcomes.length > 0) {
      const outcome = platformData.outcomes[0];
      assert('name' in outcome, 'Outcome should have name');
      assert('price' in outcome, 'Outcome should have price');
      assert(outcome.price >= 0 && outcome.price <= 1, 'Price should be between 0 and 1');
    }
  }
  
  console.log(`  - Verified complete data structure for ${Object.keys(market.platforms).length} platform(s)`);
}

// ====================================================================
// TEST SUITE 3: /api/arbitrage-opportunities
// ====================================================================

async function testArbitrageOpportunities() {
  const response = await makeRequest('/api/arbitrage-opportunities');
  
  // Check status code
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Check response structure
  assert(response.body !== null, 'Response body should not be null');
  assert('opportunities' in response.body, 'Response should have opportunities field');
  assert('count' in response.body, 'Response should have count field');
  assert('timestamp' in response.body, 'Response should have timestamp field');
  
  // Check opportunities array
  assert(Array.isArray(response.body.opportunities), 'Opportunities should be an array');
  assert(response.body.count === response.body.opportunities.length, 'Count should match opportunities array length');
  
  console.log(`  - Found ${response.body.count} arbitrage opportunities`);
  
  // If opportunities exist, validate structure
  if (response.body.opportunities.length > 0) {
    const opp = response.body.opportunities[0];
    assert('unified_id' in opp, 'Opportunity should have unified_id');
    assert('question' in opp, 'Opportunity should have question');
    assert('arbitrage' in opp, 'Opportunity should have arbitrage field');
    
    const arb = opp.arbitrage;
    assert('exists' in arb, 'Arbitrage should have exists field');
    assert(arb.exists === true, 'Arbitrage exists should be true');
    assert('profit_pct' in arb, 'Arbitrage should have profit_pct');
    assert('instructions' in arb, 'Arbitrage should have instructions');
    assert(arb.profit_pct > 0, 'Profit percentage should be positive');
    
    console.log(`  - Top opportunity: ${arb.profit_pct.toFixed(2)}% profit`);
    console.log(`  - Instructions: ${arb.instructions.substring(0, 60)}...`);
  }
}

async function testArbitrageOpportunitiesSorted() {
  const response = await makeRequest('/api/arbitrage-opportunities');
  
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Verify opportunities are sorted by profit percentage (descending)
  if (response.body.opportunities.length > 1) {
    for (let i = 0; i < response.body.opportunities.length - 1; i++) {
      const current = response.body.opportunities[i].arbitrage.profit_pct;
      const next = response.body.opportunities[i + 1].arbitrage.profit_pct;
      assert(current >= next, `Opportunities should be sorted by profit (${current} >= ${next})`);
    }
    console.log(`  - Verified opportunities are sorted by profit percentage`);
  } else {
    console.log(`  - Not enough opportunities to verify sorting`);
  }
}

// ====================================================================
// TEST SUITE 4: /api/platform-health
// ====================================================================

async function testPlatformHealth() {
  const response = await makeRequest('/api/platform-health');
  
  // Check status code
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Check response structure
  assert(response.body !== null, 'Response body should not be null');
  assert('platforms' in response.body, 'Response should have platforms field');
  assert('timestamp' in response.body, 'Response should have timestamp field');
  
  // Check platforms object
  const platforms = response.body.platforms;
  assert(typeof platforms === 'object', 'Platforms should be an object');
  assert('polymarket' in platforms, 'Should have polymarket health');
  assert('kalshi' in platforms, 'Should have kalshi health');
  
  // Check platform health structure
  for (const [platformName, health] of Object.entries(platforms)) {
    assert('status' in health, `${platformName} should have status`);
    assert(['healthy', 'degraded', 'unknown'].includes(health.status), 
      `${platformName} status should be healthy, degraded, or unknown`);
    
    console.log(`  - ${platformName}: ${health.status}`);
    
    if (health.lastSuccessfulFetch) {
      const timeSince = Date.now() - health.lastSuccessfulFetch;
      console.log(`    Last successful fetch: ${Math.round(timeSince / 1000)}s ago`);
    }
    
    if (health.lastError) {
      console.log(`    Last error: ${health.lastError}`);
    }
  }
}

async function testPlatformHealthFields() {
  const response = await makeRequest('/api/platform-health');
  
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  const platforms = response.body.platforms;
  
  // Verify all expected fields are present
  for (const [platformName, health] of Object.entries(platforms)) {
    assert('status' in health, `${platformName} should have status`);
    assert('lastSuccessfulFetch' in health, `${platformName} should have lastSuccessfulFetch`);
    assert('lastError' in health, `${platformName} should have lastError`);
    assert('lastAttempt' in health, `${platformName} should have lastAttempt`);
    
    // Verify types
    if (health.lastSuccessfulFetch !== null) {
      assert(typeof health.lastSuccessfulFetch === 'number', 
        `${platformName} lastSuccessfulFetch should be a number`);
    }
    
    if (health.lastError !== null) {
      assert(typeof health.lastError === 'string', 
        `${platformName} lastError should be a string`);
    }
  }
  
  console.log(`  - Verified all health fields for ${Object.keys(platforms).length} platforms`);
}

// ====================================================================
// TEST SUITE 5: Error Handling and Edge Cases
// ====================================================================

async function testInvalidEndpoint() {
  const response = await makeRequest('/api/invalid-endpoint');
  
  // Should return 404
  assert(response.status === 404, `Expected status 404, got ${response.status}`);
  
  console.log(`  - Invalid endpoint correctly returns 404`);
}

async function testMalformedRequest() {
  // Test with special characters in category
  const response = await makeRequest('/api/unified-markets/<script>alert("xss")</script>');
  
  // Should handle gracefully (either 200 with empty results or 400)
  assert(response.status === 200 || response.status === 400, 
    `Expected status 200 or 400, got ${response.status}`);
  
  console.log(`  - Malformed request handled gracefully with status ${response.status}`);
}

async function testConcurrentRequests() {
  // Make multiple concurrent requests
  const requests = [
    makeRequest('/api/unified-markets/Politics'),
    makeRequest('/api/unified-markets/Sports'),
    makeRequest('/api/arbitrage-opportunities'),
    makeRequest('/api/platform-health')
  ];
  
  const responses = await Promise.all(requests);
  
  // All should succeed
  for (const response of responses) {
    assert(response.status === 200, `Expected status 200, got ${response.status}`);
  }
  
  console.log(`  - ${requests.length} concurrent requests all succeeded`);
}

async function testResponseTiming() {
  const start = Date.now();
  const response = await makeRequest('/api/unified-markets/Politics');
  const duration = Date.now() - start;
  
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  assert('fetchTime' in response.body, 'Response should include fetchTime');
  
  console.log(`  - Total request time: ${duration}ms`);
  console.log(`  - Server fetch time: ${response.body.fetchTime}ms`);
  
  // Verify timing is reasonable (less than 10 seconds)
  assert(duration < 10000, `Request took too long: ${duration}ms`);
}

async function testCacheHeaders() {
  const response = await makeRequest('/api/unified-markets/Politics');
  
  assert(response.status === 200, `Expected status 200, got ${response.status}`);
  
  // Check for CORS headers
  if (response.headers['access-control-allow-origin']) {
    console.log(`  - CORS enabled: ${response.headers['access-control-allow-origin']}`);
  }
  
  // Check content type
  assert(response.headers['content-type'].includes('application/json'), 
    'Content-Type should be application/json');
  
  console.log(`  - Content-Type: ${response.headers['content-type']}`);
}

// ====================================================================
// TEST RUNNER
// ====================================================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Unified Market API Integration Test Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTesting API at: ${API_BASE_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms\n`);
  
  // Check if server is running
  try {
    await makeRequest('/api/platform-health');
  } catch (error) {
    console.error('\n✗ ERROR: Cannot connect to server');
    console.error(`  Make sure the server is running at ${API_BASE_URL}`);
    console.error(`  Error: ${error.message}\n`);
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE 1: /api/unified-markets/:category');
  console.log('═══════════════════════════════════════════════════════════');
  
  await runTest('Get unified markets by category', testUnifiedMarketsByCategory);
  await runTest('Handle invalid category', testUnifiedMarketsInvalidCategory);
  await runTest('Get markets for multiple categories', testUnifiedMarketsMultipleCategories);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE 2: /api/unified-market/:id');
  console.log('═══════════════════════════════════════════════════════════');
  
  await runTest('Get unified market by ID', testUnifiedMarketById);
  await runTest('Handle market not found', testUnifiedMarketNotFound);
  await runTest('Verify complete market details', testUnifiedMarketDetailsComplete);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE 3: /api/arbitrage-opportunities');
  console.log('═══════════════════════════════════════════════════════════');
  
  await runTest('Get arbitrage opportunities', testArbitrageOpportunities);
  await runTest('Verify opportunities are sorted', testArbitrageOpportunitiesSorted);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE 4: /api/platform-health');
  console.log('═══════════════════════════════════════════════════════════');
  
  await runTest('Get platform health status', testPlatformHealth);
  await runTest('Verify health status fields', testPlatformHealthFields);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE 5: Error Handling and Edge Cases');
  console.log('═══════════════════════════════════════════════════════════');
  
  await runTest('Handle invalid endpoint', testInvalidEndpoint);
  await runTest('Handle malformed request', testMalformedRequest);
  await runTest('Handle concurrent requests', testConcurrentRequests);
  await runTest('Verify response timing', testResponseTiming);
  await runTest('Verify response headers', testCacheHeaders);
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const total = testResults.passed + testResults.failed;
  const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${testResults.passed} (${passRate}%)`);
  console.log(`Failed: ${testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log('\nFailed tests:');
    testResults.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`  ✗ ${t.name}`);
        console.log(`    ${t.error}`);
      });
  }
  
  if (testResults.failed === 0) {
    console.log('\n✓ All tests passed!\n');
    process.exit(0);
  } else {
    console.log(`\n✗ ${testResults.failed} test(s) failed\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n✗ Fatal error running tests:', error);
  console.error(error.stack);
  process.exit(1);
});
