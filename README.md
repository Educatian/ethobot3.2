<div align="center">
  <img width="1200" height="475" alt="ETHOBOT banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>ETHOBOT 3.2</h1>
  <p><strong>An adaptive ethical reasoning workspace for dilemma dialogue, reflective prompting, and instructor analytics.</strong></p>

  <p>
    <a href="https://ethobot32.vercel.app/project-overview">Project Overview</a>
    |
    <a href="https://github.com/Educatian/ethobot3.2">Repository</a>
  </p>
</div>

## What ETHOBOT is

ETHOBOT 3.2 is a dialogue-based AI ethics learning environment designed around ill-structured problem solving, dilemma dialogue, and reflective regulation.

Instead of treating ethical reasoning as a quick-answer task, ETHOBOT treats it as a process of:

- surfacing competing values
- comparing stakeholder perspectives
- justifying provisional judgments
- slowing closure long enough for reflection to deepen

The system combines learner-facing coaching, instructor-facing analytics, adaptive intervention logic, and reflection mapping in one workspace.

## Why this version matters

ETHOBOT 3.2 moves beyond a simple chatbot interface and toward an adaptive reasoning environment.

Key updates in this version include:

- learner-facing coaching that translates analytics into gentle reflective nudges
- instructor-facing analytics for monitoring reasoning patterns, intervention traces, and review workflows
- Reflection Map mode for turning dialogue into an editable concept map with PNG export
- a shareable Project Overview page at `/project-overview`
- runtime stabilization work including lazy loading, fallbacks, and degraded-mode behavior

## Core experience

### Learner workspace

- Socratic dialogue flow for AI ethics dilemmas
- adaptive prompts based on reasoning patterns
- reflection starters and a coaching rail
- Reflection Map generation from current dialogue

### Instructor analytics

- reasoning-state monitoring
- adaptive move tracing
- swarm adjudication fallback view
- annotation and reviewed-corpus workflow
- recalibration and provider comparison reports

### Research-facing infrastructure

- a Project Overview page connecting design decisions to research foundations
- design-response matrix traces
- reviewed profile import and export
- evaluation-ready analytics and dataset exports

## Research foundations

ETHOBOT 3.2 is informed by two closely connected design directions:

1. **Computational modeling of ethical reasoning regulation**  
   This informs state tracking, reflective triggers, perspective shifts, and regulation analytics.

2. **Dilemma dialogue and open inquiry design**  
   This informs closure delay, counter-perspective sequencing, value probes, and the pacing of reflective dialogue.

The broader pedagogical frame also draws from David Jonassen's work on ill-structured problem solving, treating AI ethics as a contextual, ambiguous, and value-laden problem space rather than a single-answer exercise.

## Analytics flow

ETHOBOT's analytics are not just for logging. They sit inside the dialogue loop.

1. **Dialogue signals**  
   Learner turns, choices, stakeholder references, hesitation, and justification language are read as live signals.

2. **Reasoning analytics**  
   The system estimates reasoning state, tracks openness, and flags risks such as premature convergence or surface compliance.

3. **Adaptive moves**  
   ETHOBOT selects interventions such as closure delay, counter-perspective, value probe, or self-evaluation.

4. **Dual surfaces**  
   The same analytics are translated differently for learner-facing coaching and instructor-facing monitoring.

## Project structure

```text
components/   UI surfaces including learner workspace, analytics, reflection map, and project overview
hooks/        Main application orchestration and interaction flow
services/     Analytics, logging, reflection-map generation, provider logic, and data exports
contexts/     Shared language context
public/       Static assets
```

## Local development

### Prerequisites

- Node.js 20+

### Environment variables

Create a local env file based on `.env.example`.

Required variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

## Shareable routes

- Main app: `/`
- Project overview: `/project-overview`

The project overview route is designed to be shared directly outside the authenticated workspace.

## Contributors

- Jewoong Moon (The University of Alabama)
- Sumin Hong (Seoul National University)
- Joy Yeonjoo Lee (Leiden University)

## Notes

- `.env` files are ignored from Git. Use `.env.example` as the template for local and Vercel configuration.
- The current app is built as a client-first prototype with analytics and adaptive dialogue logic running in the front end.
- ETHOBOT 3.2 is both a research artifact and an evolving learning-system prototype.
