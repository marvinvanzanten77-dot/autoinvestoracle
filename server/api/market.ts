/**
 * Market Routes - Market data, observations, trends
 */

import { Express, Request, Response } from 'express';
import { supabase } from '../../../src/lib/supabase/client';

export function setupMarketRoutes(app: Express) {
  /**
   * GET /api/market/prices
   * Get current market prices
   */
  app.get('/api/market/prices', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('market_data_cache')
        .select('*')
        .order('cached_at', { ascending: false })
        .limit(1);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'QUERY_ERROR', message: error.message }
        });
      }

      const latestCache = data?.[0];
      res.json({
        success: true,
        data: {
          prices: latestCache?.prices || {},
          timestamp: latestCache?.cached_at,
          source: 'coingecko'
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
   * GET /api/market/observations
   * Get market observations for user
   */
  app.get('/api/market/observations', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      const { data, error } = await supabase
        .from('market_observations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'QUERY_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          observations: data || [],
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
   * POST /api/market/scan
   * Trigger market scan
   */
  app.post('/api/market/scan', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      // TODO: Implement actual market scanning
      // For now, just update last scan timestamp
      const { data, error } = await supabase
        .from('profiles')
        .update({
          agent_last_scan_at: new Date().toISOString()
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
        data: {
          scanCompleted: true,
          timestamp: new Date().toISOString()
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
   * GET /api/market/trends
   * Get market trends
   */
  app.get('/api/market/trends', async (req: Request, res: Response) => {
    try {
      const timeframe = (req.query.timeframe as string) || '24h';

      const { data, error } = await supabase
        .from('market_observations')
        .select('*')
        .eq('range', timeframe)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'QUERY_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          trends: data || [],
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
}
