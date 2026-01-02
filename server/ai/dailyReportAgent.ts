import { mockSignals } from '../../src/data/mockSignals';

export type DashboardSnapshot = typeof mockSignals;

/**
 * TODO: OpenAI integratie voorbeeld (niet actief):
 *
 * const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * const prompt = `Schrijf een kort dagrapport voor ${snapshot.currentDate} ...`;
 * const response = await client.chat.completions.create({
 *   model: 'gpt-4o-mini',
 *   messages: [{ role: 'system', content: '...' }, { role: 'user', content: prompt }],
 * });
 * return response.choices[0]?.message?.content ?? 'Kon geen rapport genereren.';
 */
export async function generateDailyReportAgent(
  snapshot: DashboardSnapshot,
  profile: 'voorzichtig' | 'gebalanceerd' | 'actief'
): Promise<string> {
  const riskLabel = snapshot.riskLevel.label;
  const top = snapshot.topChance;
  const sentiment = snapshot.marketSentiment;
  const warning = snapshot.warnings[0] || 'Geen directe waarschuwingen.';
  const profileCopy =
    profile === 'voorzichtig'
      ? 'We focussen op defensieve posities en beperken drawdowns.'
      : profile === 'gebalanceerd'
        ? 'We zoeken evenwicht tussen groei en bescherming.'
        : 'We accepteren meer volatiliteit om kansen te pakken.';

  const observations = snapshot.topSetups.slice(0, 3).map((s) => `${s.name} (${s.confidence}%)`).join(', ');

  return [
    `Dagrapport ${snapshot.currentDate}`,
    ``,
    `Risico-inschatting: ${riskLabel} (${profileCopy})`,
    `Beste kans volgens scan: ${top.assetName} (${top.confidence}/100, richting: ${
      top.direction === 'up' ? 'omhoog' : top.direction === 'down' ? 'omlaag' : 'afwachten'
    }).`,
    `Sentiment: ${sentiment.label} (${sentiment.percentage}%) en waarschuwing: ${warning}`,
    `Belangrijkste setups: ${observations}`,
    ``,
    `Dit is geen advies, alleen informatie.`
  ].join('\n');
}
