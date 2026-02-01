import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase/client';

type AuthMode = 'login' | 'register';

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const existingEmail = data.session?.user?.email;
      if (existingEmail) {
        setSessionEmail(existingEmail);
        setEmail(existingEmail);
      }
    });
  }, []);

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setStatus('Vul je e-mailadres in.');
      return;
    }
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) {
      setStatus('Kon geen magic link sturen. Probeer het opnieuw.');
    } else {
      setStatus('Check je inbox. De magic link is verstuurd.');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setStatus('Vul je e-mailadres en wachtwoord in.');
      return;
    }
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });
    if (error) {
      setStatus(error.message || 'Inloggen mislukt. Controleer je gegevens.');
    } else {
      setStatus('Ingelogd! Je wordt doorgestuurd...');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      setStatus('Vul je e-mailadres, naam en wachtwoord in.');
      return;
    }
    if (password.length < 6) {
      setStatus('Wachtwoord moet minstens 6 karakters zijn.');
      return;
    }
    setLoading(true);
    setStatus(null);
    const { error, data } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: { displayName }
      }
    });
    if (error) {
      setStatus(error.message || 'Registratie mislukt. Probeer het opnieuw.');
      setLoading(false);
      return;
    }
    
    // Na succesvolle registratie, login direct met dezelfde credentials
    // zodat je sesie krijgt en naar onboarding kunt gaan
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });
    
    if (signInError) {
      setStatus('Account aangemaakt, maar automatisch inloggen mislukt. Probeer handmatig in te loggen.');
      setLoading(false);
      return;
    }
    
    setStatus('Account gemaakt en ingelogd! Je wordt naar onboarding gestuurd...');
    setLoading(false);
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-5">
        <div className="text-center space-y-2">
          <p className="text-label tracking-[0.04em] text-slate-500">Inloggen / registreren</p>
          <p className="text-title text-slate-900 font-serif">Welkom terug</p>
          <p className="text-sm text-slate-700">
            Kies je voorkeur: magic link, wachtwoord, of nieuw account.
          </p>
        </div>

        {!sessionEmail && (
          <>
            {/* Mode Tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => { setMode('login'); setStatus(null); }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === 'login'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Inloggen
              </button>
              <button
                onClick={() => { setMode('register'); setStatus(null); }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === 'register'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Nieuw account
              </button>
            </div>

            {/* Magic Link Tab (shared) */}
            <Card title="Magic link" subtitle="Veilige login-link via email">
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.toLowerCase())}
                  placeholder="E-mailadres"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {status && <p className="text-sm text-slate-600">{status}</p>}
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading}
                  className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed w-full"
                >
                  {loading ? 'Versturen...' : 'Stuur magic link'}
                </button>
              </div>
            </Card>

            {mode === 'login' && (
              /* Login with Password */
              <Card title="Wachtwoord" subtitle="Log in met je gegevens">
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.toLowerCase())}
                    placeholder="E-mailadres"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Wachtwoord"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {status && <p className="text-sm text-slate-600">{status}</p>}
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading}
                    className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed w-full"
                  >
                    {loading ? 'Inloggen...' : 'Inloggen'}
                  </button>
                </div>
              </Card>
            )}

            {mode === 'register' && (
              /* Register */
              <Card title="Nieuw account" subtitle="Maak een account aan">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Volledige naam"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.toLowerCase())}
                    placeholder="E-mailadres"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Wachtwoord (min. 6 karakters)"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {status && <p className="text-sm text-slate-600">{status}</p>}
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={loading}
                    className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed w-full"
                  >
                    {loading ? 'Account aanmaken...' : 'Account aanmaken'}
                  </button>
                </div>
              </Card>
            )}
          </>
        )}

        {sessionEmail && (
          <Card title="Ingelogd" subtitle="Ga verder met je dashboard">
            <div className="space-y-3 text-sm text-slate-700">
              <p>Je bent ingelogd als {sessionEmail}.</p>
              <button
                type="button"
                onClick={handleContinue}
                className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition w-full"
              >
                Naar dashboard
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
