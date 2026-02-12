/**
 * Exchange Routes - Exchange connections, balances, trading
 */

import { Express, Request, Response } from 'express';
import { supabase } from '../../../src/lib/supabase/client';

export function setupExchangeRoutes(app: Express) {
  /**
   * GET /api/exchanges/status
   * Get status of all connected exchanges
   */
  app.get('/api/exchanges/status', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      // Get exchange connections
      const { data: connections, error } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'QUERY_ERROR', message: error.message }
        });
      }

      const status = connections?.map(conn => ({
        exchangeName: conn.exchange_name,
        isConnected: conn.is_connected,
        lastSyncAt: conn.last_sync_at,
        syncStatus: conn.sync_status || 'idle',
        errorMessage: conn.error_message
      })) || [];

      res.json({
        success: true,
        data: { exchanges: status }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * POST /api/exchanges/connect
   * Connect to an exchange
   */
  app.post('/api/exchanges/connect', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { exchangeName, apiKey, secretKey, passphrase } = req.body;

      if (!userId || !exchangeName || !apiKey || !secretKey) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'userId, exchangeName, apiKey, secretKey required' }
        });
      }

      // TODO: Encrypt credentials before storing
      const { data, error } = await supabase
        .from('exchange_connections')
        .upsert({
          user_id: userId,
          exchange_name: exchangeName,
          api_key: apiKey,
          secret_key: secretKey,
          passphrase: passphrase || null,
          is_connected: true,
          sync_status: 'idle'
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'INSERT_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          exchangeName: data.exchange_name,
          isConnected: true
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
   * POST /api/exchanges/disconnect
   * Disconnect from an exchange
   */
  app.post('/api/exchanges/disconnect', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { exchangeName } = req.body;

      if (!userId || !exchangeName) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'userId, exchangeName required' }
        });
      }

      const { error } = await supabase
        .from('exchange_connections')
        .delete()
        .eq('user_id', userId)
        .eq('exchange_name', exchangeName);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DELETE_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          exchangeName,
          isConnected: false
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
   * GET /api/exchanges/balance
   * Get balance from an exchange
   */
  app.get('/api/exchanges/balance', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const exchangeName = req.query.exchangeName as string;

      if (!userId || !exchangeName) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'userId, exchangeName required' }
        });
      }

      // Get exchange connection
      const { data: connection, error: connError } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('exchange_name', exchangeName)
        .single();

      if (connError) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exchange connection not found' }
        });
      }

      // TODO: Decrypt credentials and fetch balance from exchange
      // For now return empty balance
      res.json({
        success: true,
        data: {
          exchangeName,
          balances: [],
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
   * POST /api/exchanges/trade
   * Place a trade order
   */
  app.post('/api/exchanges/trade', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { exchangeName, asset, side, amount, price } = req.body;

      if (!userId || !exchangeName || !asset || !side || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'userId, exchangeName, asset, side, amount required' }
        });
      }

      // TODO: Implement actual trade execution
      // This is a placeholder for now
      const orderId = `order_${Date.now()}`;

      // Log the trade intention
      const { error } = await supabase
        .from('market_observations')
        .insert({
          user_id: userId,
          timestamp: new Date().toISOString(),
          asset_category: asset,
          market_context: `Trade ${side} ${amount} ${asset} at ${price || 'market'}`,
          source: exchangeName
        });

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'LOG_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          orderId,
          status: 'pending',
          exchangeName,
          asset,
          side,
          amount,
          price: price || 'market'
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
