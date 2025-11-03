/**
 * Test script for ArbitrageDetector
 * 
 * Tests the arbitrage detection algorithm and instruction generation
 */

const ArbitrageDetector = require('./ArbitrageDetector');

// Test data - unified markets with various scenarios
const testMarkets = {
  // Scenario 1: Clear arbitrage opportunity (5% profit)
  arbitrageMarket: {
    unified_id: 'test-arbitrage-1',
    question: 'Will there be a clear arbitrage opportunity?',
    platforms: {
      polymarket: {
        id: 'poly-123',
        platform: 'polymarket',
        outcomes: [
          { name: 'Yes', price: 0.45 },
          { name: 'No', price: 0.55 }
        ],
        volume_24h: 100000
      },
      kalshi: {
        id: 'kalshi-456',
        platform: 'kalshi',
        outcomes: [
          { name: 'Yes', price: 0.48 },
          { name: 'No', price: 0.48 }
        ],
        volume_24h: 50000
      }
    }
  },
  
  // Scenario 2: No arbitrage (prices sum to > 0.95)
  noArbitrageMarket: {
    unified_id: 'test-no-arbitrage',
    question: 'Will there be no arbitrage here?',
    platforms: {
      polymarket: {
        id: 'poly-789',
        platform: 'polymarket',
        outcomes: [
          { name: 'Yes', price: 0.52 },
          { name: 'No', price: 0.48 }
        ],
        volume_24h: 200000
      },
      kalshi: {
        id: 'kalshi-012',
        platform: 'kalshi',
        outcomes: [
          { name: 'Yes', price: 0.53 },
          { name: 'No', price: 0.47 }
        ],
        volume_24h: 100000
      }
    }
  },
  
  // Scenario 3: Small arbitrage (< 2% profit, should not flag)
  smallArbitrageMarket: {
    unified_id: 'test-small-arbitrage',
    question: 'Will this small arbitrage be ignored?',
    platforms: {
      polymarket: {
        id: 'poly-345',
        platform: 'polymarket',
        outcomes: [
          { name: 'Yes', price: 0.48 },
          { name: 'No', price: 0.52 }
        ],
        volume_24h: 150000
      },
      kalshi: {
        id: 'kalshi-678',
        platform: 'kalshi',
        outcomes: [
          { name: 'Yes', price: 0.49 },
          { name: 'No', price: 0.50 }
        ],
        volume_24h: 75000
      }
    }
  },
  
  // Scenario 4: Single platform (no arbitrage possible)
  singlePlatformMarket: {
    unified_id: 'test-single-platform',
    question: 'Will single platform markets be skipped?',
    platforms: {
      polymarket: {
        id: 'poly-999',
        platform: 'polymarket',
        outcomes: [
          { name: 'Yes', price: 0.60 },
          { name: 'No', price: 0.40 }
        ],
        volume_24h: 300000
      }
    }
  },
  
  // Scenario 5: Large arbitrage opportunity (10% profit)
  largeArbitrageMarket: {
    unified_id: 'test-large-arbitrage',
    question: 'Will this large arbitrage be detected?',
    platforms: {
      polymarket: {
        id: 'poly-111',
        platform: 'polymarket',
        outcomes: [
          { name: 'Yes', price: 0.40 },
          { name: 'No', price: 0.60 }
        ],
        volume_24h: 500000
      },
      kalshi: {
        id: 'kalshi-222',
        platform: 'kalshi',
        outcomes: [
          { name: 'Yes', price: 0.45 },
          { name: 'No', price: 0.45 }
        ],
        volume_24h: 250000
      }
    }
  }
};

// Run tests
function runTests() {
  console.log('='.repeat(80));
  console.log('ARBITRAGE DETECTOR TEST SUITE');
  console.log('='.repeat(80));
  console.log();
  
  const detector = new ArbitrageDetector({
    minProfitThreshold: 2.0,
    maxCombinedPrice: 0.95
  });
  
  // Test 1: Clear arbitrage opportunity
  console.log('TEST 1: Clear Arbitrage Opportunity (5% profit)');
  console.log('-'.repeat(80));
  const arb1 = detector.detectArbitrage(testMarkets.arbitrageMarket);
  if (arb1 && arb1.exists) {
    console.log('✓ Arbitrage detected');
    const instructions = detector.generateInstructions(arb1, testMarkets.arbitrageMarket);
    console.log('Summary:', instructions.summary);
    console.log('Profit:', instructions.profitPct + '%');
    console.log('Steps:');
    instructions.steps.forEach(step => {
      console.log(`  ${step.step}. ${step.description}`);
    });
  } else {
    console.log('✗ FAILED: Should have detected arbitrage');
  }
  console.log();
  
  // Test 2: No arbitrage
  console.log('TEST 2: No Arbitrage (prices sum to > 0.95)');
  console.log('-'.repeat(80));
  const arb2 = detector.detectArbitrage(testMarkets.noArbitrageMarket);
  if (!arb2 || !arb2.exists) {
    console.log('✓ Correctly identified no arbitrage');
  } else {
    console.log('✗ FAILED: Should not have detected arbitrage');
  }
  console.log();
  
  // Test 3: Small arbitrage (below threshold)
  console.log('TEST 3: Small Arbitrage (< 2% profit, should ignore)');
  console.log('-'.repeat(80));
  const arb3 = detector.detectArbitrage(testMarkets.smallArbitrageMarket);
  if (!arb3 || !arb3.exists) {
    console.log('✓ Correctly ignored small arbitrage below threshold');
  } else {
    console.log('✗ FAILED: Should have ignored arbitrage below 2% threshold');
  }
  console.log();
  
  // Test 4: Single platform
  console.log('TEST 4: Single Platform Market (no arbitrage possible)');
  console.log('-'.repeat(80));
  const arb4 = detector.detectArbitrage(testMarkets.singlePlatformMarket);
  if (!arb4 || !arb4.exists) {
    console.log('✓ Correctly skipped single platform market');
  } else {
    console.log('✗ FAILED: Should not detect arbitrage with single platform');
  }
  console.log();
  
  // Test 5: Large arbitrage
  console.log('TEST 5: Large Arbitrage Opportunity (10% profit)');
  console.log('-'.repeat(80));
  const arb5 = detector.detectArbitrage(testMarkets.largeArbitrageMarket);
  if (arb5 && arb5.exists) {
    console.log('✓ Arbitrage detected');
    const instructions = detector.generateInstructions(arb5, testMarkets.largeArbitrageMarket);
    console.log('Summary:', instructions.summary);
    console.log('Profit:', instructions.profitPct + '%');
    console.log('Warnings:', instructions.warnings.length);
    // Should have warning about unusually high profit
    const hasHighProfitWarning = instructions.warnings.some(w => 
      w.includes('Unusually high profit margin')
    );
    if (hasHighProfitWarning) {
      console.log('✓ Includes warning about unusually high profit');
    }
  } else {
    console.log('✗ FAILED: Should have detected large arbitrage');
  }
  console.log();
  
  // Test 6: Batch processing
  console.log('TEST 6: Batch Processing');
  console.log('-'.repeat(80));
  const allMarkets = Object.values(testMarkets);
  const opportunities = detector.detectBatchArbitrage(allMarkets);
  console.log(`Found ${opportunities.length} arbitrage opportunities out of ${allMarkets.length} markets`);
  
  // Should find 2 opportunities (arbitrageMarket and largeArbitrageMarket)
  if (opportunities.length === 2) {
    console.log('✓ Correct number of opportunities detected');
    
    // Check if sorted by profit (descending)
    if (opportunities[0].arbitrage.profitPct > opportunities[1].arbitrage.profitPct) {
      console.log('✓ Opportunities sorted by profit (descending)');
    } else {
      console.log('✗ FAILED: Opportunities not sorted correctly');
    }
  } else {
    console.log(`✗ FAILED: Expected 2 opportunities, found ${opportunities.length}`);
  }
  console.log();
  
  // Test 7: Statistics
  console.log('TEST 7: Arbitrage Statistics');
  console.log('-'.repeat(80));
  const stats = detector.getArbitrageStats(opportunities);
  console.log('Statistics:', JSON.stringify(stats, null, 2));
  if (stats.count === 2 && stats.maxProfit > stats.minProfit) {
    console.log('✓ Statistics calculated correctly');
  } else {
    console.log('✗ FAILED: Statistics incorrect');
  }
  console.log();
  
  // Summary
  console.log('='.repeat(80));
  console.log('TEST SUITE COMPLETE');
  console.log('='.repeat(80));
}

// Run the tests
try {
  runTests();
} catch (error) {
  console.error('Test suite failed with error:', error);
  process.exit(1);
}
