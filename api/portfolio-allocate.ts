type AllocationInput = {
  amount: number;
  strategy: string;
  goals?: string[];
  knowledge?: string;
  changes?: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
};

type AllocationItem = {
  label: string;
  pct: number;
  rationale: string;
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function normalizeAllocation(items: AllocationItem[]) {
  const total = items.reduce((sum, item) => sum + item.pct, 0);
  if (!total) return items;
  return items.map((item) => ({
    ...item,
    pct: Math.round((item.pct / total) * 100)
  }));
}

function fallbackAllocation(): { allocation: AllocationItem[]; note: string } {
  return {
    allocation: [
      {
        label: 'Bitcoin',
        pct: 40,
        rationale: 'Meest gevestigde munt, rustiger profiel.'
      },
      {
        label: 'Ethereum',
        pct: 30,
        rationale: 'Sterke basis, breed gebruik.'
      },
      {
        label: 'Stablecoins',
        pct: 20,
        rationale: 'Dempt schommelingen en houdt ruimte.'
      },
      {
        label: 'Altcoins',
        pct: 10,
        rationale: 'Kleine positie voor spreiding.'
      }
    ],
    note: 'Dit is een neutrale verdeling als veilige fallback.'
  };
}

async function generateAllocation(input: AllocationInput) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const prompt = [
    `Je maakt een verdeling van een crypto saldo over potjes.`,
    `Strategie: ${input.strategy}.`,
    `Doelen: ${input.goals?.join(', ') || 'niet opgegeven'}.`,
    `Kennisniveau: ${input.knowledge || 'niet opgegeven'}.`,
    `Marktbewegingen (sinds start):`,
    `- Bitcoin: ${input.changes?.bitcoin ?? 0}%`,
    `- Ethereum: ${input.changes?.ethereum ?? 0}%`,
    `- Stablecoins: ${input.changes?.stablecoins ?? 0}%`,
    `- Altcoins: ${input.changes?.altcoins ?? 0}%`,
    ``,
    `Geef JSON met exact deze vorm:`,
    `{ "allocation": [ { "label": "Bitcoin|Ethereum|Stablecoins|Altcoins", "pct": number, "rationale": "korte zin" } ], "note": "korte toelichting" }`,
    `Regels:`,
    `- Som van pct is 100.`,
    `- Gebruik alleen de 4 labels.`,
    `- Geen extra tekst buiten JSON.`,
    `- Geen advies of voorspellingen, alleen verdeling en toelichting.`
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
          content: 'Je bent een rustige crypto-observator die alleen verdelingen geeft in JSON.'
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
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('OpenAI response is geen JSON.');
  }
  const parsed = JSON.parse(content.slice(start, end + 1)) as {
    allocation: AllocationItem[];
    note: string;
  };
  if (!parsed.allocation || !parsed.note) {
    throw new Error('OpenAI response mist velden.');
  }
  return {
    allocation: normalizeAllocation(parsed.allocation),
    note: parsed.note
  };
}

export default async function handler(req: { method?: string; body?: AllocationInput }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { amount, strategy, goals, knowledge, changes } = req.body || {};
    if (!amount || !strategy) {
      res.status(400).json({ error: 'amount en strategy zijn verplicht.' });
      return;
    }
    const payload = await generateAllocation({ amount, strategy, goals, knowledge, changes });
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(200).json(fallbackAllocation());
  }
}
