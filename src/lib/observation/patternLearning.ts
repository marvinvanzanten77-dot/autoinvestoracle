/**
 * Pattern Learning Engine
 * 
 * Analyzes execution outcomes to identify patterns that can be reused
 * This is the "learning" part of the agent
 */

import { supabase } from '../supabase/client';

interface PatternTrigger {
  asset: string;
  timeOfDay?: string;
  marketCondition?: string;
  volatility?: 'low' | 'medium' | 'high';
  trend?: 'up' | 'down' | 'sideways';
}

interface LearnedPattern {
  id: string;
  userId: string;
  patternType: string;
  description: string;
  triggerCondition: PatternTrigger;
  successCount: number;
  failCount: number;
  averageReturn: number;
  confidenceScore: number;
  active: boolean;
  firstObserved: Date;
  lastObserved: Date;
}

/**
 * Analyze execution outcomes to discover patterns
 */
export async function analyzePatterns(userId: string): Promise<LearnedPattern[]> {
  try {
    // Fetch recent execution outcomes
    const { data: outcomes, error: outcomesError } = await supabase
      .from('execution_outcomes')
      .select('*')
      .eq('user_id', userId)
      .gt('predicted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('predicted_at', { ascending: false });

    if (outcomesError) {
      console.error('Error fetching outcomes for pattern analysis:', outcomesError);
      return [];
    }

    if (!outcomes || outcomes.length === 0) {
      console.log('No outcomes available for pattern analysis');
      return [];
    }

    // Group outcomes by predicted_action and asset
    const patterns = new Map<string, {
      action: string;
      asset: string;
      outcomes: typeof outcomes;
    }>();

    for (const outcome of outcomes) {
      const key = `${outcome.predicted_action}_${outcome.predicted_asset}`;
      if (!patterns.has(key)) {
        patterns.set(key, {
          action: outcome.predicted_action,
          asset: outcome.predicted_asset,
          outcomes: []
        });
      }
      patterns.get(key)!.outcomes.push(outcome);
    }

    // Analyze each pattern
    const learnedPatterns: LearnedPattern[] = [];

    for (const [key, pattern] of patterns) {
      const successCount = pattern.outcomes.filter(
        o => o.profit_loss_percent && o.profit_loss_percent > 0
      ).length;
      
      const failCount = pattern.outcomes.filter(
        o => o.profit_loss_percent && o.profit_loss_percent <= 0
      ).length;
      
      const totalReturn = pattern.outcomes.reduce(
        (sum, o) => sum + (o.profit_loss_percent || 0),
        0
      );
      
      const successRate = successCount / (successCount + failCount) || 0;
      const averageReturn = pattern.outcomes.length > 0 
        ? totalReturn / pattern.outcomes.length 
        : 0;

      // Calculate confidence: success rate + average return impact
      const confidenceScore = (successRate * 0.7 + (Math.max(0, averageReturn / 10) * 0.3)) * 100;

      if (confidenceScore > 30) { // Only save patterns with >30% confidence
        const learnedPattern: LearnedPattern = {
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          patternType: `${pattern.action}_${pattern.asset}`,
          description: `${pattern.action} ${pattern.asset} pattern - Success rate: ${(successRate * 100).toFixed(1)}%`,
          triggerCondition: {
            asset: pattern.asset,
            timeOfDay: extractTimeOfDay(pattern.outcomes[0]?.predicted_at),
          },
          successCount,
          failCount,
          averageReturn,
          confidenceScore,
          active: confidenceScore > 50,
          firstObserved: new Date(pattern.outcomes[pattern.outcomes.length - 1]?.predicted_at),
          lastObserved: new Date(pattern.outcomes[0]?.predicted_at)
        };

        learnedPatterns.push(learnedPattern);

        // Save to database
        try {
          await supabase
            .from('learned_patterns')
            .upsert({
              user_id: userId,
              pattern_type: learnedPattern.patternType,
              description: learnedPattern.description,
              success_count: learnedPattern.successCount,
              fail_count: learnedPattern.failCount,
              average_return_percent: learnedPattern.averageReturn,
              trigger_condition: learnedPattern.triggerCondition,
              active: learnedPattern.active,
              confidence_score: learnedPattern.confidenceScore,
              first_observed: learnedPattern.firstObserved.toISOString(),
              last_observed: learnedPattern.lastObserved.toISOString(),
              updated_at: new Date().toISOString()
            });
        } catch (error) {
          console.error('Error saving pattern to database:', error);
        }
      }
    }

    console.log(`✅ Pattern Analysis Complete: Found ${learnedPatterns.length} patterns`);
    return learnedPatterns;

  } catch (error) {
    console.error('Error in analyzePatterns:', error);
    return [];
  }
}

/**
 * Get learned patterns for user
 */
export async function getLearnedPatterns(
  userId: string,
  activeOnly: boolean = true
): Promise<LearnedPattern[]> {
  try {
    let query = supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', userId);

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query.order('confidence_score', { ascending: false });

    if (error) {
      console.error('Error fetching patterns:', error);
      return [];
    }

    return data?.map(p => ({
      id: p.id,
      userId: p.user_id,
      patternType: p.pattern_type,
      description: p.description,
      triggerCondition: p.trigger_condition || {},
      successCount: p.success_count,
      failCount: p.fail_count,
      averageReturn: p.average_return_percent,
      confidenceScore: p.confidence_score,
      active: p.active,
      firstObserved: new Date(p.first_observed),
      lastObserved: new Date(p.last_observed)
    })) || [];
  } catch (error) {
    console.error('Error in getLearnedPatterns:', error);
    return [];
  }
}

/**
 * Update pattern based on new outcome
 */
export async function updatePatternFromOutcome(
  userId: string,
  outcome: {
    predictedAction: string;
    predictedAsset: string;
    profitLossPercent?: number;
  }
): Promise<void> {
  try {
    const patternType = `${outcome.predictedAction}_${outcome.predictedAsset}`;
    const isSuccess = outcome.profitLossPercent && outcome.profitLossPercent > 0;

    // Update counters
    const { data: existing } = await supabase
      .from('learned_patterns')
      .select('success_count, fail_count, average_return_percent')
      .eq('user_id', userId)
      .eq('pattern_type', patternType)
      .single();

    if (existing) {
      const newSuccessCount = isSuccess ? existing.success_count + 1 : existing.success_count;
      const newFailCount = !isSuccess ? existing.fail_count + 1 : existing.fail_count;
      const totalReturn = existing.average_return_percent * (newSuccessCount + newFailCount - 1) + 
        (outcome.profitLossPercent || 0);
      const newAverageReturn = totalReturn / (newSuccessCount + newFailCount);

      await supabase
        .from('learned_patterns')
        .update({
          success_count: newSuccessCount,
          fail_count: newFailCount,
          average_return_percent: newAverageReturn,
          last_observed: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('pattern_type', patternType);
    }
  } catch (error) {
    console.error('Error updating pattern:', error);
  }
}

/**
 * Helper: Extract time of day from timestamp
 */
function extractTimeOfDay(timestamp: string | undefined): string | undefined {
  if (!timestamp) return undefined;
  
  const hour = new Date(timestamp).getHours();
  
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}
