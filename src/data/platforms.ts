export type PlatformInfo = {
  name: string;
  tone: string;
  pros: string[];
  cons: string[];
};

export const platforms: PlatformInfo[] = [
  {
    name: 'Bitvavo',
    tone: 'Rustig en overzichtelijk',
    pros: ['Duidelijke schermen', 'Euro storten is simpel', 'Goed voor starters'],
    cons: ['Minder geavanceerde opties', 'Beperkter aanbod dan wereldspelers']
  },
  {
    name: 'Kraken',
    tone: 'Betrouwbaar en degelijk',
    pros: ['Sterke reputatie', 'Goede beveiliging', 'Veel munten beschikbaar'],
    cons: ['Iets meer stappen om te starten', 'Schermen voelen wat zakelijker']
  },
  {
    name: 'Coinbase',
    tone: 'Gebruiksvriendelijk en bekend',
    pros: ['Heel toegankelijk', 'Heldere uitleg', 'Grote community'],
    cons: ['Kosten kunnen hoger voelen', 'Minder controle voor ervaren gebruikers']
  },
  {
    name: 'Bybit',
    tone: 'Sneller tempo',
    pros: ['Veel functies', 'Actieve markt', 'Veel tools'],
    cons: ['Kan druk aanvoelen', 'Meer risico als je nog leert']
  }
];
