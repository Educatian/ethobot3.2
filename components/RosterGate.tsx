import React, { useEffect, useState } from 'react';
import type { Cat100Identity } from './Cat100GatePage';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

interface Student { name: string; pid: string; }
interface Section { section: string; course: string; passcode: string; students: Student[]; }
interface RosterGateProps { onAccept: (identity: Cat100Identity) => void; }

// Deterministic fallback cell if the live RPC is unavailable (e.g., SQL not yet
// applied). Students never see the cell either way; the research team reads it
// from Supabase. Live balancing (assign_cell RPC) is preferred and global.
const hashInt = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
};
const CELLS: Array<{ condition: 'ld' | 'ar'; scenario: 'a' | 'b' }> = [
  { condition: 'ld', scenario: 'a' },
  { condition: 'ld', scenario: 'b' },
  { condition: 'ar', scenario: 'a' },
  { condition: 'ar', scenario: 'b' },
];
const fallbackCell = (pid: string) => CELLS[hashInt(pid) % 4];

const RosterGate: React.FC<RosterGateProps> = ({ onAccept }) => {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sec, setSec] = useState<Section | null>(null);
  const [studentIdx, setStudentIdx] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/rosters.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setSections(d.sections || []); })
      .catch(e => { if (!cancelled) setLoadError(e?.message || 'Unable to load class list.'); });
    return () => { cancelled = true; };
  }, []);

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sections) { setError('Still loading — please try again in a moment.'); return; }
    const t = code.trim().toLowerCase();
    if (!t) { setError('Please enter your class passcode.'); return; }
    const m = sections.find(s => s.passcode.trim().toLowerCase() === t);
    if (!m) { setError('Passcode not recognized. Check the code your instructor posted in Blackboard.'); return; }
    if (!m.students || m.students.length === 0) {
      setError('This class has no roster loaded yet — please contact your instructor.'); return;
    }
    setSec(m); setStudentIdx('');
  };

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sec) return;
    const i = parseInt(studentIdx, 10);
    if (!(i >= 0)) { setError('Please select your name.'); return; }
    const st = sec.students[i];
    setWorking(true);
    let cell: { condition: 'ld' | 'ar'; scenario: 'a' | 'b' } | null = null;
    try {
      if (isSupabaseConfigured) {
        const { data, error: rpcErr } = await supabase.rpc('assign_cell', {
          p_participant_id: st.pid, p_email: '', p_name: st.name, p_course: sec.course, p_section: sec.section,
        });
        if (!rpcErr) {
          const row: any = Array.isArray(data) ? data[0] : data;
          if (row && (row.condition === 'ld' || row.condition === 'ar') && (row.scenario === 'a' || row.scenario === 'b')) {
            cell = { condition: row.condition, scenario: row.scenario };
          }
        }
      }
    } catch {
      /* fall through to deterministic fallback */
    }
    if (!cell) cell = fallbackCell(st.pid);
    onAccept({
      pid: st.pid, condition: cell.condition, scenario: cell.scenario,
      course: sec.course, section: sec.section, source: 'code', name: st.name,
    } as Cat100Identity);
  };

  const wrap = 'min-h-screen text-lyceum-ink px-6 py-10 flex items-center justify-center';
  const card = 'bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 shadow-ambient space-y-5';
  const field = 'w-full px-4 py-3 rounded border border-lyceum-line bg-white text-base focus:outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20';
  const btn = 'w-full py-3 rounded text-sm font-semibold tracking-wide transition-colors bg-alabama-crimson text-white hover:bg-crimson-dark shadow-ambient disabled:opacity-60';

  // Step 1: passcode
  if (!sec) {
    return (
      <div className={wrap}>
        <main className="w-full max-w-md">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-headline font-semibold text-lyceum-ink mb-1">ETHOBOT — Persona Dialogue</h1>
            <p className="text-sm text-lyceum-muted">Enter your class passcode to begin.</p>
          </header>
          <form onSubmit={submitCode} className={card}>
            <div>
              <label htmlFor="rg-code" className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide">Class passcode</label>
              <input id="rg-code" type="text" value={code} autoFocus autoComplete="off" spellCheck={false}
                onChange={e => { setCode(e.target.value); setError(null); }}
                placeholder="e.g. ab12cd" className={`${field} font-mono tracking-wider`} />
              <p className="mt-2 text-xs text-lyceum-muted">Your instructor posted this code in Blackboard.</p>
            </div>
            {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {loadError && !error && <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Unable to load the class list. Please refresh, or contact your instructor.</div>}
            <button type="submit" disabled={!code.trim()} className={btn}>Continue</button>
          </form>
        </main>
      </div>
    );
  }

  // Step 2: name dropdown
  return (
    <div className={wrap}>
      <main className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-headline font-semibold text-lyceum-ink mb-1">ETHOBOT — Persona Dialogue</h1>
          <p className="text-sm text-lyceum-muted">{sec.course} · Select your name to begin.</p>
        </header>
        <form onSubmit={enter} className={card}>
          <div>
            <label htmlFor="rg-name" className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide">Your name</label>
            <select id="rg-name" value={studentIdx} onChange={e => { setStudentIdx(e.target.value); setError(null); }} className={field}>
              <option value="" disabled>Select your name…</option>
              {sec.students.map((s, i) => (<option key={s.pid} value={i}>{s.name}</option>))}
            </select>
            <p className="mt-2 text-xs text-lyceum-muted">Pick the name your instructor enrolled. Not listed? Contact your instructor.</p>
          </div>
          {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={working || studentIdx === ''} className={btn}>{working ? 'Starting…' : 'Begin'}</button>
          <button type="button" onClick={() => { setSec(null); setCode(''); setStudentIdx(''); setError(null); }}
            className="w-full text-xs text-lyceum-muted hover:text-alabama-crimson">← use a different passcode</button>
        </form>
      </main>
    </div>
  );
};

export default RosterGate;
