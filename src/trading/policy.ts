/**
 * POLICY SERVICE
 * 
 * Manages agent policies: load, create, update, activate
 * Provides preset policies: Observer, Hunter, SemiAuto
 */

import { supabase } from '../../src/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export type PolicyScansConfig = {
  mode: 'MANUAL' | 'ASSISTED' | 'AUTO';
  intervalMinutes: number;
  quietIntervalMinutes?: number;
  busyIntervalMinutes?: number;
  maxScansPerDay: number;
  aiEnabled: boolean;
};

export type PolicyBudgetConfig = {
  maxGptCallsPerDay: number;
  maxGptCallsPerHour: number;
};

export type PolicyGptGateConfig = {
  enabled: boolean;
  minVolatilityForGpt: number; // 0-100
  minMovePct1h: number; // e.g., 2.0 for 2%
  minMovePct4h: number;
  volumeSpikeZ: number; // z-score threshold
};

export type PolicyRiskConfig = {
  minOrderEur: number; // default 25
  maxOrderEur: number; // default 50 for v1
  maxDailyTrades: number; // default 3
  maxExposureEur?: number;
  cooldownMinutesAfterLoss: number;
  stopIfDrawdownDayPct: number;
  neverAverageDown: boolean;
};

export type PolicySignalConfig = {
  minConfidence: number; // 0-100, default 75
  allowedConfidences: number[];
};

export type PolicyAssetsConfig = {
  allowlist: string[]; // ["BTC-EUR", "ETH-EUR"]
  blocklist?: string[];
};

export type PolicyReportingConfig = {
  verbosity: 0 | 1 | 2;
  mustInclude: string[];
};

export type AgentPolicy = {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  scans: PolicyScansConfig;
  budget: PolicyBudgetConfig;
  gptGate: PolicyGptGateConfig;
  risk: PolicyRiskConfig;
  signal: PolicySignalConfig;
  assets: PolicyAssetsConfig;
  reporting: PolicyReportingConfig;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// PRESETS
// ============================================================================

export const POLICY_PRESETS = {
  OBSERVER: (): Omit<AgentPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
    name: 'Observer',
    isActive: false,
    scans: {
      mode: 'MANUAL',
      intervalMinutes: 120,
      maxScansPerDay: 10,
      aiEnabled: true
    },
    budget: {
      maxGptCallsPerDay: 5,
      maxGptCallsPerHour: 2
    },
    gptGate: {
      enabled: true,
      minVolatilityForGpt: 50,
      minMovePct1h: 3.0,
      minMovePct4h: 5.0,
      volumeSpikeZ: 2.0
    },
    risk: {
      minOrderEur: 25,
      maxOrderEur: 50,
      maxDailyTrades: 0, // No execution
      cooldownMinutesAfterLoss: 60,
      stopIfDrawdownDayPct: 5,
      neverAverageDown: true
    },
    signal: {
      minConfidence: 75,
      allowedConfidences: [75, 100]
    },
    assets: {
      allowlist: ['BTC-EUR', 'ETH-EUR']
    },
    reporting: {
      verbosity: 2,
      mustInclude: ['why', 'whyNot', 'invalidations', 'nextTrigger', 'riskNotes']
    }
  }),

  HUNTER: (): Omit<AgentPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
    name: 'Hunter',
    isActive: false,
    scans: {
      mode: 'ASSISTED',
      intervalMinutes: 60,
      quietIntervalMinutes: 240,
      busyIntervalMinutes: 15,
      maxScansPerDay: 20,
      aiEnabled: true
    },
    budget: {
      maxGptCallsPerDay: 10,
      maxGptCallsPerHour: 3
    },
    gptGate: {
      enabled: true,
      minVolatilityForGpt: 40,
      minMovePct1h: 2.0,
      minMovePct4h: 3.0,
      volumeSpikeZ: 1.5
    },
    risk: {
      minOrderEur: 25,
      maxOrderEur: 200,
      maxDailyTrades: 3,
      maxExposureEur: 1000,
      cooldownMinutesAfterLoss: 30,
      stopIfDrawdownDayPct: 10,
      neverAverageDown: true
    },
    signal: {
      minConfidence: 50,
      allowedConfidences: [50, 75, 100]
    },
    assets: {
      allowlist: ['BTC-EUR', 'ETH-EUR', 'ADA-EUR', 'SOL-EUR']
    },
    reporting: {
      verbosity: 1,
      mustInclude: ['why', 'riskNotes']
    }
  }),

  SEMI_AUTO: (): Omit<AgentPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
    name: 'SemiAuto',
    isActive: false,
    scans: {
      mode: 'ASSISTED',
      intervalMinutes: 30,
      quietIntervalMinutes: 120,
      busyIntervalMinutes: 10,
      maxScansPerDay: 50,
      aiEnabled: true
    },
    budget: {
      maxGptCallsPerDay: 15,
      maxGptCallsPerHour: 5
    },
    gptGate: {
      enabled: true,
      minVolatilityForGpt: 30,
      minMovePct1h: 1.5,
      minMovePct4h: 2.0,
      volumeSpikeZ: 1.0
    },
    risk: {
      minOrderEur: 25,
      maxOrderEur: 500,
      maxDailyTrades: 5,
      maxExposureEur: 2000,
      cooldownMinutesAfterLoss: 15,
      stopIfDrawdownDayPct: 15,
      neverAverageDown: false
    },
    signal: {
      minConfidence: 25,
      allowedConfidences: [25, 50, 75, 100]
    },
    assets: {
      allowlist: ['BTC-EUR', 'ETH-EUR', 'ADA-EUR', 'SOL-EUR', 'XRP-EUR']
    },
    reporting: {
      verbosity: 0,
      mustInclude: ['why']
    }
  })
};

// ============================================================================
// POLICY SERVICE
// ============================================================================

export async function getActivePolicy(userId: string): Promise<AgentPolicy | null> {
  const { data, error } = await supabase
    .from('agent_policies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows
    console.error('[PolicyService] getActivePolicy error:', error);
    return null;
  }

  if (!data) return null;

  return formatPolicy(data);
}

export async function getPolicyById(userId: string, policyId: string): Promise<AgentPolicy | null> {
  const { data, error } = await supabase
    .from('agent_policies')
    .select('*')
    .eq('user_id', userId)
    .eq('id', policyId)
    .single();

  if (error) {
    console.error('[PolicyService] getPolicyById error:', error);
    return null;
  }

  return data ? formatPolicy(data) : null;
}

export async function listPolicies(userId: string): Promise<AgentPolicy[]> {
  const { data, error } = await supabase
    .from('agent_policies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[PolicyService] listPolicies error:', error);
    return [];
  }

  return (data || []).map(formatPolicy);
}

export async function createPolicy(
  userId: string,
  name: string,
  config: Omit<AgentPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<AgentPolicy | null> {
  const { data, error } = await supabase
    .from('agent_policies')
    .insert({
      user_id: userId,
      name,
      is_active: false,
      policy_json: {
        scans: config.scans,
        budget: config.budget,
        gptGate: config.gptGate,
        risk: config.risk,
        signal: config.signal,
        assets: config.assets,
        reporting: config.reporting
      }
    })
    .select()
    .single();

  if (error) {
    console.error('[PolicyService] createPolicy error:', error);
    return null;
  }

  return formatPolicy(data);
}

export async function updatePolicy(
  userId: string,
  policyId: string,
  patch: Partial<Omit<AgentPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<AgentPolicy | null> {
  // Build policy_json patch
  const policyJsonPatch: any = {};
  if (patch.scans) policyJsonPatch.scans = patch.scans;
  if (patch.budget) policyJsonPatch.budget = patch.budget;
  if (patch.gptGate) policyJsonPatch.gptGate = patch.gptGate;
  if (patch.risk) policyJsonPatch.risk = patch.risk;
  if (patch.signal) policyJsonPatch.signal = patch.signal;
  if (patch.assets) policyJsonPatch.assets = patch.assets;
  if (patch.reporting) policyJsonPatch.reporting = patch.reporting;

  const { data, error } = await supabase
    .from('agent_policies')
    .update({
      ...(patch.name && { name: patch.name }),
      ...(Object.keys(policyJsonPatch).length > 0 && {
        policy_json: policyJsonPatch
      })
    })
    .eq('user_id', userId)
    .eq('id', policyId)
    .select()
    .single();

  if (error) {
    console.error('[PolicyService] updatePolicy error:', error);
    return null;
  }

  return formatPolicy(data);
}

export async function activatePolicy(userId: string, policyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('agent_policies')
    .update({ is_active: true })
    .eq('user_id', userId)
    .eq('id', policyId);

  if (error) {
    console.error('[PolicyService] activatePolicy error:', error);
    return false;
  }

  return true;
}

export async function deactivatePolicy(userId: string, policyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('agent_policies')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('id', policyId);

  if (error) {
    console.error('[PolicyService] deactivatePolicy error:', error);
    return false;
  }

  return true;
}

// ============================================================================
// TRADING ENABLED SETTING
// ============================================================================

export async function getTradingEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_trading_settings')
    .select('trading_enabled')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row yet; create one
    const { error: insertError } = await supabase
      .from('user_trading_settings')
      .insert({ user_id: userId, trading_enabled: false });
    
    if (insertError) {
      console.error('[PolicyService] Failed to create trading setting:', insertError);
    }
    return false;
  }

  if (error) {
    console.error('[PolicyService] getTradingEnabled error:', error);
    return false;
  }

  return data?.trading_enabled ?? false;
}

export async function setTradingEnabled(userId: string, enabled: boolean): Promise<boolean> {
  // Upsert: try update first, then insert if doesn't exist
  const { error: updateError } = await supabase
    .from('user_trading_settings')
    .update({ trading_enabled: enabled })
    .eq('user_id', userId);

  if (updateError && updateError.code === 'PGRST116') {
    // No row; insert
    const { error: insertError } = await supabase
      .from('user_trading_settings')
      .insert({ user_id: userId, trading_enabled: enabled });

    if (insertError) {
      console.error('[PolicyService] Failed to set trading enabled:', insertError);
      return false;
    }
  } else if (updateError) {
    console.error('[PolicyService] setTradingEnabled error:', updateError);
    return false;
  }

  return true;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPolicy(row: any): AgentPolicy {
  const policyJson = row.policy_json || {};

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    isActive: row.is_active,
    scans: policyJson.scans || {},
    budget: policyJson.budget || {},
    gptGate: policyJson.gptGate || {},
    risk: policyJson.risk || {},
    signal: policyJson.signal || {},
    assets: policyJson.assets || {},
    reporting: policyJson.reporting || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
