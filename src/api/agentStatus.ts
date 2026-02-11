/**
 * API Route: Agent Status Control
 * PUT /api/agent-status - Change agent status (running, paused, offline)
 * GET /api/agent-status - Get agent current status and activity log
 */

import { setAgentStatus, getAgentStatus, toggleAgentStatus, getActivityLog } from '../server/handlers/agentStatus';

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    }

    if (action === 'activity-log') {
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const log = await getActivityLog(userId, limit);
      return new Response(JSON.stringify({ status: 'success', data: log }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = await getAgentStatus(userId);
    return new Response(JSON.stringify({ status: 'success', data: { agentStatus: status } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API] Agent status GET error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action'); // 'set', 'toggle'
    
    const body = await req.json();
    const { newStatus, reason } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    }

    let result;

    if (action === 'toggle') {
      // Toggle between running and paused
      const status = await toggleAgentStatus(userId);
      result = { agentStatus: status, action: 'toggled' };
    } else if (newStatus && ['running', 'paused', 'offline'].includes(newStatus)) {
      // Set specific status
      const result_data = await setAgentStatus(userId, newStatus, reason);
      result = { agentStatus: result_data.status, action: 'set' };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid newStatus' }), { status: 400 });
    }

    return new Response(JSON.stringify({ status: 'success', data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API] Agent status PUT error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
