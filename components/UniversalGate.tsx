import React, { useState } from 'react';
import type { Cat100Identity } from './Cat100GatePage';

interface UniversalGateProps {
  onAccept: (identity: Cat100Identity) => void;
}

// Universal entry: one link, learner picks course, then we randomly assign
// study condition (ld/ar) and scenario (a/b). URL params can override for
// researcher/test runs (?condition=ld&scenario=a).
const COURSES: { value: string; label: string }[] = [
  { value: 'CAT100', label: 'CAT 100 — Digital Citizenship' },
  { value: 'CAT531', label: 'CAT 531 — Computer-Based Instruction' },
];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const genPid = (course: string) =>
  `${course.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;

const UniversalGate: React.FC<UniversalGateProps> = ({ onAccept }) => {
  const [course, setCourse] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!course) {
      setError('Please select your course.');
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and UA email.');
      return;
    }
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const condRaw = params.get('condition');
    const scenRaw = params.get('scenario');
    const condition: 'ld' | 'ar' =
      condRaw === 'ld' || condRaw === 'ar' ? condRaw : pick(['ld', 'ar'] as const);
    const scenario: 'a' | 'b' =
      scenRaw === 'a' || scenRaw === 'b' ? scenRaw : pick(['a', 'b'] as const);

    onAccept({
      pid: genPid(course),
      condition,
      scenario,
      course,
      source: 'anonymous',
      name: name.trim(),
      email: email.trim(),
    });
  };

  return (
    <div className="min-h-screen text-lyceum-ink px-6 py-10 flex items-center justify-center">
      <main className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-headline font-semibold text-lyceum-ink mb-1">
            ETHOBOT — Persona Dialogue
          </h1>
          <p className="text-sm text-lyceum-muted">
            An ethics-of-AI conversation. Select your course to begin.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 shadow-ambient space-y-5"
        >
          <div>
            <label
              htmlFor="ug-course"
              className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide"
            >
              Course
            </label>
            <select
              id="ug-course"
              value={course}
              onChange={e => {
                setCourse(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-3 rounded border border-lyceum-line bg-white text-base focus:outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20"
            >
              <option value="" disabled>
                Select your course…
              </option>
              {COURSES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ug-name"
              className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide"
            >
              Full name
            </label>
            <input
              id="ug-name"
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError(null);
              }}
              autoComplete="name"
              className="w-full px-4 py-3 rounded border border-lyceum-line bg-white text-base focus:outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20"
            />
          </div>

          <div>
            <label
              htmlFor="ug-email"
              className="block text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide"
            >
              UA email
            </label>
            <input
              id="ug-email"
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="email"
              placeholder="name@ua.edu"
              className="w-full px-4 py-3 rounded border border-lyceum-line bg-white text-base focus:outline-none focus:border-alabama-crimson focus:ring-2 focus:ring-alabama-crimson/20"
            />
            <p className="mt-2 text-xs text-lyceum-muted">
              Used only to link your activity and survey responses; kept confidential.
            </p>
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded text-sm font-semibold tracking-wide transition-colors bg-alabama-crimson text-white hover:bg-crimson-dark shadow-ambient"
          >
            Begin
          </button>

          <div className="pt-3 border-t border-lyceum-line text-xs text-lyceum-muted leading-relaxed">
            <p>
              <strong className="text-lyceum-ink">What happens next:</strong> You'll work through a
              teaching dilemma in conversation with a facilitator and a few stakeholder voices, then
              continue to a short survey. Plan for ~20 minutes. The session is recorded for course
              research.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
};

export default UniversalGate;
