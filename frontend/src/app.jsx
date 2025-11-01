import React, { 
  useState, 
  useEffect, 
  useRef, 
  createContext, 
  useContext, 
  useMemo,
  useCallback
} from 'react';

/* ---
   Task 1.3: Import Charting Library
   (These are globally available via the <script> tag in index.html)
   
   FIX: Removed top-level const { createChart, LineStyle } = window.lightweightCharts;
   This was moved inside the chart's useEffect hook to prevent a race condition
   where the script hasn't loaded before this module executes.
--- */
// const { createChart, LineStyle } = window.lightweightCharts; // This line is removed.

/* ---
   Task 1.4: Import Firebase Modules
   We've added imports for Firebase services.
   (These are globally available via the <script> tags in index.html)
--- */
// Note: We will access these from the `window.firebase` object 
// which is set up in `frontend/index.html`.

// --- Global Constants ---
const API_URL = "http://92.246.141.205:3000/api/v2/markets";
const WS_URL = "wss://simulated-market-stream.tanner.xyz";
const APP_TITLE = "Tanner.xyz";
const MIN_TRADE_AMOUNT = 0.0001;

/* ---
   Task 1.4: Firebase Configuration
   Set up global variables for Firebase instances. We'll initialize
   them inside a useEffect hook to ensure the SDKs are loaded.
--- */
let dbInstance = null;
let authInstance = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tanner-xyz';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// --- Context for Global State ---
const AppContext = createContext();

// --- Main Application Component ---
export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [activeTab, setActiveTab] = useState('trade'); // trade, orders, history
  const [ws, setWs] = useState(null);
  const [lastPrices, setLastPrices] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  /* ---
     Task 1.4: Firebase State
     Add state to hold Firebase instances and user auth status.
  --- */
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [authState, setAuthState] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDataSeeded, setIsDataSeeded] = useState(false);

  // Portfolio state
  const [portfolio, setPortfolio] = useState(null);
  const [openOrders, setOpenOrders] = useState([]);
  
  // Chart instance reference
  const chartContainerRef = useRef();
  const chartRef = useRef(null);
  const lineSeriesRef = useRef(null);

  // --- WebSocket Connection (Task 1.2) ---
  useEffect(() => {
    // 1. Fetch initial market data via REST API
    const fetchMarkets = async () => {
      console.log("Attempting to fetch LIVE markets from VPS backend...");
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Ensure data is an array
        if (Array.isArray(data.markets) && Array.isArray(data.prices)) {
          // Create a price map for efficient lookup
          const priceMap = new Map(data.prices.map(p => [p.market, p.price]));
          
          // Combine market data with its initial price
          const combinedMarkets = data.markets.map(market => ({
            ...market,
            lastPrice: priceMap.get(market.id) || "0.00",
            change24h: market.change24h || 0, // Ensure change24h exists
          }));

          console.log(`Successfully fetched LIVE data: (${combinedMarkets.length}) (${data.prices.length})`, combinedMarkets);
          setMarkets(combinedMarkets);
          
          // Set default selected market (e.g., SOL-USD)
          const defaultMarket = combinedMarkets.find(m => m.id === 'SOL-USD') || combinedMarkets[0];
          setSelectedMarket(defaultMarket);

        } else {
          console.error("Fetched data is not in the expected format:", data);
        }
      } catch (error) {
        console.error("Failed to fetch markets:", error);
      }
    };

    fetchMarkets();

    // 2. Establish WebSocket connection for live price updates
    const connectWebSocket = () => {
      console.log(`[WS] Attempting to connect to ${WS_URL}...`);
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log("[WS] Connected. Starting data stream.");
        setWs(socket);
        // Subscribe to all markets
        socket.send(JSON.stringify({
          type: 'subscribe',
          markets: ['*'] // Subscribe to all available markets
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'trade' && data.market && data.price) {
            // Update the last price for the specific market
            setLastPrices(prevPrices => ({
              ...prevPrices,
              [data.market]: data.price
            }));
          }
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      };

      socket.onclose = (event) => {
        console.log("[WS] Disconnected.", event.reason);
        setWs(null);
        // Implement reconnection logic
        setTimeout(connectWebSocket, 5000); // Reconnect after 5 seconds
      };

      socket.onerror = (error) => {
        console.error("[WS] Error:", error);
        socket.close();
      };
    };

    connectWebSocket();

    // Cleanup function to close WebSocket on component unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // --- Price Update Effect (Task 1.2) ---
  // This effect listens for changes in `lastPrices` and updates
  // the main `markets` array and the chart.
  useEffect(() => {
    if (Object.keys(lastPrices).length === 0) return;

    setMarkets(prevMarkets => 
      prevMarkets.map(market => {
        const newPrice = lastPrices[market.id];
        if (newPrice) {
          // Update the chart if this is the selected market
          if (selectedMarket && market.id === selectedMarket.id && lineSeriesRef.current) {
            lineSeriesRef.current.update({
              time: Math.floor(Date.now() / 1000), // lightweight-charts uses UNIX timestamp
              value: parseFloat(newPrice)
            });
          }
          return { ...market, lastPrice: newPrice };
        }
        return market;
      })
    );
  }, [lastPrices, selectedMarket]);

  // --- Chart Initialization Effect (Task 1.3) ---
  useEffect(() => {
    if (!selectedMarket || !chartContainerRef.current) return;

    // --- FIX: Check if the charting library is loaded before using it ---
    if (!window.lightweightCharts || !window.lightweightCharts.createChart) {
      console.error("Lightweight Charts library not loaded yet. Chart will not render.");
      return; // Exit if the library isn't ready
    }
    // --- End Fix ---

    // If chart already exists, destroy it before creating a new one
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // --- FIX: Access createChart directly from the window object ---
    const chart = window.lightweightCharts.createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300, // Fixed height for the chart
      layout: {
        background: { color: '#111827' }, // dark-gray-900
        textColor: 'rgba(255, 255, 255, 0.7)', // light text
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        timeVisible: true,
        secondsVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
    });

    chartRef.current = chart;

    // Add an area series
    const areaSeries = chart.addAreaSeries({
      lineColor: '#38BDF8', // sky-400
      topColor: 'rgba(56, 189, 248, 0.4)',
      bottomColor: 'rgba(56, 189, 248, 0.0)',
      lineWidth: 2,
    });

    lineSeriesRef.current = areaSeries;

    // --- Mock Historical Data ---
    // In a real app, you'd fetch this from your API
    const mockHistory = [];
    let currentPrice = parseFloat(selectedMarket.lastPrice);
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 100; i > 0; i--) {
      mockHistory.push({
        time: now - i * 60, // One data point per minute for 100 minutes
        value: currentPrice + (Math.random() - 0.5) * (currentPrice * 0.01), // +- 1%
      });
      currentPrice = mockHistory[mockHistory.length - 1].value;
    }
    
    // Add the current price
    mockHistory.push({
      time: now,
      value: parseFloat(selectedMarket.lastPrice)
    });

    areaSeries.setData(mockHistory);
    chart.timeScale().fitContent();

    // Handle chart resizing
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [selectedMarket]); // Re-run this effect when the selected market changes

  /* ---
     Task 1.4: Firebase Auth & Setup
     This effect initializes Firebase and sets up the auth listener.
  --- */
  useEffect(() => {
    // --- FIX: Check for window.firebase *and* config ---
    if (window.firebase && Object.keys(firebaseConfig).length > 0) {
      try {
        // 1. Initialize App
        const app = window.firebase.app.initializeApp(firebaseConfig);
        
        // 2. Initialize Services
        const auth = window.firebase.auth.getAuth(app);
        const db = window.firebase.firestore.getFirestore(app);

        // 3. Set log level for debugging
        window.firebase.firestore.setLogLevel('debug');

        // 4. Store instances in state
        setAuth(auth);
        setDb(db);
        
        // Store instances in global vars for other functions
        authInstance = auth;
        dbInstance = db;

        console.log("Firebase Initialized Successfully.");

        // 5. Set up Auth State Listener
        const unsubscribe = window.firebase.auth.onAuthStateChanged(auth, async (user) => {
          setAuthState(user);
          setIsAuthReady(true);
          
          if (user) {
             console.log("Firebase Auth user signed in:", user.uid);
             setCurrentUserId(user.uid);
             setIsAuthenticated(true);
             
             // --- FIX: REMOVED redundant listener from here. ---
             // The listener is now correctly handled in the useEffect below.

          } else {
             console.log("Firebase Auth user not signed in. Attempting anonymous sign-in...");
             setCurrentUserId(null);
             setIsAuthenticated(false);
             try {
               // --- FIX: Check for __initial_auth_token first ---
               if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                 await window.firebase.auth.signInWithCustomToken(auth, __initial_auth_token);
               } else {
                 await window.firebase.auth.signInAnonymously(auth);
               }
             } catch (error) {
               console.error("Anonymous sign-in failed:", error);
             }
          }
        });

        // 6. Cleanup listener on component unmount
        return () => {
          console.log("Unsubscribing from Firebase Auth listener.");
          unsubscribe();
        };

      } catch (error) {
        console.error("Firebase initialization error:", error);
      }
    } else {
      console.warn("Firebase SDK not found or config is missing.");
    }
  }, []); // Runs once on mount

  /* ---
     Task 1.4: Portfolio Data Listener
     This effect sets up the real-time listener for the user's portfolio data.
  --- */
  useEffect(() => {
    if (!dbInstance || !currentUserId || !isAuthReady) {
      console.log("Firestore listener: Waiting for DB, User, and Auth readiness.");
      return;
    }
    
    console.log("Firestore listener: Attaching...");
    
    // --- FIX: Use window.firebase functions ---
    const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");

    // 1. Check if data exists and seed if necessary
    const seedInitialData = async () => {
        try {
            // --- FIX: Replaced complex query with a simple getDoc ---
            const docSnapshot = await window.firebase.firestore.getDoc(userDocRef);
            
            if (!docSnapshot.exists() && !isDataSeeded) { // --- FIX: Check !docSnapshot.exists() ---
                console.log("Seeding initial portfolio data...");
                // --- FIX: Use window.firebase functions & "isSeeded" ---
                await window.firebase.firestore.setDoc(userDocRef, {
                    "USD": { balance: 10000, available: 10000 },
                    "SOL": { balance: 100, available: 100 },
                    "BTC": { balance: 1, available: 1 },
                    "ETH": { balance: 10, available: 10 },
                    openOrders: [],
                    isSeeded: true // --- FIX: Renamed "__seed__" to "isSeeded" ---
                });
                setIsDataSeeded(true);
                console.log("Firestore: Initial data seeded.");
            } else if (docSnapshot.exists()) { // --- FIX: Check docSnapshot.exists() ---
                console.log("Firestore: Data already seeded.");
                setIsDataSeeded(true);
            }
        } catch (error) {
            console.error("Error checking or seeding portfolio data:", error);
        }
    };

    seedInitialData();

    // 2. Attach the real-time snapshot listener
    console.log("Attaching Firestore real-time listener...");
    const unsubscribe = window.firebase.firestore.onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        console.log("User portfolio update:", data);
        setPortfolio(data);
        setOpenOrders(data.openOrders || []);
      } else {
        console.log("User portfolio document does not exist yet.");
        // It might not exist yet if seeding is in progress
        if (isDataSeeded) {
          // If seeding *was* complete, this is an issue.
          console.error("Firestore: Portfolio doc disappeared!");
          setPortfolio(null); // Clear portfolio
        }
      }
    }, (error) => {
      console.error("Firestore snapshot listener error:", error);
    });

    // Cleanup: Detach listener on unmount or when user logs out
    return () => {
      console.log("Detaching Firestore listener.");
      unsubscribe();
    };

  }, [db, currentUserId, isAuthReady, isDataSeeded]); // Dependencies for the listener


  // --- Memoized Context Value ---
  const contextValue = useMemo(() => ({
    markets,
    selectedMarket,
    setSelectedMarket,
    activeTab,
    setActiveTab,
    portfolio,
    openOrders,
    db,
    auth,
    currentUserId,
    isAuthReady,
    appId
  }), [
    markets, 
    selectedMarket, 
    activeTab, 
    portfolio, 
    openOrders, 
    db, 
    auth, 
    currentUserId,
    isAuthReady,
    appId
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-900 text-gray-300 font-sans">
        <Header />
        <main className="container mx-auto p-4 max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* --- Left Column: Market List & Portfolio --- */}
            <div className="w-full lg:w-1/4 flex-shrink-0 flex flex-col gap-4">
              <MarketList />
              <PortfolioDisplay />
            </div>
            
            {/* --- Right Column: Chart & Trade Interface --- */}
            <div className="w-full lg:w-3/4 flex flex-col gap-4">
              <MarketHeader />
              {/* --- Chart Container (Task 1.3) --- */}
              <div ref={chartContainerRef} className="w-full h-[300px] bg-gray-800 rounded-lg shadow-inner" />
              <TradeInterface />
            </div>
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}

// --- Sub-Components ---

function Header() {
  const { auth, currentUserId } = useContext(AppContext);

  const handleSignOut = async () => {
    if (auth) {
      try {
        await window.firebase.auth.signOut(auth);
        // Auth listener will handle state change
        console.log("User signed out.");
        // Force a re-login anonymously
        await window.firebase.auth.signInAnonymously(auth);

      } catch (error) {
        console.error("Sign out error:", error);
      }
    }
  };

  return (
    <header className="bg-gray-800 shadow-md p-4">
      <div className="container mx-auto flex justify-between items-center max-w-7xl">
        <h1 className="text-2xl font-bold text-sky-400">{APP_TITLE}</h1>
        <div className="flex items-center gap-4">
          {/* --- Task 1.4: Display User ID & Sign Out --- */}
          {currentUserId && (
            <>
              <span className="text-sm text-gray-400 hidden md:block">
                User ID: {currentUserId}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-white"
              >
                (New User)
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MarketList() {
  const { markets, setSelectedMarket, selectedMarket } = useContext(AppContext);

  if (markets.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-700 rounded"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <h2 className="text-lg font-semibold p-4 border-b border-gray-700">Markets</h2>
      <div className="overflow-y-auto max-h-64">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-gray-800">
            <tr className="border-b border-gray-700">
              <th className="p-3">Market</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right hidden md:table-cell">24h</th>
            </tr>
          </thead>
          <tbody>
            {markets.map(market => (
              <tr
                key={market.id}
                onClick={() => setSelectedMarket(market)}
                className={`cursor-pointer hover:bg-gray-700 ${selectedMarket?.id === market.id ? 'bg-sky-900/50' : ''}`}
              >
                <td className="p-3 font-medium">{market.id}</td>
                <td className="p-3 text-right">
                  ${parseFloat(market.lastPrice).toFixed(getPrecision(market.lastPrice))}
                </td>
                <td className={`p-3 text-right hidden md:table-cell ${market.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {market.change24h.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortfolioDisplay() {
  const { portfolio } = useContext(AppContext);

  const getVisibleAssets = () => {
    if (!portfolio) return [];
    
    // Filter out assets with zero balance and internal keys
    return Object.entries(portfolio)
      .filter(([key, value]) => 
        key !== 'openOrders' && 
        key !== 'isSeeded' &&
        value && 
        value.balance > 0
      )
      .map(([key, value]) => ({
        asset: key,
        ...value
      }));
  };

  const visibleAssets = getVisibleAssets();

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-lg font-semibold p-4 border-b border-gray-700">Portfolio</h2>
      <div className="p-4 space-y-3">
        {(!portfolio || visibleAssets.length === 0) && (
          <div className="text-gray-500 text-sm">
            {portfolio ? 'No assets held.' : 'Loading portfolio...'}
          </div>
        )}
        {visibleAssets.map(asset => (
          <div key={asset.asset} className="flex justify-between items-center text-sm">
            <span className="font-medium">{asset.asset}</span>
            <div className="text-right">
              <div>{formatBalance(asset.balance)}</div>
              <div className="text-xs text-gray-400">
                Available: {formatBalance(asset.available)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketHeader() {
  const { selectedMarket } = useContext(AppContext);

  if (!selectedMarket) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-6 bg-gray-700 rounded w-1/3"></div>
      </div>
    );
  }

  const { id, lastPrice, change24h, volume24h } = selectedMarket;
  const price = parseFloat(lastPrice);
  const change = parseFloat(change24h);
  const volume = parseFloat(volume24h);

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{id}</h2>
          <div className={`text-xl font-semibold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ${price.toFixed(getPrecision(price))}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className={`${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change.toFixed(2)}% (24h)
          </div>
          <div className="text-gray-400">
            Volume: {volume.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeInterface() {
  const { activeTab, setActiveTab } = useContext(AppContext);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <TabButton
          title="Trade"
          isActive={activeTab === 'trade'}
          onClick={() => setActiveTab('trade')}
        />
        <TabButton
          title="Open Orders"
          isActive={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
        />
        {/* <TabButton
          title="History"
          isActive={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        /> */}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'trade' && <TradePanel />}
        {activeTab === 'orders' && <OpenOrdersPanel />}
        {/* {activeTab === 'history' && <div>Trade History Panel</div>} */}
      </div>
    </div>
  );
}

function TabButton({ title, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium text-sm focus:outline-none
        ${
          isActive
            ? 'border-b-2 border-sky-400 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }
      `}
    >
      {title}
    </button>
  );
}

function TradePanel() {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <OrderForm type="Buy" />
      <OrderForm type="Sell" />
    </div>
  );
}

function OrderForm({ type }) {
  const { 
    portfolio, 
    selectedMarket, 
    db, 
    currentUserId, 
    appId 
  } = useContext(AppContext);
  
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');
  const [orderType, setOrderType] = useState('limit'); // limit, market
  
  // Refs for debouncing updates
  const priceRef = useRef(price);
  const amountRef = useRef(amount);
  const totalRef = useRef(total);
  
  const isBuy = type === 'Buy';

  // --- Derived State ---
  const { baseAsset, quoteAsset } = useMemo(() => {
    if (!selectedMarket) return { baseAsset: null, quoteAsset: null };
    const [base, quote] = selectedMarket.id.split('-');
    return { baseAsset: base, quoteAsset: quote };
  }, [selectedMarket]);

  const baseBalance = portfolio?.[baseAsset]?.available || 0;
  const quoteBalance = portfolio?.[quoteAsset]?.available || 0;
  
  const availableBalance = isBuy ? quoteBalance : baseBalance;
  const balanceAsset = isBuy ? quoteAsset : baseAsset;

  // --- Price/Amount/Total Synchronization ---
  
  // This function is called when Price or Amount changes
  const updatePriceOrAmount = useCallback(() => {
    const p = parseFloat(priceRef.current);
    const a = parseFloat(amountRef.current);
    if (!isNaN(p) && !isNaN(a) && p > 0 && a > 0) {
      const newTotal = (p * a).toFixed(getPrecision(p));
      setTotal(newTotal);
      totalRef.current = newTotal;
    } else {
      setTotal('');
      totalRef.current = '';
    }
  }, []);

  // This function is called when Total changes
  const updateTotal = useCallback(() => {
    const p = parseFloat(priceRef.current);
    const t = parseFloat(totalRef.current);
    if (!isNaN(p) && !isNaN(t) && p > 0 && t > 0) {
      const newAmount = (t / p).toFixed(8); // 8 decimals for crypto amount
      setAmount(newAmount);
      amountRef.current = newAmount;
    } else {
      setAmount('');
      amountRef.current = '';
    }
  }, []);
  
  // Set initial price when market changes
  useEffect(() => {
    if (selectedMarket) {
      const newPrice = parseFloat(selectedMarket.lastPrice).toFixed(getPrecision(selectedMarket.lastPrice));
      setPrice(newPrice);
      priceRef.current = newPrice;
      // Recalculate total if amount exists
      updatePriceOrAmount();
    }
  }, [selectedMarket, updatePriceOrAmount]);
  
  // --- Event Handlers ---
  const handlePriceChange = (e) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    priceRef.current = newPrice;
    updatePriceOrAmount();
  };
  
  const handleAmountChange = (e) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    amountRef.current = newAmount;
    updatePriceOrAmount();
  };

  const handleTotalChange = (e) => {
    const newTotal = e.target.value;
    setTotal(newTotal);
    totalRef.current = newTotal;
    updateTotal();
  };

  // --- Order Submission (Task 1.5) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dbInstance || !currentUserId || !selectedMarket || !portfolio) {
      console.error("Order submission failed: Services not ready.");
      // TODO: Show user-friendly error
      return;
    }

    const p = parseFloat(price);
    const a = parseFloat(amount);

    if (isNaN(p) || isNaN(a) || p <= 0 || a <= MIN_TRADE_AMOUNT) {
      console.error("Invalid price or amount");
      // TODO: Show user-friendly error
      return;
    }
    
    // --- Check available balance ---
    const cost = p * a;
    if (isBuy && cost > quoteBalance) {
      console.error("Insufficient balance to buy");
      // TODO: Show user-friendly error
      return;
    }
    if (!isBuy && a > baseBalance) {
      console.error("Insufficient balance to sell");
      // TODO: Show user-friendly error
      return;
    }

    // --- Create Order Object ---
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newOrder = {
      id: orderId,
      market: selectedMarket.id,
      side: isBuy ? 'buy' : 'sell',
      type: orderType,
      amount: a,
      price: p,
      createdAt: window.firebase.firestore.serverTimestamp(),
      status: 'open',
    };

    console.log("Submitting new order:", newOrder);

    // --- Create new available balances ---
    const newPortfolio = { ...portfolio };
    
    if (isBuy) {
      // Lock USD
      newPortfolio[quoteAsset] = {
        ...newPortfolio[quoteAsset],
        available: newPortfolio[quoteAsset].available - cost
      };
    } else {
      // Lock Base Asset
      newPortfolio[baseAsset] = {
        ...newPortfolio[baseAsset],
        available: newPortfolio[baseAsset].available - a
      };
    }

    // Add new order to openOrders array using FieldValue.arrayUnion
    const updatedOpenOrders = window.firebase.firestore.arrayUnion(newOrder);

    // --- Update Firestore ---
    try {
      const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");
      
      // Update portfolio and add to openOrders array atomically
      await window.firebase.firestore.updateDoc(userDocRef, {
        ...newPortfolio,
        openOrders: updatedOpenOrders
      });

      console.log("Order submitted successfully!");
      // Clear form
      setAmount('');
      setTotal('');
      amountRef.current = '';
      totalRef.current = '';

    } catch (error) {
      console.error("Failed to submit order:", error);
      // TODO: Revert optimistic UI update or show error
    }
  };


  return (
    <form onSubmit={handleSubmit} className="w-full md:w-1/2 p-4 bg-gray-900 rounded-md">
      <h3 className={`text-lg font-semibold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
        {type} {baseAsset}
      </h3>
      
      <div className="text-sm text-gray-400 mt-2 mb-4">
        Available: {formatBalance(availableBalance)} {balanceAsset}
      </div>

      {/* Order Type Toggle */}
      <div className="flex bg-gray-800 rounded-md p-1 mb-4">
        <button
          type="button"
          onClick={() => setOrderType('limit')}
          className={`w-1/2 py-2 rounded-md text-sm font-medium ${orderType === 'limit' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Limit
        </button>
        <button
          type="button"
          onClick={() => setOrderType('market')}
          disabled // Market orders disabled for now
          className={`w-1/2 py-2 rounded-md text-sm font-medium ${orderType === 'market' ? 'bg-sky-600 text-white' : 'text-gray-400 opacity-50 cursor-not-allowed'}`}
        >
          Market
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        {orderType === 'limit' && (
          <InputGroup
            label="Price"
            value={price}
            onChange={handlePriceChange}
            asset={quoteAsset}
          />
        )}
        <InputGroup
          label="Amount"
          value={amount}
          onChange={handleAmountChange}
          asset={baseAsset}
        />
        <InputGroup
          label="Total"
          value={total}
          onChange={handleTotalChange}
          asset={quoteAsset}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className={`w-full py-3 mt-4 rounded-md font-semibold text-white
          ${isBuy ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}
        `}
      >
        {type} {baseAsset}
      </button>
    </form>
  );
}

function InputGroup({ label, value, onChange, asset }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="any"
          value={value}
          onChange={onChange}
          placeholder="0.00"
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 pr-16 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          {asset}
        </span>
      </div>
    </div>
  );
}

function OpenOrdersPanel() {
  const { openOrders, db, currentUserId, appId, portfolio } = useContext(AppContext);

  const handleCancelOrder = async (orderToCancel) => {
    if (!dbInstance || !currentUserId || !portfolio) {
      console.error("Cannot cancel order: Services not ready.");
      return;
    }
    
    console.log("Cancelling order:", orderToCancel.id);

    // --- Create new portfolio state ---
    const newPortfolio = { ...portfolio };
    const [base, quote] = orderToCancel.market.split('-');

    if (orderToCancel.side === 'buy') {
      // Refund the quote asset (e.g., USD)
      const cost = orderToCancel.amount * orderToCancel.price;
      newPortfolio[quote] = {
        ...newPortfolio[quote],
        available: newPortfolio[quote].available + cost
      };
    } else {
      // Refund the base asset (e.g., SOL)
      newPortfolio[base] = {
        ...newPortfolio[base],
        available: newPortfolio[base].available + orderToCancel.amount
      };
    }

    // --- Update Firestore ---
    try {
      const userDocRef = window.firebase.firestore.doc(dbInstance, "artifacts", appId, "users", currentUserId, "portfolio", "data");
      
      // Update portfolio and remove from openOrders array atomically
      await window.firebase.firestore.updateDoc(userDocRef, {
        ...newPortfolio,
        openOrders: window.firebase.firestore.arrayRemove(orderToCancel)
      });

      console.log("Order cancelled successfully!");

    } catch (error) {
      console.error("Failed to cancel order:", error);
      // TODO: Show user-friendly error
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-xs text-gray-400">
            <th className="p-3">Market</th>
            <th className="p-3">Side</th>
            <th className="p-3">Price</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Total</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {openOrders.length === 0 && (
            <tr>
              <td colSpan="6" className="text-center p-6 text-gray-500">
                No open orders.
              </td>
            </tr>
          )}
          {openOrders.map(order => (
            <tr key={order.id} className="border-b border-gray-700 hover:bg-gray-700/50">
              <td className="p-3 font-medium">{order.market}</td>
              <td className={`p-3 font-medium ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                {order.side.toUpperCase()}
              </td>
              <td className="p-3">${order.price.toFixed(getPrecision(order.price))}</td>
              <td className="p-3">{formatBalance(order.amount)}</td>
              <td className="p-3">${(order.amount * order.price).toFixed(getPrecision(order.price))}</td>
              <td className="p-3 text-right">
                <button 
                  onClick={() => handleCancelOrder(order)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md"
                >
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// --- Helper Functions ---

// Dynamically calculates precision for formatting prices
function getPrecision(price) {
  const priceNum = parseFloat(price);
  if (priceNum >= 100) return 2;
  if (priceNum >= 1) return 4;
  if (priceNum < 0.0001) return 8;
  return 6;
}

// Formats large or small balances
function formatBalance(balance) {
  const balNum = parseFloat(balance);
  if (balNum === 0) return "0.00";
  if (balNum < 0.0001) return balNum.toFixed(8);
  if (balNum > 1000) return balNum.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return balNum.toFixed(4);
}
