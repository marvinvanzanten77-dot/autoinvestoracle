import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase/client';

export function Login() {
  const [email, setEmail] = useState('');
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

  const handleContinue = () => {
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-5">
        <div className="text-center space-y-2">
          <p className="text-label tracking-[0.04em] text-slate-500">Inloggen / registreren</p>
          <p className="text-title text-slate-900 font-serif">Welkom terug</p>
          <p className="text-sm text-slate-700">
            Log in met een magic link. Geen wachtwoorden nodig.
          </p>
        </div>

        <Card title="Magic link" subtitle="We sturen je een veilige login-link">
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
              className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Versturen...' : 'Stuur magic link'}
            </button>
          </div>
        </Card>

        {sessionEmail && (
          <Card title="Ingelogd" subtitle="Ga verder met je profiel">
            <div className="space-y-3 text-sm text-slate-700">
              <p>Je bent ingelogd als {sessionEmail}.</p>
              <button
                type="button"
                onClick={handleContinue}
                className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition"
              >
                Verder naar onboarding
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
