/**
 * Server API Routes Index
 * 
 * This file registers all API endpoints.
 * The actual implementations are in individual handler files.
 */

// Import handlers
import { setupAuthRoutes } from './auth';
import { setupAgentRoutes } from './agent';
import { setupPortfolioRoutes } from './portfolio';
import { setupMarketRoutes } from './market';
import { setupExchangeRoutes } from './exchanges';
import { setupChatRoutes } from './chat';

// Import type
import type { Express } from 'express';

/**
 * Register all API routes
 */
export function setupApiRoutes(app: Express) {
  // Auth routes
  setupAuthRoutes(app);
  
  // Agent routes
  setupAgentRoutes(app);
  
  // Portfolio routes
  setupPortfolioRoutes(app);
  
  // Market routes
  setupMarketRoutes(app);
  
  // Exchange routes
  setupExchangeRoutes(app);
  
  // Chat routes
  setupChatRoutes(app);
}
