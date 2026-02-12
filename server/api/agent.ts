/**
 * Agent Routes - Agent status, activity, reports
 */

import { Express, Request, Response } from 'express';
import { supabase } from '../../../src/lib/supabase/client';

export function setupAgentRoutes(app: Express) {
  /**
   * GET /api/agent/status
   * Get current agent status
   */
  app.get('/api/agent/status', async (req: Request, res: Response) => {
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
        .select('agent_status, agent_status_changed_at')
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
        data: {
          status: data.agent_status || 'running',
          changedAt: data.agent_status_changed_at
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
   * GET /api/agent/activity
   * Get real agent activity log (NOT mock data)
   */
  app.get('/api/agent/activity', async (req: Request, res: Response) => {
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
        .from('agent_activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
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
          activities: data || [],
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
   * GET /api/agent/reports
   * Get agent reports
   */
  app.get('/api/agent/reports', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      const { data, error } = await supabase
        .from('agent_reports')
        .select('*')
        .eq('user_id', userId)
        .order('reported_at', { ascending: false })
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
          reports: data || [],
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
   * PUT /api/agent/settings
   * Update agent settings
   */
  app.put('/api/agent/settings', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const settings = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(settings)
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
