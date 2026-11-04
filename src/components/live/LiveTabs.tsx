import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import DataCenters from './DataCenters';
import LocationBar from './LocationBar';
import { PanelOpen } from './useLive';
import Storms from './Storms';
import Weather from './Weather';
import WikiEdits from './WikiEdits';

/**
 * One topic at a time. A tab loads the first time it's opened and stays mounted so it
 * keeps its filters, but stops fetching and streaming while it's closed.
 */

const TABS = [
  { id: 'weather', label: 'Weather & storms', note: 'Five years of records and active alerts' },
  { id: 'wikipedia', label: 'Wikipedia', note: 'Every edit as it happens' },
  { id: 'data-centers', label: 'AI data centers', note: 'What’s built and what’s coming' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

export default function LiveTabs() {
  const [tab, setTab] = useState<Tab>('weather');
  const [opened, setOpened] = useState<Tab[]>([]); // Empty until the URL has been read, so the wrong tab never fetches.
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const open = (next: Tab) => {
    setTab(next);
    setOpened((o) => (o.includes(next) ? o : [...o, next]));
    history.replaceState(null, '', `#${next}`);
  };

  useEffect(() => {
    const hash = location.hash.slice(1);
    const first = isTab(hash) ? hash : 'weather';
    setTab(first);
    setOpened([first]);
  }, []);

  // Left, right, Home and End move between tabs, per the ARIA tabs pattern.
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const to = { ArrowRight: (i + 1) % TABS.length, ArrowLeft: (i + TABS.length - 1) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    open(TABS[to].id);
    buttons.current[TABS[to].id]?.focus();
  };

  const panel = (id: Tab, content: React.ReactNode) => (
    <div key={id} id={`tab-${id}`} role="tabpanel" aria-labelledby={`tab-btn-${id}`} className="lv-tab" hidden={tab !== id}>
      <PanelOpen.Provider value={tab === id}>{opened.includes(id) && content}</PanelOpen.Provider>
    </div>
  );

  return (
    <>
      <div className="lv-tabs" role="tablist" aria-label="Live data topics" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id} id={`tab-btn-${t.id}`} ref={(el) => { buttons.current[t.id] = el; }} type="button" role="tab"
            aria-selected={tab === t.id} aria-controls={`tab-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => open(t.id)}
          >
            <b>{t.label}</b>
            <small>{t.note}</small>
          </button>
        ))}
      </div>
      {opened.length > 0 && tab === 'weather' && <LocationBar />}
      {panel('weather', <><Weather /><Storms /></>)}
      {panel('wikipedia', <WikiEdits />)}
      {panel('data-centers', <DataCenters />)}
    </>
  );
}
