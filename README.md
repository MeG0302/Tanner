Tanner.xyz - Prediction Market Aggregator

Tanner.xyz is a professional-grade trading dashboard that aggregates prediction markets from multiple platforms (Polymarket, Kalshi, Limitless) into a single, unified interface.

The core philosophy is Account Abstraction: the user connects a single wallet and trades on all platforms through a "Tanner Smart Wallet," without ever needing to manage multiple accounts or API keys.

Note: The frontend is feature-complete and runs in a simulated mode. The backend is built and ready to be connected with live API keys.

Features

Unified Dashboard: View and trade markets from Polymarket, Kalshi, and Limitless in one list.

Live P&L: A fully dynamic portfolio page that tracks your positions and P&L in real-time as market prices fluctuate.

Advanced Trading: Full-featured trade panel supporting both Market Orders and Limit Orders with a simulated order book.

Smart Wallet Onboarding: A seamless flow for users to connect a wallet and "Create a Tanner Smart Wallet" or "Link Existing Accounts."

Complete Portfolio: View open positions, open limit orders, and total portfolio value.

Dynamic UI: Includes a scrolling news ticker, notification system (bell icon + toasts), and a 10-minute leaderboard refresh.

Wallet Integration: A clean wallet connection modal supporting Metamask, OKX, and Rabby.

Full Navigation: Complete, navigable pages for Leaderboard and Referrals.

Tech Stack

Frontend: React (functional components, hooks), Tailwind CSS

Backend: Node.js, Express

Local Setup & Running the App

To run this project locally, you must run the backend and frontend in two separate terminals.

1. Backend Setup (server.js)

The backend securely holds all API keys and aggregates data from the platforms.

Navigate to Backend:

cd /your-project/tanner-backend


Install Dependencies:

npm install


Add API Keys:
Open server.js and add your secret API keys to the API_KEYS object at the top of the file.

Run the Server:

node server.js


Your backend is now running on http://localhost:3001.

2. Frontend Setup (app.jsx)

The frontend is the React application that the user interacts with.

Navigate to Frontend:

cd /your-project/tanner-frontend


Install Dependencies:

npm install


Connect Frontend to Backend:
This is the most important step. Open app.jsx and find the fetchMarkets function. Change the API_URL variable to point to your local backend server:

// In app.jsx, inside fetchMarkets:
const API_URL = 'http://localhost:3001/api/markets';


Run the App:

npm run dev


Your React app will now load, fetch live data from your local backend, and the entire dashboard will be fully operational.

Deployment (VPS)

As discussed:

Backend: Deploy the server.js backend folder to your VPS. Use a process manager like pm2 to keep it running 24/7 (pm2 start server.js).

Frontend: Deploy the static React frontend to a service like Vercel or Netlify.

Final Connection: Update the API_URL in your frontend's app.jsx file to point to your VPS's public domain (e.g., https://api.tanner.xyz/api/markets) before you deploy to Vercel.
