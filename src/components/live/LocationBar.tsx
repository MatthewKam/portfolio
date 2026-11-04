import { useEffect, useRef, useState, type FormEvent } from 'react';
import { infer, locate, search, setPlace, usePlace, type Source } from './location';
import './live.css';

const ORIGIN: Partial<Record<Source, string>> = {
  connection: 'Approximate, from your internet connection. Not saved.',
  timezone: "Approximate, from your device's time zone. Not saved.",
};

/** Infers a rough place with no prompt. The browser's own location prompt only appears after a click. */
export default function LocationBar() {
  const place = usePlace();
  // The privacy note is a dropdown on phones; on wider screens it's simply open, with no button.
  const privacy = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const wide = matchMedia('(min-width: 767px)');
    const sync = () => { if (wide.matches && privacy.current) privacy.current.open = true; };
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { infer(); }, []);

  const useMine = async () => {
    setBusy(true);
    setMessage('');
    try {
      setPlace(await locate());
      setChanging(false);
    } catch {
      setMessage("Couldn't get your location. You can type a city or ZIP code instead.");
    }
    setBusy(false);
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const hit = await search(query.trim());
      if (hit) { setPlace(hit); setQuery(''); setChanging(false); }
      else setMessage(`Nothing found for "${query.trim()}".`);
    } catch {
      setMessage("Search isn't responding right now.");
    }
    setBusy(false);
  };

  const origin = place?.source && ORIGIN[place.source];
  const exact = place?.source === 'exact';

  return (
    <section className="lv-loc" aria-label="Your location">
      {place ? (
        <div>
          <p><i className="lv-you-dot" aria-hidden="true" /><span>Showing what's nearest to <strong>{place.name}</strong></span></p>
          {origin && <small>{origin}</small>}
        </div>
      ) : (
        <div>
          <p><strong>See what's near you</strong></p>
        </div>
      )}
      <div className="lv-loc-actions">
        {!exact && <button type="button" className={`lv-btn ${place ? '' : 'lv-btn-solid'}`} disabled={busy} onClick={useMine}>{place ? 'Use exact location' : 'Use my location'}</button>}
        {place && !changing && <button type="button" className="lv-btn" onClick={() => setChanging(true)}>Change</button>}
        {(!place || changing) && (
          <form onSubmit={onSearch}>
            <label>
              <span className="visually-hidden">City or ZIP code</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="City or ZIP" />
            </label>
            <button type="submit" className="lv-btn" disabled={busy}>Go</button>
          </form>
        )}
        {place && <button type="button" className="lv-btn" onClick={() => { setPlace(null); setChanging(false); setMessage(''); }}>Turn off</button>}
      </div>
      {message && <p className="lv-loc-msg" role="status">{message}</p>}
      <details className="lv-loc-privacy" ref={privacy}>
        <summary>Privacy</summary>
        <p>
          <strong className="lv-loc-privacy-label">Privacy: </strong>This demo only uses your location to show nearby data. It isn't stored on a server or used for tracking.
          Coordinates go to Open-Meteo and the National Weather Service to fetch local data, and a place you choose is saved
          only in this browser.
        </p>
      </details>
    </section>
  );
}
