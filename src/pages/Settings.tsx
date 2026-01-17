import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase/client';
import type { UserProfile } from '../lib/profile/types';
import { educationSnippets } from '../data/educationSnippets';

type RiskProfile = 'Voorzichtig' | 'Gebalanceerd' | 'Actief';

export function Settings() {
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('Gebalanceerd');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    avatarUrl: '',
    phone: '',
    location: '',
    bio: '',
    emailUpdatesOptIn: false
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [markets, setMarkets] = useState({
    bitcoin: true,
    ethereum: true,
    stable: true,
    altcoins: false
  });
  const [notifications, setNotifications] = useState({
    dailyEmail: true,
    volAlerts: true
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('aio_settings_v1');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { riskProfile?: RiskProfile };
      if (parsed.riskProfile) {
        setRiskProfile(parsed.riskProfile);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccountEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    fetch('/api/profile/get')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: UserProfile };
        if (!data.profile) return;
        setProfile(data.profile);
        setProfileForm({
          displayName: data.profile.displayName || '',
          email: data.profile.email || '',
          avatarUrl: data.profile.avatarUrl || '',
          phone: data.profile.phone || '',
          location: data.profile.location || '',
          bio: data.profile.bio || '',
          emailUpdatesOptIn: Boolean(data.profile.emailUpdatesOptIn)
        });
      })
      .catch(() => {
        // ignore profile fetch error
      });
  }, []);

  const handleAvatarChange = (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Avatar is te groot (max 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setProfileForm((current) => ({ ...current, avatarUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    if (!profile) {
      setProfileError('Profiel is nog niet geladen.');
      return;
    }
    if (!profileForm.displayName.trim() || !profileForm.email.trim()) {
      setProfileError('Naam en e-mailadres zijn verplicht.');
      return;
    }
    setProfileError(null);
    setProfileSaving(true);
    try {
      const payload: UserProfile = {
        ...profile,
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim().toLowerCase(),
        avatarUrl: profileForm.avatarUrl || undefined,
        phone: profileForm.phone || undefined,
        location: profileForm.location || undefined,
        bio: profileForm.bio || undefined,
        emailUpdatesOptIn: profileForm.emailUpdatesOptIn,
        strategies: Array.isArray(profile.strategies) ? profile.strategies : []
      };
      const resp = await fetch('/api/profile/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: payload })
      });
      if (!resp.ok) {
        throw new Error('Opslaan mislukt.');
      }
      const data = (await resp.json()) as { profile?: UserProfile };
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error(err);
      setProfileError('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ riskProfile });
    localStorage.setItem('aio_settings_v1', payload);
    window.dispatchEvent(new Event('aio_settings_updated'));
  }, [riskProfile]);

  const riskCopy: Record<RiskProfile, string> = {
    Voorzichtig: 'Lage volatiliteit, focus op defensief gedrag en beperkte drawdowns.',
    Gebalanceerd: 'Evenwicht tussen groei en bescherming; normaal risico met brede spreiding.',
    Actief: 'Hoger risico met focus op momentum en kortere horizons.'
  };

  return (
    <div className="grid gap-4 md:gap-5">
      <Card title="Profiel" subtitle="Persoonsgegevens en avatar">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 text-xs">
              {profileForm.avatarUrl ? (
                <img src={profileForm.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                'Geen foto'
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition cursor-pointer">
                Upload avatar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
              </label>
              {profileForm.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setProfileForm((current) => ({ ...current, avatarUrl: '' }))}
                  className="pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition"
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-700">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Naam</span>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, displayName: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">E-mailadres</span>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, email: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2">
              <input
                type="checkbox"
                checked={profileForm.emailUpdatesOptIn}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, emailUpdatesOptIn: event.target.checked }))
                }
                className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
              />
              Ik ontvang af en toe een korte update per e-mail.
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Telefoon (optioneel)</span>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Locatie (optioneel)</span>
              <input
                type="text"
                value={profileForm.location}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, location: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-500">Korte bio (optioneel)</span>
              <textarea
                value={profileForm.bio}
                onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
              />
            </label>
          </div>
          {profileError && <p className="text-sm text-amber-700">{profileError}</p>}
          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {profileSaving ? 'Opslaan...' : 'Profiel opslaan'}
          </button>
        </div>
      </Card>

      <Card title="Risicoprofiel" subtitle="Stel je risicohouding in">
        <div className="space-y-3">
          {(['Voorzichtig', 'Gebalanceerd', 'Actief'] as RiskProfile[]).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="risk"
                value={option}
                checked={riskProfile === option}
                onChange={() => setRiskProfile(option)}
                className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
              />
              <span>{option}</span>
            </label>
          ))}
          <p className="text-xs text-slate-500 pt-1">{riskCopy[riskProfile]}</p>
        </div>
      </Card>

      <Card title="Munten" subtitle="Kies welke munten je wilt volgen">
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.bitcoin}
              onChange={(e) => setMarkets((m) => ({ ...m, bitcoin: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Bitcoin
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.ethereum}
              onChange={(e) => setMarkets((m) => ({ ...m, ethereum: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Ethereum
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.stable}
              onChange={(e) => setMarkets((m) => ({ ...m, stable: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Stablecoins
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.altcoins}
              onChange={(e) => setMarkets((m) => ({ ...m, altcoins: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Altcoins
          </label>
        </div>
      </Card>

      <Card title="Notificaties" subtitle="Blijf op de hoogte">
        <div className="space-y-3 text-sm text-slate-700">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Dagrapport per e-mail</span>
            <input
              type="checkbox"
              checked={notifications.dailyEmail}
              onChange={(e) => setNotifications((n) => ({ ...n, dailyEmail: e.target.checked }))}
              className="h-5 w-10 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Waarschuwingen bij hoge volatiliteit</span>
            <input
              type="checkbox"
              checked={notifications.volAlerts}
              onChange={(e) => setNotifications((n) => ({ ...n, volAlerts: e.target.checked }))}
              className="h-5 w-10 accent-primary"
            />
          </label>
          <p className="text-xs text-slate-500 pt-1">
            Notificaties worden lokaal bewaard. Frequentie en tijdstip volgen later.
          </p>
        </div>
      </Card>

      <Card title="Basiskennis" subtitle="Rustig instappen">
        <div className="space-y-3 text-sm text-slate-700">
          {educationSnippets.slice(0, 4).map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Account" subtitle="Login via magic link">
        <div className="space-y-3 text-sm text-slate-700">
          <p>{accountEmail ? `Ingelogd als ${accountEmail}.` : 'Niet ingelogd.'}</p>
          {signOutError && <p className="text-sm text-amber-700">{signOutError}</p>}
          <button
            type="button"
            onClick={async () => {
              setSignOutError(null);
              const { error } = await supabase.auth.signOut();
              if (error) {
                setSignOutError('Uitloggen mislukt. Probeer het opnieuw.');
                return;
              }
              await fetch('/api/session/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition"
          >
            Uitloggen
          </button>
        </div>
      </Card>
    </div>
  );
}
