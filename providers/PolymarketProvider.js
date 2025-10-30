import { BaseProvider } from "../core/BaseProvider.js";
import { MarketModel } from "../core/MarketModel.js";

export class PolymarketProvider extends BaseProvider {
  constructor() {
    super("Polymarket");
    this.endpoint = "https://gamma-api.polymarket.com/markets";
  }

  async fetchMarkets() {
    try {
      const res = await fetch(this.endpoint);
      const data = await res.json();
      return data.map(m => this.normalizeMarket(m));
    } catch (err) {
      console.error("Polymarket fetch error:", err);
      return [];
    }
  }

  normalizeMarket(m) {
    return new MarketModel({
      id: m.id,
      title: m.question,
      provider: this.name,
      yesPrice: parseFloat(m.prices?.yes || 0),
      noPrice: parseFloat(m.prices?.no || 0),
      liquidity: m.liquidity || 0,
      volume24h: m.volume24h || 0,
      category: m.category,
      expiry: m.expiry
    });
  }
}
