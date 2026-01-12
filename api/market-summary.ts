type MarketSummaryInput = {
  range: string;
  changes: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const cache = new Map<string, { timestamp: number; payload: { summary: string; createdAt: string } }>();

async function generateMarketSummary(input: MarketSummaryInput) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const prompt = [
    `Geef een korte, rustige duiding in het Nederlands over de crypto markt.`,
    `Tijdspanne: ${input.range}.`,
    `Bewegingen (percentage sinds start):`,
    `- Bitcoin: ${input.changes.bitcoin.toFixed(2)}%`,
    `- Ethereum: ${input.changes.ethereum.toFixed(2)}%`,
    `- Stablecoins: ${input.changes.stablecoins.toFixed(2)}%`,
    `- Altcoins: ${input.changes.altcoins.toFixed(2)}%`,
    ``,
    `Schrijf 3 korte zinnen. Geen advies, geen voorspellingen, geen jargon.`
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een rustige crypto-observator. Je spreekt in mensentaal en blijft neutraal.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  return data.choices?.[0]?.message?.content?.trim() || 'Geen samenvatting beschikbaar.';
}

export default async function handler(req: { method?: string; body?: MarketSummaryInput }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { range, changes } = req.body || {};
    if (!range || !changes) {
      res.status(400).json({ error: 'range en changes zijn verplicht.' });
      return;
    }
    const cacheKey = [
      range,
      changes.bitcoin.toFixed(2),
      changes.ethereum.toFixed(2),
      changes.stablecoins.toFixed(2),
      changes.altcoins.toFixed(2)
    ].join('|');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 120_000) {
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
      res.status(200).json(cached.payload);
      return;
    }
    const summary = await generateMarketSummary({ range, changes });
    const payload = { summary, createdAt: new Date().toISOString() };
    cache.set(cacheKey, { timestamp: Date.now(), payload });
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon AI-samenvatting niet ophalen.' });
  }
}
