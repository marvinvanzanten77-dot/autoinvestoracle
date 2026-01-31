import type { ApiRequest, ApiResponse } from './types';
import { getTickets } from '../../lib/observation/logger';
import { createErrorResponse, getHttpStatusCode, validateRequired } from '../errorHandler';

export async function handleTickets(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    const error = createErrorResponse('Method not allowed', 'INVALID_REQUEST');
    res.status(getHttpStatusCode('INVALID_REQUEST')).json(error);
    return;
  }

  try {
    const userId = (req.query?.userId as string) || 'anonymous';

    // Valideer userId
    const validation = validateRequired({ userId }, ['userId']);
    if (!validation.valid) {
      res.status(400).json(validation.error);
      return;
    }

    // Haal tickets op (momenteel in-memory, later Supabase)
    const allTickets = getTickets(userId);

    // Filter: alleen geldige tickets (nog niet verlopen)
    const now = new Date();
    const activeTickets = allTickets.filter((ticket) => new Date(ticket.validUntil) > now);

    // Sort: newest first
    activeTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      tickets: activeTickets,
      count: activeTickets.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in handleTickets:', err);
    const error = createErrorResponse(
      err instanceof Error ? err.message : 'Kon tickets niet ophalen',
      'INTERNAL_ERROR'
    );
    res.status(500).json(error);
  }
}
