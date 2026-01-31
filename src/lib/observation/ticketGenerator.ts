/**
 * TICKET-GENERATOR
 * 
 * Zet observaties om in tickets — informatieve adviezen
 * zonder enige dwang om te handelen.
 * 
 * Tickets zijn:
 * ✅ Informatief ("let op")
 * ✅ Tijdelijk (validUntil)
 * ✅ Geclassificeerd (type, confidence, priority)
 * ❌ GEEN trade-signalen
 * ❌ GEEN execution-orders
 * ❌ GEEN return-promises
 * 
 * Doel: Gebruiker bewust maken van interessante patronen
 * zonder druk om direct iets te doen.
 */

import type { MarketObservation, Ticket, ConfidenceLevel } from './types';

export function generateTicketsFromObservation(
  userId: string,
  observation: MarketObservation
): Partial<Ticket>[] {
  const tickets: Partial<Ticket>[] = [];
  
  // Ticket 1: Gewone observatie (altijd)
  tickets.push({
    userId,
    type: 'observatie',
    title: `${observation.assetCategory}: ${observation.marketContext}`,
    description: observation.observedBehavior,
    confidence: mapConfidence(observation.relativeMomentum?.btcVsEth || 0),
    priority: 'medium',
    validUntil: addHours(new Date(), 4).toISOString(),
    relatedObservationId: observation.id,
    pattern: `In ${observation.range} zien we: ${observation.observedBehavior}`,
    context: `Markt is op dit moment ${observation.marketContext}; volatiliteit ${observation.volatilityLevel}`
  });
  
  // Ticket 2: Mogelijke opportuniteit (alleen als exchange-afwijkingen)
  if (observation.exchangeAnomalies && observation.exchangeAnomalies.length > 0) {
    tickets.push({
      userId,
      type: 'opportuniteit',
      title: `Exchange-afwijking gedetecteerd`,
      description: observation.exchangeAnomalies
        .map(a => `${a.exchange}: ${a.anomaly}`)
        .join(' | '),
      confidence: observation.exchangeAnomalies[0].confidence,
      priority: observation.exchangeAnomalies[0].confidence === 'hoog' ? 'high' : 'medium',
      validUntil: addHours(new Date(), 2).toISOString(),
      relatedObservationId: observation.id,
      pattern: `Prijs/volume-verschillen tussen exchanges`,
      context: `Dit kan interessant zijn voor wie meerdere platforms monitor.`
    });
  }
  
  // Ticket 3: Relatieve momentum waarschuwing
  if (observation.relativeMomentum.btcVsEth && Math.abs(observation.relativeMomentum.btcVsEth) > 5) {
    tickets.push({
      userId,
      type: 'advies',
      title: `BTC-ETH correlatie breekt`,
      description: `Bitcoin en Ethereum bewegen meer dan 5% uiteen (verschil: ${observation.relativeMomentum.btcVsEth.toFixed(1)}%)`,
      confidence: 'middel',
      priority: 'medium',
      validUntil: addHours(new Date(), 6).toISOString(),
      relatedObservationId: observation.id,
      pattern: `Ontkoppeling: Een stijgt/daalt terwijl de ander tegengesteld beweegt`,
      context: `Dit zien we vaker in marktfaseveranderingen. Interessant om te monitoren.`
    });
  }
  
  return tickets;
}

/**
 * Genereer ticket op basis van een waargenomen patroon.
 * Bijvoorbeeld: "stablecoins stijgen terwijl BTC daalt".
 */
export function generatePatternTicket(
  userId: string,
  pattern: {
    name: string;
    description: string;
    assets: string[];
    confidence: ConfidenceLevel;
    historicalOccurrences?: number;
  }
): Partial<Ticket> {
  return {
    userId,
    type: 'advies',
    title: `Patroon: ${pattern.name}`,
    description: pattern.description,
    confidence: pattern.confidence,
    priority: pattern.confidence === 'hoog' ? 'high' : pattern.confidence === 'middel' ? 'medium' : 'low',
    validUntil: addHours(new Date(), 12).toISOString(),
    pattern: `${pattern.assets.join(' ↔ ')}: ${pattern.name}`,
    context: 
      pattern.historicalOccurrences
        ? `Dit patroon zagen we ${pattern.historicalOccurrences} keer eerder in de logs.`
        : `Dit patroon komt voor in ons observatie-archief.`
  };
}

/**
 * Genereer ticket voor markt-stress.
 */
export function generateStressTicket(
  userId: string,
  stressLevel: 'laag' | 'matig' | 'hoog',
  description: string
): Partial<Ticket> {
  const titleMap = {
    laag: 'Markt verhoogde aandacht nodig',
    matig: 'Markt toont spanningstekenen',
    hoog: 'Markt onder druk'
  };
  
  const priorityMap = { laag: 'low' as const, matig: 'medium' as const, hoog: 'high' as const };
  const validHours = stressLevel === 'hoog' ? 2 : stressLevel === 'matig' ? 4 : 8;
  
  return {
    userId,
    type: stressLevel === 'hoog' ? 'advies' : 'observatie',
    title: titleMap[stressLevel],
    description,
    confidence: stressLevel === 'hoog' ? 'hoog' : stressLevel === 'matig' ? 'middel' : 'laag',
    priority: priorityMap[stressLevel],
    validUntil: addHours(new Date(), validHours).toISOString(),
    pattern: `Markt-stress: ${stressLevel}`,
    context: `Monitoring aanbevolen vanwege marktomstandigheden.`
  };
}

/**
 * Genereer "alles rustig" ticket (ook informatief!).
 * Geen actie nodig, maar wel bevestiging dat markt normaal beweegt.
 */
export function generateCalmnessTicket(
  userId: string,
  marketContext: string
): Partial<Ticket> {
  return {
    userId,
    type: 'observatie',
    title: 'Markt beweegt normaal',
    description: `Geen aanleiding voor actie. Markten bewegen zoals verwacht: ${marketContext}.`,
    confidence: 'middel',
    priority: 'low',
    validUntil: addHours(new Date(), 8).toISOString(),
    pattern: 'Normaal marktgedrag',
    context: 'Alles is in orde. Geen nood om iets te veranderen.'
  };
}

// ============ HELPERS ============

function mapConfidence(value: number): ConfidenceLevel {
  const abs = Math.abs(value);
  if (abs > 10) return 'hoog';
  if (abs > 5) return 'middel';
  return 'laag';
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
