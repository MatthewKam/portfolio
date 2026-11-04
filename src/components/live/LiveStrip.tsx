import { fetchAlerts } from './alerts';
import { useNow, usePolled } from './useLive';
import './LiveStrip.css';

/** Home page teaser: a few real numbers carried on the hero's front hill. */

const POLL_MS = 5 * 60_000;

export default function LiveStrip() {
  const { data } = usePolled(fetchAlerts, POLL_MS);
  const now = useNow(30_000);
  const alerts = data?.filter((a) => a.end > now);
  const blank = '–';
  return (
    <section className="ls" aria-label="Live data">
      <div className="wrap ls-inner">
        <p className="ls-now"><i aria-hidden="true" />Right now</p>
        <dl>
          <div><dt>US storm alerts</dt><dd>{alerts?.length ?? blank}</dd></div>
          <div><dt>Under way</dt><dd>{alerts?.filter((a) => a.start <= now).length ?? blank}</dd></div>
          <div><dt>Counties affected</dt><dd>{alerts ? new Set(alerts.flatMap((a) => [...a.fips])).size.toLocaleString() : blank}</dd></div>
        </dl>
        <a href="/live">See it live <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
