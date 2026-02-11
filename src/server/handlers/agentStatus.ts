/**
 * Agent Status Handler
 * 
 * Manages agent state: running, paused, offline
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export type AgentStatus = 'running' | 'paused' | 'offline';

export interface AgentStatusInfo {
  userId: string;
  status: AgentStatus;
  changedAt: string;
  nextCheckAt?: string;
}

export async function getAgentStatus(userId: string): Promise<AgentStatus> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('agent_status')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[AgentStatus] Failed to fetch status:', error);
      throw error;
    }

    return (data?.agent_status || 'running') as AgentStatus;
  } catch (error) {
    console.error('[AgentStatus] Error getting status:', error);
    // Default to running if error
    return 'running';
  }
}

export async function setAgentStatus(
  userId: string,
  newStatus: AgentStatus,
  reason?: string
): Promise<AgentStatusInfo> {
  try {
    // Get current status
    const currentStatus = await getAgentStatus(userId);

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        agent_status: newStatus,
        agent_status_changed_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[AgentStatus] Failed to update status:', updateError);
      throw updateError;
    }

    // Log status change
    const { error: logError } = await supabase
      .from('agent_activity_log')
      .insert({
        user_id: userId,
        previous_status: currentStatus,
        new_status: newStatus,
        reason: reason || `Changed from ${currentStatus} to ${newStatus}`,
        changed_by: 'user',
      });

    if (logError) {
      console.error('[AgentStatus] Failed to log status change:', logError);
      // Don't throw - status was updated successfully
    }

    return {
      userId,
      status: newStatus,
      changedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AgentStatus] Error setting status:', error);
    throw error;
  }
}

export async function toggleAgentStatus(userId: string): Promise<AgentStatus> {
  try {
    const current = await getAgentStatus(userId);
    
    let newStatus: AgentStatus;
    if (current === 'running') {
      newStatus = 'paused';
    } else if (current === 'paused') {
      newStatus = 'running';
    } else {
      newStatus = 'running'; // offline -> running
    }

    await setAgentStatus(userId, newStatus, `Toggled from ${current}`);
    return newStatus;
  } catch (error) {
    console.error('[AgentStatus] Error toggling status:', error);
    throw error;
  }
}

export async function getActivityLog(userId: string, limit = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AgentStatus] Failed to fetch activity log:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[AgentStatus] Error getting activity log:', error);
    throw error;
  }
}

export async function shouldRunAgent(userId: string): Promise<boolean> {
  try {
    const status = await getAgentStatus(userId);
    return status === 'running';
  } catch (error) {
    console.error('[AgentStatus] Error checking if agent should run:', error);
    return false; // Fail safe - don't run if error
  }
}
