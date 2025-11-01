import React, { useState, useEffect, useRef } from 'react';

// --- NEW: Web3 Constants ---
const USDC_CONTRACT_ADDRESS = '0x94a9D9AC8a22534E3FaCa422B7D3B74064fCaBf4'; // Sepolia USDC
const SMART_WALLET_ADDRESS = '0xB3C33d442469b432a44cB39787213D5f2C3f8c43'; // Your deployed contract!

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function withdrawUSDC(uint256 amount) external"
];


// --- API LOGIC (Category-based fetching) ---
export const fetchMarketsByCategory = async (category, setToastMessage) => {
  console.log(`Fetching markets for category: ${category}`);

  // Use special endpoint for Trending
  const API_URL = category.toLowerCase() === 'trending' 
    ? 'http://92.246.141.205:3001/api/markets/trending'
    : `http://92.246.141.205:3001/api/markets/${category}`;
  
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Successfully fetched ${data.length} markets for ${category}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch markets for ${category}:`, error);
    if (setToastMessage) {
      setToastMessage(`Error loading ${category} markets`);
    }
    return [];
  }
};

// --- NEW: Fetch live market price for trading ---
export const fetchLiveMarketPrice = async (marketId, setToastMessage) => {
  console.log(`🔴 Fetching LIVE price for market: ${marketId}`);

  const API_URL = `http://92.246.141.205:3001/api/market/${marketId}/live`;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`🔴 LIVE price fetched in ${data.fetchTime}ms`);
    return data.market;
  } catch (error) {
    console.error(`Failed to fetch live price for ${marketId}:`, error);
    if (setToastMessage) {
      setToastMessage(`Error loading live price`);
    }
    return null;
  }
};

// --- Legacy function (for backward compatibility) ---
export const fetchMarkets = async (setToastMessage) => {
  return fetchMarketsByCategory('All', setToastMessage);
};

// --- NEW: Custom hook for live price updates ---
function useLivePrice(marketId, refreshInterval = 5000) {
  const [liveMarket, setLiveMarket] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!marketId) return;

    let isMounted = true;

    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        const market = await fetchLiveMarketPrice(marketId);
        
        if (isMounted && market) {
          setLiveMarket(market);
          setLastUpdate(new Date());
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          console.error('Live price fetch error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchPrice();

    // Set up interval for auto-refresh
    const interval = setInterval(fetchPrice, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [marketId, refreshInterval]);

  return { liveMarket, lastUpdate, isLoading, error };
}

// --- Helper for Unique IDs (Fixes crypto.randomUUID() crash) ---
const generateUniqueId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// --- Mock Portfolio Data (for initial state) ---
const initialPositions = [
  { id: generateUniqueId(), marketId: 1, title: 'Will Donald Trump win the 2024 US election?', side: 'YES', shares: 192.31, avgPrice: 0.52, currentValue: 100, pnl: 0 },
  { id: generateUniqueId(), marketId: 3, title: 'Will Ethereum (ETH) be above $10,000 on Dec 31, 2025?', side: 'YES', shares: 161.29, avgPrice: 0.31, currentValue: 50, pnl: 0 },
  { id: generateUniqueId(), marketId: 5, title: 'Will the LA Lakers win the 2026 NBA Championship?', side: 'NO', shares: 58.82, avgPrice: 0.85, currentValue: 50, pnl: 0 },
];

const initialPortfolioBalance = {
  totalUSDC: 1250.75,
  totalValue: 1450.75,
  totalPnl: 200.00,
};

// --- Mock Order Book Data ---
const mockOrderBook = {
  bids: [ // Green
    { price: 0.51, size: 250.5 },
    { price: 0.50, size: 1000.0 },
    { price: 0.49, size: 800.7 },
    { price: 0.48, size: 1200.0 },
    { price: 0.47, size: 500.0 },
  ],
  asks: [ // Red
    { price: 0.52, size: 150.0 },
    { price: 0.53, size: 750.2 },
    { price: 0.54, size: 1200.0 },
    { price: 0.55, size: 600.0 },
    { price: 0.56, size: 300.0 },
  ]
};

// --- Mock News Data ---
const mockNews = [
  { id: 1, platform: 'Polymarket', text: 'New market on 2024 Election odds just listed.' },
  { id: 2, platform: 'Kalshi', text: 'Fed interest rate decision market resolving soon.' },
  { id: 3, platform: 'Limitless', text: 'Crypto volatility markets see record volume.' },
  { id: 4, platform: 'Polymarket', text: 'Market added for "Will Taylor Swift tour in 2025?".' },
  { id: 5, platform: 'Kalshi', text: 'Weekly jobless claims market now available.' },
  { id: 6, platform: 'Limitless', text: 'New BTC price target markets live.' },
];

// --- Mock Leaderboard Data ---
const mockLeaderboard = [
  { rank: 1, user: '0x1A2B...5C6D', volume: 542987, pnl: 18542.50 },
  { rank: 2, user: '0x8F9E...A1B2', volume: 498122, pnl: 12301.99 },
  { rank: 3, user: '0x34CD...F5E6', volume: 301098, pnl: 9876.15 },
  { rank: 4, user: '0x777A...000Z', volume: 210543, pnl: 5678.00 },
  { rank: 5, user: '0x123B...987C', volume: 195432, pnl: 4012.30 },
];

// --- Mock Referral Data ---
const mockReferralData = {
  referralCode: "TNR-SMART-9154",
  referredUsers: 7,
  totalEarnings: 154.32,
  commissionRate: '2%'
};


// --- Helper function for logos (FIXED IMAGE PATHS) ---
const getLogo = (platform) => {
  // Using placeholder logos (Twitter blocks direct image access)
  switch (platform) {
    case 'Limitless':
      return "https://placehold.co/32x32/3B82F6/FFFFFF?text=L";
    case 'Polymarket':
      return "https://placehold.co/32x32/8B5CF6/FFFFFF?text=P";
    case 'Kalshi':
      return "https://placehold.co/32x32/10B981/FFFFFF?text=K";
    default:
      return "https://placehold.co/24x24/808080/FFFFFF?text=?";
  }
};

// --- NEW: Mock Price Chart Data Generator ---
const generateChartData = () => {
  let data = [];
  let price = 0.5; // Starting price
  const startTime = new Date().getTime() - (100 * 30000); // 100 data points, 30 sec apart

  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 0.02;
    price += change;
    if (price > 0.99) price = 0.99;
    if (price < 0.01) price = 0.01;
    data.push({ time: startTime + (i * 30000), price: price });
  }
  return data;
};

// --- NEW: Mock Chart Data Fetcher ---
const fetchChartData = (marketId, platform) => {
    console.log(`Simulating fetch for ${platform} chart data (Market ID: ${marketId})...`);
    return new Promise(resolve => {
        setTimeout(() => {
            const chartData = generateChartData(platform);
            resolve(chartData);
        }, 1200); // Simulated network delay
    });
};


// --- END OF API LOGIC ---


// --- SVG Icon Components ---

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2zM2 16v2h4v-2H2z" clipRule="evenodd" />
  </svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

// --- NEW: Deposit/Withdraw Icons ---
const ArrowDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8l-8 8-8-8" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m-8 8l8-8 8 8" />
  </svg>
);

// --- NEW: Back arrow icon ---
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

// --- Icons for wallet button state ---
const LogOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- Icon for Modal Close Button ---
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// --- Icon for Toast Notification ---
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// --- NEW: Wallet Icons ---

const MetamaskIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 318 318" xmlns="http://www.w3.org/2000/svg">
    <path d="M272.58 128.168L220.08 72.368C213.68 65.568 205.28 61.468 196.28 60.868C194.98 60.768 193.68 60.768 192.38 60.768H191.08C182.28 60.768 174.08 64.068 167.68 69.868L127.38 106.168L96.18 72.568C89.58 65.768 81.18 61.668 72.28 60.968C70.98 60.868 69.68 60.768 68.38 60.768H67.08C58.28 60.768 50.08 64.068 43.68 69.868L14.08 96.668C11.18 99.368 9.18 102.568 7.38 105.768C3.58 112.568 1.48 120.368 0.78 128.568C0.58 130.468 0.38 132.368 0.28 134.368C0.18 136.268 0.18 138.168 0.18 140.068V142.168C0.18 153.768 3.58 164.868 10.08 174.168L70.78 261.268C76.98 270.068 85.38 276.568 94.98 280.068C103.78 283.168 113.18 284.168 122.28 282.768L123.68 282.568C126.38 282.168 129.08 281.668 131.68 280.968C143.08 278.268 153.28 272.468 161.38 264.068L212.08 210.068L247.98 241.568C253.98 246.968 261.38 250.368 269.28 251.268C270.58 251.468 271.98 251.568 273.28 251.568C282.08 251.568 290.28 248.268 296.68 242.468L313.68 226.768C315.98 224.668 317.08 221.768 317.08 218.868V190.168C317.08 186.268 315.98 182.468 314.08 179.168L272.58 128.168ZM257.08 199.168L247.98 207.368L215.78 177.868L257.08 133.068L284.98 179.168V199.168H257.08ZM171.18 122.968L193.38 102.368C195.18 100.768 197.68 100.768 199.38 102.368L209.68 111.768L171.18 146.968V122.968ZM107.08 118.968L84.88 139.568C83.08 141.168 80.58 141.168 78.88 139.568L68.58 130.168L107.08 94.968V118.968ZM41.88 113.668L62.78 94.568L92.28 120.768L62.78 147.268L41.88 128.468C39.08 125.868 39.08 121.468 41.88 118.868V118.868L41.88 113.668ZM105.68 263.868C101.38 265.968 96.58 266.968 91.78 266.668C86.78 266.368 81.98 264.868 77.88 262.168L48.28 234.868L88.98 197.868L121.38 233.668L105.68 263.868ZM273.28 235.668C272.08 235.668 270.88 235.468 269.68 235.168C266.18 234.468 263.08 232.868 260.68 230.168L228.48 194.268L272.58 146.368L296.68 218.868C297.88 220.868 298.18 223.368 297.38 225.668C296.48 228.068 294.58 229.968 292.18 230.868C286.08 233.268 279.48 234.768 272.78 235.568L273.28 235.668Z" fill="#E2761B"/>
    <path d="M212.08 210.068L161.38 264.068C153.28 272.468 143.08 278.268 131.68 280.968C129.08 281.668 126.38 282.168 123.68 282.568L122.28 282.768C113.18 284.168 103.78 283.168 94.98 280.068C85.38 276.568 76.98 270.068 70.78 261.268L10.08 174.168C3.58 164.868 0.18 153.768 0.18 142.168V140.068C0.18 138.168 0.18 136.268 0.28 134.368C0.38 132.368 0.58 130.468 0.78 128.568C1.48 120.368 3.58 112.568 7.38 105.768L10.08 102.168C10.68 101.168 11.28 100.268 11.98 99.368L14.08 96.668L43.68 69.868L62.78 94.568L41.88 113.668V118.868L41.88 128.468L62.78 147.268L92.28 120.768L68.58 130.168L78.88 139.568L84.88 139.568L107.08 118.968V94.968L171.18 146.968V122.968L209.68 111.768L199.38 102.368L193.38 102.368L171.18 122.968V122.968L127.38 106.168L167.68 69.868L191.08 60.768H192.38H196.28L220.08 72.368L272.58 128.168L314.08 179.168L284.98 179.168L257.08 133.068L215.78 177.868L247.98 207.368L257.08 199.168V190.168V186.268L272.58 146.368L228.48 194.268L260.68 230.168C263.08 232.868 266.18 234.468 269.68 235.168C270.88 235.468 272.08 235.668 273.28 235.668H273.28C279.48 234.768 286.08 233.268 292.18 230.868C294.58 229.968 296.48 228.068 297.38 225.668C298.18 223.368 297.88 220.868 296.68 218.868L272.58 146.368L228.48 194.268L260.68 230.168L273.28 235.668H273.28L296.68 242.468L313.68 226.768L317.08 218.868V190.168H257.08L247.98 207.368L215.78 177.868L257.08 133.068L284.98 179.168V199.168H257.08L247.98 207.368L212.08 210.068Z" fill="#E2761B"/>
    <path d="M121.38 233.668L88.98 197.868L48.28 234.868L77.88 262.168C81.98 264.868 86.78 266.368 91.78 266.668C96.58 266.968 101.38 265.968 105.68 263.868L121.38 233.668Z" fill="#E2761B"/>
    <path d="M107.08 118.968V94.968L68.58 130.168L78.88 139.568C80.58 141.168 83.08 141.168 84.88 139.568L107.08 118.968Z" fill="#233447"/>
    <path d="M171.18 122.968V146.968L209.68 111.768L199.38 102.368C197.68 100.768 195.18 100.768 193.38 102.368L171.18 122.968Z" fill="#CC6228"/>
    <path d="M62.78 94.568L41.88 113.668C39.08 116.268 39.08 120.768 41.88 123.468V123.468L41.88 128.468L62.78 147.268L92.28 120.768L62.78 94.568Z" fill="#CC6228"/>
    <path d="M257.08 133.068L215.78 177.868L247.98 207.368L257.08 199.168V190.168C257.08 190.168 284.98 179.168 284.98 179.168L257.08 133.068Z" fill="#CC6228"/>
    <path d="M228.48 194.268L260.68 230.168C263.08 232.868 266.18 234.468 269.68 235.168C270.88 235.468 272.08 235.668 273.28 235.668H273.28C279.48 234.768 286.08 233.268 292.18 230.868C294.58 229.968 296.48 228.068 297.38 225.668C298.18 223.368 297.88 220.868 296.68 218.868L272.58 146.368L228.48 194.268Z" fill="#E2761B"/>
    <path d="M105.68 263.868L121.38 233.668L88.98 197.868L48.28 234.868L77.88 262.168C81.98 264.868 86.78 266.368 91.78 266.668C96.58 266.968 101.38 265.968 105.68 263.868Z" fill="#F6851B"/>
  </svg>
);

const OKXIcon = () => (
  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.288 14.43v-4.86L16.8 4.08h-4.86l-2.71 2.71v.006H4.37v4.86l5.49 5.49h4.86l2.71-2.71V14.43h4.858zm-4.86-2.43h-2.43v-2.43h2.43v2.43zm-4.86-4.86h-2.43V4.71h2.43v2.43zm-2.43 4.86H7.71v-2.43h2.43v2.43zm2.43 4.86h2.43v2.43h-2.43v-2.43zm2.43-2.43v2.43h2.43v-2.43h-2.43zm4.86 4.86h-2.43v2.43h2.43v-2.43zm-2.43-4.86H16.8v-2.43h-2.43v2.43zm-4.86 2.43v-2.43H7.71v2.43h2.43zm4.86 0h2.43v2.43h-2.43v-2.43zM12.54 9.57H9.57V7.14h2.97v2.43zm2.43 0h2.43v2.43h-2.43V9.57zM9.57 12h2.97v2.43H9.57V12zm4.86 0v2.43h-2.43V12h2.43zM1.71 9.57h2.43v4.86H1.71V9.57zm18.15 0h2.43v4.86h-2.43V9.57zM7.14 1.71h4.86v2.43H7.14V1.71zm9.72 0h-2.43v2.43h2.43V1.71zm-4.86 18.15h-4.86v2.43h4.86v-2.43z"/>
  </svg>
);

const RabbyIcon = () => (
  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.6 13.9C3.6 10.9 5.2 8.3 7.8 6.9C10.4 5.5 13.6 5.6 16.1 7.2L24.1 12.3L32.1 7.2C34.6 5.6 37.8 5.5 40.4 6.9C43 8.3 44.6 10.9 44.6 13.9V22.2L34.2 28.3V19.6C34.2 18.9 33.9 18.2 33.3 17.8L25.3 12.7C24.7 12.3 23.5 12.3 22.9 12.7L14.9 17.8C14.3 18.2 14 18.9 14 19.6V28.3L3.6 22.2V13.9Z"/>
    <path d="M34.2 31.5V40.2C34.2 40.9 33.9 41.6 33.3 42L25.3 47.1C24.7 47.5 23.5 47.5 22.9 47.1L14.9 42C14.3 41.6 14 40.9 14 40.2V31.5L24.1 37.6L34.2 31.5Z"/>
  </svg>
);


// ====================================================================
// START OF COMPONENTS (Defined before App)
// ====================================================================

// --- Custom Hook for Simulated Live Data (FIXED) ---
function useSimulatedWebSocket(markets, setMarkets, handleAddNotification) {
  // FIX: Use useRef to prevent re-renders from breaking the interval
  const marketsRef = useRef(markets);
  const setMarketsRef = useRef(setMarkets);
  const handleAddNotificationRef = useRef(handleAddNotification);
  
  // Update refs whenever props change
  useEffect(() => {
    marketsRef.current = markets;
    setMarketsRef.current = setMarkets;
    handleAddNotificationRef.current = handleAddNotification;
  }, [markets, setMarkets, handleAddNotification]);

  useEffect(() => {
    // Only start the websocket simulation if markets are loaded
    if (marketsRef.current.length === 0) {
      return;
    }

    const SIMULATED_WS_URL = 'wss://simulated-market-stream.tanner.xyz';

    const generatePriceUpdate = () => {
      const currentMarkets = marketsRef.current;
      if (currentMarkets.length === 0) return null;

      const randomMarket = currentMarkets[Math.floor(Math.random() * currentMarkets.length)];
      if (!randomMarket || !Array.isArray(randomMarket.outcomes) || randomMarket.outcomes.length === 0) return null;
      
      const randomOutcome = randomMarket.outcomes[Math.floor(Math.random() * randomMarket.outcomes.length)];
      if (typeof randomOutcome.price !== 'number') return null;
      
      const change = (Math.random() - 0.5) * 0.01; 
      let newPrice = Math.max(0.01, Math.min(0.99, randomOutcome.price + change));

      return {
        marketId: randomMarket.id,
        outcomeName: randomOutcome.name,
        newPrice: parseFloat(newPrice.toFixed(4)),
        timestamp: Date.now()
      };
    };

    let isConnected = false;
    let updateInterval;

    const simulateConnect = () => {
      console.log(`[WS] Attempting to connect to ${SIMULATED_WS_URL}...`);
      
      setTimeout(() => {
        isConnected = true;
        console.log("[WS] Connected. Starting data stream.");
        if (handleAddNotificationRef.current) {
          handleAddNotificationRef.current("Market data stream established.");
        }

        updateInterval = setInterval(sendUpdate, 1000);
      }, 1500);
    };

    const sendUpdate = () => {
      const update = generatePriceUpdate();
      if (update) {
        processMessage(update);
      }
    };

    const processMessage = (update) => {
      if (setMarketsRef.current) {
        setMarketsRef.current(prevMarkets => {
          let updated = false;
          const newMarkets = prevMarkets.map(m => {
            if (m.id === update.marketId) {
              const newOutcomes = m.outcomes.map(o => {
                if (o.name === update.outcomeName) {
                  updated = true;
                  return { ...o, price: update.newPrice };
                }
                return o;
              });
              
              newOutcomes.sort((a, b) => b.price - a.price);
              return { ...m, outcomes: newOutcomes };
            }
            return m;
          });
          return updated ? newMarkets : prevMarkets;
        });
      }
    };

    simulateConnect();
    
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      console.log("[WS] Disconnected.");
    };

  }, []); // Run only once when component mounts
}


// --- NEW: Simulated Price Chart Component ---
function SimulatedPriceChart({ data }) {
  // A simple SVG chart. A real app would use a library like lightweight-charts.
  const svgWidth = 500;
  const svgHeight = 300;

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1; // Prevent division by zero

  // Create path string
  const path = data.map((d, i) => {
    const x = (i / (data.length - 1)) * svgWidth;
    const y = svgHeight - ((d.price - minPrice) / priceRange) * svgHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
        <path
          d={path}
          fill="none"
          stroke="#3B82F6" // Blue-600
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

// --- Simulated Order Book Component ---
function SimulatedOrderBook({ onPriceClick }) {
  const {bids, asks} = mockOrderBook;

  return (
    <div className="mt-1 bg-gray-800 rounded-lg border border-gray-700 h-72 overflow-hidden text-sm">
      {/* Header */}
      <table className="w-full table-fixed">
        <thead className="sticky top-0 bg-gray-800 z-10">
          <tr className="text-gray-500">
            <th className="w-1/3 font-medium p-1 text-left">Price ($)</th>
            <th className="w-1/3 font-medium p-1 text-right">Size</th>
            <th className="w-1/3 font-medium p-1 text-right">Total</th>
          </tr>
        </thead>
      </table>
      {/* Scrollable Body */}
      <div className="h-full overflow-y-auto -mt-8 pt-8"> {/* Adjust for sticky header */}
        <table className="w-full table-fixed">
          <tbody className="divide-y divide-gray-700/50">
            {/* Asks (Red) */}
            {[...asks].reverse().map(ask => (
              <tr
                key={`ask-${ask.price}`}
                className="hover:bg-red-900/20 relative cursor-pointer"
                onClick={() => onPriceClick(ask.price)}
              >
                <td className="w-1/3 p-1.5 text-red-400 text-left">{ask.price.toFixed(2)}</td>
                <td className="w-1/3 p-1.5 text-gray-300 text-right">{ask.size.toFixed(1)}</td>
                <td className="w-1/3 p-1.5 text-gray-300 text-right relative">
                  <div
                    className="absolute top-0 right-0 h-full bg-red-500/10 -z-10"
                    style={{ width: `${Math.min(100, (ask.size / 1500) * 100)}%` }}
                  ></div>
                  {(ask.price * ask.size).toFixed(1)}
                </td>
              </tr>
            ))}

            {/* Current Price */}
            <tr className="bg-gray-700 sticky top-0 bottom-0">
              <td colSpan="3" className="p-2 text-center text-white font-bold text-base">
                ${(bids[0].price + 0.01).toFixed(2)}
              </td>
            </tr>

            {/* Bids (Green) */}
            {bids.map(bid => (
              <tr
                key={`bid-${bid.price}`}
                className="hover:bg-green-900/20 relative cursor-pointer"
                onClick={() => onPriceClick(bid.price)}
              >
                <td className="w-1/3 p-1.5 text-green-400 text-left">{bid.price.toFixed(2)}</td>
                <td className="w-1/3 p-1.5 text-gray-300 text-right">{bid.size.toFixed(1)}</td>
                <td className="w-1/3 p-1.5 text-gray-300 text-right relative">
                  <div
                    className="absolute top-0 right-0 h-full bg-green-500/10 -z-10"
                    style={{ width: `${Math.min(100, (bid.size / 1500) * 100)}%` }}
                  ></div>
                  {(bid.price * bid.size).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// --- RENAMED: TradePanel Component (was TradeConfirmModal) ---
function TradePanel({ market, side, onSubmit, onSideChange, userAddress, onConnectWallet, portfolioBalance, setToastMessage, handleAddNotification, selectedOutcome }) {
  const [tradeType, setTradeType] = useState('Market');
  const [marketAmount, setMarketAmount] = useState(''); 
  const [limitPrice, setLimitPrice] = useState('');   
  const [limitShares, setLimitShares] = useState('');   

  // NEW: Fetch live prices for trading (auto-refreshes every 5 seconds)
  const { liveMarket, lastUpdate, isLoading, error } = useLivePrice(market?.id, 5000);

  // Use live market data if available, otherwise fall back to cached market
  const activeMarket = liveMarket || market;
  const activeOutcome = liveMarket 
    ? liveMarket.outcomes.find(o => o.name === selectedOutcome?.name) || selectedOutcome
    : selectedOutcome;

  // Calculate trade price based on live data
  const tradePrice = React.useMemo(() => {
    if (!activeOutcome) return 0;
    return (side === 'YES') ? activeOutcome.price : (1 - activeOutcome.price);
  }, [activeOutcome, side]);

  useEffect(() => {
    if (activeOutcome) {
      setTradeType('Market');
      setMarketAmount('');
      setLimitShares('');
      setLimitPrice(tradePrice.toFixed(2));
    }
  }, [activeOutcome, side, tradePrice]);

  if (!market || !selectedOutcome) return null; // Safety check

  // Calculate time since last update
  const timeSinceUpdate = lastUpdate 
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  const marketPayout = (marketAmount > 0 && tradePrice > 0) ? (marketAmount / tradePrice).toFixed(2) : 0;
  const limitCost = (limitPrice > 0 && limitShares > 0) ? (limitPrice * limitShares).toFixed(2) : 0;

  const handleSubmit = () => {
    if (!userAddress) {
      setToastMessage("Please connect wallet first.");
      onConnectWallet(); // Open the connect modal
      return;
    }
    
    if (typeof window.ethers === 'undefined') {
      setToastMessage("Web3 library not loaded. Cannot process trade.");
      return;
    }
    
    let tradeDetails = {};
    if (tradeType === 'Market') {
      tradeDetails = {
        tradeType: 'Market',
        amount: parseFloat(marketAmount),
        shares: parseFloat(marketPayout),
        limitPrice: null,
      };
    } else {
      tradeDetails = {
        tradeType: 'Limit',
        amount: parseFloat(limitCost), 
        shares: parseFloat(limitShares),
        limitPrice: parseFloat(limitPrice),
      };
    }
    
    // Validation
    if (portfolioBalance.totalUSDC < tradeDetails.amount) {
      handleAddNotification("Trade failed: Insufficient funds.");
      setToastMessage("Insufficient USDC balance!");
      return;
    }
    
    onSubmit(tradeDetails);
    
    setMarketAmount('');
    setLimitShares('');
  };

  const handlePriceClick = (price) => {
    setLimitPrice(price.toFixed(2));
  };

  const isMarketSubmitDisabled = !marketAmount || parseFloat(marketAmount) <= 0;
  const isLimitSubmitDisabled = !limitPrice || parseFloat(limitPrice) <= 0 || !limitShares || parseFloat(limitShares) <= 0;
  
  // FIX: Button color was reversed
  const buttonClass = side === 'YES' 
    ? 'bg-green-600 hover:bg-green-700' 
    : 'bg-red-600 hover:bg-red-700';

  return (
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl w-full p-6 relative"
      >
        {/* --- NEW: LIVE Price Indicator --- */}
        <div className="mb-4 flex items-center justify-between bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center space-x-2">
            {isLoading ? (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Loading live prices...</span>
              </>
            ) : error ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs text-red-400">Using cached prices</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400 font-medium">🔴 LIVE</span>
              </>
            )}
          </div>
          {lastUpdate && !isLoading && (
            <span className="text-xs text-gray-500">
              Updated {timeSinceUpdate}s ago
            </span>
          )}
        </div>

        {/* --- NEW: YES/NO Side Toggle --- */}
        <div className="flex w-full bg-gray-800 rounded-lg p-1 mb-6">
          <button
            onClick={() => onSideChange(activeOutcome, 'YES')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${side === 'YES' ? 'bg-green-600/80 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            YES
          </button>
          <button
            onClick={() => onSideChange(activeOutcome, 'NO')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${side === 'NO' ? 'bg-red-600/80 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            NO
          </button>
        </div>

        <div className="flex w-full bg-gray-800 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTradeType('Market')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${tradeType === 'Market' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Market
          </button>
          <button
            onClick={() => setTradeType('Limit')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${tradeType === 'Limit' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Limit
          </button>
        </div>

        {tradeType === 'Market' ? (
          <div className="w-full space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400">Amount to Pay (USDC)</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  value={marketAmount}
                  onChange={(e) => setMarketAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-full pl-4 pr-16 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">USDC</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400">Est. Payout (Shares)</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={marketPayout}
                  disabled
                  className="w-full pl-4 pr-16 py-3 bg-gray-800 text-gray-400 rounded-lg border border-gray-700"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">SHARES</span>
              </div>
            </div>

            <div className="text-sm text-gray-400 flex justify-between pt-2">
              <span>Price per Share</span>
              <span className="text-white font-medium">${tradePrice.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row space-x-0 md:space-x-4 space-y-4 md:space-y-0">
              <div className="w-full md:w-1/2">
                <label className="text-xs font-medium text-gray-400">Limit Price ($)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-4 pr-10 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">$</span>
                </div>
              </div>
              <div className="w-full md:w-1/2">
                <label className="text-xs font-medium text-gray-400">Amount (Shares)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={limitShares}
                    onChange={(e) => setLimitShares(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    step="any"
                    className="w-full pl-4 pr-10 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">S</span>
                </div>
              </div>
            </div>
             <div className="text-sm text-gray-400 flex justify-between pt-2">
                <span>Est. Total Cost</span>
                <span className="text-white font-medium">${limitCost}</span>
              </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Order Book (Simulated)</label>
              <SimulatedOrderBook onPriceClick={handlePriceClick} />
            </div>
          </div>
        )}

        <div className="text-sm text-gray-400 space-y-2 mt-6">
          <div className="flex justify-between">
            <span>Est. Fee</span>
            <span className="text-white font-medium">$0.15 (Simulated)</span>
          </div>
        </div>

        {/* --- UPDATED: Connect Wallet / Submit Button --- */}
        {!userAddress ? (
          <button
            onClick={onConnectWallet}
            className="w-full py-3 mt-6 rounded-lg font-semibold text-white transition-colors bg-blue-800 hover:bg-blue-700"
          >
            Connect Wallet to Trade
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={tradeType === 'Market' ? isMarketSubmitDisabled : isLimitSubmitDisabled}
            className={`w-full py-3 mt-6 rounded-lg font-semibold text-white transition-colors
              ${(tradeType === 'Market' ? isMarketSubmitDisabled : isLimitSubmitDisabled)
                ? 'bg-gray-700 cursor-not-allowed'
                : buttonClass
              }
            `}
          >
            {tradeType === 'Market' ? 'Confirm Trade' : 'Place Limit Order'}
          </button>
        )}

      </div>
  );
}

// --- OutcomeRow Component ---
function OutcomeRow({ outcome, onSelectOutcome }) {
  const price = outcome.price || 0;
  const noPrice = 1 - price;
  const priceCents = (price * 100).toFixed(0);
  const noPriceCents = (noPrice * 100).toFixed(0);

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50">
      <td className="p-4">
        <div className="font-medium text-white">{outcome.name}</div>
      </td>
      <td className="p-4 text-center">
        <span className="font-bold text-2xl text-white">{priceCents}¢</span>
      </td>
      <td className="p-4 space-x-2 text-right">
        <button 
          onClick={() => onSelectOutcome(outcome, 'YES')}
          className="bg-green-600/20 hover:bg-green-600/40 text-green-300 font-medium py-2 px-5 rounded-lg transition-colors"
        >
          Buy Yes {priceCents}¢
        </button>
        <button 
          onClick={() => onSelectOutcome(outcome, 'NO')}
          className="bg-red-600/20 hover:bg-red-600/40 text-red-300 font-medium py-2 px-5 rounded-lg transition-colors"
        >
          Buy No {noPriceCents}¢
        </button>
      </td>
    </tr>
  );
}

// --- Market Detail Page Component ---
function MarketDetailPage({ 
  market, 
  onBack, 
  onSubmit, 
  userAddress, 
  onConnectWallet, 
  setToastMessage, 
  handleAddNotification, 
  portfolioBalance,
  selectedOutcome,
  onSelectOutcome,
  tradeSide,
  onCloseTradePanel
}) {
  
  if (!market || !Array.isArray(market.outcomes)) {
    return (
      <main className="flex-1 overflow-y-auto p-8 flex justify-center items-center">
         <p className="text-gray-400">Market data not found.</p>
      </main>
    );
  }

  const isBinary = market.outcomes.length === 2 && market.outcomes.some(o => o.name === 'Yes') && market.outcomes.some(o => o.name === 'No');

  return (
    <main className="flex-1 overflow-y-auto p-8">
      {/* Back Button */}
      <button onClick={onBack} className="flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 mb-4">
        <ArrowLeftIcon />
        <span>Back to All Markets</span>
      </button>

      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <img
          src={getLogo(market.platform)}
          alt={market.platform}
          className="w-8 h-8 rounded-full"
          style={market.platform === 'Kalshi' ? { backgroundColor: 'white' } : {}}
        />
        <h1 className="text-3xl font-bold text-white">{market.title}</h1>
      </div>

      {/* Main Grid: Chart/Details on Left, Trade Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Price Chart */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              {isBinary ? '7-Day Probability Chart' : '7-Day Odds Chart'}
            </h2>
            <SimulatedPriceChart data={generateChartData()} /> {/* Fallback for live data */}
          </div>

          {/* Outcomes List */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg">
            <h2 className="text-xl font-semibold text-white p-6 border-b border-gray-800">
              Outcomes
            </h2>
            <table className="w-full table-auto">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase">Outcome</th>
                  <th className="p-4 text-center text-xs font-medium text-gray-400 uppercase">% Chance</th>
                  <th className="p-4 text-right text-xs font-medium text-gray-400 uppercase">Trade</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(market.outcomes) && market.outcomes.map(outcome => (
                  <OutcomeRow 
                    key={outcome.id || outcome.name} 
                    outcome={outcome} 
                    onSelectOutcome={onSelectOutcome} 
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (Trade Panel) */}
        <div className="lg:col-span-1">
          {selectedOutcome ? (
            <TradePanel
              selectedOutcome={selectedOutcome}
              side={tradeSide}
              onSideChange={onSelectOutcome}
              onSubmit={onSubmit}
              userAddress={userAddress}
              onConnectWallet={onConnectWallet}
              setToastMessage={setToastMessage}
              handleAddNotification={handleAddNotification}
              portfolioBalance={portfolioBalance}
              onClose={onCloseTradePanel}
            />
          ) : (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 text-center text-gray-400">
              <p>Select an outcome to begin trading.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// --- Components for Portfolio Page ---
function ConnectWalletPrompt({ onConnect }) {
  return (
    <main className="flex-1 overflow-y-auto p-8 flex justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-4">View Your Portfolio</h2>
        <p className="text-gray-400 mb-6">Connect your wallet to see your smart wallet balance and open positions.</p>
        <button
          onClick={onConnect}
          className="bg-blue-800 text-white hover:bg-blue-700 transition-colors duration-200 px-6 py-3 rounded-lg font-medium shadow flex items-center space-x-2 mx-auto"
        >
          <span>Connect Wallet</span>
        </button>
      </div>
    </main>
  );
}

// --- PositionRow Component ---
function PositionRow({ position, onClosePosition }) { 
  const sideClass = position.side === 'YES'
    ? 'text-green-400 bg-green-500/10'
    : 'text-red-400 bg-red-500/10';

  const pnlClass = position.pnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <tr className="hover:bg-gray-900/40 transition-colors">
      <td className="px-4 py-4 text-sm text-white max-w-xs truncate">
        {position.title}
        <span className="block text-xs text-gray-400">Outcome: {position.outcomeName}</span>
      </td>
      <td className="px-4 py-4 text-sm">
        <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${sideClass}`}>
          {position.side}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-gray-300">{position.shares ? position.shares.toFixed(2) : 'N/A'}</td>
      <td className="px-4 py-4 text-sm text-gray-300">${position.avgPrice ? position.avgPrice.toFixed(2) : 'N/A'}</td>
      <td className={`px-4 py-4 text-sm text-white font-medium`}>${position.currentValue ? position.currentValue.toFixed(2) : 'N/A'}</td>
      <td className={`px-4 py-4 text-sm font-medium ${pnlClass}`}>
        {position.pnl ? (position.pnl >= 0 ? '+' : '') + position.pnl.toFixed(2) : 'N/A'}
      </td>
      <td className="px-4 py-4 text-sm text-center">
        <button
          onClick={() => onClosePosition(position)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1 px-3 rounded-lg transition-colors"
        >
          Close
        </button>
      </td>
    </tr>
  );
}

// --- OpenOrderRow Component ---
function OpenOrderRow({ order, onCancel }) {
  const sideClass = order.side === 'YES'
    ? 'text-green-400'
    : 'text-red-400';

  const logoUrl = getLogo(order.platform); 

  return (
    <tr className="hover:bg-gray-900/40 transition-colors">
      <td className="px-4 py-4 text-sm text-white max-w-xs truncate">
        {order.marketTitle}
        <span className="block text-xs text-gray-400">Outcome: {order.outcomeName}</span>
      </td>
      <td className="px-4 py-4 text-sm text-gray-400">
        <img
          src={logoUrl}
          alt={order.platform}
          className="w-5 h-5 rounded-full inline-block mr-2"
          style={order.platform === 'Kalshi' ? { backgroundColor: 'white' } : {}}
        />
        {order.platform}
      </td>
      <td className="px-4 py-4 text-sm font-medium">
        <span className={sideClass}>
          {order.side}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-gray-300">${order.price ? order.price.toFixed(2) : 'N/A'}</td>
      <td className="px-4 py-4 text-sm text-gray-300">{order.shares ? order.shares.toFixed(2) : 'N/A'}</td>
      <td className="px-4 py-4 text-sm text-white font-medium">${order.cost ? order.cost.toFixed(2) : 'N/A'}</td>
      <td className="px-4 py-4 text-sm text-center">
        <button
          onClick={() => onCancel(order.id)}
          className="text-gray-500 hover:text-red-400 transition-colors"
          title="Cancel Order"
        >
          <XIcon />
        </button>
      </td>
    </tr>
  );
}

// --- PortfolioPage Component ---
function PortfolioPage({ balance, positions, openOrders, onCancelOrder, onDeposit, onWithdraw, onLinkAccounts, onClosePosition }) { 

  const totalPnlColor = balance?.totalPnl >= 0 ? 'text-green-400' : 'text-red-400';

  const positionsValue = positions.reduce((acc, pos) => acc + (pos.currentValue || 0), 0);
  const calculatedTotalValue = (balance?.totalUSDC || 0) + positionsValue;
  const displayTotalUSDC = (balance?.totalUSDC || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const displayTotalPnl = (balance?.totalPnl || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <h1 className="text-3xl font-bold text-white mb-8">My Portfolio</h1>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`bg-gray-950 border border-gray-800 rounded-lg p-6`}>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Portfolio Value</h3>
          <p className="text-3xl font-semibold text-white">${calculatedTotalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Smart Wallet Balance (USDC)</h3>
          <p className="text-3xl font-semibold text-white">${displayTotalUSDC}</p>
          <div className="flex space-x-2 mt-4">
            <button onClick={onDeposit} className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
              <ArrowDownIcon />
              <span>Deposit</span>
            </button>
            <button onClick={onWithdraw} className="flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
              <ArrowUpIcon />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        <div className={`bg-gray-950 border border-gray-800 rounded-lg p-6`}>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total P&L</h3>
          <p className={`text-3xl font-semibold ${totalPnlColor}`}>
            {(balance?.totalPnl || 0) >= 0 ? '+' : ''}{displayTotalPnl}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <button
          onClick={onLinkAccounts}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          &rarr; Or, link your existing accounts
        </button>
      </div>

      {/* Open Positions Table */}
      <h2 className="text-2xl font-bold text-white mb-6">Open Positions</h2>
      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full table-auto"><thead className="border-b border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Market</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Side</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Shares</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Avg. Price</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Current Value</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">P&L</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th> 
          </tr>
        </thead><tbody className="divide-y divide-gray-800">
          {positions.map(pos => (
            <PositionRow
              key={pos.id}
              position={pos}
              onClosePosition={onClosePosition} 
            />
          ))}
          {positions.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center py-8 text-gray-500">You have no open positions.</td> 
            </tr>
          )}
        </tbody></table>
      </div>

      {/* Open Limit Orders Table */}
      <h2 className="text-2xl font-bold text-white mt-8 mb-4">Open Orders</h2>
      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full table-auto"><thead className="border-b border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Market</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Platform</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Side</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Price</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Shares</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cost</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase"></th>
          </tr>
        </thead><tbody className="divide-y divide-gray-800">
          {openOrders.map(order => (
            <OpenOrderRow key={order.id} order={order} onCancel={onCancelOrder} />
          ))}
          {openOrders.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center py-8 text-gray-500">You have no open limit orders.</td>
            </tr>
          )}
        </tbody></table>
      </div>
    </main>
  );
}

// --- PortfolioOnboarding Component ---
function PortfolioOnboarding({ onCreateSmartWallet, onLinkAccounts }) {
  return (
    <main className="flex-1 overflow-y-auto p-8 flex justify-center items-center">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-3xl font-bold text-white mb-4">Welcome to your Portfolio</h2>
        <p className="text-gray-400 mb-8">
          Choose how you want to manage your funds. Create a new, secure smart wallet for a seamless experience, or link your existing accounts.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button
            onClick={onCreateSmartWallet}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium shadow hover:bg-blue-700 transition-colors duration-200"
          >
            Create Tanner Smart Wallet
          </button>
          <button
            onClick={onLinkAccounts}
            className="bg-gray-700 text-white px-6 py-3 rounded-lg font-medium shadow hover:bg-gray-600 transition-colors duration-200"
          >
            Link Existing Accounts
          </button>
        </div>
      </div>
    </main>
  );
}

// --- LinkAccountsPage Component ---
function LinkAccountsPage({ onBack }) {
  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 mb-4">
          <ArrowLeftIcon />
          <span>Back to Portfolio</span>
        </button>
        <h1 className="text-3xl font-bold text-white mb-6">Link Existing Accounts</h1>

        <div className="space-y-4">
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Polymarket & Limitless</h2>
            <p className="text-sm text-gray-400 mb-4">
              Your connected wallet (0x...) is already linked to these platforms.
            </p>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg font-medium cursor-not-allowed" disabled>
              Connected
            </button>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Kalshi (KYC Required)</h2>
            <p className="text-sm text-gray-400 mb-4">
              Please enter your Kalshi API keys to link your account.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Kalshi API Key"
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Kalshi Secret Key"
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium mt-4 transition-colors">
              Link Kalshi Account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Leaderboard Page ---
function LeaderboardPage({ leaderboardData }) { 
  return (
    <main className="flex-1 overflow-y-auto p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Leaderboard: Top Traders</h1>

      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden max-w-3xl">
        <table className="w-full table-auto">
          <thead className="border-b border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total P&L</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {leaderboardData.map((trader, index) => ( 
              <tr key={trader.rank} className="hover:bg-gray-900/40 transition-colors">
                <td className="px-4 py-4 text-sm font-bold text-blue-400">{trader.rank}</td>
                <td className="px-4 py-4 text-sm text-white">{trader.user}</td>
                <td className={`px-4 py-4 text-sm font-medium ${trader.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-300">${trader.volume.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-500">Note: Data is simulated for demonstration purposes.</p>
    </main>
  );
}

// --- Referrals Page ---
function ReferralsPage({setToastMessage}) {
  const { referralCode, referredUsers, totalEarnings, commissionRate } = mockReferralData;

  const copyToClipboard = () => {
    try {
      const tempElement = document.createElement('textarea');
      tempElement.value = referralCode;
      document.body.appendChild(tempElement);
      tempElement.select();
      document.execCommand('copy');
      document.body.removeChild(tempElement);
      setToastMessage(`Copied code to clipboard!`);   
    } catch (err) {
      setToastMessage('Could not copy text.');
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Referrals</h1>

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 max-w-3xl">
        <h2 className="text-xl font-semibold text-white mb-4">Your Referral Link</h2>

        <div className="flex flex-col md:flex-row items-center gap-4 bg-gray-900 border border-gray-700 p-4 rounded-lg mb-6">
          <code className="flex-1 text-lg font-mono text-blue-400 truncate bg-transparent border-none outline-none">
            {referralCode}
          </code>
          <button
            onClick={copyToClipboard}
            className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Copy Link
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-8">
          Share your unique referral code with friends. You will earn {commissionRate} commission on their platform trading fees.
        </p>

        <h2 className="text-xl font-semibold text-white mb-4">Your Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Referred Users</p>
            <p className="text-2xl font-bold text-white mt-1">{referredUsers}</p>
          </div>
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Total Earnings</p>
            <p className="text-2xl font-bold text-green-400 mt-1">${totalEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Commission Rate</p>
            <p className="text-2xl font-bold text-white mt-1">{commissionRate}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Toast Notification Component ---
function ToastNotification({ message, show, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <div
      className={`fixed bottom-8 right-8 z-50 transition-all duration-300
        ${show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-center bg-gray-950 border border-gray-700 rounded-lg shadow-lg p-4">
        <CheckCircleIcon />
        <span className="ml-3 text-white font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 text-gray-500 hover:text-white">
          <XIcon />
        </button>
      </div>
    </div>
  );
}

// --- Notification Dropdown Component ---
function NotificationDropdown({ isOpen, onClose, notifications }) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 right-6 z-40 w-80 bg-gray-950 border border-gray-800 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Notifications</h3>
      </div>
      <div className="flex flex-col-reverse max-h-96 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map(notif => (
            <div key={notif.id} className="p-4 border-b border-gray-800/50 hover:bg-gray-900">
              <p className="text-sm text-white">{notif.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(notif.time).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-gray-500 text-center">No new notifications.</p>
        )}
      </div>
    </div>
  );
}

// --- WalletConnectModal Component ---
function WalletConnectModal({ isOpen, onClose, onWalletSelect }) {
  if (!isOpen) return null;

  const walletOptions = [
    { name: 'Metamask', icon: <MetamaskIcon /> }, 
    { name: 'OKX', icon: <OKXIcon /> },    
    { name: 'Rabby', icon: <RabbyIcon /> },    
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <XIcon />
        </button>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Connect a Wallet</h2>
        <div className="space-y-4">
          {walletOptions.map(wallet => (
            <button
              key={wallet.name}
              onClick={() => onWalletSelect(wallet.name)}
              className="w-full flex items-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-white">{wallet.icon}</span>
              <span className="ml-4 text-lg font-medium text-white">{wallet.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- DepositWithdrawModal Component ---
function DepositWithdrawModal({ isOpen, onClose, modalType, onConfirm, portfolioBalance }) {
  const [amount, setAmount] = useState('');
  const title = modalType === 'deposit' ? 'Deposit USDC' : 'Withdraw USDC';
  const buttonText = modalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw';
  const maxAmount = modalType === 'deposit' ? null : (portfolioBalance?.totalUSDC || 0);

  useEffect(() => {
    if (isOpen) {
      setAmount(''); 
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      onConfirm(numAmount);
    }
  };
  
  const isWithdrawDisabled = modalType === 'withdraw' && (!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount);
  const isDepositDisabled = modalType === 'deposit' && (!amount || parseFloat(amount) <= 0);
  const isDisabled = modalType === 'deposit' ? isDepositDisabled : isWithdrawDisabled;


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <XIcon />
        </button>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{title}</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-gray-400">Amount (USDC)</label>
              {modalType === 'withdraw' && (
                <span className="text-xs text-gray-400">
                  Balance: ${(portfolioBalance.totalUSDC || 0).toFixed(2)}
                </span>
              )}
            </div>
            <div className="relative mt-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
                className="w-full pl-4 pr-16 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">USDC</span>
            </div>
            {/* Show error if trying to withdraw too much */}
            {modalType === 'withdraw' && parseFloat(amount) > maxAmount && (
              <p className="text-red-400 text-xs mt-1">Insufficient balance.</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`w-full py-3 mt-6 rounded-lg font-semibold text-white transition-colors ${
              (isDisabled)
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ClosePositionModal Component ---
function ClosePositionModal({ isOpen, onClose, position, market, onConfirmClose }) {
  const [closeType, setCloseType] = useState('Market'); 
  const [limitPrice, setLimitPrice] = useState('');
  const [limitShares, setLimitShares] = useState('');

  const outcome = market?.outcomes.find(o => o.name === position?.outcomeName);
  
  const marketSellPrice = (outcome && position)
    ? (position.side === 'YES' ? (1 - outcome.price) : outcome.price)
    : 0; 

  useEffect(() => {
    if (position) {
      setCloseType('Market');
      setLimitShares(position.shares.toFixed(2));
      setLimitPrice(marketSellPrice.toFixed(2));
    }
  }, [position, marketSellPrice]); 

  if (!isOpen || !position || !market || !outcome) return null;

  const estimatedProceeds = position.shares * marketSellPrice;
  const limitProceeds = (limitPrice > 0 && limitShares > 0) ? (limitPrice * limitShares).toFixed(2) : 0;
  
  const handleSubmit = () => {
    if (closeType === 'Market') {
      onConfirmClose({
        position,
        closeType: 'Market',
        shares: position.shares,
        price: marketSellPrice
      });
    } else {
      onConfirmClose({
        position,
        closeType: 'Limit',
        shares: parseFloat(limitShares),
        price: parseFloat(limitPrice)
      });
    }
  };
  
  const isLimitSubmitDisabled = !limitPrice || parseFloat(limitPrice) <= 0 || !limitShares || parseFloat(limitShares) <= 0 || parseFloat(limitShares) > position.shares;
  const oppositeSide = position.side === 'YES' ? 'NO' : 'YES';
  const sideColor = oppositeSide === 'YES' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <XIcon />
        </button>
        <h2 className="text-2xl font-bold text-white mb-2">Close Position</h2>
        <p className="text-sm text-gray-400 mb-6 truncate">Selling {position.shares ? position.shares.toFixed(2) : 'N/A'} shares of "{position.outcomeName || position.title}"</p>

        <div className="flex w-full bg-gray-800 rounded-lg p-1 mb-6">
          <button
            onClick={() => setCloseType('Market')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${closeType === 'Market' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Market Close
          </button>
          <button
            onClick={() => setCloseType('Limit')}
            className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${closeType === 'Limit' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Limit Close
          </button>
        </div>

        {closeType === 'Market' ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Shares to Sell</span>
              <span className="text-white font-medium">{position.shares ? position.shares.toFixed(2) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. Price per Share</span>
              <span className="text-white font-medium">${marketSellPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-400">Est. Proceeds</span>
              <span className="text-white font-bold">${estimatedProceeds.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label className="text-xs font-medium text-gray-400">Limit Price ($)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-full pl-4 pr-10 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">$</span>
                </div>
              </div>
              <div className="w-1/2">
                <label className="text-xs font-medium text-gray-400">Amount (Shares)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={limitShares}
                    onChange={(e) => setLimitShares(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    max={position.shares}
                    step="any"
                    className="w-full pl-4 pr-10 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">S</span>
                </div>
              </div>
            </div>
             {parseFloat(limitShares) > position.shares && (
               <p className="text-red-400 text-xs -mt-2">Cannot sell more shares than you own.</p>
             )}
             <div className="text-sm text-gray-400 flex justify-between pt-2">
                <span>Est. Total Proceeds</span>
                <span className="text-white font-medium">${limitProceeds}</span>
              </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={closeType === 'Limit' && isLimitSubmitDisabled}
          className={`w-full py-3 mt-6 rounded-lg font-semibold text-white transition-colors ${
            (closeType === 'Limit' && isLimitSubmitDisabled)
              ? 'bg-gray-700 cursor-not-allowed'
              : sideColor
          }`}
        >
          {closeType === 'Market' ? `Market Sell ${oppositeSide}` : `Place Limit Sell ${oppositeSide} Order`}
        </button>
      </div>
    </div>
  );
}


// --- Header Component ---
function Header({ navItems, activeNav, onNavClick, walletState, userAddress, onConnect, onDisconnect, onBellClick, notifCount }) {
  const getButtonClass = (item) => {
    return `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      activeNav === item
        ? 'bg-gray-800 text-white'
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    }`;
  };

  const renderWalletButton = () => {
    switch (walletState) {
      case 'connecting':
      case 'signingIn': 
        return (
          <button className="bg-gray-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 cursor-not-allowed">
            <SpinnerIcon />
            <span>Connecting...</span>
          </button>
        );
      case 'connected':
        return (
          <button
            onClick={onDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
          >
            <LogOutIcon />
            <span>{userAddress ? `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}` : 'Wallet'}</span>
          </button>
        );
      case 'idle':
      default:
        return (
          <button
            onClick={onConnect}
            className="bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
          >
            <WalletIcon />
            <span>Connect Wallet</span>
          </button>
        );
    }
  };

  return (
    <header className="bg-gray-950 border-b border-gray-800 sticky top-0 z-30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">
              Tanner<span className="text-blue-400">.xyz</span>
            </h1>
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <button
                  key={item}
                  onClick={() => onNavClick(item.toLowerCase())}
                  className={getButtonClass(item.toLowerCase())}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={onBellClick} className="relative text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700">
              <BellIcon />
              {notifCount > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {notifCount}
                </span>
              )}
            </button>
            {renderWalletButton()}
          </div>
        </div>
      </div>
    </header>
  );
}

// --- TickerTape Component ---
function TickerTape({ newsItems }) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 h-12 flex items-center overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {newsItems.concat(newsItems).map((item, index) => (
          <div key={index} className="flex items-center mx-6">
            <img
              src={getLogo(item.platform)}
              alt={item.platform}
              className="w-5 h-5 rounded-full mr-2"
              style={item.platform === 'Kalshi' ? { backgroundColor: 'white' } : {}}
            />
            <span className="text-sm text-gray-300">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MarketCard Component (FIXED) ---
function MarketCard({ market, onMarketClick }) {
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  
  // Find Yes/No for binary markets
  const yesOutcome = outcomes.find(o => o.name === 'Yes');
  const noOutcome = outcomes.find(o => o.name === 'No');
  const isBinary = yesOutcome && noOutcome;

  if (outcomes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-4 h-auto">
        <span className="text-xs text-gray-400 uppercase">{market.category}</span>
        <h3 className="text-sm font-medium text-gray-900 mt-2">{market.shortTitle || market.title}</h3>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    );
  }

  // Format volume with commas (user requested: $66,777,056)
  const formattedVolume = market.volume_24h 
    ? `$${Math.round(market.volume_24h).toLocaleString()}` 
    : '$0';

  // Handler to open trade panel for specific outcome
  const handleTradeClick = (e, outcome, side) => {
    e.stopPropagation(); // Prevent card click
    onMarketClick(market, outcome, side); // Pass outcome and side to parent
  };

  return (
    <div
      className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 h-auto"
      onClick={() => onMarketClick(market)}
      title={market.title} // Show full title on hover
    >
      {/* Header: Platform logo and title */}
      <div className="flex items-start gap-2 mb-3">
        <img
          src={getLogo(market.platform)}
          alt={market.platform}
          className="w-8 h-8 rounded-full flex-shrink-0 mt-1"
          style={market.platform === 'Kalshi' ? { backgroundColor: 'white', padding: '2px' } : {}}
        />
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight flex-1">
          {market.shortTitle || market.title}
        </h3>
      </div>

      {/* Outcomes Section */}
      <div className="space-y-2 mb-3">
        {isBinary ? (
          // Binary Yes/No Market - Show YES probability as main number
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-2xl font-bold text-gray-900">{(yesOutcome.price * 100).toFixed(0)}%</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={(e) => handleTradeClick(e, yesOutcome, 'YES')}
                className="px-3 py-1.5 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100 transition-colors"
              >
                Yes
              </button>
              <button 
                onClick={(e) => handleTradeClick(e, noOutcome, 'NO')}
                className="px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          // Multi-outcome Market (show top 2-3)
          outcomes.slice(0, 3).map((outcome, idx) => (
            <div key={idx} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-gray-600 truncate max-w-[100px]">{outcome.name}</span>
                <span className="text-sm font-bold text-gray-900">{(outcome.price * 100).toFixed(0)}%</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={(e) => handleTradeClick(e, outcome, 'YES')}
                  className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100 transition-colors"
                >
                  Yes
                </button>
                <button 
                  onClick={(e) => handleTradeClick(e, outcome, 'NO')}
                  className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: Volume and expand icon */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">{formattedVolume}</span>
        <button className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50">
          <span className="text-gray-600 text-xs">+</span>
        </button>
      </div>
    </div>
  );
}

// --- MarketListPage Component ---
function MarketListPage({ markets, onMarketClick, onCategoryChange, activeCategory, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const categories = ['Trending', 'All', 'Politics', 'Geopolitics', 'Crypto', 'Economics', 'Sports', 'World', 'Culture', 'Other'];

  // Filter only by search term (category filtering happens in backend)
  const filteredMarkets = markets
    .filter(m => m.title && m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <main className="flex-1 overflow-y-auto p-8">
      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full md:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              disabled={isLoading}
              className={`flex-shrink-0 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMarkets.length > 0 ? (
          filteredMarkets.map(market => (
            <MarketCard key={market.id} market={market} onMarketClick={onMarketClick} />
          ))
        ) : (
          <p className="text-gray-400 col-span-full text-center">
            {markets.length === 0 ? "Loading markets..." : "No markets found matching your criteria."}
          </p>
        )}
      </div>
    </main>
  );
}


// ====================================================================
// --- MAIN APP COMPONENT ---
// ====================================================================

// --- FIX: Moved Firebase globals outside the component ---
// They will be initialized *inside* useEffect to prevent race condition
let app;
let db;
let auth;

export default function App() {
  // --- State ---
  const [markets, setMarkets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('markets'); 
  
  // --- Trading State ---
  const [selectedMarket, setSelectedMarket] = useState(null); 
  const [selectedOutcome, setSelectedOutcome] = useState(null); 
  const [tradeSide, setTradeSide] = useState('YES'); 

  // --- Firestore/Auth State ---
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dbInstance, setDbInstance] = useState(null);
  const [authState, setAuthState] = useState(null); 
  const [isDataSeeded, setIsDataSeeded] = useState(false); 
  const currentUserId = authState?.uid;

  // Wallet & Portfolio State
  const [walletState, setWalletState] = useState('idle'); 
  const [userAddress, setUserAddress] = useState(null);
  const [portfolioOnboardingState, setPortfolioOnboardingState] = useState('prompt'); 
  const [portfolioBalance, setPortfolioBalance] = useState(initialPortfolioBalance); // Lives in Firestore
  const [positions, setPositions] = useState(initialPositions); // Lives in Firestore
  const [openOrders, setOpenOrders] = useState([]); // Lives in Firestore
  const [leaderboardData, setLeaderboardData] = useState(mockLeaderboard); 

  // --- Web3 State ---
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  
  // --- Modal State ---
  const [modalState, setModalState] = useState({ type: null, isOpen: false }); 
  const [closePositionState, setClosePositionState] = useState({ position: null, isOpen: false });

  const navItems = ['Markets', 'Portfolio', 'Leaderboard', 'Referrals'];

  // --- Handlers ---
  const handleAddNotification = (message) => {
    setNotifications(prev => [
      ...prev,
      { id: generateUniqueId(), message, time: Date.now() }
    ]);
  };

  // --- Firebase Auth & Setup (FIXED) ---
  useEffect(() => {
    // FIX: Read globals from window object *inside* useEffect
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    if (!firebaseConfig || !window.firebase || !window.firebase.app) {
      console.error("Firebase config or core library (firebase-app.js) is missing. Cannot initialize Firestore/Auth.");
      setIsLoading(false);
      return;
    }

    try {
      app = window.firebase.app.initializeApp(firebaseConfig);
      auth = window.firebase.auth.getAuth(app);
      db = window.firebase.firestore.getFirestore(app);
      window.firebase.firestore.setLogLevel('debug'); 
      console.log("Firebase Initialized Successfully.");
      setDbInstance(db); // Set the db instance in state
    } catch (error) {
      console.error("Firebase Initialization Failed:", error);
      setIsLoading(false);
      return;
    }

    const unsubscribe = window.firebase.auth.onAuthStateChanged(auth, async (user) => {
      setAuthState(user);
      setIsAuthReady(true);
      
      if (user) {
         console.log("Firebase Auth user signed in:", user.uid);
      } else {
         console.log("Firebase Auth user not signed in. Attempting anonymous sign-in...");
        try {
          await window.firebase.auth.signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous sign in failed:", e);
        }
      }
    });

    if (initialAuthToken) {
        window.firebase.auth.signInWithCustomToken(auth, initialAuthToken).catch(error => {
            console.error("Custom token sign in failed:", error);
        });
    } else if (!authState) {
        window.firebase.auth.signInAnonymously(auth).catch(e => {
            console.error("Initial anonymous sign in failed:", e);
        });
    }

    return () => {
      console.log("Unsubscribing from Firebase Auth listener.");
      unsubscribe();
    }
  }, []); // Run only once on mount

  // --- Portfolio Data Listener ---
  useEffect(() => {
    if (!dbInstance || !currentUserId || !isAuthReady) {
       if(isAuthReady) { 
           console.log("Firestore listener: Canceled. Missing db, userId, or auth state.", dbInstance, currentUserId, isAuthReady);
       }
       return;
    }
    console.log("Firestore listener: Attaching...");

    const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");

    // 1. Check if data exists and seed if necessary
    const seedInitialData = async () => {
        try {
            const docSnapshot = await window.firebase.firestore.getDoc(userDocRef);
            
            if (!docSnapshot.exists() && !isDataSeeded) { 
                console.log("Seeding initial portfolio data...");
                await window.firebase.firestore.setDoc(userDocRef, {
                    balance: initialPortfolioBalance,
                    positions: initialPositions,
                    openOrders: [],
                    isSeeded: true 
                });
                setIsDataSeeded(true);
                handleAddNotification("Initial portfolio loaded and saved.");
            } else if (docSnapshot.exists()) { 
                console.log("Firestore: Data already seeded.");
                setIsDataSeeded(true);
            }
        } catch (e) {
            console.error("Error checking or seeding portfolio data:", e);
        }
    };

    seedInitialData();

    // 2. Set up real-time listener
    console.log("Attaching Firestore real-time listener...");
    const unsubscribe = window.firebase.firestore.onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setPortfolioBalance(data.balance || initialPortfolioBalance);
            setPositions(data.positions || initialPositions);
            setOpenOrders(data.openOrders || []);
            console.log("Portfolio data updated from Firestore.");
        } else {
            console.warn("User portfolio document does not exist yet.");
        }
    }, (error) => {
        console.error("Firestore listener failed:", error);
    });

    return () => {
      console.log("Detaching Firestore listener.");
      unsubscribe();
    }
  }, [dbInstance, currentUserId, isAuthReady, isDataSeeded]); // Added isDataSeeded


  // --- Category State ---
  const [activeCategory, setActiveCategory] = useState('All');

  // --- Data Fetching (Markets by Category) ---
  useEffect(() => {
    const loadMarkets = async () => {
      setIsLoading(true);
      try {
        const data = await fetchMarketsByCategory(activeCategory, setToastMessage);
        if (Array.isArray(data)) {
            setMarkets(data);
        } else {
            console.error("Received non-array data from backend:", data);
            setMarkets([]);
        }
      } catch (error) {
        console.error("Failed to fetch markets:", error);
        handleAddNotification("Error fetching markets.", 'error');
        setMarkets([]); 
      }
      setIsLoading(false);
    };
    loadMarkets();
  }, [activeCategory]); // Re-fetch when category changes

  // --- Category Change Handler ---
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    handleAddNotification(`Loading ${category} markets...`);
  };


  // --- Live Price Update Stream ---
  useSimulatedWebSocket(markets, setMarkets, handleAddNotification);


  // --- Real Balance Fetching ---
  useEffect(() => {
    const fetchRealBalance = async () => {
        if (!signer || !dbInstance || !currentUserId || typeof window.ethers === 'undefined') {
            return;
        }

        try {
            const { ethers } = window;
            const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider);
            const userWalletAddress = await signer.getAddress();
            
            // Fetch connected wallet balance
            const rawBalance = await usdcContract.balanceOf(userWalletAddress);
            const decimals = 6; 
            const formattedBalance = parseFloat(ethers.utils.formatUnits(rawBalance, decimals));

            // Fetch Smart Wallet balance
            const rawSmartBalance = await usdcContract.balanceOf(SMART_WALLET_ADDRESS);
            const formattedSmartBalance = parseFloat(ethers.utils.formatUnits(rawSmartBalance, decimals));
            
            console.log(`[Web3] Wallet Balance: ${formattedBalance.toFixed(2)} USDC`);
            console.log(`[Web3] Smart Wallet Balance: ${formattedSmartBalance.toFixed(2)} USDC`);
            
            const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");
            await window.firebase.firestore.updateDoc(userDocRef, {
                'balance.totalUSDC': formattedSmartBalance
            });

            handleAddNotification(`Real balance updated: ${formattedSmartBalance.toFixed(2)} USDC`);
            setToastMessage("Balance Synced with Blockchain");

        } catch (error) {
            console.error("[Web3] Failed to fetch real balance:", error);
            handleAddNotification("Error syncing real balance. Check network.");
        }
    };

    fetchRealBalance();
  }, [signer, dbInstance, currentUserId, provider]); 


  // --- P&L Simulation (Runs when markets state changes due to WS) ---
  useEffect(() => {
    if (markets.length === 0) return; 

    let totalPnl = 0;
    
    // 1. Calculate new P&L for positions
    const newPositions = positions.map(pos => {
      const market = markets.find(m => m.id === pos.marketId);
      const outcome = market?.outcomes.find(o => o.name === pos.outcomeName);
      
      if (!market || !outcome || !pos.shares || !pos.avgPrice) return pos; 

      const currentPrice = pos.side === 'YES' ? outcome.price : (1 - outcome.price);
      const newValue = pos.shares * currentPrice;
      const newPnl = newValue - (pos.shares * pos.avgPrice);
      
      totalPnl += newPnl; 
      
      return { ...pos, currentValue: newValue, pnl: newPnl };
    });

    // 2. Update Firestore if P&L or positions changed significantly (to avoid spamming)
    if (JSON.stringify(newPositions) !== JSON.stringify(positions) || totalPnl !== portfolioBalance.totalPnl) {
        if (dbInstance && currentUserId) {
            const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");
            window.firebase.firestore.updateDoc(userDocRef, {
                'balance.totalPnl': totalPnl,
                'positions': newPositions
            }).catch(e => console.error("Failed to update P&L in Firestore:", e));
        } else {
            // Update local state if not authenticated yet
            setPortfolioBalance(prevBalance => ({
                ...prevBalance,
                totalPnl: totalPnl
            }));
            setPositions(newPositions);
        }
    }
  }, [markets, currentUserId, dbInstance, positions, portfolioBalance.totalPnl]); 


  // --- Navigation & UI Handlers ---
  const handleNavClick = (page) => {
    setActiveNav(page);
    setSelectedMarket(null); 
    setSelectedOutcome(null); 
  };

  const handleConnectWallet = () => {
    setIsWalletModalOpen(true); 
  };

  // --- Handle wallet selection from modal with ethers.js ---
  const handleWalletSelected = async (walletName) => {
    setIsWalletModalOpen(false);
    
    if (typeof window.ethereum === 'undefined' || typeof window.ethers === 'undefined') {
      handleAddNotification("Metamask or Ethers.js not found. Please install Metamask.");
      setToastMessage("Metamask not found!");
      return;
    }

    setWalletState('connecting');
    handleAddNotification(`Connecting with ${walletName}...`);
    
    try {
      const { ethers } = window;
      const newProvider = new ethers.providers.Web3Provider(window.ethereum);
      
      await newProvider.send("eth_requestAccounts", []);
      
      const newSigner = newProvider.getSigner();
      const address = await newSigner.getAddress();

      setProvider(newProvider);
      setSigner(newSigner);
      setUserAddress(address);
      setWalletState('connected');
      setActiveNav('portfolio'); 
      setPortfolioOnboardingState('onboarding'); 
      handleAddNotification("Wallet connected successfully!");
      setToastMessage("Wallet Connected!");

    } catch (err) {
      console.error("Wallet connection error:", err);
      setWalletState('idle');
      handleAddNotification("Wallet connection failed or was rejected.");
      setToastMessage("Connection failed.");
    }
  };

  const handleDisconnectWallet = async () => {
    setUserAddress(null);
    setWalletState('idle');
    setPortfolioOnboardingState('prompt');
    setProvider(null); 
    setSigner(null);  
    if (activeNav === 'portfolio') { 
      setActiveNav('markets');
    }
    if (auth) {
      await window.firebase.auth.signOut(auth);
    }
    handleAddNotification("Wallet disconnected.");
    setToastMessage("Wallet Disconnected");
  };

  const handleMarketClick = (market, outcome = null, side = 'YES') => {
    setSelectedMarket(market);
    if (outcome) {
      // If outcome is provided, open trade panel immediately
      setSelectedOutcome(outcome);
      setTradeSide(side);
    } else {
      // Otherwise just open market detail page
      setSelectedOutcome(null);
    }
  };

  const handleBackToMarkets = () => {
    setSelectedMarket(null);
    setSelectedOutcome(null);
    setActiveNav('markets'); 
  };

  const handleSelectOutcome = (outcome, side) => {
    setSelectedOutcome(outcome);
    setTradeSide(side);
  };
  
  const handleCloseTradePanel = () => {
    setSelectedOutcome(null);
  };

  const handleCreateSmartWallet = () => {
    setPortfolioOnboardingState('smartWallet');
    handleAddNotification("Tanner Smart Wallet created!");
    setToastMessage("Smart Wallet Created!");
  };

  const handleLinkAccounts = () => {
    setActiveNav('linkAccounts'); 
  };

  const handleBackToPortfolio = () => {
    setActiveNav('portfolio'); 
  }

  // --- Portfolio Persistence Handlers ---

  const updatePortfolioInFirestore = async (newBalance, newPositions, newOrders) => {
    if (!dbInstance || !currentUserId) {
        handleAddNotification("Persistence failed: User not authenticated.");
        return;
    }
    const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");
    try {
        await window.firebase.firestore.updateDoc(userDocRef, {
            balance: newBalance,
            positions: newPositions,
            openOrders: newOrders
        });
        console.log("Firestore updated successfully.");
    } catch (e) {
        console.error("Failed to write to Firestore:", e);
        handleAddNotification("Error saving data to persistence layer.");
    }
  };


  const handleTradeSubmit = async (tradeDetails) => {
    
    const { tradeType, amount, shares, limitPrice } = tradeDetails;
    
    // ** Simulating Web3 interaction for Market Orders **

    let newBalance = { ...portfolioBalance, totalUSDC: portfolioBalance.totalUSDC - amount };
    let newPositions = [...positions];
    let newOrders = [...openOrders];

    if (tradeType === 'Market') {
      
      const existingIndex = positions.findIndex(
        p => p.marketId === selectedMarket.id && p.outcomeName === selectedOutcome.name && p.side === tradeSide
      );
      
      if (existingIndex > -1) {
        const existing = positions[existingIndex];
        const totalShares = existing.shares + shares;
        const totalCost = (existing.shares * existing.avgPrice) + amount;
        const newAvgPrice = totalCost / totalShares;
        const updatedPos = { ...existing, shares: totalShares, avgPrice: newAvgPrice };
        newPositions = [...positions.slice(0, existingIndex), updatedPos, ...positions.slice(existingIndex + 1)];
      } else {
        const newPos = {
          id: generateUniqueId(),
          marketId: selectedMarket.id,
          title: selectedMarket.title,
          outcomeName: selectedOutcome.name, 
          side: tradeSide,
          shares: shares,
          avgPrice: (tradeSide === 'YES') ? selectedOutcome.price : (1 - selectedOutcome.price),
          currentValue: amount,
          pnl: 0
        };
        newPositions = [...positions, newPos];
      }
      handleAddNotification(`Market ${tradeSide} order for ${shares.toFixed(2)} shares of ${selectedOutcome.name} filled.`);
      setToastMessage("Market Order Filled!");
    } else {
      
      const newOrder = {
        id: generateUniqueId(),
        marketId: selectedMarket.id,
        marketTitle: selectedMarket.title,
        platform: selectedMarket.platform,
        outcomeName: selectedOutcome.name, 
        side: tradeSide,
        price: limitPrice,
        shares: shares,
        cost: amount
      };
      newOrders = [newOrder, ...openOrders];
      handleAddNotification(`Limit ${tradeSide} order for ${shares.toFixed(2)} shares of ${selectedOutcome.name} placed.`);
      setToastMessage("Limit Order Placed!");
    }

    // Save changes to Firestore
    await updatePortfolioInFirestore(newBalance, newPositions, newOrders);
  };


  const handleCancelOrder = async (orderId) => {
    const orderToCancel = openOrders.find(o => o.id === orderId);
    if (orderToCancel) {
      
      let newBalance = { ...portfolioBalance, totalUSDC: portfolioBalance.totalUSDC + orderToCancel.cost };
      let newOrders = openOrders.filter(o => o.id !== orderId);
      
      await updatePortfolioInFirestore(newBalance, positions, newOrders);
      
      handleAddNotification("Limit order cancelled.");
      setToastMessage("Order Cancelled");
    }
  };


  const handleOpenDepositModal = () => setModalState({ type: 'deposit', isOpen: true });
  const handleOpenWithdrawModal = () => setModalState({ type: 'withdraw', isOpen: true });

  const handleCloseModals = () => {
    setModalState({ type: null, isOpen: false });
    setClosePositionState({ position: null, isOpen: false });
  };


  // --- UPDATED: handleConfirmDeposit ---
  const handleConfirmDeposit = async (amount) => {
    if (!signer || !dbInstance || !currentUserId || typeof window.ethers === 'undefined') {
      setToastMessage("Web3 error: Wallet not connected or Ethers.js not loaded.");
      return;
    }
    
    if (!SMART_WALLET_ADDRESS || SMART_WALLET_ADDRESS === '0xB3C33d442469b432a44cB39787213D5f2C3f8c43') {
      setToastMessage("Developer: Smart Wallet address is not set.");
      console.error("Please set SMART_WALLET_ADDRESS constant.");
      return;
    }

    handleCloseModals();
    setToastMessage("Initiating deposit sequence...");
    
    try {
      const { ethers } = window; 
      const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, signer);
      const smartWalletContract = new ethers.Contract(SMART_WALLET_ADDRESS, USDC_ABI, signer); // Using USDC_ABI for now

      // --- 1. Get Decimals and Parse Amount ---
      const decimals = 6; 
      const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);

      // --- 2. Approve Token Transfer to Smart Wallet ---
      handleAddNotification("1/2: Requesting approval for USDC transfer...");
      const approveTx = await usdcContract.approve(SMART_WALLET_ADDRESS, parsedAmount);
      setToastMessage("Waiting for approval transaction confirmation...");
      await approveTx.wait(); 
      
      // --- 3. Call Deposit Function on Smart Wallet Contract ---
      handleAddNotification("2/2: Transferring USDC to Smart Wallet...");
      
      // !! This is a temporary simple transfer. A real contract would have a deposit() function
      // that calls transferFrom(). We'll use the user's signer to send the already-approved tokens.
      const transferTx = await usdcContract.transfer(SMART_WALLET_ADDRESS, parsedAmount);
      setToastMessage("Waiting for deposit confirmation...");
      await transferTx.wait(); 
      
      // --- 4. Update Firestore state ---
      let newBalance = { ...portfolioBalance, totalUSDC: portfolioBalance.totalUSDC + amount };
      await updatePortfolioInFirestore(newBalance, positions, openOrders);

      setToastMessage(`Successfully deposited $${amount.toFixed(2)}!`);
      handleAddNotification(`$${amount.toFixed(2)} deposited to Smart Wallet.`);

    } catch (err) {
      console.error("Deposit failed:", err);
      if (err.code === 4001) {
        setToastMessage("Deposit rejected by user.");
        handleAddNotification("Deposit rejected by user.");
      } else {
        setToastMessage("Deposit transaction failed. Check console.");
        handleAddNotification("Deposit failed.");
      }
    }
  };


  // --- UPDATED: handleConfirmWithdraw ---
  const handleConfirmWithdraw = async (amount) => {
    if (!signer || !dbInstance || !currentUserId || typeof window.ethers === 'undefined') {
        setToastMessage("Web3 error: Wallet not connected or Ethers.js not loaded.");
        return;
    }

    if (amount > portfolioBalance.totalUSDC) {
        setToastMessage("Withdrawal failed: Insufficient Smart Wallet funds.");
        handleAddNotification("Withdrawal failed: Insufficient funds.");
        return;
    }
    
    if (!SMART_WALLET_ADDRESS || SMART_WALLET_ADDRESS === '0xB3C33d442469b432a44cB39787213D5f2C3f8c43') {
        setToastMessage("Developer: Smart Wallet address is not set.");
        console.error("Please set SMART_WALLET_ADDRESS constant.");
        return;
    }

    handleCloseModals();
    setToastMessage("Initiating withdrawal...");

    try {
        const { ethers } = window;
        const decimals = 6; 
        const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
        
        // --- 1. Create a contract instance for the Smart Wallet ---
        const smartWalletContract = new ethers.Contract(SMART_WALLET_ADDRESS, USDC_ABI, signer); // Using USDC_ABI for withdrawUSDC

        // --- 2. Call the withdrawal function on your Smart Wallet contract ---
        handleAddNotification(`Calling Smart Wallet to withdraw $${amount.toFixed(2)}...`);
        const withdrawTx = await smartWalletContract.withdrawUSDC(parsedAmount);
        setToastMessage("Waiting for withdrawal transaction confirmation...");
        await withdrawTx.wait(); 

        // --- 3. Update Firestore state after TX confirmation ---
        let newBalance = { ...portfolioBalance, totalUSDC: portfolioBalance.totalUSDC - amount };
        await updatePortfolioInFirestore(newBalance, positions, newOrders);

        setToastMessage(`Successfully withdrew $${amount.toFixed(2)}!`);
        handleAddNotification(`$${amount.toFixed(2)} withdrawn to connected wallet.`);

    } catch (err) {
        console.error("Withdrawal failed:", err);
         if (err.code === 4001) {
            setToastMessage("Withdrawal rejected by user.");
            handleAddNotification("Withdrawal rejected by user.");
        } else {
            setToastMessage("Withdrawal transaction failed. Check console.");
            handleAddNotification("Withdrawal failed.");
        }
    }
  };

  const handleOpenClosePositionModal = (position) => {
    setClosePositionState({ position: position, isOpen: true });
  };

  // --- UPDATED: handleConfirmClosePosition (Simulated) ---
  const handleConfirmClosePosition = async (details) => {
    
    const { position, closeType, shares, price } = details;
    
    const market = markets.find(m => m.id === position.marketId);
    const outcome = market?.outcomes.find(o => o.name === position.outcomeName);

    if (!market || !outcome) {
      setToastMessage("Error closing position: Market/Outcome not found.");
      return;
    }

    // In a real application, this would be a market/limit sell contract call.
    // We simulate the persistence layer update here:
    const marketSellPrice = position.side === 'YES' ? (1 - outcome.price) : outcome.price;
    let newBalance = portfolioBalance;
    let newPositions = positions;
    let newOrders = openOrders;
    
    if (closeType === 'Market') {
      const proceeds = position.shares * marketSellPrice;
      newBalance = { ...portfolioBalance, totalUSDC: portfolioBalance.totalUSDC + proceeds };
      newPositions = positions.filter(p => p.id !== position.id); // Remove position
      
      setToastMessage(`Market close executed! (Simulated)`);
      handleAddNotification(`Sold ${position.shares.toFixed(2)} shares of "${position.outcomeName}". (Simulated)`);
    
    } else {
      // Limit Close: Add a new limit order for the *opposite* side.
      const oppositeSide = position.side === 'YES' ? 'NO' : 'YES';
      const limitOrder = {
          id: generateUniqueId(),
          marketId: position.marketId,
          marketTitle: position.title,
          platform: market.platform,
          outcomeName: position.outcomeName, 
          side: oppositeSide,
          price: price,
          shares: shares,
          cost: shares * price // This is expected proceeds
      };
      newOrders = [limitOrder, ...openOrders];
      setToastMessage("Limit close order placed! (Simulated)");
      handleAddNotification(`Limit sell for ${shares.toFixed(2)} shares placed. (Simulated)`);
    }
    
    await updatePortfolioInFirestore(newBalance, newPositions, newOrders);

    handleCloseModals();
  };


  // --- Render Logic ---
  // FIX: Determine current page based on state, not a separate variable
  const renderPage = () => {
    if (selectedMarket) {
      return (
        <MarketDetailPage
          market={selectedMarket}
          onBack={handleBackToMarkets}
          onSubmit={handleTradeSubmit}
          userAddress={userAddress}
          onConnectWallet={handleConnectWallet}
          setToastMessage={setToastMessage}
          handleAddNotification={handleAddNotification}
          portfolioBalance={portfolioBalance}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={handleSelectOutcome}
          tradeSide={tradeSide}
          onCloseTradePanel={handleCloseTradePanel}
        />
      );
    }
    
    switch (activeNav) { 
      case 'markets':
        return <MarketListPage 
          markets={markets} 
          onMarketClick={handleMarketClick} 
          onCategoryChange={handleCategoryChange}
          activeCategory={activeCategory}
          isLoading={isLoading}
        />;
      case 'portfolio':
        if (!userAddress) {
          return <ConnectWalletPrompt onConnect={handleConnectWallet} />;
        }
        if (portfolioOnboardingState === 'onboarding') {
          return <PortfolioOnboarding onCreateSmartWallet={handleCreateSmartWallet} onLinkAccounts={handleLinkAccounts} />;
        }
        return (
          <PortfolioPage
            balance={portfolioBalance}
            positions={positions}
            openOrders={openOrders}
            onCancelOrder={handleCancelOrder}
            onDeposit={handleOpenDepositModal}
            onWithdraw={handleOpenWithdrawModal}
            onLinkAccounts={handleLinkAccounts}
            onClosePosition={handleOpenClosePositionModal}
          />
        );
      case 'linkAccounts':
          return <LinkAccountsPage onBack={handleBackToPortfolio} />
      case 'leaderboard':
        return <LeaderboardPage leaderboardData={leaderboardData} />;
      case 'referrals':
        return <ReferralsPage setToastMessage={setToastMessage} />;
      default:
        return <MarketListPage 
          markets={markets} 
          onMarketClick={handleMarketClick}
          onCategoryChange={handleCategoryChange}
          activeCategory={activeCategory}
          isLoading={isLoading}
        />;
    }
  };

  if (isLoading && !isAuthReady) { // Wait for both API and Auth
    return (
      <div className="bg-black text-white h-screen flex flex-col items-center justify-center">
        <SpinnerIcon />
        <p className="mt-4 text-lg">Loading Aggregator...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex flex-col font-sans">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
      `}</style>

      <Header
        navItems={navItems}
        activeNav={activeNav} 
        onNavClick={handleNavClick}
        walletState={walletState}
        userAddress={userAddress}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
        onBellClick={() => setIsNotifOpen(prev => !prev)}
        notifCount={notifications.length}
      />
      <TickerTape newsItems={mockNews} />
      <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        {renderPage()}
      </div>
      <ToastNotification
        message={toastMessage}
        show={!!toastMessage}
        onClose={() => setToastMessage('')}
      />
      <NotificationDropdown
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
      />
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onWalletSelect={handleWalletSelected}
      />
      
      <DepositWithdrawModal
        isOpen={modalState.isOpen && (modalState.type === 'deposit' || modalState.type === 'withdraw')}
        onClose={handleCloseModals}
        modalType={modalState.type}
        onConfirm={modalState.type === 'deposit' ? handleConfirmDeposit : handleConfirmWithdraw}
        portfolioBalance={portfolioBalance}
      />
      <ClosePositionModal
        isOpen={closePositionState.isOpen}
        onClose={handleCloseModals}
        position={closePositionState.position}
        market={markets.find(m => m.id === closePositionState.position?.marketId)}
        onConfirmClose={handleConfirmClosePosition}
      />
    </div>
  );
}
