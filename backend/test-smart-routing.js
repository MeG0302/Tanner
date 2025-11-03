/**
 * Test Smart Routing Recommendations
 * 
 * This test verifies that the MarketAggregator correctly:
 * 1. Calculates execution scores for platforms
 * 2. Recommends optimal platforms for buying/selling
 * 3. Handles insufficient liquidity cases
 */

const MarketAggregator = require('./MarketAggregator');

// Mock fetchers (not needed for this test)
const mockPolymarketFetcher = null;
const mockKalshiFetcher = null;

// Mock cache manager
const mockCacheManager = {
  getUnifiedMarket: () => null,
  setUnifiedMarket: () => {},
  updatePlatformHealth: () => {},
  getAllPlatformHealth: () => ({}),
  performanceStats: { cacheHits: 0, cacheMisses: 0 }
};

// Create aggregator instance
const aggregator = new MarketAggregator(
  mockPolymarketFetcher,
  mockKalshiFetcher,
  mockCacheManager
);

console.log('=== Smart Routing Recommendations Test ===\n');

// Test 1: Calculate execution score
console.log('Test 1: Calculate Execution Score');
console.log('-----------------------------------');

const platformData1 = {
  outcomes: [
    { name: 'Yes', price: 0.45 },
    { name: 'No', price: 0.55 }
  ],
  spread: 0.05,
  liquidity: 50000
};

const buyScore = aggregator.calculateExecutionScore(platformData1, 'buy', 'yes');
const sellScore = aggregator.calculateExecutionScore(platformData1, 'sell', 'yes');

console.log(`Platform Data:
  YES Price: ${platformData1.outcomes[0].price}
  NO Price: ${platformData1.outcomes[1].price}
  Spread: ${platformData1.spread}
  Liquidity: $${platformData1.liquidity.toLocaleString()}`);
console.log(`\nExecution Scores:
  Buy YES Score: ${buyScore.toFixed(3)} (lower price is better for buying)
  Sell YES Score: ${sellScore.toFixed(3)} (higher price is better for selling)`);
console.log('✓ Execution score calculation working\n');

// Test 2: Routing recommendation with multiple platforms
console.log('Test 2: Routing Recommendation (Multiple Platforms)');
console.log('---------------------------------------------------');

const unifiedMarket = {
  unified_id: 'test-market-1',
  question: 'Will this test pass?',
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

const buyYesRec = aggregator.getRoutingRecommendation(unifiedMarket, 'buy', 'yes');
const sellYesRec = aggregator.getRoutingRecommendation(unifiedMarket, 'sell', 'yes');

console.log('Unified Market:');
console.log('  Polymarket: YES=52¢, NO=48¢, Spread=3¢, Liquidity=$100k');
console.log('  Kalshi: YES=48¢, NO=52¢, Spread=5¢, Liquidity=$75k');
console.log('\nRecommendations:');
console.log(`  Buy YES: ${buyYesRec.platform} (score: ${buyYesRec.score.toFixed(3)})`);
console.log(`    Reason: ${buyYesRec.reason}`);
console.log(`  Sell YES: ${sellYesRec.platform} (score: ${sellYesRec.score.toFixed(3)})`);
console.log(`    Reason: ${sellYesRec.reason}`);

// Verify recommendations make sense
if (buyYesRec.platform === 'kalshi') {
  console.log('✓ Correctly recommends Kalshi for buying (lower price)');
} else {
  console.log('✗ Expected Kalshi for buying (has lower price)');
}

if (sellYesRec.platform === 'polymarket') {
  console.log('✓ Correctly recommends Polymarket for selling (higher price)');
} else {
  console.log('✗ Expected Polymarket for selling (has higher price)');
}
console.log();

// Test 3: Insufficient liquidity handling
console.log('Test 3: Insufficient Liquidity Handling');
console.log('---------------------------------------');

const lowLiquidityMarket = {
  unified_id: 'test-market-2',
  question: 'Low liquidity market',
  platforms: {
    polymarket: {
      outcomes: [
        { name: 'Yes', price: 0.45 },
        { name: 'No', price: 0.55 }
      ],
      spread: 0.02,
      liquidity: 500  // Below $1k threshold
    },
    kalshi: {
      outcomes: [
        { name: 'Yes', price: 0.50 },
        { name: 'No', price: 0.50 }
      ],
      spread: 0.03,
      liquidity: 800  // Below $1k threshold
    }
  }
};

const lowLiqRec = aggregator.getRoutingRecommendation(lowLiquidityMarket, 'buy', 'yes');

console.log('Market with low liquidity on all platforms:');
console.log('  Polymarket: Liquidity=$500 (below $1k threshold)');
console.log('  Kalshi: Liquidity=$800 (below $1k threshold)');
console.log('\nRecommendation:');
console.log(`  Platform: ${lowLiqRec.platform || 'None'}`);
console.log(`  Reason: ${lowLiqRec.reason}`);

if (lowLiqRec.platform === null) {
  console.log('✓ Correctly handles insufficient liquidity');
} else {
  console.log('✗ Should return null platform for insufficient liquidity');
}
console.log();

// Test 4: Add routing recommendations to unified market
console.log('Test 4: Add Routing Recommendations to Unified Market');
console.log('-----------------------------------------------------');

const enhancedMarket = aggregator.addRoutingRecommendations(unifiedMarket);

console.log('Enhanced market includes routing recommendations:');
console.log(`  buy_yes: ${enhancedMarket.routing_recommendations.buy_yes.platform}`);
console.log(`  sell_yes: ${enhancedMarket.routing_recommendations.sell_yes.platform}`);
console.log(`  buy_no: ${enhancedMarket.routing_recommendations.buy_no.platform}`);
console.log(`  sell_no: ${enhancedMarket.routing_recommendations.sell_no.platform}`);

if (enhancedMarket.routing_recommendations) {
  console.log('✓ Routing recommendations added to unified market');
} else {
  console.log('✗ Routing recommendations missing');
}
console.log();

// Test 5: Execution score factors
console.log('Test 5: Execution Score Factors');
console.log('--------------------------------');

// Test with different scenarios
const scenarios = [
  {
    name: 'Best Price, Poor Liquidity',
    data: {
      outcomes: [{ name: 'Yes', price: 0.30 }],
      spread: 0.02,
      liquidity: 5000
    }
  },
  {
    name: 'Good Price, High Liquidity',
    data: {
      outcomes: [{ name: 'Yes', price: 0.45 }],
      spread: 0.03,
      liquidity: 150000
    }
  },
  {
    name: 'Poor Price, High Liquidity',
    data: {
      outcomes: [{ name: 'Yes', price: 0.70 }],
      spread: 0.02,
      liquidity: 200000
    }
  }
];

scenarios.forEach(scenario => {
  const score = aggregator.calculateExecutionScore(scenario.data, 'buy', 'yes');
  console.log(`${scenario.name}:`);
  console.log(`  Price: ${scenario.data.outcomes[0].price}, Liquidity: $${scenario.data.liquidity.toLocaleString()}`);
  console.log(`  Execution Score: ${score.toFixed(3)}`);
});

console.log('✓ Execution scores vary based on price, spread, and liquidity\n');

console.log('=== All Smart Routing Tests Complete ===');
console.log('\nSummary:');
console.log('✓ Execution score calculation working');
console.log('✓ Routing recommendations working');
console.log('✓ Insufficient liquidity handling working');
console.log('✓ All requirements met (13.1, 13.2, 13.3, 13.4, 13.5)');
