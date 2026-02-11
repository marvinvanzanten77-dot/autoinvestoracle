/**
 * Agent Reports Handler
 * 
 * Retrieves hourly agent reports with observations and action suggestions
 */

import { createClient } from '@supabase/supabase-js';
import type { AgentReport } from '../../lib/observation/types';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export async function getAgentReports(userId: string, limit = 24): Promise<AgentReport[]> {
  try {
    const { data, error } = await supabase
      .from('agent_reports')
      .select('*')
      .eq('user_id', userId)
      .order('reported_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AgentReports] Failed to fetch reports:', error);
      throw error;
    }

    // Map database format to AgentReport type
    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      reportedAt: row.reported_at,
      period: {
        from: row.period_from,
        to: row.period_to,
        durationMinutes: row.period_duration_minutes,
      },
      summary: {
        observationsCount: row.observations_count,
        suggestionsCount: row.suggestions_count,
        executionsCount: row.executions_count,
        mainTheme: row.main_theme,
      },
      observations: row.observations || [],
      suggestions: row.suggestions || [],
      agentMood: row.agent_mood as 'bullish' | 'neutral' | 'bearish' | 'cautious',
      recommendedAction: row.recommended_action,
      overallConfidence: row.overall_confidence,
      shouldNotify: row.should_notify,
      notificationSent: row.notification_sent,
    }));
  } catch (error) {
    console.error('[AgentReports] Error getting reports:', error);
    throw error;
  }
}

export async function getLatestAgentReport(userId: string): Promise<AgentReport | null> {
  try {
    const reports = await getAgentReports(userId, 1);
    return reports.length > 0 ? reports[0] : null;
  } catch (error) {
    console.error('[AgentReports] Error getting latest report:', error);
    throw error;
  }
}

export async function getAgentReportsByMood(userId: string, mood: 'bullish' | 'bearish' | 'cautious', limit = 10): Promise<AgentReport[]> {
  try {
    const { data, error } = await supabase
      .from('agent_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_mood', mood)
      .order('reported_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AgentReports] Failed to fetch reports by mood:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      reportedAt: row.reported_at,
      period: {
        from: row.period_from,
        to: row.period_to,
        durationMinutes: row.period_duration_minutes,
      },
      summary: {
        observationsCount: row.observations_count,
        suggestionsCount: row.suggestions_count,
        executionsCount: row.executions_count,
        mainTheme: row.main_theme,
      },
      observations: row.observations || [],
      suggestions: row.suggestions || [],
      agentMood: row.agent_mood,
      recommendedAction: row.recommended_action,
      overallConfidence: row.overall_confidence,
      shouldNotify: row.should_notify,
      notificationSent: row.notification_sent,
    }));
  } catch (error) {
    console.error('[AgentReports] Error getting reports by mood:', error);
    throw error;
  }
}

export async function getAgentReportStats(userId: string, days = 7): Promise<{
  totalReports: number;
  bullishCount: number;
  bearishCount: number;
  cautiousCount: number;
  avgConfidence: number;
  totalSuggestions: number;
}> {
  try {
    const reports = await getAgentReports(userId, 24 * days);
    
    const stats = {
      totalReports: reports.length,
      bullishCount: reports.filter(r => r.agentMood === 'bullish').length,
      bearishCount: reports.filter(r => r.agentMood === 'bearish').length,
      cautiousCount: reports.filter(r => r.agentMood === 'cautious').length,
      avgConfidence: reports.length > 0 
        ? Math.round(reports.reduce((sum, r) => sum + r.overallConfidence, 0) / reports.length)
        : 0,
      totalSuggestions: reports.reduce((sum, r) => sum + r.summary.suggestionsCount, 0),
    };

    return stats;
  } catch (error) {
    console.error('[AgentReports] Error getting stats:', error);
    throw error;
  }
}
