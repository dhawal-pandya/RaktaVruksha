import { useEffect } from 'react';
import Scene3D from './render/Scene3D';
import Scene2D from './render/Scene2D';
import TopBar from './ui/TopBar';
import DetailCard from './ui/DetailCard';
import RelationPanel from './ui/RelationPanel';
import PersonForm from './ui/PersonForm';
import FamilyEditor from './ui/FamilyEditor';
import {
  ConfirmDeleteModal,
  ConfirmResetModal,
  Hint,
  ImportErrorModal,
  MergePersonModal,
  MergeReportModal,
  Toast,
} from './ui/Modals';
import { useStore } from './state/store';

const AUTHOR_ID = 'Dhawal';

function Footer() {
  const canFocus = useStore(s => !!s.dataset?.people.has(AUTHOR_ID));
  const showPersonIn3D = useStore(s => s.showPersonIn3D);
  const focus = () => showPersonIn3D(AUTHOR_ID);
  return (
    <footer
      className={`app-footer ${canFocus ? 'clickable' : ''}`}
      onClick={canFocus ? focus : undefined}
      onKeyDown={
        canFocus
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                focus();
              }
            }
          : undefined
      }
      role={canFocus ? 'button' : undefined}
      tabIndex={canFocus ? 0 : undefined}
      title={canFocus ? 'Find me on the tree' : undefined}
    >
      made with ❤ by{' '}
      <a
        href="https://dhawal-pandya.github.io/"
        target="_blank"
        rel="noreferrer noopener"
        onClick={e => e.stopPropagation()}
      >
        Dhawal Pandya
      </a>
    </footer>
  );
}

function UpdatedStamp() {
  const t = useStore(s => s.dataUpdatedAt);
  if (!t) return null;
  const stamp = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(t);
  return <div className="data-stamp">updated {stamp} IST</div>;
}

export default function App() {
  const phase = useStore(s => s.phase);
  const loadError = useStore(s => s.loadError);
  const viewMode = useStore(s => s.viewMode);
  const boot = useStore(s => s.boot);

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') useStore.getState().escape();
      else if (e.key === 'r' || e.key === 'R') useStore.getState().toggleRelationMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'loading') {
    return (
      <div className="boot-screen">
        <div className="boot-mark">रक्तवृक्ष</div>
        <div className="boot-sub">growing the tree…</div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="boot-screen">
        <div className="boot-mark">रक्तवृक्ष</div>
        <div className="boot-error">{loadError}</div>
      </div>
    );
  }

  return (
    <>
      {viewMode === '3d' ? <Scene3D /> : <Scene2D />}
      <TopBar />
      <DetailCard />
      <RelationPanel />
      <Hint />
      <Toast />
      <PersonForm />
      <FamilyEditor />
      <MergePersonModal />
      <MergeReportModal />
      <ImportErrorModal />
      <ConfirmResetModal />
      <ConfirmDeleteModal />
      <UpdatedStamp />
      <Footer />
    </>
  );
}
