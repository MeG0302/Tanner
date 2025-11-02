/**
 * Test Script: Polymarket Trending Endpoint Discovery
 * 
 * This script tests various Polymarket API endpoints to find the correct
 * trending markets endpoint that matches what Polymarket.com displays.
 */

const https = require('https');

/**
 * Simple fetch using Node's native HTTPS module
 */
function nativeFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON Parse Error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Test a single endpoint and log results
 */
async function testEndpoint(name, url) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(70));
  
  try {
    const startTime = Date.now();
    const data = await nativeFetch(url);
    const duration = Date.now() - startTime;
    
    // Parse response
    const markets = Array.isArray(data) ? data : (data.data || data.markets || []);
    
    if (!Array.isArray(markets)) {
      console.log('❌ FAILED: Response is not an array');
      console.log('Response structure:', Object.keys(data));
      return { success: false, error: 'Invalid response structure' };
    }
    
    console.log(`✅ SUCCESS: Fetched ${markets.length} markets in ${duration}ms`);
    
    // Show top 10 markets
    console.log('\nTop 10 Markets:');
    markets.slice(0, 10).forEach((market, i) => {
      const title = market.question || market.title || market.name || 'Unknown';
      const volume = market.volume || market.volume24hr || market.volume_24h || 0;
      console.log(`  ${i + 1}. ${title.substring(0, 60)}`);
      console.log(`     Volume: $${parseFloat(volume).toLocaleString()}`);
    });
    
    return { 
      success: true, 
      count: markets.length, 
      duration,
      topMarkets: markets.slice(0, 10).map(m => ({
        title: (m.question || m.title || '').substring(0, 60),
        volume: parseFloat(m.volume || m.volume24hr || m.volume_24h || 0)
      }))
    };
    
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('POLYMARKET TRENDING ENDPOINT DISCOVERY');
  console.log('='.repeat(70));
  console.log('Testing various endpoints to find the correct trending API...\n');
  
  const endpoints = [
    {
      name: 'Test 1: order=trending',
      url: 'https://gamma-api.polymarket.com/markets?order=trending&limit=100&active=true&closed=false'
    },
    {
      name: 'Test 2: sort=trending',
      url: 'https://gamma-api.polymarket.com/markets?sort=trending&limit=100&active=true&closed=false'
    },
    {
      name: 'Test 3: /trending endpoint',
      url: 'https://gamma-api.polymarket.com/trending?limit=100'
    },
    {
      name: 'Test 4: /markets/trending',
      url: 'https://gamma-api.polymarket.com/markets/trending?limit=100'
    },
    {
      name: 'Test 5: CLOB API trending',
      url: 'https://clob.polymarket.com/trending'
    },
    {
      name: 'Test 6: order=volume24hr (baseline)',
      url: 'https://gamma-api.polymarket.com/markets?order=volume24hr&limit=100&active=true&closed=false'
    },
    {
      name: 'Test 7: Default (no sorting)',
      url: 'https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false'
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.url);
    results.push({ ...endpoint, ...result });
    
    // Wait 1 second between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n📊 Successful Endpoints:');
    successful.forEach(r => {
      console.log(`\n  ${r.name}`);
      console.log(`  URL: ${r.url}`);
      console.log(`  Markets: ${r.count}, Duration: ${r.duration}ms`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    failed.forEach(r => {
      console.log(`\n  ${r.name}`);
      console.log(`  Error: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('NEXT STEPS:');
  console.log('='.repeat(70));
  console.log('1. Compare the top 10 markets from successful endpoints');
  console.log('2. Check which endpoint matches Polymarket.com/trending');
  console.log('3. If no endpoint matches, we\'ll implement custom trending algorithm');
  console.log('='.repeat(70) + '\n');
}

// Run the tests
runTests().catch(console.error);
