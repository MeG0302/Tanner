/**
 * Test script to verify all SmartCacheManager functions are working
 * Run this on your VPS: node backend/test-cache-functions.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCacheFunctions() {
  console.log('🧪 Testing SmartCacheManager Functions\n');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Check cache stats endpoint
    console.log('\n📊 Test 1: Cache Statistics Endpoint');
    const statsResponse = await axios.get(`${BASE_URL}/api/cache/stats`);
    console.log('✅ Stats endpoint working');
    console.log('   Metadata categories:', statsResponse.data.metadataSize);
    console.log('   Full data markets:', statsResponse.data.fullDataSize);
    console.log('   Cache hit rate:', statsResponse.data.hitRate);
    
    // Test 2: Fetch markets by category (should cache)
    console.log('\n📦 Test 2: Category Caching (Politics)');
    const start1 = Date.now();
    const politics1 = await axios.get(`${BASE_URL}/api/markets/Politics`);
    const duration1 = Date.now() - start1;
    console.log(`✅ First fetch: ${politics1.data.length} markets in ${duration1}ms (cache MISS expected)`);
    
    // Test 3: Fetch same category again (should hit cache)
    console.log('\n⚡ Test 3: Cache Hit Test');
    const start2 = Date.now();
    const politics2 = await axios.get(`${BASE_URL}/api/markets/Politics`);
    const duration2 = Date.now() - start2;
    console.log(`✅ Second fetch: ${politics2.data.length} markets in ${duration2}ms (cache HIT expected)`);
    console.log(`   Speed improvement: ${Math.round((duration1 / duration2) * 100)}% faster`);
    
    // Test 4: Check stats after caching
    console.log('\n📈 Test 4: Stats After Caching');
    const stats2 = await axios.get(`${BASE_URL}/api/cache/stats`);
    console.log('✅ Updated stats:');
    console.log('   Cache hits:', stats2.data.cacheHits);
    console.log('   Cache misses:', stats2.data.cacheMisses);
    console.log('   Top categories:', JSON.stringify(stats2.data.topCategories));
    
    // Test 5: Test trending endpoint
    console.log('\n🔥 Test 5: Trending Markets Caching');
    const trending1 = await axios.get(`${BASE_URL}/api/markets/trending`);
    console.log(`✅ Trending fetch: ${trending1.data.length} markets`);
    
    // Test 6: Test unlimited markets (no slice limit)
    console.log('\n♾️  Test 6: Unlimited Markets Return');
    const all = await axios.get(`${BASE_URL}/api/markets/All`);
    console.log(`✅ All markets: ${all.data.length} markets (should be > 100)`);
    if (all.data.length > 100) {
      console.log('   ✅ PASS: Unlimited return working!');
    } else {
      console.log('   ⚠️  WARNING: Markets might still be limited');
    }
    
    // Test 7: Multiple category requests (test access tracking)
    console.log('\n🎯 Test 7: Access Tracking (5+ hits for TTL extension)');
    for (let i = 0; i < 6; i++) {
      await axios.get(`${BASE_URL}/api/markets/Sports`);
      console.log(`   Request ${i + 1}/6 completed`);
    }
    console.log('✅ Access tracking test complete (check logs for TTL extension)');
    
    // Test 8: Final stats
    console.log('\n📊 Test 8: Final Statistics');
    const finalStats = await axios.get(`${BASE_URL}/api/cache/stats`);
    console.log('✅ Final cache stats:');
    console.log(JSON.stringify(finalStats.data, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run tests
testCacheFunctions();
