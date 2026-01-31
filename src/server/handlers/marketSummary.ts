import type { ApiRequest, ApiResponse } from './types';

type MarketSummaryRequest = {
  range: '1h' | '24h' | '7d';
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

async function generateSummary(input: MarketSummaryRequest) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  // 🧠 HERORIËNTEERDE AI-ROL: Interpretatie, niet predictie
  // De AI noemt patronen die ze ziet, zonder te zeggen wat er gaat gebeuren.
  const prompt = [
    `Je bent een observator, niet een voorspeller.`,
    `Beschrijf ZUIVER wat gebeurde in de cryptomarkt, zonder voorspellingen of advies.`,
    ``,
    `Periode: ${input.range}.`,
    `Waargenomen bewegingen:`,
    `- Bitcoin: ${input.changes.bitcoin}%`,
    `- Ethereum: ${input.changes.ethereum}%`,
    `- Stablecoins: ${input.changes.stablecoins}%`,
    `- Altcoins: ${input.changes.altcoins}%`,
    ``,
    `Taak:`,
    `1. Noem welke assets het meest/minst bewogen.`,
    `2. Beschrijf correlaties (of ontkoppeling).`,
    `3. Noem wat dit mogelijk aangeeft over markt-fase (niet wat gaat gebeuren).`,
    `4. 3-4 zinnen, rustig, feitelijk.`,
    ``,
    `VERBODEN: geen "koopen/verkopen", geen "zal stijgen/dalen", geen returns.`
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een rustige crypto-observator. Je geeft geen advies of voorspellingen.'
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

function fallbackSummary(input: MarketSummaryRequest) {
  const btc = input.changes.bitcoin;
  const eth = input.changes.ethereum;
  const stable = input.changes.stablecoins;
  const alt = input.changes.altcoins;
  return `In de afgelopen ${input.range} zien we beperkte bewegingen. Bitcoin ${btc >= 0 ? 'stijgt' : 'daalt'} licht (${btc}%), Ethereum ${eth >= 0 ? 'stijgt' : 'daalt'} met ${Math.abs(eth)}%, stablecoins blijven vrijwel stabiel (${stable}%) en altcoins bewegen ${alt >= 0 ? 'licht omhoog' : 'licht omlaag'} (${alt}%).`;
}

export async function handleMarketSummary(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { range, changes } = (req.body || {}) as MarketSummaryRequest;
    if (!range || !changes) {
      res.status(400).json({ error: 'range en changes zijn verplicht.' });
      return;
    }
    const summary = await generateSummary({ range, changes });
    res.status(200).json({ summary, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    const { range, changes } = (req.body || {}) as MarketSummaryRequest;
    if (range && changes) {
      res.status(200).json({ summary: fallbackSummary({ range, changes }), createdAt: new Date().toISOString() });
      return;
    }
    res.status(500).json({ error: 'Kon samenvatting niet ophalen.' });
  }
}
