/**
 * BITVAVO API REFERENCE
 * =====================
 * Complete API documentation embedded in code to avoid refetching
 * 
 * Source: Bitvavo official documentation
 * Last updated: February 2026
 * 
 * ARCHITECTURE INSIGHT:
 * - REST API: State queries and initial data load
 * - WebSocket API: Realtime updates and event streaming
 * - Ideal flow: REST → bootstrap, WS → live updates
 */

// ============================================================================
// REST API CONFIGURATION
// ============================================================================

export const BITVAVO_REST_CONFIG = {
  base: 'https://api.bitvavo.com/v2',
  timeout: 10000,
  rateLimit: {
    requests: 600,        // 600 requests
    window: 60000,        // per 60 seconds
    weight: 1,            // each request = 1 weight by default
  },
} as const;

export const BITVAVO_WEBSOCKET_CONFIG = {
  url: 'wss://ws.bitvavo.com/v2',
  reconnectInterval: 5000,
  reconnectMaxAttempts: 10,
  heartbeat: 30000,
} as const;

// ============================================================================
// AUTHENTICATION
// ============================================================================

export const BITVAVO_AUTH = {
  algorithm: 'HMAC-SHA256',
  headers: {
    key: 'Bitvavo-Access-Key',
    timestamp: 'Bitvavo-Access-Timestamp',
    signature: 'Bitvavo-Access-Signature',
    window: 'Bitvavo-Access-Window', // optional, default 5 seconds
  },
  signature: {
    format: 'timestamp + method + path + body',
    example: `
      timestamp = 1234567890000
      method = 'GET'
      path = '/v2/balance'
      body = ''
      
      message = '1234567890000GET/v2/balance'
      signature = HMAC-SHA256(secret, message)
    `,
  },
} as const;

// ============================================================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================================================

export const BITVAVO_PUBLIC_ENDPOINTS = {
  markets: {
    method: 'GET',
    path: '/markets',
    description: 'Get all available trading markets',
    query: {
      'market?': 'string - specific market (e.g., "BTC-EUR")',
    },
    response: {
      example: [
        {
          market: 'BTC-EUR',
          base: 'BTC',
          quote: 'EUR',
          status: 'trading',
          minOrderSize: '0.001',
          maxOrderSize: '100',
          orderTypes: ['limit', 'market'],
          maker: '0.0025', // 0.25% fee
          taker: '0.0025', // 0.25% fee
          canDeposit: true,
          canWithdraw: true,
        },
      ],
    },
  },

  ticker: {
    method: 'GET',
    path: '/ticker',
    description: 'Get current ticker data for all or specific markets - REALTIME PRICES',
    query: {
      'market?': 'string - specific market (e.g., "BTC-EUR")',
    },
    response: {
      example: {
        market: 'BTC-EUR',
        last: '45000.50',       // 👈 CURRENT PRICE - use this!
        bid: '45000.00',
        ask: '45000.99',
        high: '46000.00',       // 24h high
        low: '44000.00',        // 24h low
        volume: '1234.567',     // 24h volume
        timestamp: 1234567890000,
      },
    },
    error: {
      404: 'Endpoint not found - use /ticker (not /ticker24h)',
    },
  },

  ticker24h: {
    method: 'GET',
    path: '/ticker24h',
    description: '❌ DOES NOT EXIST - Use /ticker instead',
    deprecated: true,
  },

  orderbook: {
    method: 'GET',
    path: '/orderbook',
    description: 'Get order book for a market',
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      'depth?': 'number - number of levels (default: 20)',
    },
    response: {
      example: {
        market: 'BTC-EUR',
        nonce: 12345,
        bids: [
          ['45000.00', '0.5'],   // [price, amount]
          ['44999.99', '1.2'],
        ],
        asks: [
          ['45001.00', '0.3'],
          ['45001.99', '0.8'],
        ],
        timestamp: 1234567890000,
      },
    },
  },

  candles: {
    method: 'GET',
    path: '/candles',
    description: 'Get OHLCV candlestick data',
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      interval: 'string - "1m", "5m", "15m", "30m", "1h", "4h", "8h", "12h", "1d"',
      'limit?': 'number - max 1440',
    },
    response: {
      example: [
        {
          timestamp: 1234567890000,
          open: '44000.00',
          high: '45000.00',
          low: '43500.00',
          close: '44500.00',
          volume: '123.456',
        },
      ],
    },
  },

  trades: {
    method: 'GET',
    path: '/trades',
    description: 'Get recent trades for a market',
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      'limit?': 'number - max 500 (default: 500)',
      'tradeIdFrom?': 'string - pagination',
      'tradeIdTo?': 'string - pagination',
    },
    response: {
      example: [
        {
          id: 'trade123',
          amount: '0.5',
          price: '45000.00',
          side: 'buy',
          timestamp: 1234567890000,
        },
      ],
    },
  },
} as const;

// ============================================================================
// PRIVATE ENDPOINTS (Authentication required)
// ============================================================================

export const BITVAVO_PRIVATE_ENDPOINTS = {
  // ACCOUNT ENDPOINTS
  balance: {
    method: 'GET',
    path: '/balance',
    description: 'Get account balances for all assets',
    auth: true,
    query: {
      'symbol?': 'string - specific asset (e.g., "BTC")',
    },
    response: {
      example: [
        {
          symbol: 'BTC',
          available: '1.5',      // Available to trade
          inOrder: '0.5',        // Locked in orders
          totalAmount: '2.0',    // Total = available + inOrder
        },
        {
          symbol: 'EUR',
          available: '1000.00',
          inOrder: '500.00',
          totalAmount: '1500.00',
        },
      ],
    },
  },

  account: {
    method: 'GET',
    path: '/account',
    description: 'Get account information',
    auth: true,
    response: {
      example: {
        fees: {
          trading: '0.0025',     // 0.25% taker fee
          making: '0.0025',      // 0.25% maker fee
        },
        limits: {
          volume: {
            day: '1000000.00',   // Daily volume limit
          },
          withdrawal: {
            day: '50000.00',     // Daily withdrawal limit
          },
        },
      },
    },
  },

  accountFees: {
    method: 'GET',
    path: '/account/fees',
    description: 'Get account fee structure',
    auth: true,
    query: {
      'market?': 'string - specific market (e.g., "BTC-EUR")',
    },
    response: {
      example: {
        market: 'BTC-EUR',
        maker: '0.0025',
        taker: '0.0025',
        volume30d: '0.00',
      },
    },
  },

  // TRADING ENDPOINTS
  order: {
    method: 'POST',
    path: '/order',
    description: 'Create a new order',
    auth: true,
    body: {
      market: 'string - market (e.g., "BTC-EUR")',
      side: 'string - "buy" or "sell"',
      orderType: 'string - "limit" or "market"',
      amount: 'string - order amount in base currency',
      'price?': 'string - limit price (required for limit orders)',
      'postOnly?': 'boolean - post-only limit order',
      'timeInForce?': 'string - "ioc" (immediate-or-cancel)',
      'operatorId?': 'string - operator identifier (if required by Bitvavo)',
      'clientOrderId?': 'string - custom order ID',
    },
    response: {
      example: {
        orderId: 'order123',
        market: 'BTC-EUR',
        created: 1234567890000,
        updated: 1234567890000,
        amount: '0.5',
        amountRemaining: '0.5',
        price: '45000.00',
        filledAmount: '0',
        filledCost: '0',
        side: 'buy',
        orderType: 'limit',
        status: 'submitted',
      },
    },
  },

  updateOrder: {
    method: 'PUT',
    path: '/order',
    description: 'Update an existing order',
    auth: true,
    body: {
      market: 'string - market (e.g., "BTC-EUR")',
      orderId: 'string - order ID to update',
      'amount?': 'string - new amount',
      'price?': 'string - new price',
    },
  },

  cancelOrder: {
    method: 'DELETE',
    path: '/order',
    description: 'Cancel an order',
    auth: true,
    body: {
      market: 'string - market (e.g., "BTC-EUR")',
      orderId: 'string - order ID to cancel',
    },
  },

  getOrder: {
    method: 'GET',
    path: '/order',
    description: 'Get details of a specific order',
    auth: true,
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      orderId: 'string - order ID',
    },
  },

  getOrders: {
    method: 'GET',
    path: '/orders',
    description: 'Get all orders (filled and open)',
    auth: true,
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      'limit?': 'number - max 500',
      'start?': 'number - pagination offset',
    },
  },

  getOpenOrders: {
    method: 'GET',
    path: '/openOrders',
    description: 'Get all open (unfilled) orders',
    auth: true,
    query: {
      'market?': 'string - market (e.g., "BTC-EUR")',
    },
    response: {
      example: [
        {
          orderId: 'order123',
          market: 'BTC-EUR',
          side: 'buy',
          price: '45000.00',
          amount: '0.5',
          amountRemaining: '0.5',
          status: 'open',
        },
      ],
    },
  },

  // TRADE HISTORY
  trades: {
    method: 'GET',
    path: '/trades',
    description: 'Get personal trade history',
    auth: true,
    query: {
      market: 'string - market (e.g., "BTC-EUR")',
      'limit?': 'number - max 500',
      'start?': 'number - pagination offset',
      'tradeIdFrom?': 'string - get trades after this ID',
      'tradeIdTo?': 'string - get trades before this ID',
    },
    response: {
      example: [
        {
          id: 'trade123',
          orderId: 'order123',
          market: 'BTC-EUR',
          amount: '0.5',
          price: '45000.00',
          side: 'buy',
          fee: '56.25',          // Fee amount
          feeCurrency: 'EUR',
          timestamp: 1234567890000,
        },
      ],
    },
  },

  // WITHDRAWAL / DEPOSIT
  withdrawal: {
    method: 'POST',
    path: '/withdrawal',
    description: 'Withdraw funds to external address',
    auth: true,
    body: {
      symbol: 'string - currency (e.g., "EUR", "BTC")',
      amount: 'string - amount to withdraw',
      address: 'string - destination address',
      'message?': 'string - memo/tag (for some currencies)',
      'paymentId?': 'string - payment ID (for some currencies)',
    },
  },

  depositHistory: {
    method: 'GET',
    path: '/depositHistory',
    description: 'Get deposit history',
    auth: true,
    query: {
      'symbol?': 'string - specific currency',
      'limit?': 'number - max 500',
      'start?': 'number - pagination offset',
    },
  },

  withdrawalHistory: {
    method: 'GET',
    path: '/withdrawalHistory',
    description: 'Get withdrawal history',
    auth: true,
    query: {
      'symbol?': 'string - specific currency',
      'limit?': 'number - max 500',
      'start?': 'number - pagination offset',
    },
  },
} as const;

// ============================================================================
// WEBSOCKET API (REALTIME UPDATES)
// ============================================================================

export const BITVAVO_WEBSOCKET_CHANNELS = {
  authentication: {
    action: 'authenticate',
    format: {
      action: 'authenticate',
      key: 'API_KEY',
      signature: 'HMAC-SHA256(secret, timestamp + GET + /v2/websocket)',
      timestamp: 'milliseconds',
    },
    description: 'Authenticate WebSocket connection for private channels',
  },

  // Public channels (no auth)
  ticker: {
    name: 'ticker',
    description: 'Realtime ticker data for specified markets',
    subscribe: {
      action: 'subscribe',
      channels: [
        {
          name: 'ticker',
          markets: ['BTC-EUR', 'ETH-EUR'],
        },
      ],
    },
    response: {
      example: {
        event: 'ticker',
        market: 'BTC-EUR',
        last: '45000.50',        // Current price 👈 USE THIS!
        bid: '45000.00',
        ask: '45000.99',
        high: '46000.00',
        low: '44000.00',
        volume: '1234.567',
        timestamp: 1234567890000,
      },
    },
  },

  book: {
    name: 'book',
    description: 'Order book updates (realtime depth)',
    subscribe: {
      action: 'subscribe',
      channels: [
        {
          name: 'book',
          markets: ['BTC-EUR'],
        },
      ],
    },
    response: {
      example: {
        event: 'book',
        market: 'BTC-EUR',
        nonce: 12345,
        bids: [['45000.00', '0.5']],
        asks: [['45001.00', '0.3']],
        timestamp: 1234567890000,
      },
    },
  },

  trades: {
    name: 'trades',
    description: 'Realtime market trades',
    subscribe: {
      action: 'subscribe',
      channels: [
        {
          name: 'trades',
          markets: ['BTC-EUR'],
        },
      ],
    },
    response: {
      example: {
        event: 'trade',
        market: 'BTC-EUR',
        id: 'trade123',
        amount: '0.5',
        price: '45000.00',
        side: 'buy',
        timestamp: 1234567890000,
      },
    },
  },

  candles: {
    name: 'candles',
    description: 'Candlestick data updates',
    subscribe: {
      action: 'subscribe',
      channels: [
        {
          name: 'candles',
          markets: ['BTC-EUR'],
          interval: '1h', // '1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '1d'
        },
      ],
    },
  },

  account: {
    name: 'account',
    description: 'Account updates (orders, fills, balance changes)',
    auth: true,
    subscribe: {
      action: 'subscribe',
      channels: [
        {
          name: 'account',
        },
      ],
    },
    events: ['order', 'fill', 'balanceUpdate'],
  },

  // Actions (request-response pattern)
  actions: {
    getMarkets: {
      action: 'getMarkets',
      params: {
        'market?': 'string',
      },
    },
    getTicker: {
      action: 'getTicker',
      params: {
        market: 'string',
      },
    },
    getOrderbook: {
      action: 'getOrderbook',
      params: {
        market: 'string',
        'depth?': 'number',
      },
    },
    createOrder: {
      action: 'createOrder',
      params: {
        market: 'string',
        side: 'string',
        orderType: 'string',
        amount: 'string',
        'price?': 'string',
      },
    },
    cancelOrder: {
      action: 'cancelOrder',
      params: {
        market: 'string',
        orderId: 'string',
      },
    },
    getOpenOrders: {
      action: 'getOpenOrders',
      params: {
        'market?': 'string',
      },
    },
  },
} as const;

// ============================================================================
// ERROR CODES & HANDLING
// ============================================================================

export const BITVAVO_ERRORS = {
  400: {
    message: 'Bad Request',
    cause: 'Invalid parameters or malformed request',
  },
  401: {
    message: 'Unauthorized',
    cause: 'Missing or invalid authentication',
  },
  403: {
    message: 'Forbidden',
    cause: 'API key lacks required permissions',
  },
  404: {
    message: 'Not Found',
    cause: 'Endpoint or resource does not exist',
    example: 'GET /ticker24h returns 404 - use /ticker instead',
  },
  429: {
    message: 'Too Many Requests',
    cause: 'Rate limit exceeded (600 req/min)',
    solution: 'Implement exponential backoff, use WebSocket for realtime',
  },
  500: {
    message: 'Internal Server Error',
    cause: 'Bitvavo server error',
  },
} as const;

// ============================================================================
// BEST PRACTICES FOR AUTO INVEST ORACLE
// ============================================================================

export const BITVAVO_BEST_PRACTICES = {
  architecture: {
    pattern: 'Observer → Planner → Executor',
    explanation: `
      Observer: Fetch /balance, /markets, subscribe to WS ticker
      Planner: Pure internal logic (no API calls)
      Executor: POST /order, PUT /order, DELETE /order
    `,
  },

  performance: {
    rule1: 'Use REST only for bootstrap/state queries',
    rule2: 'Use WebSocket for realtime price updates (reduces API weight)',
    rule3: 'Cache market metadata (/markets) for 1 hour',
    rule4: 'Subscribe to ticker channel instead of polling /ticker',
    rule5: 'Batch order operations when possible',
  },

  authentication: {
    rule1: 'Generate signature server-side only',
    rule2: 'Include nonce/timestamp in every request',
    rule3: 'Rotate API keys quarterly',
    rule4: 'Use read-only API keys for observers, trading keys for executors',
  },

  correctEndpoints: {
    price_data: '/ticker (NOT /ticker24h)',
    balance: '/balance',
    markets: '/markets (metadata only)',
    orderbook: '/orderbook',
    candles: '/candles',
    openOrders: '/openOrders',
    createOrder: 'POST /order',
    websocket_realtime: 'wss://ws.bitvavo.com/v2',
  },
} as const;

// ============================================================================
// COMMON MISTAKES TO AVOID
// ============================================================================

export const BITVAVO_COMMON_MISTAKES = [
  {
    mistake: 'Using /ticker24h instead of /ticker',
    impact: '404 error, prices not fetched',
    fix: 'Change endpoint to /ticker',
  },
  {
    mistake: 'Using /markets for prices',
    impact: 'Get metadata instead of prices (no "last" field)',
    fix: 'Use /ticker for current prices',
  },
  {
    mistake: 'Polling REST /ticker constantly',
    impact: 'High API weight, rate limit hits',
    fix: 'Subscribe to WebSocket ticker channel',
  },
  {
    mistake: 'Calling API every second without rate limiting',
    impact: '429 Too Many Requests',
    fix: 'Implement rate limiter (600 req/60s)',
  },
  {
    mistake: 'Storing sensitive data in frontend code',
    impact: 'API key compromise',
    fix: 'Keep API keys server-side only',
  },
] as const;
