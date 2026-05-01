import React, { useEffect, useState } from 'react';

export interface Cat100Identity {
  pid: string;
  condition: 'ld' | 'ar';
  scenario: 'a' | 'b';
  course: string;
  source: 'url' | 'code' | 'localStorage' | 'anonymous';
}

interface Cat100GatePageProps {
  onAccept: (identity: Cat100Identity) => void;
}

interface CodeEntry {
  pid: string;
  condition: 'ld' | 'ar';
  scenario: 'a' | 'b';
  course: string;
}

const Cat100GatePage: React.FC<Cat100GatePageProps> = ({ onAccept }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [codeMap, setCodeMap] = useState<Record<string, CodeEntry> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/cat100-codes.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Record<string, CodeEntry>) => {
        if (!cancelled) setCodeMap(data);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err?.message || 'Unable to load access list.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!codeMap) {
      setError('Still loading — please try again in a moment.');
      return;
    }
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter your access code.');
      return;
    }
    setIsChecking(true);
    const entry = codeMap[trimmed];
    if (!entry) {
      setError('Code not recognized. Check your code and try again, or contact your instructor.');
      setIsChecking(false);
      return;
    }
    onAccept({
      pid: entry.pid,
      condition: entry.condition,
      scenario: entry.scenario,
      course: entry.course,
      source: 'code',
    });
  };

  return (
    <div className="min-h-screen text-lyceum-ink px-6 py-10 flex items-center justify-center">
      <main className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-headline font-semibold text-lyceum-ink mb-1">
            CAT 100 — Persona Dialogue
          </h1>
          <p className="text-sm text-lyceum-muted">
            An ethics-of-AI conversation for pre-service teachers.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 shadow-ambient space-y-5"
        >
          <div>
            <label
              htmlFor="cat100-access-code"
              className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide"
            >
              Access code
            </label>
            <input
              id="cat100-access-code"
              type="text"
              value={code}
              onChange={e => {
                setCode(e.target.value);
                setError(null);
              }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. 9b4402"
              className="w-full px-4 py-3 rounded border border-lyceum-line bg-white font-mono text-base tracking-wider focus:outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20"
              disabled={isChecking}
            />
            <p className="mt-2 text-xs text-lyceum-muted">
              Your instructor sent you a 6-character code through Blackboard.
            </p>
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {loadError && !error && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Unable to load the access list. Please refresh, or contact your instructor.
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking || !code.trim()}
            className={`w-full py-3 rounded text-sm font-semibold tracking-wide transition-colors ${
              !isChecking && code.trim()
                ? 'bg-alabama-crimson text-white hover:bg-crimson-dark shadow-ambient'
                : 'bg-lyceum-paper-deep text-lyceum-muted cursor-not-allowed'
            }`}
          >
            {isChecking ? 'Checking…' : 'Begin'}
          </button>

          <div className="pt-3 border-t border-lyceum-line text-xs text-lyceum-muted leading-relaxed">
            <p>
              <strong className="text-lyceum-ink">What happens next:</strong> You'll work through
              a teaching dilemma in conversation with a facilitator and a few stakeholder
              voices. Plan for ~20 minutes. The session is recorded for course research; no
              personally identifying information is collected beyond the code you just entered.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Cat100GatePage;
