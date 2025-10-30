import { TannerAggregator } from "./Aggregator.js";

export async function getMarkets() {
  const agg = new TannerAggregator();
  return await agg.fetchAllMarkets();
}

// Example usage:
if (import.meta.url === `file://${process.argv[1]}`) {
  getMarkets().then(markets => {
    console.log(`Fetched ${markets.length} markets`);
    console.log(markets.slice(0, 5));
  });
}
