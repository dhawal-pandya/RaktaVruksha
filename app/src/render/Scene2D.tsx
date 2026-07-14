import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import type { Gender, GraphLink, GraphNode } from '../core/types';
import { BACKGROUND_COLOR, dimToward, mixHex } from '../core/colors';
import { computeLayout2d } from '../core/layout2d';
import { familyView, largestFamily, subgraphForFamily } from '../core/family2d';
import { useStore } from '../state/store';
import { computeVisuals, type VisualState } from './visuals';

type FG2Node = GraphNode & { x?: number; y?: number; fx?: number; fy?: number; short?: string; ext?: boolean };
type FG2Link = Omit<GraphLink, 'source' | 'target'> & { source: string | FG2Node; target: string | FG2Node };
type LabelBox = { x0: number; y0: number; x1: number; y1: number };

const NODE_R = 6;
const UNION_R = 2.8;
const UNION_COLOR = '#4a5468';
const PATH_COLOR = '#ffd27d';
// The union→child line is colored by the child's gender: cool blue for a son,
// rose for a daughter.
const GENDER_LINK: Record<Gender, string> = { male: '#5b9bd5', female: '#d86fa4' };

// Name sits above the node for men, below for women — matching the 3D view, so a
// married pair side by side never prints its two names over each other.
const labelTop = (node: FG2Node, fontSize: number): number => {
  const yy = node.y ?? 0;
  const above = node.kind === 'person' && node.gender === 'male';
  return above ? yy - NODE_R - 2 - fontSize : yy + NODE_R + 2;
};

const LINK_COLORS: Record<string, string> = {
  married: '#ffffff',
  partners: '#b58fc4',
  divorced: '#7a6a4d',
  unknown: '#93855f',
  biological: '#55617a',
  adoptive: '#7f95b5',
};
const linkBaseColor = (l: FG2Link): string =>
  l.kind === 'partner' ? LINK_COLORS[l.status ?? 'married'] : LINK_COLORS[l.tag ?? 'biological'];
const endpointId = (e: string | FG2Node): string => (typeof e === 'string' ? e : e.id);
const boxesOverlap = (b: LabelBox, arr: LabelBox[]): boolean =>
  arr.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);

export default function Scene2D() {
  const graph = useStore(s => s.graph);
  const dataset = useStore(s => s.dataset);
  const family2d = useStore(s => s.family2d);
  const focusId = useStore(s => s.focusId);
  const relation = useStore(s => s.relation);
  const cameraRequest = useStore(s => s.cameraRequest);
  const clickPerson = useStore(s => s.clickPerson);
  const backgroundClick = useStore(s => s.backgroundClick);

  const fgRef = useRef<ForceGraphMethods<FG2Node, FG2Link> | undefined>(undefined);
  const visualRef = useRef<VisualState | null>(null);
  const nodeById = useRef<Map<string, FG2Node>>(new Map());
  const labelBoxes = useRef<LabelBox[]>([]);

  const activeFamily = useMemo(
    () => (dataset ? family2d ?? largestFamily(dataset) : null),
    [dataset, family2d],
  );

  // Build the single-family subgraph and its deterministic tree layout. Positions
  // are fixed (fx/fy): no live force sim: so the tree is stable and overlap-free.
  const data = useMemo(() => {
    if (!graph || !dataset || !activeFamily) return { nodes: [] as FG2Node[], links: [] as FG2Link[] };
    const view = familyView(dataset, activeFamily);
    const sub = subgraphForFamily(graph, view);
    const pos = computeLayout2d(sub, view.external);
    const map = new Map<string, FG2Node>();
    const nodes: FG2Node[] = sub.nodes.map(n => {
      const p = pos.get(n.id) ?? { x: 0, y: 0 };
      const short =
        n.kind === 'person' ? dataset.people.get(n.personId)?.firstName ?? '' : '';
      const node: FG2Node = { ...n, x: p.x, y: p.y, fx: p.x, fy: p.y, short, ext: view.external.has(n.id) };
      map.set(n.id, node);
      return node;
    });
    nodeById.current = map;
    return { nodes, links: sub.links.map(l => ({ ...l })) };
  }, [graph, dataset, activeFamily]);

  const visuals = useMemo(() => {
    if (!dataset || !graph) return null;
    return computeVisuals(dataset, graph, {
      focusId,
      lensFamilyId: null,
      isolateComponent: null,
      relationActive: relation.active,
      relationSteps: relation.steps,
      relationEndpoints: [relation.aId, relation.bId],
    });
  }, [dataset, graph, focusId, relation]);
  visualRef.current = visuals;

  const nodeOpacity = useCallback((node: FG2Node): number => {
    const vis = visualRef.current;
    if (vis?.pathSet) return vis.pathSet.has(node.id) ? 1 : 0.12;
    return node.ext ? 0.5 : 1;
  }, []);

  const drawLabel = useCallback(
    (ctx: CanvasRenderingContext2D, node: FG2Node, globalScale: number, force: boolean, op: number) => {
      const fontSize = Math.max(4, 12 / globalScale);
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      const text = node.short ?? '';
      if (!text) return;
      const w = ctx.measureText(text).width;
      const cx = node.x ?? 0;
      const top = labelTop(node, fontSize);
      const pad = 2 / globalScale;
      const box: LabelBox = { x0: cx - w / 2 - pad, y0: top - pad, x1: cx + w / 2 + pad, y1: top + fontSize + pad };
      if (!force && boxesOverlap(box, labelBoxes.current)) return;
      labelBoxes.current.push(box);
      ctx.globalAlpha = Math.min(1, op + 0.15);
      ctx.fillStyle = 'rgba(10, 14, 26, 0.6)';
      ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.fillStyle = node.ext ? '#aeb7c8' : '#e6ebf5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(text, cx, top);
      ctx.globalAlpha = 1;
    },
    [],
  );

  const nodeCanvasObject = useCallback(
    (node: FG2Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const op = nodeOpacity(node);
      if (op <= 0.02) return;
      const isUnion = node.kind === 'union';
      const r = isUnion ? UNION_R : NODE_R;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const glow = visualRef.current?.glow.has(node.id) ?? false;
      ctx.globalAlpha = op;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isUnion
        ? UNION_COLOR
        : node.ext
          ? mixHex(node.color, BACKGROUND_COLOR, 0.35)
          : node.color;
      ctx.fill();
      if (node.ext && !isUnion) {
        // Dashed ring marks a spouse who belongs to another family (married away).
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1 / globalScale;
        ctx.strokeStyle = '#aeb7c8';
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (glow) {
        ctx.lineWidth = 2 / globalScale;
        ctx.strokeStyle = PATH_COLOR;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (isUnion || glow) return; // glow labels drawn with priority in the post pass
      drawLabel(ctx, node, globalScale, false, op);
    },
    [nodeOpacity, drawLabel],
  );

  const nodePointerAreaPaint = useCallback(
    (node: FG2Node, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, node.kind === 'union' ? 3.5 : 8, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    labelBoxes.current = [];
    const vis = visualRef.current;
    if (!vis) return;
    const fontSize = Math.max(4, 12 / globalScale);
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    for (const id of vis.glow) {
      const node = nodeById.current.get(id);
      if (!node || node.kind !== 'person') continue;
      const w = ctx.measureText(node.short ?? '').width;
      const cx = node.x ?? 0;
      const top = labelTop(node, fontSize);
      const pad = 2 / globalScale;
      labelBoxes.current.push({ x0: cx - w / 2 - pad, y0: top - pad, x1: cx + w / 2 + pad, y1: top + fontSize + pad });
    }
  }, []);

  const onRenderFramePost = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      const vis = visualRef.current;
      if (!vis) return;
      for (const id of vis.glow) {
        const node = nodeById.current.get(id);
        if (node && node.kind === 'person') drawLabel(ctx, node, globalScale, true, 1);
      }
    },
    [drawLabel],
  );

  const linkColor = useMemo(() => {
    const vis = visuals;
    return (l: FG2Link): string => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return PATH_COLOR;
      const na = nodeById.current.get(a);
      const nb = nodeById.current.get(b);
      // Child links carry the child's gender (target is always the child); partner
      // and other links keep their status/tag color.
      const base =
        l.kind === 'child' && nb?.kind === 'person'
          ? GENDER_LINK[nb.gender]
          : linkBaseColor(l);
      const faded = na?.ext || nb?.ext;
      return faded ? dimToward(base, 0.4) : base;
    };
  }, [visuals]);

  const linkWidth = useMemo(() => {
    const vis = visuals;
    return (l: FG2Link): number => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return 2.5;
      return l.kind === 'partner' ? 1.6 : 1;
    };
  }, [visuals]);

  const linkDash = useMemo(
    () => (l: FG2Link): number[] | null =>
      l.kind === 'partner' && l.status === 'divorced'
        ? [3, 3]
        : l.kind === 'child' && l.tag === 'adoptive'
          ? [1.5, 2]
          : null,
    [],
  );

  // Camera choreography: consumes the shared request stream.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !cameraRequest) return;
    const run = () => {
      switch (cameraRequest.kind) {
        case 'person': {
          const n = nodeById.current.get(cameraRequest.id);
          if (n) {
            fg.centerAt(n.x ?? 0, n.y ?? 0, 700);
            fg.zoom(2.2, 700);
          } else {
            fg.zoomToFit(600, 80);
          }
          break;
        }
        default:
          fg.zoomToFit(700, 80);
      }
    };
    const t = setTimeout(run, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest?.seq]);

  // Fit whenever the shown family changes.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    const t = setTimeout(() => fg.zoomToFit(600, 80), 120);
    return () => clearTimeout(t);
  }, [data]);

  const onNodeClick = useCallback(
    (node: FG2Node) => {
      // Focus the person; if they belong to another family, the store switches
      // the 2D view to that family so they become visible.
      if (node.kind === 'person') clickPerson(node.personId);
    },
    [clickPerson],
  );

  const shareFamily = useCallback(() => {
    if (!activeFamily) return;
    const url = new URL(window.location.href);
    url.searchParams.set('family', activeFamily);
    url.searchParams.delete('edit'); // a shared link must never carry the edit key
    const link = url.toString();
    const done = () =>
      useStore.getState().showToast('Link copied — it opens on this family tree');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(done, () => window.prompt('Copy this link:', link));
    } else {
      window.prompt('Copy this link:', link);
    }
  }, [activeFamily]);

  const familyName = activeFamily
    ? dataset?.raw.families[activeFamily]?.name ?? 'this family'
    : null;

  return (
    <div className="scene-root">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        backgroundColor={BACKGROUND_COLOR}
        enableNodeDrag={false}
        cooldownTicks={0}
        warmupTicks={0}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onRenderFramePre={onRenderFramePre}
        onRenderFramePost={onRenderFramePost}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkLineDash={linkDash}
        onNodeClick={onNodeClick}
        onBackgroundClick={backgroundClick}
      />
      {activeFamily && (
        <button
          className="btn share-btn"
          onClick={shareFamily}
          title={`Copy a link that opens the ${familyName} tree`}
        >
          ⤴ Share
        </button>
      )}
    </div>
  );
}
