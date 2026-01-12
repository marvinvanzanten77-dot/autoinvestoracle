export type PlatformInfo = {
  name: string;
  tone: string;
  url: string;
  costs: string;
  ease: string;
  pace: string;
  learning: string;
  bestFor: string;
  pros: string[];
  cons: string[];
};

export const platforms: PlatformInfo[] = [
  {
    name: 'Bitvavo',
    tone: 'Rustig en overzichtelijk',
    url: 'https://bitvavo.com',
    costs: 'Laag tot gemiddeld',
    ease: 'Makkelijk starten',
    pace: 'Rustig',
    learning: 'Veel duidelijkheid',
    bestFor: 'Starters',
    pros: ['Duidelijke schermen', 'Euro storten is simpel', 'Goed voor starters'],
    cons: ['Minder geavanceerde opties', 'Beperkter aanbod dan wereldspelers']
  },
  {
    name: 'Kraken',
    tone: 'Betrouwbaar en degelijk',
    url: 'https://kraken.com',
    costs: 'Gemiddeld',
    ease: 'Meer stappen',
    pace: 'Rustig',
    learning: 'Degelijke uitleg',
    bestFor: 'Zorgvuldige gebruikers',
    pros: ['Sterke reputatie', 'Goede beveiliging', 'Veel munten beschikbaar'],
    cons: ['Iets meer stappen om te starten', 'Schermen voelen wat zakelijker']
  },
  {
    name: 'Coinbase',
    tone: 'Gebruiksvriendelijk en bekend',
    url: 'https://coinbase.com',
    costs: 'Iets hoger',
    ease: 'Heel makkelijk',
    pace: 'Rustig',
    learning: 'Duidelijke uitleg',
    bestFor: 'Starters',
    pros: ['Heel toegankelijk', 'Heldere uitleg', 'Grote community'],
    cons: ['Kosten kunnen hoger voelen', 'Minder controle voor ervaren gebruikers']
  },
  {
    name: 'Bybit',
    tone: 'Sneller tempo',
    url: 'https://bybit.com',
    costs: 'Gemiddeld',
    ease: 'Meer keuzes',
    pace: 'Actief',
    learning: 'Meer uitzoekwerk',
    bestFor: 'Ervaren gebruikers',
    pros: ['Veel functies', 'Actieve markt', 'Veel tools'],
    cons: ['Kan druk aanvoelen', 'Meer risico als je nog leert']
  }
];
