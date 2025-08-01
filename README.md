## Getting Started

1. Run `npm install`
2. Run `npm run dev`

## Troubleshooting: Monad Dashboard Live Data Issues

### 1. CORS Error: No 'Access-Control-Allow-Origin' header

**Problem:**
- Monad RPC endpoints (e.g., BlockVision, Alchemy) do not allow direct browser access due to CORS restrictions.
- You will see errors like:
  > Access to fetch at 'https://rpc.blockvision.org/v1/monad-testnet/...' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

**Solution:**
- You must use a backend proxy server. Your React app sends requests to your own backend, which then calls the Monad RPC and returns the data.

#### Example: Node.js Proxy Server

1. Install dependencies:
   ```bash
   npm install express node-fetch
   ```
2. Create a file called `server.js` in your project root with the following content:
   ```js
   const express = require('express');
   const fetch = require('node-fetch');
   const app = express();
   app.use(express.json());

   // Replace with your real BlockVision or Alchemy URL
   const MONAD_RPC_URL = 'https://rpc.blockvision.org/v1/monad-testnet/YOUR_REAL_KEY_HERE';

   app.post('/api/monad', async (req, res) => {
     try {
       const response = await fetch(MONAD_RPC_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(req.body),
       });
       const data = await response.json();
       res.json(data);
     } catch (err) {
       res.status(500).json({ error: 'Proxy error', details: err.message });
     }
   });

   app.listen(3001, () => console.log('Proxy running on port 3001'));
   ```
3. Start the proxy server:
   ```bash
   node server.js
   ```
4. In your React app, change all Monad RPC requests to use `http://localhost:3001/api/monad` instead of the direct RPC URL.

---

### 2. 401 Unauthorized Error (Alchemy)

**Problem:**
- You see errors like:
  > POST https://monad-testnet.g.alchemy.com/v2/... 401 (Unauthorized)
- This means your Alchemy API key is missing, invalid, or not set up for Monad.

**Solution:**
- Double-check your `.env` file:
  ```env
  VITE_MONAD_ALCHEMY_URL=https://monad-testnet.g.alchemy.com/v2/YOUR_REAL_KEY_HERE
  VITE_MONAD_BLOCKVISION_URL=https://rpc.blockvision.org/v1/monad-testnet/YOUR_REAL_KEY_HERE
  ```
- Do **not** include angle brackets (`<` and `>`). Use your real keys.
- Restart your dev server after editing `.env`.

---

### 3. Summary Table

| Error Type | Cause | Solution |
|------------|-------|----------|
| CORS | Browser not allowed to call RPC | Use backend proxy |
| 401 Unauthorized | Invalid/missing API key | Fix `.env` and use real keys |

---

If you need help updating your React code to use the proxy, see the comments in `src/services/monadService.ts` or ask for further assistance.

# Monad Blockchain Dashboard

A comprehensive dashboard for monitoring Monad blockchain activity, built with React and TypeScript.

## Features

- Real-time block and transaction monitoring
- Gas usage analytics
- Contract deployment tracking
- Search functionality for blocks, transactions, and contracts
- Responsive design with modern UI

## API Keys Configuration

The dashboard uses multiple RPC endpoints for different functionalities. API keys are stored in the `.env` file:

### Required Environment Variables

```bash
# Monad RPC endpoints
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
VITE_QUICKNODE_RPC_URL=https://proportionate-floral-sheet.monad-testnet.quiknode.pro/YOUR_QUICKNODE_KEY/
VITE_ALCHEMY_RPC_URL=https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# API Keys (for reference)
VITE_QUICKNODE_API_KEY=your_quicknode_api_key
VITE_ALCHEMY_API_KEY=your_alchemy_api_key
```

### Getting API Keys

1. **QuickNode**: Sign up at [quicknode.com](https://quicknode.com) and create a Monad testnet endpoint
2. **Alchemy**: Sign up at [alchemy.com](https://alchemy.com) and create a Monad testnet app

### Current Configuration

Your API keys are already configured in the `.env` file:

- **QuickNode Key**: `********`
- **Alchemy Key**: `********`
  
## Installation

// ... existing code ...
