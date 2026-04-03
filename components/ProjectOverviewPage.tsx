import React from 'react';
import { ArrowLeft, ArrowUpRight, Compass, GitBranch, Layers3, MessagesSquare, Scale } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ProjectOverviewPageProps {
  onBack: () => void;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const ProjectOverviewPage: React.FC<ProjectOverviewPageProps> = ({ onBack, onLogClick }) => {
  const { language } = useLanguage();

  const copy = language === 'ko'
    ? {
        eyebrow: '프로젝트 개요',
        title: '비구조적 문제해결과 딜레마 대화의 만남',
        subtitle:
          'ETHOBOT은 AI 윤리를 단일 정답 문제가 아니라, 충돌하는 가치와 잠정적 판단, 그리고 성찰을 깊게 만드는 대화적 개입이 필요한 문제 공간으로 다룹니다.',
        thesisLabel: '설계 명제',
        thesis:
          'Jonassen은 학습자가 어떤 종류의 문제를 다루는지 설명해주고, 딜레마 기반 교수법은 어떤 종류의 대화가 필요한지 설명해줍니다. ETHOBOT은 이 둘을 단계적이고 성찰적인 윤리 학습 공간으로 조율합니다.',
        back: '학습자 화면으로 돌아가기',
        contributors: '기여자',
        researchOverview: '연구 개요',
        threeLens: '세 가지 렌즈, 하나의 학습 설계',
        alignment: '왜 이 둘이 잘 맞는가',
        flow: 'ETHOBOT이 이론을 상호작용으로 바꾸는 방식',
        matrix: '개념-설계 매트릭스',
        note: '해석적 메모',
        sources: '참고 문헌',
        lensCards: [
          ['비구조적 문제', '모호성, 불완전한 정보, 경쟁하는 판단 기준, 그리고 하나 이상 가능한 해결 경로를 다루게 됩니다.'],
          ['딜레마 기반 교수법', '입장을 비교하고, 충돌하는 가치를 드러내며, 타인의 관점을 취하고, 수정 가능한 판단을 정당화합니다.'],
          ['ETHOBOT의 조율', '질문의 순서를 설계하고, 결론을 늦추며, 관점 전환과 자기평가를 유도합니다.'],
        ],
        alignmentItems: [
          ['윤리 문제는 깔끔하지 않습니다.', 'Jonassen이 말하듯 실제 문제는 맥락적이고 불확실합니다. 윤리적 딜레마도 같은 성격을 가지므로 단일 정답 문제처럼 다루기 어렵습니다.'],
          ['추론은 대화 속에서 깊어집니다.', '딜레마 대화는 학습자가 이유를 말하고, 상충하는 선택지를 비교하며, 처음에는 보지 못했던 관점을 만나게 합니다.'],
          ['관점 취하기는 논증의 질을 높입니다.', '다른 사람의 이유를 따라가 볼 수 있어야만 그 입장을 책임 있게 검토하고 자신의 판단을 수정할 수 있습니다.'],
          ['성찰에는 속도 조절이 필요합니다.', '시스템은 너무 빨리 결론을 닫지 않고, 정당화와 이해당사자 비교, 자기평가가 일어날 시간을 남겨두어야 합니다.'],
        ],
        steps: [
          ['1. 모호성과 마주하기', '정답이 미리 정해진 문제가 아니라 가치 충돌이 있는 사례를 만납니다.'],
          ['2. 이해당사자 드러내기', '질문은 누가 영향을 받는지 넓히고, 어떤 이해가 서로 긴장하는지 보이게 합니다.'],
          ['3. 윤리 틀 비교하기', '원칙, 결과, 의무, 맥락을 넘나들며 생각하게 합니다.'],
          ['4. 잠정적 판단 정당화하기', '이유, 트레이드오프, 영향을 받는 사람을 묻고 나서야 판단을 안정된 것으로 취급합니다.'],
          ['5. 성찰하며 다시 열기', '관점 전환과 자기평가 개입은 아직 충분히 검토되지 않은 지점을 다시 보게 만듭니다.'],
        ],
        matrixColumns: ['연구 개념', '교수학적 움직임', 'ETHOBOT 구현'],
        matrixRows: [
          ['복수의 가능한 해결', '정답 찾기보다 비교를 유도', '열린 딜레마 질문과 리소스 연동 후속 질문'],
          ['맥락의존적 판단', '이해당사자 관점을 대화 안으로 끌어오기', '관점 전환 프롬프트와 역할 민감형 후속 질문'],
          ['논증과 근거의 필요', '정당화, 한정, 수정 요청', '정당화 요청, 가치 탐색, closure delay 개입'],
          ['메타인지와 성찰의 중요성', '자기 추론 과정을 돌아보게 하기', 'reflection starter, 자기평가 프롬프트, 코칭 애널리틱'],
        ],
        studyCards: [
          [
            '연구 1. 윤리적 추론 조절의 계산 모델링',
            'ETHOBOT의 상태 추적과 개입 로직은 학습자의 추론이 어떤 상태에 머무는지 읽고, 언제 관점 전환과 자기평가를 유도해야 하는지 설명하는 규제 관점에서 출발합니다.',
            ['D/C/P/R 상태 전이', 'perspective gateway', 'self-evaluation as reflective trigger', 'entropy/coherence analytics'],
          ],
          [
            '연구 2. 딜레마 대화와 개방적 탐구 설계',
            '대화 설계는 결론을 너무 빨리 닫지 않으면서 가치 충돌, trade-off, justification을 유지하는 방식으로 조직됩니다. 이 흐름은 ETHOBOT의 closure delay, counter-perspective, value probe에 직접 연결됩니다.',
            ['closure delay', 'counter-perspective sequencing', 'value probe', 'continuous openness orientation'],
          ],
        ],
        noteBody:
          '이 페이지는 ETHOBOT을 위한 설계 종합입니다. Jonassen의 비구조적 문제해결과 대화 중심 딜레마 교수법을 함께 해석해 인터페이스, 프롬프트, 애널리틱 설계를 정리한 것입니다.',
      }
    : {
        eyebrow: 'Project Overview',
        title: 'Ill-Structured Problems Meet Dilemma Dialogue',
        subtitle:
          'ETHOBOT frames AI ethics as a problem space with competing values, provisional judgments, and dialogue moves that keep reasoning open long enough for reflection to deepen.',
        thesisLabel: 'Design Thesis',
        thesis:
          'Jonassen helps define the kind of problem learners are facing. Dilemma-based pedagogy helps define the kind of dialogue they need. ETHOBOT coordinates the two into a staged, reflective ethics workspace.',
        back: 'Back to learner workspace',
        contributors: 'Contributors',
        researchOverview: 'Research Overview',
        threeLens: 'Three lenses, one learning design',
        alignment: 'Why these traditions fit together',
        flow: 'How ETHOBOT translates the theory into interaction',
        matrix: 'Concept-to-design matrix',
        note: 'Interpretive note',
        sources: 'Selected sources',
        lensCards: [
          ['Ill-Structured Problems', 'Learners work through ambiguity, incomplete information, competing criteria, and more than one defensible path forward.'],
          ['Dilemma-Based Pedagogy', 'Learners compare positions, surface values in conflict, take perspectives, and justify a judgment that remains open to revision.'],
          ['ETHOBOT Orchestration', 'The system stages prompts, delays closure, introduces counter-perspectives, and nudges self-evaluation instead of rushing toward a single answer.'],
        ],
        alignmentItems: [
          ['Ethics problems are rarely clean.', 'Jonassen argues that real-world problems are contextual and uncertain. Ethical dilemmas share that same texture, so they should not be taught as single-answer exercises.'],
          ['Reasoning improves through dialogue.', 'Dilemma dialogue makes students articulate reasons, weigh trade-offs, and encounter viewpoints they did not start with.'],
          ['Perspective-taking strengthens argument quality.', 'A learner must follow another person’s reasons before they can responsibly critique or revise a position.'],
          ['Reflection needs pacing.', 'The system should keep the dilemma open long enough for justification, stakeholder comparison, and self-evaluation to happen before closure.'],
        ],
        steps: [
          ['1. Encounter ambiguity', 'The learner meets a case with value conflict rather than a predefined right answer.'],
          ['2. Surface stakeholders', 'Dialogue prompts widen the field of concern and reveal whose interests are in tension.'],
          ['3. Compare ethical frames', 'The learner moves across principles, consequences, duties, and context instead of staying inside one quick frame.'],
          ['4. Justify a provisional judgment', 'The system asks for reasons, trade-offs, and affected persons before accepting a position as stable.'],
          ['5. Reflect and reopen', 'Counter-perspective and self-evaluation moves help the learner revisit what still feels underexamined.'],
        ],
        matrixColumns: ['Research idea', 'Pedagogical move', 'ETHOBOT implementation'],
        matrixRows: [
          ['Multiple possible solutions', 'Invite comparison instead of answer hunting', 'Open-ended dilemma prompts plus resource-linked follow-ups'],
          ['Context-dependent judgment', 'Bring stakeholder positions into the conversation', 'Counter-perspective prompts and role-sensitive follow-up questions'],
          ['Need for argument and evidence', 'Ask learners to justify, qualify, and revise', 'Justification requests, value probes, and closure-delay moves'],
          ['Metacognition and reflection matter', 'Help learners inspect their own reasoning process', 'Reflection starters, self-evaluation prompts, and coaching analytics'],
        ],
        studyCards: [
          [
            'Study 1. Computational Modeling of Ethical Reasoning Regulation',
            'ETHOBOT’s state tracking and intervention logic draw on a regulatory view of learning: the system reads where reasoning is getting stuck and uses perspective-taking and self-evaluation to support deeper transitions.',
            ['D/C/P/R state transitions', 'perspective gateway', 'self-evaluation as reflective trigger', 'entropy/coherence analytics'],
          ],
          [
            'Study 2. Dilemma Dialogue and Open Inquiry Design',
            'The dialogue layer is designed to keep ethical inquiry open long enough for value conflict, trade-offs, and justification to emerge. This directly informs ETHOBOT’s closure delay, counter-perspective, and value-probe moves.',
            ['closure delay', 'counter-perspective sequencing', 'value probe', 'continuous openness orientation'],
          ],
        ],
        noteBody:
          'This page is a design synthesis for ETHOBOT. It interprets Jonassen’s account of ill-structured problem solving alongside dialogue-centered dilemma pedagogy to guide interface, prompt, and analytics decisions.',
      };

  const sources = [
    ['Jonassen, D. H. (1997). Instructional design models for well-structured and ill-structured problem-solving learning outcomes.', 'https://www.davidlewisphd.com/courses/EDD8121/readings/1997-Jonassen.pdf'],
    ['Jonassen, D. H. (2000). Toward a Design Theory of Problem Solving.', 'https://site.caes.uga.edu/sandlin/files/2023/09/Jonassen-2000.pdf'],
    ['Stolper, M., Molewijk, B., & Widdershoven, G. (2016). Bioethics education in clinical settings: theory and practice of the dilemma method of moral case deliberation.', 'https://pubmed.ncbi.nlm.nih.gov/27448597/'],
    ['Fancourt, N., & Guilfoyle, L. (2022). Interdisciplinary perspective-taking within argumentation.', 'https://link.springer.com/article/10.1007/s40839-021-00143-9'],
  ] as const;

  const contributors = [
    'Jewoong Moon (The University of Alabama)',
    'Sumin Hong (Seoul National University)',
    'Joy Yeonjoo Lee (Leiden University)',
  ];

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-transparent px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-lyceum-line bg-[#f8f4ea] shadow-panel">
        <div className="border-b border-lyceum-line bg-lyceum-ink px-6 py-8 text-lyceum-paper sm:px-10 sm:py-12">
          <button
            type="button"
            onClick={() => {
              onLogClick('project-overview-back', 'button', copy.back);
              onBack();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-lyceum-paper/82 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={14} />
            {copy.back}
          </button>
          <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.34em] text-lyceum-paper/58">{copy.eyebrow}</p>
          <h2 className="mt-4 max-w-4xl font-headline text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-lyceum-paper/76 sm:text-base">{copy.subtitle}</p>
          <div className="mt-8 max-w-3xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-paper/52">{copy.contributors}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {contributors.map(contributor => (
                <div
                  key={contributor}
                  className="rounded-full border border-white/14 bg-white/6 px-4 py-2 text-sm font-medium text-lyceum-paper/88 backdrop-blur"
                >
                  {contributor}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-0 border-b border-lyceum-line lg:grid-cols-[1.35fr_0.95fr]">
          <div className="border-b border-lyceum-line px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.thesisLabel}</p>
            <p className="mt-4 max-w-3xl font-headline text-3xl leading-tight text-lyceum-ink">{copy.thesis}</p>
          </div>
          <div className="bg-[#f2ebde] px-6 py-8 sm:px-10">
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              {[['Problem type', 'Open, contextual, and value-laden.', Compass], ['Dialogue mode', 'Compare, justify, reopen, reflect.', MessagesSquare], ['System role', 'Coordinate pacing rather than supply a final answer.', GitBranch]].map(([label, body, Icon]) => (
                <div key={label as string} className="flex items-start gap-3">
                  <Icon className="mt-1 h-5 w-5 text-lyceum-accent" />
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-lyceum-muted">{label as string}</p>
                    <p className="mt-1 text-sm leading-6 text-lyceum-ink-soft">{body as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-lyceum-line px-6 py-10 sm:px-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.researchOverview}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {copy.studyCards.map(study => (
              <div key={study[0]} className="rounded-[1.75rem] border border-lyceum-line bg-white px-6 py-7 shadow-sm">
                <h4 className="font-headline text-3xl font-bold leading-tight text-lyceum-ink">{study[0]}</h4>
                <p className="mt-4 text-sm leading-7 text-lyceum-ink-soft">{study[1]}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {study[2].map(tag => (
                    <span
                      key={tag}
                      className="rounded-full border border-lyceum-line bg-[#fcfaf4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-lyceum-accent"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-b border-lyceum-line px-6 py-10 sm:px-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.threeLens}</p>
          <h3 className="mt-3 font-headline text-4xl font-bold text-lyceum-ink">Jonassen {'->'} dilemma dialogue {'->'} ETHOBOT</h3>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {copy.lensCards.map((item, index) => {
              const tones = [
                'bg-[#f6efe0] text-lyceum-ink',
                'bg-white text-lyceum-ink',
                'bg-lyceum-ink text-lyceum-paper',
              ];
              const icons = [Layers3, Scale, GitBranch];
              const Icon = icons[index];
              return (
                <div key={item[0]} className={`min-h-[15rem] rounded-[1.75rem] border border-lyceum-line px-6 py-7 ${tones[index]}`}>
                  <Icon className="h-6 w-6 text-lyceum-accent" />
                  <h4 className="mt-6 font-headline text-3xl font-bold leading-tight">{item[0]}</h4>
                  <p className="mt-4 text-sm leading-7 opacity-85">{item[1]}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-0 border-b border-lyceum-line lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-lyceum-line bg-white px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.alignment}</p>
            <div className="mt-8 space-y-7">
              {copy.alignmentItems.map((item, index) => (
                <div key={item[0]} className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-lyceum-line bg-[#f7f1e6] font-headline text-xl font-bold text-lyceum-accent">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-lyceum-ink">{item[0]}</h4>
                    <p className="mt-2 text-sm leading-7 text-lyceum-muted">{item[1]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#082d30] px-6 py-10 text-lyceum-paper sm:px-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-paper/55">{copy.flow}</p>
            <div className="mt-8 space-y-5">
              {copy.steps.map((step, index) => (
                <div key={step[0]} className="grid grid-cols-[1.15rem_1fr] gap-4">
                  <div className="relative flex justify-center">
                    <div className="mt-2 h-3 w-3 rounded-full bg-lyceum-highlight" />
                    {index < copy.steps.length - 1 && <div className="absolute top-6 h-[calc(100%+1.25rem)] w-px bg-white/14" />}
                  </div>
                  <div className="pb-3">
                    <h4 className="text-lg font-semibold text-white">{step[0]}</h4>
                    <p className="mt-2 text-sm leading-7 text-lyceum-paper/76">{step[1]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-lyceum-line bg-[#f9f5ec] px-6 py-10 sm:px-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.matrix}</p>
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-lyceum-line bg-white">
            <div className="hidden grid-cols-[1fr_1fr_1.2fr] border-b border-lyceum-line bg-[#f5efe2] text-[10px] font-extrabold uppercase tracking-[0.22em] text-lyceum-muted md:grid">
              {copy.matrixColumns.map(column => <div key={column} className="px-5 py-4">{column}</div>)}
            </div>
            {copy.matrixRows.map(row => (
              <div key={row[0]} className="grid border-b border-lyceum-line last:border-b-0 md:grid-cols-[1fr_1fr_1.2fr]">
                {row.map((cell, cellIndex) => (
                  <div key={`${row[0]}-${cellIndex}`} className="px-5 py-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-lyceum-muted md:hidden">{copy.matrixColumns[cellIndex]}</p>
                    <p className={`mt-1 text-sm leading-6 ${cellIndex === 0 ? 'font-semibold text-lyceum-ink' : 'text-lyceum-ink-soft'}`}>{cell}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-lyceum-line bg-[#f2ebde] px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.note}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-lyceum-ink-soft">{copy.noteBody}</p>
          </div>
          <div className="bg-white px-6 py-8 sm:px-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-lyceum-muted">{copy.sources}</p>
            <div className="mt-5 space-y-4">
              {sources.map(source => (
                <a
                  key={source[1]}
                  href={source[1]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => onLogClick('project-overview-source-link', 'a', (event.currentTarget.textContent || '').slice(0, 120))}
                  className="group flex items-start justify-between gap-4 rounded-[1.2rem] border border-lyceum-line bg-[#fcfaf4] px-4 py-4 text-sm leading-6 text-lyceum-ink-soft transition hover:border-lyceum-accent/30 hover:bg-[#fffdf8]"
                >
                  <span>{source[0]}</span>
                  <ArrowUpRight className="mt-1 h-4 w-4 flex-shrink-0 text-lyceum-accent transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectOverviewPage;
