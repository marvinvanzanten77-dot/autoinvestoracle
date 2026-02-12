/**
 * API Route: Agent Reports
 * GET /api/agent-reports - Get hourly agent reports with observations and suggestions
 */

import { getAgentReports, getLatestAgentReport, getAgentReportsByMood, getAgentReportStats } from '../server/handlers/agentReports';

export async function GET(req: Request): Promise<Response> {
  try {
    // Get user from session (implement your auth logic)
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const mood = url.searchParams.get('mood');
    const limit = parseInt(url.searchParams.get('limit') || '24', 10);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    }

    let data;

    if (action === 'latest') {
      // Get latest report
      data = await getLatestAgentReport(userId);
    } else if (action === 'stats') {
      // Get statistics
      const days = parseInt(url.searchParams.get('days') || '7', 10);
      data = await getAgentReportStats(userId, days);
    } else if (mood) {
      // Get reports by mood
      data = await getAgentReportsByMood(userId, mood as any, limit);
    } else {
      // Get all reports
      data = await getAgentReports(userId, limit);
    }

    return new Response(JSON.stringify({ status: 'success', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API] Agent reports error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
