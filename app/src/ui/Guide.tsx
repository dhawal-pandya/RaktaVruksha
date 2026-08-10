import { useEffect, useState } from 'react';
import {
  GENDER_LINK,
  LINK_COLORS,
  UNION_COLOR,
  UNKNOWN_FAMILY_COLOR,
} from '../core/colors';
import { useStore } from '../state/store';

/**
 * The one place that explains what any of this means: what an orb is, what each
 * colored thread between them says, and how the relation finder works.
 *
 * Opens by itself the first time someone lands here and never again, so a returning
 * visitor drops straight into the tree; the ? in the corner brings it back.
 */

const SEEN_KEY = 'raktavruksha:guide-seen';

/** A short line in the tree's own colors, so the legend can't describe one thing
 *  and the canvas draw another. */
function Thread({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg className="guide-swatch" viewBox="0 0 34 12" aria-hidden="true">
      <line
        x1="1"
        y1="6"
        x2="33"
        y2="6"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

function Orb({ color, r = 5, aura = false }: { color: string; r?: number; aura?: boolean }) {
  return (
    <svg className="guide-swatch" viewBox="0 0 34 12" aria-hidden="true">
      {aura && <circle cx="17" cy="6" r={r + 3.5} fill={color} opacity="0.22" />}
      <circle cx="17" cy="6" r={r} fill={color} />
    </svg>
  );
}

function Row({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="guide-row">
      {swatch}
      <span>{children}</span>
    </li>
  );
}

export default function Guide() {
  const [open, setOpen] = useState(false);
  const viewMode = useStore(s => s.viewMode);
  const phase = useStore(s => s.phase);

  // First visit only. A blocked or full localStorage shouldn't mean the guide
  // reopens forever, so a failed write is simply let go.
  useEffect(() => {
    if (phase !== 'ready') return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* private mode: skip the auto-open rather than nag every load */
    }
  }, [phase]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to do: the guide is still one click away */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Swallow it, so the app's own Escape handler doesn't also step the
      // selection back behind the modal.
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open)
    return (
      <button
        className="btn guide-btn"
        onClick={() => setOpen(true)}
        title="What am I looking at?"
        aria-label="Open the guide"
      >
        ?
      </button>
    );

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal panel guide" role="dialog" aria-label="Guide">
        <header className="guide-head">
          <div>
            <h2 className="guide-title">रक्तवृक्ष</h2>
            <p className="guide-sub">Raktavruksha · the tree of blood</p>
          </div>
          <button className="btn btn-icon" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        <div className="detail-body guide-body">
          <p className="guide-lede">
            Every orb is a person and every thread is a tie of blood or marriage. Generations
            run downward: the eldest at the top, each row below it the children of the row
            above. Spouses sit welded side by side, so a couple always reads as a pair.
          </p>

          <div className="detail-section">
            <h3>The orbs</h3>
            <ul className="guide-list">
              <Row swatch={<Orb color="#d0555f" />}>
                A person, tinted by the family they belong to. The Families menu lists them
                all and spotlights one.
              </Row>
              <Row swatch={<Orb color={UNKNOWN_FAMILY_COLOR} />}>
                Grey means no lineage is recorded for them. Those who have died are
                desaturated toward grey too, and carry a ॐ in their tooltip.
              </Row>
              <Row swatch={<Orb color="#ffd68a" r={6.5} aura />}>
                A larger orb wrapped in a glow is a <em>deva</em> — a shining one. Their
                descent into the mortal line is drawn as a dotted ray in their own color.
              </Row>
              <Row swatch={<Orb color={UNION_COLOR} r={2.6} />}>
                The small dot between two people is their marriage. Children hang from it.
              </Row>
            </ul>
            <p className="detail-notes">
              A man's name prints above his orb and a woman's below, so a married pair never
              writes over itself. A few figures who lived under two names — Ila and Sudyumna
              — show both, one on each side.
            </p>
          </div>

          <div className="detail-section">
            <h3>The threads</h3>
            <ul className="guide-list">
              <Row swatch={<Thread color={LINK_COLORS.married} />}>Married</Row>
              <Row swatch={<Thread color={LINK_COLORS.partners} />}>Partners, unmarried</Row>
              <Row swatch={<Thread color={LINK_COLORS.divorced} dash="4 3" />}>Divorced</Row>
              <Row swatch={<Thread color={GENDER_LINK.male} />}>A son of that union</Row>
              <Row swatch={<Thread color={GENDER_LINK.female} />}>A daughter of that union</Row>
              <Row swatch={<Thread color={LINK_COLORS.adoptive} dash="1.5 2.5" />}>
                Adopted rather than born in
              </Row>
            </ul>
          </div>

          <div className="detail-section">
            <h3>Finding how two people are related</h3>
            <p>
              Press <kbd>R</kbd> or hit <strong>Relation</strong>, then pick two people —
              from the search box or straight off the tree. Raktavruksha walks the shortest
              path of blood and marriage between them and gives it a name:{' '}
              <em>maternal grandmother</em>, <em>first cousin</em>, <em>sister-in-law</em>, or
              at the depths these lineages reach, <em>7× great-grandfather</em>. Below it the
              chain is spelled out hop by hop, and the whole path lights up gold on the tree
              so you can trace it yourself.
            </p>
          </div>

          <div className="detail-section">
            <h3>Getting around</h3>
            <ul className="guide-list guide-keys">
              <Row swatch={<span className="guide-key">click</span>}>
                Focus a person and open their card
              </Row>
              <Row swatch={<span className="guide-key">double-click</span>}>
                Isolate everyone they connect to, and hide the rest
              </Row>
              <Row swatch={<span className="guide-key">drag</span>}>
                {viewMode === '3d'
                  ? 'Spin the tree around its vertical axis; elders stay up top'
                  : 'Pan across the tree'}
              </Row>
              {viewMode === '3d' && (
                <Row swatch={<span className="guide-key">⌘ drag</span>}>Pan instead of spin</Row>
              )}
              <Row swatch={<span className="guide-key">scroll</span>}>Zoom</Row>
              <Row swatch={<span className="guide-key">Esc</span>}>
                Step back — clear the focus, then the isolation
              </Row>
              <Row swatch={<span className="guide-key">⌂ Fit</span>}>Frame the whole tree again</Row>
            </ul>
            <p className="detail-notes">
              The <strong>2D</strong> view lays one family out as a tidy genealogical chart,
              generation by generation. The <strong>3D</strong> view shows every family at
              once as a constellation, which is the only way the older lineages — some ninety
              generations deep — fit on a screen at all.
            </p>
          </div>
        </div>

        <footer className="modal-actions">
          <button className="btn btn-primary" onClick={close}>
            Enter the tree
          </button>
        </footer>
      </div>
    </div>
  );
}
