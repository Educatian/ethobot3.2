import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, RefreshCcw, ArrowLeft, Share2 } from 'lucide-react';
import * as d3 from 'd3';
import type { Message, ReasoningAnalyticsSnapshot } from '../types';
import {
  buildReflectionMapFromDialogue,
  type ReflectionMapData,
  type ReflectionMapLink,
  type ReflectionMapNode,
} from '../services/reflectionMapService';

interface ReflectionMapPageProps {
  messages: Message[];
  reasoningAnalytics: ReasoningAnalyticsSnapshot;
  onBack: () => void;
  onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

type SimNode = ReflectionMapNode & d3.SimulationNodeDatum;
type SimLink = ReflectionMapLink & d3.SimulationLinkDatum<SimNode>;

const NODE_COLORS: Record<ReflectionMapNode['type'], string> = {
  concept: '#0d3b3f',
  value: '#904d00',
  stakeholder: '#487174',
  judgment: '#1d1d17',
};

const ReflectionMapPage: React.FC<ReflectionMapPageProps> = ({
  messages,
  reasoningAnalytics,
  onBack,
  onLogClick,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapData, setMapData] = useState<ReflectionMapData>(() => buildReflectionMapFromDialogue(messages, reasoningAnalytics));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [mapWidth, setMapWidth] = useState(860);
  const mapHeight = 620;

  useEffect(() => {
    setMapData(buildReflectionMapFromDialogue(messages, reasoningAnalytics));
    setSelectedNodeId(null);
  }, [messages, reasoningAnalytics]);

  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) return;
      setMapWidth(containerRef.current.clientWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const selectedNode = useMemo(
    () => mapData.nodes.find(node => node.id === selectedNodeId) || null,
    [mapData.nodes, selectedNodeId]
  );

  useEffect(() => {
    setDraftLabel(selectedNode?.label || '');
  }, [selectedNode]);

  useEffect(() => {
    if (!svgRef.current || mapData.nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes: SimNode[] = mapData.nodes.map(node => ({ ...node }));
    const links: SimLink[] = mapData.links.map(link => ({ ...link }));

    const width = Math.max(mapWidth, 640);
    const height = mapHeight;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const layer = svg.append('g');

    const link = layer
      .append('g')
      .attr('stroke', '#cfc6b6')
      .attr('stroke-opacity', 0.9)
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke-width', d => Math.max(1.5, d.weight * 0.9))
      .attr('stroke-dasharray', d => (d.relation === 'conflicts' ? '5 4' : d.relation === 'compares' ? '3 5' : '0'));

    const linkLabel = layer
      .append('g')
      .selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .text(d => d.relation)
      .attr('font-size', 10)
      .attr('fill', '#7d7568')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .style('text-transform', 'uppercase');

    const node = layer
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .on('click', (_, datum) => {
        setSelectedNodeId(datum.id);
      });

    node
      .append('circle')
      .attr('r', d => 18 + d.weight * 4)
      .attr('fill', d => NODE_COLORS[d.type])
      .attr('stroke', '#fffdf7')
      .attr('stroke-width', 3);

    node
      .append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.type === 'judgment' ? 4 : 32 + d.weight * 0.5))
      .attr('fill', d => (d.type === 'judgment' ? '#fffdf7' : '#1d1d17'))
      .attr('font-size', d => (d.type === 'judgment' ? 11 : 12))
      .attr('font-weight', d => (d.type === 'judgment' ? 700 : 600))
      .style('pointer-events', 'none');

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id(d => d.id)
          .distance(d => (d.relation === 'supports' ? 140 : 110))
          .strength(0.45)
      )
      .force('charge', d3.forceManyBody().strength(-520))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(d => 32 + d.weight * 5));

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, datum) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        datum.fx = datum.x;
        datum.fy = datum.y;
      })
      .on('drag', (event, datum) => {
        datum.fx = event.x;
        datum.fy = event.y;
      })
      .on('end', (event, datum) => {
        if (!event.active) simulation.alphaTarget(0);
        datum.fx = null;
        datum.fy = null;
      });

    node.call(drag as never);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x || 0)
        .attr('y1', d => (d.source as SimNode).y || 0)
        .attr('x2', d => (d.target as SimNode).x || 0)
        .attr('y2', d => (d.target as SimNode).y || 0);

      linkLabel
        .attr('x', d => (((d.source as SimNode).x || 0) + ((d.target as SimNode).x || 0)) / 2)
        .attr('y', d => (((d.source as SimNode).y || 0) + ((d.target as SimNode).y || 0)) / 2 - 6);

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [mapData, mapHeight, mapWidth]);

  const updateSelectedNode = () => {
    if (!selectedNode || !draftLabel.trim()) return;
    setMapData(current => ({
      ...current,
      nodes: current.nodes.map(node =>
        node.id === selectedNode.id ? { ...node, label: draftLabel.trim() } : node
      ),
    }));
  };

  const addConceptNode = () => {
    const label = `New Concept ${mapData.nodes.filter(node => node.type === 'concept').length + 1}`;
    const nodeId = `concept:${label.toLowerCase().replace(/\s+/g, '-')}`;
    const nextNode: ReflectionMapNode = {
      id: nodeId,
      label,
      type: 'concept',
      weight: 1.4,
      note: 'Add your own concept or missing issue.',
    };

    const judgmentNode = mapData.nodes.find(node => node.type === 'judgment');
    const nextLinks = judgmentNode
      ? [
          ...mapData.links,
          {
            id: `${judgmentNode.id}->${nodeId}:relates`,
            source: judgmentNode.id,
            target: nodeId,
            relation: 'relates' as const,
            weight: 1,
          },
        ]
      : mapData.links;

    setMapData(current => ({
      ...current,
      nodes: [...current.nodes, nextNode],
      links: nextLinks,
    }));
    setSelectedNodeId(nodeId);
  };

  const regenerateMap = () => {
    setMapData(buildReflectionMapFromDialogue(messages, reasoningAnalytics));
    setSelectedNodeId(null);
  };

  const exportPng = async () => {
    if (!svgRef.current) return;

    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to render reflection map image.'));
    });

    const canvas = document.createElement('canvas');
    const width = svgElement.viewBox.baseVal.width || svgElement.clientWidth;
    const height = svgElement.viewBox.baseVal.height || svgElement.clientHeight;
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }

    context.scale(2, 2);
    context.fillStyle = '#fcf9ef';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `ethobot_reflection_map_${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-transparent px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-lyceum-line/70 pb-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-lyceum-muted">Reflective Visualization</p>
            <h2 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-lyceum-ink sm:text-5xl">
              Reflection Map
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-lyceum-muted">
              Turn your current dialogue into a concept map of values, stakeholders, concepts, and emerging judgment. Refine it, download it as a PNG, and share it in your discussion board.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onLogClick('reflection-back', 'button', 'Back to learner workspace');
                onBack();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-lyceum-line bg-white px-4 py-3 text-sm font-semibold text-lyceum-ink transition hover:bg-lyceum-paper-soft"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                onLogClick('reflection-regenerate', 'button', 'Regenerate from current dialogue');
                regenerateMap();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-lyceum-line bg-white px-4 py-3 text-sm font-semibold text-lyceum-ink transition hover:bg-lyceum-paper-soft"
            >
              <RefreshCcw size={16} />
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => {
                onLogClick('reflection-download-png', 'button', 'Download PNG');
                exportPng();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-lyceum-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-lyceum-ink-soft"
            >
              <Download size={16} />
              Download PNG
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[1.9rem] border border-lyceum-line bg-white shadow-panel">
            <div className="border-b border-lyceum-line bg-[#f4eee2] px-5 py-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Map Canvas</p>
            </div>
            <div ref={containerRef} className="bg-[radial-gradient(circle_at_top,_rgba(255,220,195,0.24),_transparent_36%),#fcf9ef] p-3 sm:p-5">
              <svg ref={svgRef} className="h-[620px] w-full overflow-visible rounded-[1.35rem] border border-lyceum-line bg-[#fffdf8]" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-lyceum-line bg-[#f8f3e8] p-5 shadow-panel">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Map Read</p>
              <p className="mt-3 text-sm leading-7 text-lyceum-ink-soft">{mapData.summary}</p>
            </div>

            <div className="rounded-[1.75rem] border border-lyceum-line bg-white p-5 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Node Editor</p>
                <button
                  type="button"
                  onClick={() => {
                    onLogClick('reflection-add-concept', 'button', 'Add concept');
                    addConceptNode();
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-lyceum-line bg-lyceum-paper-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-lyceum-ink transition hover:bg-[#efe7d8]"
                >
                  <Plus size={12} />
                  Add concept
                </button>
              </div>

              {selectedNode ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-lyceum-muted">Selected</p>
                    <p className="mt-2 text-lg font-semibold text-lyceum-ink">{selectedNode.type}</p>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-lyceum-muted">Node label</span>
                    <input
                      value={draftLabel}
                      onChange={event => setDraftLabel(event.target.value)}
                      className="w-full rounded-[1rem] border border-lyceum-line bg-[#fffdf8] px-4 py-3 text-sm text-lyceum-ink outline-none transition focus:border-lyceum-accent focus:ring-2 focus:ring-lyceum-accent/15"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onLogClick('reflection-save-node-label', 'button', 'Save node label');
                      updateSelectedNode();
                    }}
                    className="w-full rounded-full bg-lyceum-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-lyceum-ink-soft"
                  >
                    Save label
                  </button>
                  {selectedNode.note && <p className="text-sm leading-7 text-lyceum-muted">{selectedNode.note}</p>}
                </div>
              ) : (
                <p className="mt-5 text-sm leading-7 text-lyceum-muted">
                  Select a node to rename it or inspect it more closely.
                </p>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-lyceum-line bg-white p-5 shadow-panel">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-lyceum-muted">Reflection Prompts</p>
              <div className="mt-4 space-y-3">
                {mapData.prompts.map(prompt => (
                  <div key={prompt} className="rounded-[1.1rem] border border-lyceum-line bg-[#fcfaf4] px-4 py-3 text-sm leading-7 text-lyceum-ink-soft">
                    {prompt}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-lyceum-line bg-lyceum-ink p-5 text-white shadow-panel">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-white/58">Share</p>
              <p className="mt-3 text-sm leading-7 text-white/78">
                Download this map as a PNG and upload it to your discussion board as a visual summary of your current ethical reasoning.
              </p>
              <button
                type="button"
                onClick={() => {
                  onLogClick('reflection-share-guidance', 'button', 'Discussion board guidance');
                  exportPng();
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-lyceum-ink transition hover:bg-[#f7f1e4]"
              >
                <Share2 size={16} />
                Export for discussion board
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReflectionMapPage;
