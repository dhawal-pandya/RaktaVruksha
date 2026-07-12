import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { GraphLink, GraphNode, Vec3 } from '../core/types';
import { personName } from '../core/types';
import { BACKGROUND_COLOR, dimToward } from '../core/colors';
import { useStore } from '../state/store';
import { computeVisuals, type VisualState } from './visuals';

type FGNode = GraphNode & {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __mat?: THREE.MeshLambertMaterial;
  __sprite?: SpriteText;
};

type FGLink = Omit<GraphLink, 'source' | 'target'> & {
  source: string | FGNode;
  target: string | FGNode;
};

const personGeometry = new THREE.SphereGeometry(6, 20, 20);
const unionGeometry = new THREE.SphereGeometry(2.6, 12, 12);
const UNION_COLOR = '#4a5468';

// The camera is locked to this polar angle (measured from +Y). Rotation can only
// change azimuth, so the world twirls around the vertical axis and never tumbles.
// A shade above the equator gives a gentle, fixed 3/4 elevation.
const FIXED_POLAR = Math.PI * 0.42;

// Default orbit anchor: whole-tree views pivot around this person, so the spin
// axis passes through him rather than the graph centroid. Focusing a person or
// family still re-pivots there; absent from the data (stress set), views fall
// back to the centroid.
const ANCHOR_PERSON_ID = 'Dhawal';

/** Camera position that frames `target` at `dist`, at the locked elevation,
 *  preserving the current horizontal heading (azimuth). */
const framedCameraPos = (cam: Vec3, target: Vec3, dist: number): Vec3 => {
  const azim = Math.atan2(cam.z - target.z, cam.x - target.x);
  const sinP = Math.sin(FIXED_POLAR);
  return {
    x: target.x + dist * sinP * Math.cos(azim),
    y: target.y + dist * Math.cos(FIXED_POLAR),
    z: target.z + dist * sinP * Math.sin(azim),
  };
};

const endpointId = (e: string | FGNode): string => (typeof e === 'string' ? e : e.id);

const LINK_COLORS: Record<string, string> = {
  married: '#c9a86a',
  partners: '#b58fc4',
  divorced: '#7a6a4d',
  unknown: '#93855f',
  biological: '#55617a',
  adoptive: '#7f95b5',
};

const linkBaseColor = (l: FGLink): string =>
  l.kind === 'partner'
    ? LINK_COLORS[l.status ?? 'married']
    : LINK_COLORS[l.tag ?? 'biological'];

// Supported by 3d-force-graph at runtime but absent from the react wrapper's prop
// types: divorced marriages dash, adoptive child links dot.
const linkDashProp: Record<string, unknown> = {
  linkLineDash: (l: FGLink) =>
    l.kind === 'partner' && l.status === 'divorced'
      ? [4, 3]
      : l.kind === 'child' && l.tag === 'adoptive'
        ? [1.5, 2.5]
        : null,
};

export default function Scene3D() {
  const graph = useStore(s => s.graph);
  const layout = useStore(s => s.layout);
  const dataset = useStore(s => s.dataset);
  const focusId = useStore(s => s.focusId);
  const lensFamilyId = useStore(s => s.lensFamilyId);
  const isolateComponent = useStore(s => s.isolateComponent);
  const relation = useStore(s => s.relation);
  const cameraRequest = useStore(s => s.cameraRequest);
  const clickPerson = useStore(s => s.clickPerson);
  const isolatePerson = useStore(s => s.isolatePerson);
  const backgroundClick = useStore(s => s.backgroundClick);

  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const visualRef = useRef<VisualState | null>(null);
  const lastClickRef = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const didInitialFitRef = useRef(false);

  const data = useMemo(() => {
    if (!graph || !layout) return { nodes: [] as FGNode[], links: [] as FGLink[] };
    const nodes: FGNode[] = graph.nodes.map(n => {
      const p = layout.get(n.id) as Vec3;
      return { ...n, x: p.x, y: p.y, z: p.z, fx: p.x, fy: p.y, fz: p.z };
    });
    const links: FGLink[] = graph.links.map(l => ({ ...l }));
    return { nodes, links };
  }, [graph, layout]);

  const visuals = useMemo(() => {
    if (!dataset || !graph) return null;
    return computeVisuals(dataset, graph, {
      focusId,
      lensFamilyId,
      isolateComponent,
      relationActive: relation.active,
      relationSteps: relation.steps,
      relationEndpoints: [relation.aId, relation.bId],
    });
  }, [dataset, graph, focusId, lensFamilyId, isolateComponent, relation]);
  visualRef.current = visuals;

  // Names stay visible even from afar on human-scale trees; distance culling
  // only kicks in on very large graphs where 1000+ sprites would hurt.
  const labelDistance = data.nodes.length > 1000 ? 1400 : Infinity;

  const updateLabelVisibility = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera();
    const maxSq = labelDistance * labelDistance;
    for (const node of data.nodes) {
      if (!node.__sprite) continue;
      const op = visualRef.current?.nodeOpacity.get(node.id) ?? 1;
      if (maxSq === Infinity) {
        node.__sprite.visible = op > 0.5;
        continue;
      }
      const dx = (node.x ?? 0) - cam.position.x;
      const dy = (node.y ?? 0) - cam.position.y;
      const dz = (node.z ?? 0) - cam.position.z;
      node.__sprite.visible = op > 0.5 && dx * dx + dy * dy + dz * dz < maxSq;
    }
  }, [data, labelDistance]);

  // Batched material update: opacity and glow only, never geometry.
  useEffect(() => {
    if (!visuals) return;
    for (const node of data.nodes) {
      const mat = node.__mat;
      if (!mat) continue;
      const op = visuals.nodeOpacity.get(node.id) ?? 1;
      mat.opacity = op;
      mat.emissiveIntensity =
        visuals.glow.has(node.id) ? 1.1 : node.kind === 'person' ? 0.45 : 0.2;
    }
    updateLabelVisibility();
  }, [visuals, data, updateLabelVisibility]);

  // Control model: the generational (vertical) axis is fixed. Left-drag spins
  // the graph, and because the polar angle is locked that spin is azimuth-only —
  // a twirl around the zenith with elders staying up top. Ctrl/Cmd-drag (or
  // right-drag) pans. Touch: one finger twirls, two fingers pinch-zoom + pan.
  // Scroll zooms.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = fg.controls() as any;
    controls.minPolarAngle = FIXED_POLAR;
    controls.maxPolarAngle = FIXED_POLAR;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    // Decide spin-vs-pan per drag from the modifier held at pointer-down. Attach
    // to an ancestor in the capture phase so it runs before OrbitControls reads
    // mouseButtons on the canvas itself.
    const canvas = fg.renderer().domElement as HTMLCanvasElement;
    const host = canvas.parentElement ?? window;
    const onPointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      controls.mouseButtons.LEFT =
        pe.ctrlKey || pe.metaKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    };
    host.addEventListener('pointerdown', onPointerDown, true);
    return () => host.removeEventListener('pointerdown', onPointerDown, true);
  }, [data]);

  // Label culling follows the camera.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    const controls = fg.controls() as unknown as {
      addEventListener: (t: string, h: () => void) => void;
      removeEventListener: (t: string, h: () => void) => void;
    };
    let raf = 0;
    const handler = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateLabelVisibility();
      });
    };
    controls.addEventListener('change', handler);
    const t = setTimeout(updateLabelVisibility, 500);
    return () => {
      controls.removeEventListener('change', handler);
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data, updateLabelVisibility]);

  // Fly the camera to frame a set of points: look at `anchor` (the future spin
  // pivot) or their centroid, from the current direction. (The library's
  // zoomToFit keeps the sight line, which strands tall graphs low in the frame:
  // this centers them properly.)
  const flyToPoints = useCallback((points: Vec3[], ms = 900, anchor?: Vec3) => {
    const fg = fgRef.current;
    if (!fg || points.length === 0) return;
    const c = anchor
      ? { ...anchor }
      : points.reduce(
          (acc, p) => ({
            x: acc.x + p.x / points.length,
            y: acc.y + p.y / points.length,
            z: acc.z + p.z / points.length,
          }),
          { x: 0, y: 0, z: 0 },
        );
    const radius = Math.max(
      60,
      ...points.map(p => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z)),
    );
    const dist = radius * 1.9 + 130;
    fg.cameraPosition(framedCameraPos(fg.camera().position, c, dist), c, ms);
  }, []);

  // Camera choreography: consume requests from the store.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !cameraRequest || !layout || !dataset) return;

    switch (cameraRequest.kind) {
      case 'person': {
        const p = layout.get(cameraRequest.id);
        if (!p) return;
        fg.cameraPosition(framedCameraPos(fg.camera().position, p, 150), p, 800);
        break;
      }
      case 'family': {
        const members = dataset.membersOfFamily.get(cameraRequest.id);
        if (!members) return;
        flyToPoints([...members].map(id => layout.get(id)).filter((p): p is Vec3 => !!p));
        break;
      }
      case 'component': {
        const pts: Vec3[] = [];
        for (const [id, comp] of dataset.componentOf) {
          if (comp === cameraRequest.comp) {
            const p = layout.get(id);
            if (p) pts.push(p);
          }
        }
        flyToPoints(pts);
        break;
      }
      case 'fit': {
        if (relation.active && visualRef.current?.pathSet) {
          const pts = [...visualRef.current.pathSet]
            .map(id => layout.get(id))
            .filter((p): p is Vec3 => !!p);
          flyToPoints(pts);
        } else {
          flyToPoints([...layout.values()], 900, layout.get(ANCHOR_PERSON_ID));
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest?.seq]);

  const nodeThreeObject = useCallback((node: FGNode) => {
    if (node.kind === 'union') {
      const mat = new THREE.MeshLambertMaterial({
        color: UNION_COLOR,
        transparent: true,
        opacity: 0.8,
        emissive: UNION_COLOR,
        emissiveIntensity: 0.2,
      });
      node.__mat = mat;
      return new THREE.Mesh(unionGeometry, mat);
    }
    const color = new THREE.Color(node.color);
    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      emissive: color,
      emissiveIntensity: 0.45,
    });
    const mesh = new THREE.Mesh(personGeometry, mat);
    const sprite = new SpriteText(node.label, 7, '#e6ebf5');
    // Split couple labels: men's names above the sphere, women's below, so a
    // married pair sitting side by side never prints its names over each other.
    sprite.position.set(0, node.gender === 'male' ? 14.5 : -14.5, 0);
    sprite.material.depthWrite = false;
    sprite.fontFace = 'Inter, system-ui, sans-serif';
    sprite.backgroundColor = 'rgba(10, 14, 26, 0.55)';
    sprite.padding = 1.2;
    sprite.borderRadius = 1.5;
    mesh.add(sprite);
    node.__mat = mat;
    node.__sprite = sprite;
    return mesh;
  }, []);

  const nodeLabel = useCallback(
    (node: FGNode) => {
      if (node.kind !== 'person' || !dataset) return '';
      const p = dataset.people.get(node.personId);
      if (!p) return '';
      const affs = (dataset.familiesOf.get(p.id) ?? [])
        .map(a => {
          const fam = dataset.raw.families[a.familyId]?.name ?? a.familyId;
          const kind = a.kind === 'birth' ? 'born' : a.kind === 'adopted-into' ? 'adopted' : a.status === 'divorced' ? 'divorced' : 'married';
          return `${fam} (${kind})`;
        })
        .join(' · ');
      return `<div class="node-tooltip"><strong>${personName(p)}</strong>${p.alive ? '' : ' ॐ'}<br/><span>${affs || 'unknown lineage'}</span></div>`;
    },
    [dataset],
  );

  // New function identity whenever visuals change → react-force-graph re-applies
  // link colors in place (no geometry rebuild).
  const linkColor = useMemo(() => {
    const vis = visuals;
    return (l: FGLink): string => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return '#ffd27d';
      const base = linkBaseColor(l);
      if (!vis) return base;
      const op = Math.min(vis.nodeOpacity.get(a) ?? 1, vis.nodeOpacity.get(b) ?? 1);
      return dimToward(base, 1 - Math.min(1, op + 0.08));
    };
  }, [visuals]);

  const linkWidth = useMemo(() => {
    const vis = visuals;
    return (l: FGLink): number => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return 2.2;
      return 0;
    };
  }, [visuals]);

  const onNodeClick = useCallback(
    (node: FGNode) => {
      if (node.kind !== 'person') return;
      const now = Date.now();
      const last = lastClickRef.current;
      lastClickRef.current = { id: node.id, t: now };
      if (last.id === node.id && now - last.t < 350) {
        isolatePerson(node.personId);
      } else {
        clickPerson(node.personId);
      }
    },
    [clickPerson, isolatePerson],
  );

  return (
    <div className="scene-root">
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        backgroundColor={BACKGROUND_COLOR}
        controlType="orbit"
        showNavInfo={false}
        warmupTicks={5}
        cooldownTicks={40}
        enableNodeDrag={false}
        nodeThreeObject={nodeThreeObject}
        nodeLabel={nodeLabel}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.55}
        {...linkDashProp}
        onNodeClick={onNodeClick}
        onBackgroundClick={backgroundClick}
        onEngineStop={() => {
          // The boot-time fit request fires before the scene graph is populated;
          // re-fit once the engine has placed everything.
          if (!didInitialFitRef.current) {
            didInitialFitRef.current = true;
            if (layout) flyToPoints([...layout.values()], 700, layout.get(ANCHOR_PERSON_ID));
            updateLabelVisibility();
          }
        }}
      />
    </div>
  );
}
