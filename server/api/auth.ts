/**
 * Authentication Routes - Session and auth flows
 */

import { Express, Request, Response } from 'express';
import { supabase } from '../../../src/lib/supabase/client';

export function setupAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login
   * Authenticate with email/password
   */
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Email and password required' }
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: error.message }
        });
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session
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
   * POST /api/auth/logout
   * Terminate session
   */
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'LOGOUT_FAILED', message: error.message }
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/auth/session
   * Get current session
   */
  app.get('/api/auth/session', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'SESSION_ERROR', message: error.message }
        });
      }

      res.json({
        success: true,
        data: data.session
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });
}
