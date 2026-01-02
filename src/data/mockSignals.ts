export const mockSignals = {
  currentDate: '23 april 2024',
  scanStatus: 'live' as const,
  topChance: {
    assetName: 'NLX Tech Index',
    direction: 'up' as const,
    confidence: 82
  },
  marketSentiment: {
    label: 'Optimistisch',
    percentage: 68,
    explanation: 'Veel mensen durven weer in te stappen; gevoeligheid voor schrikreacties neemt toe.'
  },
  riskLevel: {
    label: 'Gemiddeld',
    description: 'De markt beweegt normaal: niet rustig, niet extreem wild.'
  },
  topSetups: [
    { name: 'AEX Futures', direction: 'Omhoog', confidence: 84, horizonText: 'Enkele uren', riskLabel: 'Normaal' },
    { name: 'EUR/USD', direction: 'Omlaag', confidence: 71, horizonText: 'Enkele dagen', riskLabel: 'Laag' },
    { name: 'ASML', direction: 'Nog even afwachten', confidence: 64, horizonText: 'Enkele uren', riskLabel: 'Hoog' }
  ],
  dailySummary: [
    'De technologiesector doet het beter dan de rest.',
    'Er is genoeg geld in de markt om beweging te blijven maken.',
    'In Europa is het economisch beeld rustig; grote onrust wordt vandaag niet verwacht.'
  ],
  warnings: [
    'Om 15:00 spreekt de Europese Centrale Bank — dit kan plots beweging geven.',
    'Morgen komen er Amerikaanse inflatiecijfers.',
    'Bedrijven in de chipsector reageren sterk op nieuws.'
  ],
  userRiskProfile: {
    label: 'Gebalanceerd',
    description: 'Jij zit in de gebalanceerde stand: niet super voorzichtig, niet extreem spannend. Je spreidt automatisch en vermijdt grote gokposities.'
  }
};
