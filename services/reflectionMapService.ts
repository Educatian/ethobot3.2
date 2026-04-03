import type { Message, ReasoningAnalyticsSnapshot } from '../types';

export type ReflectionNodeType = 'concept' | 'value' | 'stakeholder' | 'judgment';
export type ReflectionLinkRelation = 'relates' | 'supports' | 'conflicts' | 'affects' | 'compares';

export interface ReflectionMapNode {
  id: string;
  label: string;
  type: ReflectionNodeType;
  weight: number;
  note?: string;
}

export interface ReflectionMapLink {
  id: string;
  source: string;
  target: string;
  relation: ReflectionLinkRelation;
  weight: number;
}

export interface ReflectionMapData {
  nodes: ReflectionMapNode[];
  links: ReflectionMapLink[];
  summary: string;
  prompts: string[];
}

const VALUE_TERMS = [
  'fairness', 'privacy', 'safety', 'bias', 'accountability', 'transparency', 'trust', 'harm', 'rights', 'consent',
  'justice', 'autonomy', 'equity', 'security', 'dignity',
  '공정', '사생활', '안전', '편향', '책임', '투명성', '신뢰', '피해', '권리', '동의', '자율성',
];

const STAKEHOLDER_TERMS = [
  'student', 'students', 'teacher', 'teachers', 'user', 'users', 'developer', 'developers', 'company', 'companies',
  'government', 'community', 'patient', 'patients', 'pedestrian', 'pedestrians', 'driver', 'drivers', 'citizen',
  'learner', 'learners', 'child', 'children', 'worker', 'workers', 'family', 'families',
  '학생', '교사', '사용자', '개발자', '회사', '정부', '공동체', '환자', '보행자', '운전자', '시민', '학습자',
];

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'every', 'first', 'from',
  'have', 'into', 'just', 'like', 'made', 'more', 'most', 'much', 'other', 'really', 'should', 'still', 'than',
  'that', 'their', 'there', 'these', 'they', 'this', 'think', 'those', 'through', 'under', 'very', 'what', 'when',
  'where', 'which', 'while', 'would', 'your', 'ours', 'ourselves', 'ours', 'into', 'with', 'without', 'then',
  'have', 'having', 'about', 'ethical', 'ethics', 'dilemma', 'technology', 'system', 'systems',
  '그리고', '그런데', '하지만', '정말', '너무', '조금', '이것', '그것', '저것', '대한', '위한', '에서', '으로',
  '하는', '있는', '있다', '같은', '문제', '윤리', '기술', '시스템',
]);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));

const titleize = (token: string) =>
  /^[a-z]/.test(token) ? token.charAt(0).toUpperCase() + token.slice(1) : token;

const detectJudgmentLabel = (messages: Message[]) => {
  const latestUserMessage = [...messages].reverse().find(message => message.sender === 'user');
  if (!latestUserMessage) {
    return 'Current Position';
  }

  const trimmed = latestUserMessage.text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 54) {
    return trimmed;
  }

  return `${trimmed.slice(0, 51)}...`;
};

export const buildReflectionMapFromDialogue = (
  messages: Message[],
  analytics: ReasoningAnalyticsSnapshot
): ReflectionMapData => {
  const nodeMap = new Map<string, ReflectionMapNode>();
  const edgeMap = new Map<string, ReflectionMapLink>();
  const userMessages = messages.filter(message => message.sender === 'user');
  const latestJudgmentLabel = detectJudgmentLabel(messages);
  const currentStateLabel = analytics.currentLearnerState || 'Emerging reflection';

  const addNode = (label: string, type: ReflectionNodeType, weight = 1, note?: string) => {
    const id = `${type}:${label.toLowerCase()}`;
    const existing = nodeMap.get(id);
    if (existing) {
      existing.weight += weight;
      if (!existing.note && note) {
        existing.note = note;
      }
      return existing.id;
    }
    nodeMap.set(id, { id, label, type, weight, note });
    return id;
  };

  const addEdge = (
    source: string,
    target: string,
    relation: ReflectionLinkRelation,
    weight = 1
  ) => {
    if (source === target) {
      return;
    }
    const [left, right] = [source, target].sort();
    const edgeId = `${left}->${right}:${relation}`;
    const existing = edgeMap.get(edgeId);
    if (existing) {
      existing.weight += weight;
      return;
    }
    edgeMap.set(edgeId, { id: edgeId, source, target, relation, weight });
  };

  const judgmentId = addNode(latestJudgmentLabel, 'judgment', 2, `Current reasoning stage: ${currentStateLabel}`);

  userMessages.forEach(message => {
    const tokens = tokenize(message.text);
    const uniqueTokens = Array.from(new Set(tokens));
    const presentValues = uniqueTokens.filter(token => VALUE_TERMS.includes(token)).slice(0, 4);
    const presentStakeholders = uniqueTokens.filter(token => STAKEHOLDER_TERMS.includes(token)).slice(0, 4);
    const candidateConcepts = uniqueTokens
      .filter(token => !VALUE_TERMS.includes(token) && !STAKEHOLDER_TERMS.includes(token))
      .slice(0, 5);

    const nodeIds = [
      ...presentValues.map(token => addNode(titleize(token), 'value', 1.6)),
      ...presentStakeholders.map(token => addNode(titleize(token), 'stakeholder', 1.5)),
      ...candidateConcepts.map(token => addNode(titleize(token), 'concept', 1)),
    ];

    nodeIds.forEach(nodeId => addEdge(judgmentId, nodeId, 'supports', 1));

    for (let i = 0; i < nodeIds.length; i += 1) {
      for (let j = i + 1; j < nodeIds.length; j += 1) {
        const left = nodeMap.get(nodeIds[i]);
        const right = nodeMap.get(nodeIds[j]);
        if (!left || !right) continue;

        let relation: ReflectionLinkRelation = 'relates';
        if (left.type === 'value' && right.type === 'value') {
          relation = 'conflicts';
        } else if (
          (left.type === 'stakeholder' && right.type === 'value') ||
          (left.type === 'value' && right.type === 'stakeholder')
        ) {
          relation = 'affects';
        } else if (left.type === 'concept' && right.type === 'concept') {
          relation = 'compares';
        }

        addEdge(nodeIds[i], nodeIds[j], relation, 0.8);
      }
    }
  });

  const sortedNodes = Array.from(nodeMap.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 14)
    .map(node => ({
      ...node,
      weight: clamp(node.weight, 1, 5),
    }));

  const allowedIds = new Set(sortedNodes.map(node => node.id));
  const filteredLinks = Array.from(edgeMap.values())
    .filter(link => allowedIds.has(link.source) && allowedIds.has(link.target))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 24);

  const summary =
    sortedNodes.length === 0
      ? 'Keep the dialogue going and the map will begin to surface your values, stakeholders, and emerging judgment.'
      : `This map sketches how your current position connects to ${sortedNodes.filter(node => node.type === 'value').length} value cues, ${sortedNodes.filter(node => node.type === 'stakeholder').length} stakeholder cues, and ${sortedNodes.filter(node => node.type === 'concept').length} concept cues from the dialogue.`;

  const prompts = [
    'Which link on this map feels the weakest or most uncertain?',
    'Which stakeholder deserves more space before you settle on a judgment?',
    'What value conflict here still feels unresolved?',
  ];

  return {
    nodes: sortedNodes,
    links: filteredLinks,
    summary,
    prompts,
  };
};
