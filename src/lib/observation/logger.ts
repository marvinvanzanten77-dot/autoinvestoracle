/**
 * OBSERVATIE-LOGGER
 * 
 * Lichtgewicht logging-laag voor marktobservaties.
 * Dit kan geïmplementeerd worden op Supabase of lokale storage.
 * 
 * Deze laag is kritiek: hier wordt leerdata vastgelegd.
 */

import type { MarketObservation, Ticket } from './types';

/**
 * Stub: echte implementatie zou naar Supabase gaan.
 * Voor nu: in-memory cache + console logging.
 */

const observationLog = new Map<string, MarketObservation>();
const ticketLog = new Map<string, Ticket>();

export async function logObservation(obs: MarketObservation): Promise<string> {
  // In echte app: INSERT INTO observations (...)
  const id = obs.id || `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  observationLog.set(id, { ...obs, id });
  
  console.log('📊 OBSERVATIE GELOGD:', {
    id,
    asset: obs.assetCategory,
    context: obs.marketContext,
    behavior: obs.observedBehavior,
    timestamp: obs.timestamp
  });
  
  return id;
}

export async function logTicket(ticket: Ticket): Promise<string> {
  // In echte app: INSERT INTO tickets (...)
  const id = ticket.id || `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  ticketLog.set(id, { ...ticket, id });
  
  console.log('🎫 TICKET GEGENEREERD:', {
    id,
    type: ticket.type,
    title: ticket.title,
    confidence: ticket.confidence,
    validUntil: ticket.validUntil
  });
  
  return id;
}

/**
 * Log een trade execution ticket - wanneer een automatisch trade-voorstel
 * succesvol is uitgevoerd en de gebruiker moet op de hoogte worden gesteld.
 */
export async function logExecutionTicket(
  userId: string,
  execution: {
    proposalId: string;
    action: 'buy' | 'sell' | 'hold' | 'wait' | 'close_position' | 'rebalance';
    asset: string;
    amount: number;
    currency: string;
    orderId: string;
    confidence: number;
    rationale?: string;
  }
): Promise<string> {
  const actionLabel = {
    buy: '🟢 Koop',
    sell: '🔴 Verkoop',
    close_position: '⚫ Positie sluiten',
    rebalance: '🔄 Herbalanceer',
    hold: '⏸️ Wacht',
    wait: '⏸️ Observeer'
  }[execution.action] || execution.action;

  const ticket: Ticket = {
    id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'execution',
    title: `${actionLabel} ${execution.asset}`,
    description: `Order ${execution.orderId} is succesvol geplaatst.`,
    confidence: (
      execution.confidence === 100 ? 'hoog' :
      execution.confidence >= 50 ? 'middel' :
      'laag'
    ) as 'laag' | 'middel' | 'hoog',
    priority: execution.confidence === 100 ? 'high' : execution.confidence >= 50 ? 'medium' : 'low',
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    pattern: `${execution.action.toUpperCase()} ${execution.amount} ${execution.asset}`,
    context: execution.rationale || 'Automatische agent uitvoering',
    createdAt: new Date().toISOString(),
    relatedProposalId: execution.proposalId
  };

  // Add to ticket log
  const id = ticket.id;
  ticketLog.set(id, ticket);

  console.log('✅ EXECUTION TICKET GELOGD:', {
    id,
    userId,
    action: execution.action,
    asset: execution.asset,
    orderId: execution.orderId,
    confidence: execution.confidence
  });

  return id;
}

export function getObservations(userId: string): MarketObservation[] {
  return Array.from(observationLog.values()).filter(o => o.userId === userId);
}

export function getTickets(userId: string): Ticket[] {
  return Array.from(ticketLog.values()).filter(t => t.userId === userId);
}

export function getRecentObservations(userId: string, hoursBack: number = 24): MarketObservation[] {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return getObservations(userId).filter(o => new Date(o.timestamp) > cutoff);
}

/**
 * Registreer outcome van een observatie
 * Dit gebeurt LATER, nadat we teruggaan en zien wat werkelijk gebeurde.
 */
export async function recordOutcome(
  observationId: string,
  outcome: {
    what_happened: string;
    duration: string;
    was_significant: boolean;
    pattern_broken: boolean;
  }
): Promise<void> {
  const obs = observationLog.get(observationId);
  if (obs) {
    obs.outcome = outcome;
    obs.outcomeLoggedAt = new Date().toISOString();
    
    console.log('📝 OUTCOME VASTGELEGD:', {
      observationId,
      what_happened: outcome.what_happened,
      duration: outcome.duration,
      pattern_broken: outcome.pattern_broken
    });
  }
}

/**
 * Export observatie-log voor analyse (mock Supabase query)
 */
export function exportObservationLog(): Record<string, unknown> {
  return {
    total_observations: observationLog.size,
    total_tickets: ticketLog.size,
    observations_sample: Array.from(observationLog.values()).slice(0, 5),
    tickets_sample: Array.from(ticketLog.values()).slice(0, 5)
  };
}
