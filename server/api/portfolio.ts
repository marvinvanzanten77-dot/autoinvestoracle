/**
 * Portfolio Routes - Portfolio data, allocations, history
 */

import { Express, Request, Response } from 'express';
import { supabase } from '../../../src/lib/supabase/client';

export function setupPortfolioRoutes(app: Express) {
  /**
   * GET /api/portfolio/current
   * Get current portfolio state
   */
  app.get('/api/portfolio/current', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('portfolio_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' }
        });
      }

      res.json({
        success: true,
        data: data?.portfolio_data || []
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/portfolio/allocation
   * Get current portfolio allocation
   */
  app.get('/api/portfolio/allocation', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      // Get market prices to calculate allocations
      const { data: priceData } = await supabase
        .from('market_data_cache')
        .select('*')
        .order('cached_at', { ascending: false })
        .limit(1);

      const { data: portfolioData } = await supabase
        .from('profiles')
        .select('portfolio_data')
        .eq('user_id', userId)
        .single();

      // Calculate allocations based on current prices
      const allocations = [];
      if (portfolioData?.portfolio_data) {
        for (const position of portfolioData.portfolio_data) {
          // Find price from cache
          const price = priceData?.[0]?.prices?.[position.asset] || 0;
          const valueInEur = position.amount * price;
          allocations.push({
            asset: position.asset,
            amount: position.amount,
            valueInEur,
            percentage: 0 // Will be calculated on frontend
          });
        }
      }

      res.json({
        success: true,
        data: allocations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/portfolio/performance
   * Get portfolio performance metrics
   */
  app.get('/api/portfolio/performance', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const timeframe = (req.query.timeframe as string) || '24h';

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      // Get performance snapshots
      const { data, error } = await supabase
        .from('market_observations')
        .select('*')
        .eq('user_id', userId)
        .eq('range', timeframe === '24h' ? '24h' : timeframe)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'QUERY_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          snapshots: data || [],
          timeframe,
          count: data?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * POST /api/portfolio/update
   * Update portfolio data (from exchange sync)
   */
  app.post('/api/portfolio/update', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { portfolio } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      if (!portfolio) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'portfolio data required' }
        });
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          portfolio_data: portfolio,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPDATE_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });
}
