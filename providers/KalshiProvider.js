import { BaseProvider } from "../core/BaseProvider.js";
import { MarketModel } from "../core/MarketModel.js";

export class KalshiProvider extends BaseProvider {
  constructor() {
    super("Kalshi");
    this.endpoint = "https://api.kalshi.com/v1/markets";
  }

  async fetchMarkets() {
    try {
      const res = await fetch(this.endpoint);
      const { markets } = await res.json();
      return markets.map(m => this.normalizeMarket(m));
    } catch (err) {
      console.error("Kalshi fetch error:", err);
      return [];
    }
  }

  normalizeMarket(m) {
    return new MarketModel({
      id: m.id,
      title: m.title,
      provider: this.name,
      yesPrice: m.yes_bid || 0,
      noPrice: m.no_ask || 0,
      liquidity: m.liquidity || 0,
      volume24h: m.volume_24h || 0,
      category: m.category,
      expiry: m.expiry
    });
  }
}
