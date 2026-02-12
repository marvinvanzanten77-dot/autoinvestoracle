/**
 * Shared API Client
 * Fetch wrappers for backend endpoints
 */

// Agent
export * from './agentStatus';
export { setupAgentReportsRoutes } from './agentReports';

// Market
export { setupMarketDataRoutes } from './marketData';
export { setupMarketScanRoutes } from './marketScan';
export { setupMarketSummaryRoutes } from './marketSummary';

// Portfolio
export { setupPortfolioAllocateRoutes } from './portfolioAllocate';

// Exchanges
export { setupExchangesRoutes } from './exchanges';

// Chat
export * from './chat';

// Trading
export * from './trading';

// Dashboard
export * from './dashboard';

// Daily Report
export * from './dailyReport';
