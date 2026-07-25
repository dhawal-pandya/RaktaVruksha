import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { Gender, GraphLink, GraphNode, Vec3 } from '../core/types';
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
  __aura?: THREE.MeshBasicMaterial;
  __sprite?: SpriteText;
  __altSprite?: SpriteText;
};

type FGLink = Omit<GraphLink, 'source' | 'target'> & {
  source: string | FGNode;
  target: string | FGNode;
};

const personGeometry = new THREE.SphereGeometry(6, 20, 20);
const unionGeometry = new THREE.SphereGeometry(2.6, 12, 12);
// A deva is a sphere too — just larger and radiant (deva = "the shining one"),
// wrapped in a soft glowing aura.
const divineGeometry = new THREE.SphereGeometry(9, 24, 24);
const divineAuraGeometry = new THREE.SphereGeometry(15, 18, 18);
const UNION_COLOR = '#4a5468';

// A link between two orbs on opposite sides of the graph (a divine ray reaching
// a far devotee, an affinal tie between distant branches) draws as a stray line
// slashing across the whole scene. Past LONG_LINK_DIST it isn't drawn edge to
// edge: instead a short brush-stroke tapers out of each orb toward the other,
// LINK_CAP_LEN long, and the rest of the span is left empty. A link shorter than
// that (roughly "one generation apart", vs. LAYER_GAP=110 and the settled
// one-hop distances in layout.ts) still renders as one continuous line, so nearby
// relationships look exactly as before.
const LONG_LINK_DIST = 700;
const LINK_CAP_LEN = 200;
// The fade reads as "trailing into the dark", not true transparency: with the
// scene's flat, unlit background this is indistinguishable from real alpha and
// avoids blend-order glitches from stacking many transparent line segments.
const BG_THREE_COLOR = new THREE.Color(BACKGROUND_COLOR);
const TAPER_MATERIAL = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

const makeCapLine = (): THREE.Line => {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geom, TAPER_MATERIAL);
};

const scratchColor = new THREE.Color();
const writeCap = (
  line: THREE.Line,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  len: number,
  baseColor: THREE.Color,
  fade: boolean,
) => {
  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  const col = line.geometry.attributes.color as THREE.BufferAttribute;
  pos.setXYZ(0, ox, oy, oz);
  pos.setXYZ(1, ox + dx * len, oy + dy * len, oz + dz * len);
  pos.needsUpdate = true;
  col.setXYZ(0, baseColor.r, baseColor.g, baseColor.b);
  scratchColor.copy(fade ? BG_THREE_COLOR : baseColor);
  col.setXYZ(1, scratchColor.r, scratchColor.g, scratchColor.b);
  col.needsUpdate = true;
  line.geometry.computeBoundingSphere();
};

// The camera's polar angle (measured from +Y) is confined to a narrow band, so a
// left-drag mostly twirls the world around the vertical axis (azimuth) but also
// lets you tip the elevation a little between two limits — never tumbling past
// either. POLAR_LEVEL (π/2) is dead-level/head-on; POLAR_TILTED looks gently down
// (the classic 3/4 elevation). Node framing lands at head-on.
const POLAR_LEVEL = Math.PI * 0.5;
const POLAR_TILTED = Math.PI * 0.0;

// Default orbit anchor: whole-tree views pivot around this person, so the spin
// axis passes through him rather than the graph centroid. Focusing a person or
// family still re-pivots there; absent from the data (stress set), views fall
// back to the centroid.
const ANCHOR_PERSON_ID = 'Dhawal';

/** Camera position that frames `target` at `dist` head-on (level), preserving the
 *  current horizontal heading (azimuth). From here a drag can tip up to POLAR_TILTED. */
const framedCameraPos = (cam: Vec3, target: Vec3, dist: number): Vec3 => {
  const azim = Math.atan2(cam.z - target.z, cam.x - target.x);
  const sinP = Math.sin(POLAR_LEVEL);
  return {
    x: target.x + dist * sinP * Math.cos(azim),
    y: target.y + dist * Math.cos(POLAR_LEVEL),
    z: target.z + dist * sinP * Math.sin(azim),
  };
};

const endpointId = (e: string | FGNode): string => (typeof e === 'string' ? e : e.id);

const LINK_COLORS: Record<string, string> = {
  married: '#ffffff',
  partners: '#b58fc4',
  divorced: '#7a6a4d',
  unknown: '#93855f',
  biological: '#55617a',
  adoptive: '#7f95b5',
};

// The union→child line is colored by the child's gender: cool blue for a son,
// rose for a daughter.
const GENDER_LINK: Record<Gender, string> = { male: '#5b9bd5', female: '#d86fa4' };

const linkBaseColor = (l: FGLink): string =>
  l.kind === 'partner'
    ? LINK_COLORS[l.status ?? 'married']
    : LINK_COLORS[l.tag ?? 'biological'];

// Supported by 3d-force-graph at runtime but absent from the react wrapper's prop
// types: divorced marriages dash, adoptive child links dot.
const linkDashProp: Record<string, unknown> = {
  linkLineDash: (l: FGLink) =>
    l.kind === 'divine'
      ? [2, 3]
      : l.kind === 'partner' && l.status === 'divorced'
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
      let vis: boolean;
      if (maxSq === Infinity) {
        vis = op > 0.5;
      } else {
        const dx = (node.x ?? 0) - cam.position.x;
        const dy = (node.y ?? 0) - cam.position.y;
        const dz = (node.z ?? 0) - cam.position.z;
        vis = op > 0.5 && dx * dx + dy * dy + dz * dz < maxSq;
      }
      node.__sprite.visible = vis;
      if (node.__altSprite) node.__altSprite.visible = vis;
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
      if (node.__aura) node.__aura.opacity = 0.16 * op;
      mat.emissiveIntensity = visuals.glow.has(node.id)
        ? 1.1
        : node.kind === 'person' && node.divine
          ? 0.95
          : node.kind === 'person'
            ? 0.45
            : 0.2;
    }
    updateLabelVisibility();
  }, [visuals, data, updateLabelVisibility]);

  // Control model: the generational (vertical) axis stays upright. Left-drag spins
  // the graph around the zenith (azimuth) with elders staying up top, and can also
  // tip the elevation within a narrow band — from head-on (π/2) up to the classic
  // 3/4 look-down (POLAR_TILTED), never further. Ctrl/Cmd-drag (or right-drag) pans.
  // Touch: one finger twirls, two fingers pinch-zoom + pan. Scroll zooms.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = fg.controls() as any;
    controls.minPolarAngle = POLAR_TILTED;
    controls.maxPolarAngle = POLAR_LEVEL;
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
    const divine = node.divine === true;
    const color = new THREE.Color(node.color);
    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: divine ? 0.98 : 0.96,
      emissive: color,
      emissiveIntensity: divine ? 0.95 : 0.45,
    });
    const mesh = new THREE.Mesh(divine ? divineGeometry : personGeometry, mat);
    if (divine) {
      // A soft glowing aura around the deva — the radiance of a shining one.
      const auraMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      mesh.add(new THREE.Mesh(divineAuraGeometry, auraMat));
      node.__aura = auraMat;
    }
    // Split couple labels: men's names above the sphere, women's below, so a
    // married pair sitting side by side never prints its names over each other.
    // Divine beings follow the same gender rule (names just sit a touch further
    // out), so a goddess like Saraswati still reads below her orb, not above.
    const makeLabel = (text: string, gender: string): SpriteText => {
      const s = new SpriteText(text, divine ? 8 : 7, divine ? '#fff2c8' : '#e6ebf5');
      s.position.set(0, (gender === 'male' ? 1 : -1) * (divine ? 17 : 14.5), 0);
      s.material.depthWrite = false;
      s.fontFace = 'Inter, system-ui, sans-serif';
      s.backgroundColor = 'rgba(10, 14, 26, 0.55)';
      s.padding = 1.2;
      s.borderRadius = 1.5;
      mesh.add(s);
      return s;
    };
    const sprite = makeLabel(node.label, node.gender);
    // A dual-life figure (e.g. Ila / Sudyumna) also shows its other name on the
    // opposite side of the orb, seated by that name's own gender.
    if (node.altName) node.__altSprite = makeLabel(node.altName, node.altGender ?? node.gender);
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
  const genderById = useMemo(() => {
    const m = new Map<string, Gender>();
    for (const n of data.nodes) if (n.kind === 'person') m.set(n.id, n.gender);
    return m;
  }, [data]);
  const colorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of data.nodes) if (n.kind === 'person') m.set(n.id, n.color);
    return m;
  }, [data]);

  const linkColor = useMemo(() => {
    const vis = visuals;
    return (l: FGLink): string => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return '#ffd27d';
      // A deva's ray glows in the deva's own lineage colour (source is the deva).
      if (l.kind === 'divine') return colorById.get(a) ?? '#ffd76a';
      // Child links carry the child's gender (target is always the child); partner
      // and other links keep their status/tag color.
      const childGender = l.kind === 'child' ? genderById.get(b) : undefined;
      const base = childGender ? GENDER_LINK[childGender] : linkBaseColor(l);
      if (!vis) return base;
      const op = Math.min(vis.nodeOpacity.get(a) ?? 1, vis.nodeOpacity.get(b) ?? 1);
      return dimToward(base, 1 - Math.min(1, op + 0.08));
    };
  }, [visuals, genderById, colorById]);

  const linkWidth = useMemo(() => {
    const vis = visuals;
    return (l: FGLink): number => {
      const a = endpointId(l.source);
      const b = endpointId(l.target);
      if (vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b)) return 2.2;
      return 0;
    };
  }, [visuals]);

  // A relation-finder path stays as the library's own highlighted line (full
  // brightness, real width): only non-path links get the tapered treatment, so
  // that trace-through-the-tree feature reads exactly as it always has.
  const linkThreeObject = useCallback((l: FGLink) => {
    const vis = visualRef.current;
    const a = endpointId(l.source);
    const b = endpointId(l.target);
    const onPath = !!(vis?.pathSet && vis.pathSet.has(a) && vis.pathSet.has(b));
    if (onPath) return undefined;
    const group = new THREE.Group();
    group.add(makeCapLine(), makeCapLine());
    group.userData.isTaperedLink = true;
    group.userData.posKey = '';
    return group;
  }, []);

  const linkPositionUpdate = useCallback(
    (obj: THREE.Object3D, coords: { start: Vec3; end: Vec3 }, l: FGLink): boolean => {
      const ud = obj.userData as { isTaperedLink?: boolean; posKey?: string };
      if (!ud.isTaperedLink) return false; // default/highlighted objects: let the library place them
      const { start, end } = coords;
      const key = `${start.x},${start.y},${start.z}|${end.x},${end.y},${end.z}`;
      if (ud.posKey === key) return true; // static tree: nothing moved since last frame
      ud.posKey = key;
      const [capA, capB] = (obj as THREE.Group).children as THREE.Line[];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dz = end.z - start.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const uz = dz / dist;
      const long = dist > LONG_LINK_DIST;
      const capLen = long ? Math.min(LINK_CAP_LEN, dist / 2 - 2) : dist / 2;
      const baseColor = new THREE.Color(linkColor(l));
      writeCap(capA, start.x, start.y, start.z, ux, uy, uz, capLen, baseColor, long);
      writeCap(capB, end.x, end.y, end.z, -ux, -uy, -uz, capLen, baseColor, long);
      return true;
    },
    [linkColor],
  );

  // Both are supported by 3d-force-graph at runtime but too narrowly typed by
  // the react wrapper (linkThreeObject can't return undefined; linkPositionUpdate
  // wants the generic LinkObject, not our concrete FGLink) — same workaround as
  // linkDashProp above.
  const linkTaperProps: Record<string, unknown> = { linkThreeObject, linkPositionUpdate };

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
        {...linkTaperProps}
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
