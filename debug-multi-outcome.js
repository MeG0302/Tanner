/**
 * Debug script to investigate multi-outcome market detection
 * This will fetch raw data from Polymarket and analyze it
 */

const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function investigateMultiOutcome() {
  console.log('=== MULTI-OUTCOME MARKET INVESTIGATION ===\n');
  
  try {
    // Fetch first page of markets
    const url = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&offset=0';
    console.log('Fetching from:', url);
    
    const data = await fetch(url);
    const markets = Array.isArray(data) ? data : data.data;
    
    console.log(`\nTotal markets fetched: ${markets.length}\n`);
    
    // Analyze each market
    let binaryCount = 0;
    let multiOutcomeCount = 0;
    const multiOutcomeExamples = [];
    
    markets.forEach((market, index) => {
      // Check how many outcomes/tokens this market has
      const tokens = market.tokens || [];
      const outcomes = market.outcomes || [];
      const clobTokenIds = market.clobTokenIds || [];
      
      const outcomeCount = Math.max(tokens.length, outcomes.length, clobTokenIds.length);
      
      if (outcomeCount > 2) {
        multiOutcomeCount++;
        if (multiOutcomeExamples.length < 5) {
          multiOutcomeExamples.push({
            index,
            question: market.question,
            outcomeCount,
            tokens: tokens.length,
            outcomes: outcomes.length,
            clobTokenIds: clobTokenIds.length,
            outcomePrices: market.outcomePrices,
            sample: {
              tokens: tokens.slice(0, 3),
              outcomes: outcomes.slice(0, 3)
            }
          });
        }
      } else {
        binaryCount++;
      }
    });
    
    console.log('=== RESULTS ===');
    console.log(`Binary markets (2 outcomes): ${binaryCount}`);
    console.log(`Multi-outcome markets (3+ outcomes): ${multiOutcomeCount}`);
    console.log(`\n=== MULTI-OUTCOME EXAMPLES ===\n`);
    
    if (multiOutcomeExamples.length === 0) {
      console.log('❌ NO MULTI-OUTCOME MARKETS FOUND IN FIRST 100 MARKETS');
      console.log('\nLet me check the structure of a sample market:');
      const sample = markets[0];
      console.log(JSON.stringify({
        question: sample.question,
        tokens: sample.tokens,
        outcomes: sample.outcomes,
        clobTokenIds: sample.clobTokenIds,
        outcomePrices: sample.outcomePrices
      }, null, 2));
    } else {
      multiOutcomeExamples.forEach((example, i) => {
        console.log(`${i + 1}. "${example.question}"`);
        console.log(`   Outcome count: ${example.outcomeCount}`);
        console.log(`   Tokens: ${example.tokens}, Outcomes: ${example.outcomes}, ClobTokenIds: ${example.clobTokenIds}`);
        console.log(`   Sample data:`, JSON.stringify(example.sample, null, 2));
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

investigateMultiOutcome();
