export type AcademyLevel = 'beginner' | 'intermediate' | 'expert';

export interface AcademyModule {
  id: string;
  level: AcademyLevel;
  order: number;
  title: string;
  description: string;
  badge: {
    name: string;
    icon: string;
    color: string;
  };
  lessons: {
    title: string;
    content: string;
    keyPoints: string[];
  }[];
  aiPrompt: string;
}

export const academyCurriculum: AcademyModule[] = [
  // BEGINNER - Basiskennis voor starters
  {
    id: 'beginner-01',
    level: 'beginner',
    order: 1,
    title: 'Wat is Bitcoin?',
    description: 'Ontdek de basics van Bitcoin, het eerste cryptocoin.',
    badge: {
      name: 'Bitcoin Basics',
      icon: '₿',
      color: 'bg-yellow-500'
    },
    lessons: [
      {
        title: 'Introduction to Bitcoin',
        content: 'Bitcoin is een gedecentraliseerde digitale munt die in 2009 werd uitgevonden door Satoshi Nakamoto. Het werkt zonder centrale bank of regering.',
        keyPoints: [
          'Bitcoin is de eerste succesvolle cryptocurrency',
          'Werkt op blockchain technologie',
          'Begrenzing: slechts 21 miljoen coins'
        ]
      },
      {
        title: 'Waarom Bitcoin waardevol is',
        content: 'Bitcoin is waardevol omdat het schaars is, nuttig, en gedecentraliseerd.',
        keyPoints: [
          'Schaarsheid: vaste supply',
          'Nuttigheid: kan overal heen',
          'Geen centrale controle'
        ]
      }
    ],
    aiPrompt: 'Leg op een begrijpelijke manier uit wat Bitcoin is, waarom het werd uitgevonden, en wat de voordelen zijn van gedecentraliseerde valuta. Zorg dat het geschikt is voor beginners.'
  },
  {
    id: 'beginner-02',
    level: 'beginner',
    order: 2,
    title: 'Blockchain Basics',
    description: 'Begrijp hoe blockchain technologie werkt.',
    badge: {
      name: 'Blockchain Master',
      icon: '⛓️',
      color: 'bg-blue-500'
    },
    lessons: [
      {
        title: 'Wat is een blockchain?',
        content: 'Een blockchain is een rij van digitale "blokken" die met elkaar gekoppeld zijn door wiskundige codes, waardoor het onmogelijk is om data achteraf te veranderen.',
        keyPoints: [
          'Gelinkt via cryptografische hashes',
          'Immutable (onveranderbaar)',
          'Transparant en gedistribueerd'
        ]
      },
      {
        title: 'Miners en validatie',
        content: 'Miners zorgen ervoor dat alle transacties correct zijn en voegen nieuwe blokken toe aan de chain.',
        keyPoints: [
          'Miners controleren transacties',
          'Proof of Work systeem',
          'Beloning in crypto'
        ]
      }
    ],
    aiPrompt: 'Verklaar blockchain technologie voor beginners. Gebruik analogieën (bijv. onveranderbare ledger). Vermeld miners, hashing, en consensus.'
  },
  {
    id: 'beginner-03',
    level: 'beginner',
    order: 3,
    title: 'Hoe werkt een Crypto Wallet?',
    description: 'Leer hoe je je cryptocurrency veilig bewaart.',
    badge: {
      name: 'Wallet Wizard',
      icon: '👛',
      color: 'bg-purple-500'
    },
    lessons: [
      {
        title: 'Public vs Private Keys',
        content: 'Een wallet heeft twee sleutels: een openbare (public) en een privésleutel (private). De publieke sleutel is je rekeningnummer, de privésleutel is je wachtwoord.',
        keyPoints: [
          'Public key = waar anderen naar sturen',
          'Private key = bewijs van eigendom',
          'Nooit je private key delen!'
        ]
      },
      {
        title: 'Soorten wallets',
        content: 'Er zijn hot wallets (online, snel) en cold wallets (offline, veilig).',
        keyPoints: [
          'Hot wallets: gemak',
          'Cold wallets: veiligheid',
          'Hardware wallets, paper wallets, etc.'
        ]
      }
    ],
    aiPrompt: 'Leg uit hoe crypto wallets werken. Verklaar public/private keys, en bespreek hot vs cold storage. Geef veiligheidstips.'
  },
  {
    id: 'beginner-04',
    level: 'beginner',
    order: 4,
    title: 'Soorten Cryptocurrencies',
    description: 'Ontdek de verschillende types cryptos en hun functies.',
    badge: {
      name: 'Crypto Connoisseur',
      icon: '🪙',
      color: 'bg-orange-500'
    },
    lessons: [
      {
        title: 'Coins vs Tokens',
        content: 'Coins hebben hun eigen blockchain (Bitcoin, Ethereum), tokens draaien op bestaande blockchains (USDC op Ethereum).',
        keyPoints: [
          'Coins = native blockchain',
          'Tokens = draaien op andere chain',
          'Verschillende use cases'
        ]
      },
      {
        title: 'Stablecoins',
        content: 'Stablecoins zijn gekoppeld aan fiat (EUR, USD) en hebben stabiele waarde.',
        keyPoints: [
          'USDC, USDT, DAI',
          'Nuttig voor trading',
          'Minder volatiel'
        ]
      }
    ],
    aiPrompt: 'Verklaar het verschil tussen coins en tokens. Bespreek stablecoins, altcoins, en waarom ze bestaan.'
  },
  {
    id: 'beginner-05',
    level: 'beginner',
    order: 5,
    title: 'Gas, Fees & Transactiekosten',
    description: 'Begrijp hoe transactiekosten werken in crypto.',
    badge: {
      name: 'Fee Navigator',
      icon: '⛽',
      color: 'bg-red-500'
    },
    lessons: [
      {
        title: 'Gas fees uitgelegd',
        content: 'Gas is de vergoeding voor het uitvoeren van transacties op een blockchain. Hoe drukker het netwerk, hoe hoger het gas.',
        keyPoints: [
          'Gas = prioriteit betalen',
          'Gwei = unit van gas',
          'Varieert per chain'
        ]
      },
      {
        title: 'Fees minimaliseren',
        content: 'Je kunt fees besparen door op rustige momenten te transacten of andere chains te gebruiken.',
        keyPoints: [
          'Off-peak transacties goedkoper',
          'Layer 2 solutions',
          'Andere blockchains'
        ]
      }
    ],
    aiPrompt: 'Leg uit wat gas fees zijn, hoe ze berekend worden, en hoe gebruikers ze kunnen minimaliseren.'
  },
  {
    id: 'beginner-06',
    level: 'beginner',
    order: 6,
    title: 'Cryptocurrency Exchanges',
    description: 'Leer hoe je cryptos koopt en verkoopt.',
    badge: {
      name: 'Exchange Expert',
      icon: '💱',
      color: 'bg-green-500'
    },
    lessons: [
      {
        title: 'Centralized vs Decentralized',
        content: 'CEX (Coinbase, Kraken) zijn gecentraliseerd en eenvoudig. DEX (Uniswap) zijn gedecentraliseerd en laten je je sleutels houden.',
        keyPoints: [
          'CEX = sneller, makkelijker',
          'DEX = meer controle, minder fees',
          'Trade-offs in veiligheid en gemak'
        ]
      },
      {
        title: 'KYC en veiligheid',
        content: 'Grote exchanges vragen om identificatie (KYC). Zorg altijd voor 2FA veiligheid.',
        keyPoints: [
          'Know Your Customer regels',
          '2FA = twee-factor authenticatie',
          'Veilige wachtwoorden'
        ]
      }
    ],
    aiPrompt: 'Verklaar het verschil tussen centralized en decentralized exchanges. Bespreek veiligheid, KYC, en hoe je veilig tradt.'
  },
  {
    id: 'beginner-07',
    level: 'beginner',
    order: 7,
    title: 'Smart Contracts Basis',
    description: 'Ontdek wat smart contracts zijn.',
    badge: {
      name: 'Contract Creator',
      icon: '📋',
      color: 'bg-indigo-500'
    },
    lessons: [
      {
        title: 'Wat zijn smart contracts?',
        content: 'Smart contracts zijn zelfuitvoerende programmas op de blockchain. "If X happens, then do Y" automatisch, zonder tussenpersoon.',
        keyPoints: [
          'Automatische uitvoering',
          'Geen tussenpersoon nodig',
          'Ethereum populariteit'
        ]
      },
      {
        title: 'Use cases',
        content: 'Smart contracts gebruiken voor DeFi, NFTs, insurance, supply chain tracking, en meer.',
        keyPoints: [
          'DeFi protocols',
          'NFT minting',
          'Automatische betalingen'
        ]
      }
    ],
    aiPrompt: 'Leg uit wat smart contracts zijn, hoe ze werken, en geef praktische voorbeelden van toepassingen.'
  },
  {
    id: 'beginner-08',
    level: 'beginner',
    order: 8,
    title: 'DeFi Introduceerden',
    description: 'Introductie tot Decentralized Finance.',
    badge: {
      name: 'DeFi Discoverer',
      icon: '🏦',
      color: 'bg-cyan-500'
    },
    lessons: [
      {
        title: 'Wat is DeFi?',
        content: 'DeFi (Decentralized Finance) vervangt traditionele financiële diensten met blockchain-gebaseerde alternatieven.',
        keyPoints: [
          'Geen banken of intermediairs',
          'Transparant en open',
          'Iedereen kan deelnemen'
        ]
      },
      {
        title: 'DeFi producten',
        content: 'Lending pools, AMMs (Automated Market Makers), derivatives, insurance.',
        keyPoints: [
          'Yield farming',
          'Liquidity pools',
          'Staking rewards'
        ]
      }
    ],
    aiPrompt: 'Verklaar DeFi concept, voordelen vs traditionele finance, en populaire DeFi producten.'
  },
  {
    id: 'beginner-09',
    level: 'beginner',
    order: 9,
    title: 'NFTs en Tokenomics',
    description: 'Begrijp NFTs en token economie.',
    badge: {
      name: 'NFT Novice',
      icon: '🖼️',
      color: 'bg-pink-500'
    },
    lessons: [
      {
        title: 'Wat zijn NFTs?',
        content: 'NFTs (Non-Fungible Tokens) zijn unieke digitale items op blockchain. Elk NFT is verschillend en kan niet vervangen worden.',
        keyPoints: [
          'Uniek en niet verwisselbaar',
          'Eigenaarschap op chain',
          'Art, collectibles, gaming'
        ]
      },
      {
        title: 'Tokenomics',
        content: 'Tokenomics bepaalt hoe tokens gedistribueerd zijn, de use-case, en incentives.',
        keyPoints: [
          'Supply & demand',
          'Emission schedule',
          'Utility & governance'
        ]
      }
    ],
    aiPrompt: 'Leg uit wat NFTs zijn, hun toepassingen, en hoe tokenomics projecten waardevol maken.'
  },
  {
    id: 'beginner-10',
    level: 'beginner',
    order: 10,
    title: 'Veiligheid en Risico\'s',
    description: 'Bescherm jezelf tegen crypto scams en hacks.',
    badge: {
      name: 'Security Sentinel',
      icon: '🔒',
      color: 'bg-red-600'
    },
    lessons: [
      {
        title: 'Veelvoorkomende scams',
        content: 'Rug pulls, phishing, pump & dump, fake tokens. Leer hoe je ze herkennen en vermijdt.',
        keyPoints: [
          'Rug pulls - ontwikkelaars verdwijnen',
          'Phishing - valse links',
          'Pump & dump - kunstmatige hype'
        ]
      },
      {
        title: 'Veiligheid best practices',
        content: 'Sterke wachtwoorden, 2FA, cold storage, geen seed phrases delen.',
        keyPoints: [
          'Never share private keys',
          'Verify URLs',
          'Use hardware wallets',
          'Backup your seed phrase'
        ]
      }
    ],
    aiPrompt: 'Bespreek veelvoorkomende crypto scams, hoe ze werken, hoe je ze herkennen. Geef veiligheidstips.'
  },

  // INTERMEDIATE - Verdiepende kennis gevorderden
  {
    id: 'intermediate-01',
    level: 'intermediate',
    order: 1,
    title: 'Technical Analysis Basics',
    description: 'Leer charts lezen en prijsbewegingen analyseren.',
    badge: {
      name: 'Chart Master',
      icon: '📊',
      color: 'bg-yellow-600'
    },
    lessons: [
      {
        title: 'Candlestick charts',
        content: 'Candlesticks tonen open, close, high, low over een periode. Groen = stijging, rood = daling.',
        keyPoints: [
          'OHLC data in één candle',
          'Wicks = extremen',
          'Body = opening en closing'
        ]
      },
      {
        title: 'Support & Resistance',
        content: 'Support is een prijsniveau waar kopers instappen. Resistance waar verkopers uitgaan.',
        keyPoints: [
          'Support = buy interest',
          'Resistance = sell interest',
          'Breaks kunnen signaal geven'
        ]
      }
    ],
    aiPrompt: 'Verklaar technical analysis voor gevorderden. Bespreek candlestick patterns, support/resistance, volume.'
  },
  {
    id: 'intermediate-02',
    level: 'intermediate',
    order: 2,
    title: 'Moving Averages & Indicators',
    description: 'Gebruik indicators voor betere trading decisions.',
    badge: {
      name: 'Indicator Guru',
      icon: '📈',
      color: 'bg-blue-600'
    },
    lessons: [
      {
        title: 'Moving Averages',
        content: 'MA geven de gemiddelde prijs over X toekennen. SMA = Simple, EMA = Exponential (meer gewicht op recent).',
        keyPoints: [
          'SMA vs EMA',
          'Golden Cross = bullish',
          'Death Cross = bearish'
        ]
      },
      {
        title: 'RSI & MACD',
        content: 'RSI meet momentum (overbought/oversold). MACD toont trend shifts.',
        keyPoints: [
          'RSI > 70 = overbought',
          'RSI < 30 = oversold',
          'MACD crosses'
        ]
      }
    ],
    aiPrompt: 'Leg uit moving averages, RSI, MACD voor traders. Geef praktische voorbeelden van signalen.'
  },
  {
    id: 'intermediate-03',
    level: 'intermediate',
    order: 3,
    title: 'Risk Management',
    description: 'Bescherm je kapitaal met goede risicobeheer.',
    badge: {
      name: 'Risk Master',
      icon: '⚠️',
      color: 'bg-red-600'
    },
    lessons: [
      {
        title: 'Position Sizing',
        content: 'Zet nooit alles in 1 trade. Gebruik percentage van portfolio per trade (bijv. 2% risico per trade).',
        keyPoints: [
          '2% rule populair',
          'Stop losses plaatsen',
          'Profit targets stellen'
        ]
      },
      {
        title: 'Leverage & Margin',
        content: 'Leverage vergrootwinsten maar ook verliezen. Gevaarlijk voor beginners.',
        keyPoints: [
          'Leverage = schuld nemen',
          'Liquidation risk',
          'Margin call alert'
        ]
      }
    ],
    aiPrompt: 'Bespreek risicobeheer voor crypto trading. Position sizing, stop losses, leverage gevaren.'
  },
  {
    id: 'intermediate-04',
    level: 'intermediate',
    order: 4,
    title: 'Portfolio Diversification',
    description: 'Bouw een sterke, gediversificeerde portfolio.',
    badge: {
      name: 'Diversifier',
      icon: '📂',
      color: 'bg-green-600'
    },
    lessons: [
      {
        title: 'Asset allocation',
        content: 'Mix van cryptos, stablecoins, DeFi, NFTs, etc. geeft balans.',
        keyPoints: [
          'Niet alles in Bitcoin',
          'Mix von high/low risk',
          'Stablecoins voor liquiditeit'
        ]
      },
      {
        title: 'Rebalancing',
        content: 'Regelmatig aanpassen naar target allocation om discipline te behouden.',
        keyPoints: [
          'Maandelijks/kwartaals',
          'Vast % allocation',
          'Discipline over timing'
        ]
      }
    ],
    aiPrompt: 'Leg uit portfolio diversification strategy voor crypto. Bespreek asset allocation en rebalancing.'
  },
  {
    id: 'intermediate-05',
    level: 'intermediate',
    order: 5,
    title: 'On-Chain Analysis',
    description: 'Analyseer blockchain data voor inzichten.',
    badge: {
      name: 'On-Chain Detective',
      icon: '🔍',
      color: 'bg-purple-600'
    },
    lessons: [
      {
        title: 'Wallet behavior',
        content: 'Grote wallets (whales) verplaatsing van coins kan signalen geven.',
        keyPoints: [
          'Whale watch tools',
          'Exchange inflows',
          'Holder accumulation'
        ]
      },
      {
        title: 'Network metrics',
        content: 'Active addresses, transaction volume, holder distribution.',
        keyPoints: [
          'Aktive adres count',
          'Network value',
          'Concentration risk'
        ]
      }
    ],
    aiPrompt: 'Verklaar on-chain metrics en hoe traders ze gebruiken. Bespreek whale behavior en netwerk gezondheid.'
  },
  {
    id: 'intermediate-06',
    level: 'intermediate',
    order: 6,
    title: 'Fundamental Analysis',
    description: 'Evalueer de onderliggende waarde van projecten.',
    badge: {
      name: 'Fundamentalist',
      icon: '📚',
      color: 'bg-cyan-600'
    },
    lessons: [
      {
        title: 'Whitepaper reading',
        content: 'Whitepaper vertelt het verhaal van een project. Lees ze kritisch.',
        keyPoints: [
          'Problem & solution',
          'Tokenomics',
          'Roadmap & milestones'
        ]
      },
      {
        title: 'Team & governance',
        content: 'Wie zit achter het project? Zijn ze experienced? Gedecentraliseerd of centraal?',
        keyPoints: [
          'Team credentials',
          'Development history',
          'Governance model'
        ]
      }
    ],
    aiPrompt: 'Bespreek fundamental analysis voor crypto projecten. Whitepaper review, team, technology.'
  },
  {
    id: 'intermediate-07',
    level: 'intermediate',
    order: 7,
    title: 'Yield Farming & Staking',
    description: 'Verdien passief inkomen in DeFi.',
    badge: {
      name: 'Yield Farmer',
      icon: '🌾',
      color: 'bg-orange-600'
    },
    lessons: [
      {
        title: 'Staking rewards',
        content: 'Lock coins in validators/pools, ontvang rewards. PoS blockchains.',
        keyPoints: [
          'APY vs APR',
          'Lock-up periods',
          'Slashing risks'
        ]
      },
      {
        title: 'Liquidity mining',
        content: 'Voeg liquidity toe aan pools, ontvang handelsgebeurenkosten + extra rewards.',
        keyPoints: [
          'Impermanent loss',
          'LP tokens',
          'Multi-yield strats'
        ]
      }
    ],
    aiPrompt: 'Leg uit yield farming en staking voor DeFi gebruikers. Risico\'s inclusief slashing en IL.'
  },
  {
    id: 'intermediate-08',
    level: 'intermediate',
    order: 8,
    title: 'Futures & Options',
    description: 'Geavanceerde trading instrumenten.',
    badge: {
      name: 'Derivatives Dealer',
      icon: '⚡',
      color: 'bg-indigo-600'
    },
    lessons: [
      {
        title: 'Futures trading',
        content: 'Speculeer op toekomstige prijs. Long (stijging verwacht) of Short (daling).',
        keyPoints: [
          'Leverage inherent',
          'Perpetual vs dated',
          'Funding rates'
        ]
      },
      {
        title: 'Options basics',
        content: 'Calls (stijging) en Puts (daling). Premium betalen voor mogelijkheid.',
        keyPoints: [
          'Call vs Put',
          'Strike price',
          'Expiration date'
        ]
      }
    ],
    aiPrompt: 'Verklaar crypto futures en options. Risico\'s, hedge strategies, leverage gevaren.'
  },
  {
    id: 'intermediate-09',
    level: 'intermediate',
    order: 9,
    title: 'Layer 2 & Scaling',
    description: 'Begrijp scaling solutions voor snellere transacties.',
    badge: {
      name: 'Scaling Scholar',
      icon: '🚀',
      color: 'bg-pink-600'
    },
    lessons: [
      {
        title: 'Rollups',
        content: 'Optimistic & ZK rollups bundelen transacties, lagere fees.',
        keyPoints: [
          'Optimistic rollups',
          'ZK rollups',
          'Arbitrum, Optimism'
        ]
      },
      {
        title: 'Sidechains & plasma',
        content: 'Alternatieve scaling via separate chains.',
        keyPoints: [
          'Sidechains',
          'Plasma',
          'Trade-offs in security'
        ]
      }
    ],
    aiPrompt: 'Leg uit Layer 2 solutions en scaling. Rollups vs sidechains vs plasma.'
  },
  {
    id: 'intermediate-10',
    level: 'intermediate',
    order: 10,
    title: 'Governance & DAOs',
    description: 'Begrijp decentralized governance en DAOs.',
    badge: {
      name: 'DAO Diplomat',
      icon: '🗳️',
      color: 'bg-teal-600'
    },
    lessons: [
      {
        title: 'DAO structure',
        content: 'Decentralized Autonomous Organizations geleid door token holders via voting.',
        keyPoints: [
          'Governance tokens',
          'Voting power',
          'Smart contract execution'
        ]
      },
      {
        title: 'Treasury management',
        content: 'DAOs beheren treasuries. Voorstelaan, stemmen, executie.',
        keyPoints: [
          'Proposal system',
          'Quorum requirements',
          'Multi-sig wallets'
        ]
      }
    ],
    aiPrompt: 'Verklaar DAO governance, voting, treasury management, en decentralisatie trade-offs.'
  },

  // EXPERT - Afleren & zelf observeren
  {
    id: 'expert-01',
    level: 'expert',
    order: 1,
    title: 'Marktpsychologie Demystified',
    description: 'Vergeet wat je dacht te weten. Observe pure market psychology.',
    badge: {
      name: 'Psychology Master',
      icon: '🧠',
      color: 'bg-yellow-700'
    },
    lessons: [
      {
        title: 'Bias erkenning',
        content: 'Confirmation bias, recency bias, FOMO - herken je eigen bias in keuzes.',
        keyPoints: [
          'Confirmation bias = info filteren',
          'Recency bias = recent overgewicht',
          'FOMO = emotional decisions'
        ]
      },
      {
        title: 'Crowd behavior',
        content: 'Markets zijn emoties in massa. Leer de psychologie van groepen lezen.',
        keyPoints: [
          'Herd mentality',
          'Greed & Fear cycles',
          'Contrarian observations'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Diepgaande analyse van marktpsychologie, behavioral finance, cognitive biases in crypto markets. Zorg dat het experts helpt hun eigen bias af te leren.'
  },
  {
    id: 'expert-02',
    level: 'expert',
    order: 2,
    title: 'Macro & Microeconomics',
    description: 'Groot plaatje: hoe economie crypto beïnvloedt.',
    badge: {
      name: 'Macro Analyst',
      icon: '🌍',
      color: 'bg-blue-700'
    },
    lessons: [
      {
        title: 'Fed policy impact',
        content: 'Interest rates, inflation, QE - hoe beïnvloedt dit crypto?',
        keyPoints: [
          'Rate hikes = risk off',
          'Inflation = crypto hedge?',
          'QE = liquidity surge'
        ]
      },
      {
        title: 'Microeconomic signals',
        content: 'Tokens, staking, holder patterns - zelf je eigen micro-analyse.',
        keyPoints: [
          'Supply shocks',
          'Holder accumulation',
          'Exchange flows'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Macro-economische factoren die crypto beïnvloeden. Fed, inflation, real yields. Zelf trends identificeren.'
  },
  {
    id: 'expert-03',
    level: 'expert',
    order: 3,
    title: 'Probability & Expected Value',
    description: 'Trade math: odds, probabilities, expected value.',
    badge: {
      name: 'Math Mastermind',
      icon: '🎲',
      color: 'bg-red-700'
    },
    lessons: [
      {
        title: 'Expected value',
        content: 'Niet elke trade met 60% winkans is goed. EV = (win% × profit) - (loss% × loss).',
        keyPoints: [
          'Risk:Reward ratio',
          'Win rate vs average win',
          'Long-term edge matters'
        ]
      },
      {
        title: 'Kelly Criterion',
        content: 'Optimal sizing gegeven win% en payoff. Voorkant overbetalen, achteruit onderbetalen.',
        keyPoints: [
          'f* = (bp - q) / b',
          'Bankroll management',
          'Avoiding ruin'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Diepgaande goktheorie, expected value, Kelly Criterion. Wiskundige rigor in trading decisions.'
  },
  {
    id: 'expert-04',
    level: 'expert',
    order: 4,
    title: 'Market Microstructure',
    description: 'Hoe werkt de markt echt? Order flow, spreads, slippage.',
    badge: {
      name: 'Microstructure Sage',
      icon: '⚙️',
      color: 'bg-green-700'
    },
    lessons: [
      {
        title: 'Order book dynamics',
        content: 'Hoe order flow prijzen beïnvloedt. Bid-ask spreads, depth.',
        keyPoints: [
          'Limit vs market orders',
          'Bid-ask spread costs',
          'Order book depth analysis'
        ]
      },
      {
        title: 'Slippage & execution',
        content: 'Grote orders verstorenmarkt. Minimaal slippage strategies.',
        keyPoints: [
          'Impact cost',
          'TWAP/VWAP orders',
          'Patience pays'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Market microstructure, order flow, execution algorithms, hidden liquidity.'
  },
  {
    id: 'expert-05',
    level: 'expert',
    order: 5,
    title: 'Arbitrage & Market Inefficiencies',
    description: 'Zoek en exploit market inefficiencies ethisch.',
    badge: {
      name: 'Arbitrage Master',
      icon: '🔄',
      color: 'bg-purple-700'
    },
    lessons: [
      {
        title: 'Cross-exchange arb',
        content: 'Dezelfde asset, verschillende prijzen. Buy low, sell high over exchanges.',
        keyPoints: [
          'Price discrepancies',
          'Execution speed matters',
          'Fees erode profits'
        ]
      },
      {
        title: 'Statistical arbitrage',
        content: 'Correlated pairs: exploiteer temporaire decorrelation.',
        keyPoints: [
          'Pairs trading',
          'Mean reversion',
          'Cointegration'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Arbitrage opportunities, market inefficiencies, quantitative strategies in crypto.'
  },
  {
    id: 'expert-06',
    level: 'expert',
    order: 6,
    title: 'Protocol Economics Deep Dive',
    description: 'Analyseer token incentives & protocol design diepgaand.',
    badge: {
      name: 'Tokenomist',
      icon: '📊',
      color: 'bg-cyan-700'
    },
    lessons: [
      {
        title: 'Mechanism design',
        content: 'Hoe protocols incentives structureren. Supply, demand, rewards alignment.',
        keyPoints: [
          'Incentive alignment',
          'Emission schedules',
          'Sink mechanisms'
        ]
      },
      {
        title: 'Sustainability',
        content: 'Zijn protocol economics duurzaam? Kan het lang bestaan?',
        keyPoints: [
          'Runway analysis',
          'Revenue streams',
          'Tail risk'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Diepgaande token economics, mechanism design, protocol sustainability analysis.'
  },
  {
    id: 'expert-07',
    level: 'expert',
    order: 7,
    title: 'Advanced On-Chain Analysis',
    description: 'Messy chain data analysis voor eerlijke insights.',
    badge: {
      name: 'Chain Whisperer',
      icon: '⛓️',
      color: 'bg-orange-700'
    },
    lessons: [
      {
        title: 'Cohort analysis',
        content: 'Volg cohorten van kopers. Worden ze hodlers of flippers?',
        keyPoints: [
          'Cohort profitability',
          'Holder duration',
          'Age-based analysis'
        ]
      },
      {
        title: 'Anomaly detection',
        content: 'Herken ongewone on-chain patterns. Kunnen signalen geven.',
        keyPoints: [
          'Exchange flows anomalies',
          'Whale movements',
          'Concentration shifts'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Geavanceerde on-chain analytics, cohort tracking, anomaly detection met data.'
  },
  {
    id: 'expert-08',
    level: 'expert',
    order: 8,
    title: 'Systemic Risk & Black Swans',
    description: 'Begrijp systeemische risico\'s en onverwachte events.',
    badge: {
      name: 'Risk Sentinel',
      icon: '⛈️',
      color: 'bg-indigo-700'
    },
    lessons: [
      {
        title: 'Contagion risk',
        content: 'Hoe kan falen in één protocol het hele ecosystem treffen?',
        keyPoints: [
          'Cascading defaults',
          'Liquidation spirals',
          'Interconnectedness'
        ]
      },
      {
        title: 'Black swan scenarios',
        content: 'Onverwachte events. Hoe je je voorbereidt.',
        keyPoints: [
          'Regulatory shocks',
          'Technology failures',
          'Security breaches'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Systeemrisico\'s, interconnectedness, black swan scenarios, hedging strategies.'
  },
  {
    id: 'expert-09',
    level: 'expert',
    order: 9,
    title: 'Trend Identification Without Bias',
    description: 'Herken trends met frisse ogen, zonder vooroordelen.',
    badge: {
      name: 'Trend Spotter',
      icon: '🎯',
      color: 'bg-pink-700'
    },
    lessons: [
      {
        title: 'Structural shifts',
        content: 'Wat is veranderd structureel? Niet cyclisch, maar fundamenteel?',
        keyPoints: [
          'Adoption milestones',
          'Regulatory changes',
          'Protocol upgrades'
        ]
      },
      {
        title: 'Zelf observeren',
        content: 'Stel jezelf vragen: Wat zie ik werkelijk? Niet wat verwacht ik?',
        keyPoints: [
          'First principles',
          'Discard assumptions',
          'Fresh perspective'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Trends identificeren met beginner\'s mind. Onwetendheid als voordeel. Disconfirm assumptions.'
  },
  {
    id: 'expert-10',
    level: 'expert',
    order: 10,
    title: 'Building Your Personal Edge',
    description: 'Wat is JE unieke voordeel in crypto markets?',
    badge: {
      name: 'Edge Builder',
      icon: '💎',
      color: 'bg-teal-700'
    },
    lessons: [
      {
        title: 'Skill identification',
        content: 'Waar ben je beter dan de markt gemiddeld?',
        keyPoints: [
          'Domain expertise',
          'Speed advantages',
          'Data access',
          'Unique perspective'
        ]
      },
      {
        title: 'Sustainable advantage',
        content: 'Hoe maak je je voordeel duurzaam? Wat kan anderen niet doen?',
        keyPoints: [
          'Repeatable process',
          'Risk management',
          'Emotional discipline',
          'Continuous learning'
        ]
      }
    ],
    aiPrompt: 'Voor experts: Hoe bouw je persoonlijke edge in markets? Sustainable advantages, skill development, differentiation.'
  }
];
