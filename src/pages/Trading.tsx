import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';

type TradeAction = 'buy' | 'sell' | 'rebalance' | 'close_position' | 'hold' | 'wait';

type AgentPolicy = {
  id: string;
  userId: string;
  exchange: string;
  name: string;
  description?: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  maxTradeSize: number; // EUR
  maxDailyLoss: number; // percentage
  confidenceThreshold: number; // percentage (0-100)
  enabledAssets: string[];
  disabledAssets: string[];
  tradingStrategy: 'conservative' | 'balanced' | 'aggressive';
  createdAt: string;
  activatedAt?: string;
  isActive: boolean;
};

type TradeProposal = {
  id: string;
  policyId: string;
  exchange: string;
  asset: string;
  action: TradeAction;
  price: number;
  amount: number;
  estimatedValue: number;
  confidence: number;
  reasoning: string;
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'DECLINED' | 'FAILED';
  createdAt: string;
  approvedAt?: string;
  executedAt?: string;
  feedback?: string;
};

export function Trading() {
  const [activeTab, setActiveTab] = useState<'proposals' | 'policy' | 'history'>('proposals');
  const [userId, setUserId] = useState<string>('');
  const [exchange, setExchange] = useState<string>('bitvavo');
  const [exchanges, setExchanges] = useState<string[]>(['bitvavo']);

  // Policy state
  const [policy, setPolicy] = useState<AgentPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  // Proposals state
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);

  // Controls state
  const [scansEnabled, setScansEnabled] = useState(true);
  const [tradingEnabled, setTradingEnabled] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);

  // Fetch session
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await fetch('/api/session/init');
        if (!resp.ok) return;
        const data = (await resp.json()) as { userId: string };
        setUserId(data.userId);
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };
    initSession();
  }, []);

  // Fetch exchange connections
  useEffect(() => {
    if (!userId) return;
    const fetchExchanges = async () => {
      try {
        const resp = await fetch(`/api/exchanges/status?userId=${userId}`);
        if (!resp.ok) return;
        const data = (await resp.json()) as { connections: Array<{ exchange: string }> };
        const exs = data.connections.map((c) => c.exchange);
        setExchanges(exs.length > 0 ? exs : ['bitvavo']);
        setExchange(exs[0] || 'bitvavo');
      } catch (err) {
        console.error('Error fetching exchanges:', err);
      }
    };
    fetchExchanges();
  }, [userId]);

  // Fetch active policy
  useEffect(() => {
    if (!userId) return;
    const fetchPolicy = async () => {
      setPolicyLoading(true);
      try {
        const resp = await fetch(`/api/trading/policy?userId=${userId}&exchange=${exchange}`);
        if (resp.ok) {
          const data = (await resp.json()) as { policy: AgentPolicy };
          setPolicy(data.policy);
        } else {
          setPolicy(null);
        }
      } catch (err) {
        console.error('Error fetching policy:', err);
        setPolicy(null);
      } finally {
        setPolicyLoading(false);
      }
    };
    fetchPolicy();
  }, [userId, exchange]);

  // Fetch proposals
  useEffect(() => {
    if (!userId) return;
    const fetchProposals = async () => {
      setProposalsLoading(true);
      try {
        const resp = await fetch(
          `/api/trading/proposals?userId=${userId}&exchange=${exchange}&status=PROPOSED`
        );
        if (resp.ok) {
          const data = (await resp.json()) as { proposals: TradeProposal[] };
          setProposals(data.proposals || []);
        }
      } catch (err) {
        console.error('Error fetching proposals:', err);
      } finally {
        setProposalsLoading(false);
      }
    };
    fetchProposals();
  }, [userId, exchange]);

  // Handle proposal acceptance
  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const resp = await fetch(`/api/trading/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (resp.ok) {
        // Remove from list and refresh
        setProposals(proposals.filter((p) => p.id !== proposalId));
        alert('✓ Voorstel geaccepteerd en order geplaatst!');
      } else {
        alert('Fout bij accepteren voorstel');
      }
    } catch (err) {
      console.error('Error accepting proposal:', err);
      alert('Fout opgetreden');
    }
  };

  // Handle proposal decline
  const handleDeclineProposal = async (proposalId: string) => {
    try {
      const resp = await fetch(`/api/trading/proposals/${proposalId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, feedback: 'Geweigerd door gebruiker' })
      });

      if (resp.ok) {
        setProposals(proposals.filter((p) => p.id !== proposalId));
        alert('✓ Voorstel afgewezen');
      }
    } catch (err) {
      console.error('Error declining proposal:', err);
    }
  };

  // Toggle trading
  const handleToggleTrading = async () => {
    setScanLoading(true);
    try {
      const resp = await fetch('/api/trading/trading-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled: !tradingEnabled })
      });

      if (resp.ok) {
        setTradingEnabled(!tradingEnabled);
        alert(tradingEnabled ? '⏸️ Trading uitgeschakeld' : '▶️ Trading ingeschakeld');
      }
    } catch (err) {
      console.error('Error toggling trading:', err);
    } finally {
      setScanLoading(false);
    }
  };

  // Force scan
  const handleForceScan = async () => {
    setScanLoading(true);
    try {
      const resp = await fetch('/api/trading/scan/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, exchange })
      });

      if (resp.ok) {
        alert('✓ Scan gestart!');
      }
    } catch (err) {
      console.error('Error forcing scan:', err);
    } finally {
      setScanLoading(false);
    }
  };

  const getActionBadgeColor = (action: TradeAction) => {
    switch (action) {
      case 'buy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'sell':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'rebalance':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'close_position':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'hold':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'wait':
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const getActionLabel = (action: TradeAction) => {
    switch (action) {
      case 'buy':
        return '🛒 Kopen';
      case 'sell':
        return '💰 Verkopen';
      case 'rebalance':
        return '⚖️ Rebalanceren';
      case 'close_position':
        return '🔐 Sluiten';
      case 'hold':
        return '➡️ Houden';
      case 'wait':
        return '⏳ Wachten';
    }
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trading Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Beheer trading policies en handelsvoorstellen</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-600">
            {tradingEnabled ? '✓ Trading actief' : '✕ Trading uit'}
          </div>
          <div className="text-xs text-slate-500">
            {scansEnabled ? 'Scans actief' : 'Scans gepauzeerd'}
          </div>
        </div>
      </div>

      {/* Control buttons */}
      <Card>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleToggleTrading}
            disabled={scanLoading}
            className={`pill px-4 py-2 font-medium transition ${
              tradingEnabled
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {tradingEnabled ? '⏸️ Trading uitschakelen' : '▶️ Trading inschakelen'}
          </button>
          <button
            onClick={handleForceScan}
            disabled={scanLoading}
            className="pill px-4 py-2 font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
          >
            {scanLoading ? 'Laden...' : '🔄 Nu scannen'}
          </button>
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {exchanges.map((ex) => (
              <option key={ex} value={ex}>
                {ex.charAt(0).toUpperCase() + ex.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('proposals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'proposals'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📋 Voorstellen ({proposals.length})
        </button>
        <button
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'policy'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          ⚙️ Actief Policy
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📊 Geschiedenis
        </button>
      </div>

      {/* Proposals Tab */}
      {activeTab === 'proposals' && (
        <Card title="Handelsvoorstellen" subtitle="Agent heeft voorstellen gemaakt - review en keur goed">
          {proposalsLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Voorstellen laden...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Geen actieve voorstellen</p>
              <p className="text-xs text-slate-400 mt-2">Agent zal voorstellen doen bij geschikte marktomstandigheden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded border font-medium ${getActionBadgeColor(proposal.action)}`}>
                          {getActionLabel(proposal.action)}
                        </span>
                        <p className="font-semibold text-slate-900">
                          {proposal.asset} @ €{proposal.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600">{proposal.reasoning}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        €{proposal.estimatedValue.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {proposal.amount.toFixed(4)} {proposal.asset}
                      </div>
                    </div>
                  </div>

                  {/* Confidence & Details */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-500">Betrouwbaarheid</p>
                      <p className="font-semibold text-slate-900">{proposal.confidence}%</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-500">Aantal</p>
                      <p className="font-semibold text-slate-900">{proposal.amount.toFixed(4)}</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-500">Geschat bedrag</p>
                      <p className="font-semibold text-slate-900">€{proposal.estimatedValue.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleAcceptProposal(proposal.id)}
                      className="flex-1 pill bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 font-medium"
                    >
                      ✓ Accepteren
                    </button>
                    <button
                      onClick={() => handleDeclineProposal(proposal.id)}
                      className="flex-1 pill border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 font-medium"
                    >
                      ✕ Weigeren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Policy Tab */}
      {activeTab === 'policy' && (
        <Card title="Actief Trading Policy" subtitle="Huidige instellingen en grenzen">
          {policyLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Policy laden...</p>
            </div>
          ) : policy ? (
            <div className="space-y-4">
              {/* Policy Info */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Naam</p>
                  <p className="text-sm font-semibold text-slate-900">{policy.name}</p>
                </div>
                {policy.description && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Beschrijving</p>
                    <p className="text-sm text-slate-700">{policy.description}</p>
                  </div>
                )}
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Risicoprofiel</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {policy.riskTolerance}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Max trade</p>
                  <p className="text-sm font-semibold text-slate-900">€{policy.maxTradeSize}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Max dagverlies</p>
                  <p className="text-sm font-semibold text-slate-900">{policy.maxDailyLoss}%</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Betrouwbaarheid</p>
                  <p className="text-sm font-semibold text-slate-900">&gt;{policy.confidenceThreshold}%</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Strategie</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {policy.tradingStrategy}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Status</p>
                  <p className="text-sm font-semibold text-emerald-700">
                    {policy.isActive ? '✓ Actief' : '✕ Inactief'}
                  </p>
                </div>
              </div>

              {/* Assets */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Geschikte assets</p>
                <div className="flex flex-wrap gap-2">
                  {policy.enabledAssets.map((asset) => (
                    <span
                      key={asset}
                      className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      ✓ {asset}
                    </span>
                  ))}
                </div>
              </div>

              {policy.disabledAssets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Uitgestelde assets</p>
                  <div className="flex flex-wrap gap-2">
                    {policy.disabledAssets.map((asset) => (
                      <span
                        key={asset}
                        className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200"
                      >
                        ✕ {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 pt-2">
                Geactiveerd: {new Date(policy.activatedAt || '').toLocaleString('nl-NL')}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Geen actief policy</p>
              <p className="text-xs text-slate-400 mt-2">Maak een policy aan in Agent instellingen</p>
            </div>
          )}
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card title="Handelsgeschiedenis" subtitle="Recentelijk uitgevoerde trades">
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">Handelsgeschiedenis wordt binnenkort beschikbaar</p>
            <p className="text-xs text-slate-400 mt-2">Voltooid trades verschijnen hier</p>
          </div>
        </Card>
      )}
    </div>
  );
}
