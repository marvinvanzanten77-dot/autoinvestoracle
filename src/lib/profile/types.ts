export type UserProfile = {
  displayName: string;
  email: string;
  primaryGoal: 'growth' | 'income' | 'preserve' | 'learn';
  timeHorizon: 'lt1y' | '1-3y' | '3-7y' | '7y+';
  riskTolerance: number;
  maxDrawdownComfort: '5' | '10' | '20' | '30' | '50';
  rebalancing: 'none' | 'quarterly' | 'monthly';
  panicSellLikelihood: 'low' | 'medium' | 'high';
  startAmountRange: '0-500' | '500-2k' | '2k-10k' | '10k-50k' | '50k+';
  monthlyContributionRange: '0' | '1-100' | '100-500' | '500-2k' | '2k+';
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced';
  assetPreference: Array<'crypto' | 'etf' | 'stocks' | 'mixed'>;
  excludedAssets?: string[];
  ethicalConstraints?: string;
  advisorMode: 'conservative' | 'balanced' | 'aggressive';
  explanationDepth: 'short' | 'normal' | 'deep';
};
