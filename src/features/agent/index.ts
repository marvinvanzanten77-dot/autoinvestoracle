/**
 * Agent Feature
 * AI-powered portfolio monitoring and suggestions
 */

// Components
export { default as AgentActivityWidget } from './components/AgentActivityWidget';
export { default as AgentChat } from './components/AgentChat';
export { default as AgentStatusWidget } from './components/AgentStatusWidget';
export { default as AgentStatePanel } from './components/AgentStatePanel';
export { default as AgentIntentPanel } from './components/AgentIntentPanel';
export { default as TicketsWidget } from './components/TicketsWidget';

// Types are imported from parent shared types
export type { AgentStatus, AgentReport, ObservationType } from '../../../shared/types/domain';
