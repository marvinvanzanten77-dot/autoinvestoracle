/**
 * OBSERVATIE-LOGGER
 * 
 * Logging-laag voor marktobservaties en execution outcomes.
 * Nu geïntegreerd met Supabase voor persistent data storage.
 */

import { supabase } from '../supabase/client';
import type { MarketObservation, Ticket } from './types';

/**
 * Log a market observation to Supabase
 */
export async function logObservation(obs: MarketObservation): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('market_observations')
      .insert({
        id: obs.id,
        user_id: obs.userId,
        timestamp: obs.timestamp,
        range: obs.range,
        asset_category: obs.assetCategory,
        market_context: obs.marketContext,
        volatility_level: obs.volatilityLevel,
        observed_behavior: obs.observedBehavior,
        relative_momentum: obs.relativeMomentum || {},
        exchange_anomalies: obs.exchangeAnomalies || [],
        data_sources: obs.dataSources || {},
        source: obs.source
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to log observation:', error);
      throw error;
    }

    console.log('📊 OBSERVATIE VASTGELEGD IN SUPABASE:', {
      id: data.id,
      asset: obs.assetCategory,
      context: obs.marketContext,
      timestamp: obs.timestamp
    });

    return data.id;
  } catch (error) {
    console.error('Error logging observation:', error);
    throw error;
  }
}

/**
 * Record execution outcome (what actually happened after an observation)
 */
export async function recordOutcome(
  userId: string,
  observationId: string | undefined,
  outcome: {
    predictedAction: string;
    predictedAsset: string;
    predictedConfidence: number;
    predictedAt: Date;
    
    actualOutcome: string;
    actualResult?: string;
    durationHours?: number;
    profitLossPercent?: number;
    
    wasSignificant: boolean;
    patternIdentified?: string;
  }
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('execution_outcomes')
      .insert({
        user_id: userId,
        observation_id: observationId,
        predicted_action: outcome.predictedAction,
        predicted_asset: outcome.predictedAsset,
        predicted_confidence: outcome.predictedConfidence,
        predicted_at: outcome.predictedAt.toISOString(),
        
        actual_outcome: outcome.actualOutcome,
        actual_result: outcome.actualResult,
        duration_hours: outcome.durationHours,
        profit_loss_percent: outcome.profitLossPercent,
        
        was_significant: outcome.wasSignificant,
        pattern_identified: outcome.patternIdentified,
        
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to record outcome:', error);
      throw error;
    }

    console.log('✅ OUTCOME VASTGELEGD:', {
      id: data.id,
      action: outcome.predictedAction,
      result: outcome.actualOutcome,
      profitLoss: outcome.profitLossPercent
    });

    return data.id;
  } catch (error) {
    console.error('Error recording outcome:', error);
    throw error;
  }
}

export async function logTicket(ticket: Ticket): Promise<string> {
  try {
    // Log tickets as market observations for now
    const { data, error } = await supabase
      .from('market_observations')
      .insert({
        user_id: ticket.userId,
        timestamp: ticket.createdAt,
        asset_category: 'ticket',
        market_context: ticket.title,
        observed_behavior: ticket.description || '',
        source: 'ticket_generator'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to log ticket:', error);
      throw error;
    }

    console.log('🎫 TICKET GEGENEREERD:', {
      id: data.id,
      type: ticket.type,
      title: ticket.title,
      confidence: ticket.confidence
    });

    return data.id;
  } catch (error) {
    console.error('Error logging ticket:', error);
    throw error;
  }
}

/**
 * Get observations from Supabase
 */
export async function getObservations(userId: string, limit: number = 50): Promise<MarketObservation[]> {
  try {
    const { data, error } = await supabase
      .from('market_observations')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching observations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getObservations:', error);
    return [];
  }
}

/**
 * Get recent observations within specified hours
 */
export async function getRecentObservations(
  userId: string,
  hoursBack: number = 24
): Promise<MarketObservation[]> {
  try {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('market_observations')
      .select('*')
      .eq('user_id', userId)
      .gt('timestamp', cutoff)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching recent observations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecentObservations:', error);
    return [];
  }
}

/**
 * Export observation log for analysis
 */
export async function exportObservationLog(userId: string): Promise<{
  totalObservations: number;
  totalOutcomes: number;
  recent: MarketObservation[];
}> {
  try {
    const [observations, outcomes] = await Promise.all([
      supabase
        .from('market_observations')
        .select('*', { count: 'exact' })
        .eq('user_id', userId),
      
      supabase
        .from('execution_outcomes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
    ]);

    return {
      totalObservations: observations.count || 0,
      totalOutcomes: outcomes.count || 0,
      recent: observations.data?.slice(0, 5) || []
    };
  } catch (error) {
    console.error('Error exporting observation log:', error);
    return {
      totalObservations: 0,
      totalOutcomes: 0,
      recent: []
    };
  }
}