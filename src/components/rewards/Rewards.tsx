import {
	useEffect,
	useRef,
	useState,
	type PointerEvent,
	type ReactNode,
} from "react";
import {
	BONUS,
	MILESTONES,
	SLOTS,
	join,
	leave,
	markSeen,
	pointsOf,
	reset,
	slotsOf,
	tierOf,
	useMembership,
} from "./membership";
import { confetti } from "./confetti";
import { contactLinks } from "../../data/contact";
import { sideProject } from "../../data/sideProject";
import "./rewards.css";

export type WorkItem = {
	slug: string;
	title: string;
	company: string;
	years: string;
	summary: string;
};

// What each stamp says around its rim.
const RIM: Record<string, string> = {
	"punch-cards": "PUNCH CARDS",
	"cancellation-flow": "RETENTION",
	referrals: "REFERRALS",
	"vejo-bundles-headless": "BUNDLES",
	"ad-exchange-dashboards": "DASHBOARDS",
	[BONUS.slug]: "SIDE PROJECT",
};
const BONUS_TITLE = sideProject.title;
const BLACK_PERK = "First in line for the Household beta.";

const RESUME = "/resume.pdf";
const LINKEDIN = "https://www.linkedin.com/in/mattkam/";

// The same slug always lands at the same slight angle, like a hand-pressed stamp.
const tilt = (s: string) =>
	(Array.from(s).reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 25) - 12;

/** `children` is the page's intro text, set beside the card on wide screens. */
export default function Rewards({
	work,
	children,
}: {
	work: WorkItem[];
	children?: ReactNode;
}) {
	const m = useMembership();
	const [mounted, setMounted] = useState(false);
	const [flipped, setFlipped] = useState(false);
	const [said, setSaid] = useState("");
	const motion = useRef(true);

	useEffect(() => {
		setMounted(true);
		motion.current = !matchMedia("(prefers-reduced-motion: reduce)").matches;
	}, []);

	// Counted in slots: the side project fills two.
	const count = Math.min(pointsOf(m?.stamps ?? []), SLOTS);
	const seenCount = Math.min(
		pointsOf(m ? m.stamps.slice(0, m.seen) : []),
		SLOTS,
	);
	const fresh = m ? m.stamps.slice(m.seen) : [];
	// The card turns into contact details once the last stamp has landed.
	const complete = !!m && count >= SLOTS && seenCount >= SLOTS;
	// Past Gold: every case study and the side project. The card turns black.
	const everything = [...work.map((w) => w.slug), BONUS.slug];
	const hasAll = (stamps: string[]) =>
		everything.every((s) => stamps.includes(s));
	const allSix = !!m && hasAll(m.stamps);
	const opened = m ? everything.filter((s) => m.stamps.includes(s)).length : 0;
	const black = complete && allSix && m!.seen >= m!.stamps.length;
	const [justBlack, setJustBlack] = useState(false);
	const tier = black ? "Black" : tierOf(count);

	// New stamps slam down one after another, then count as seen.
	useEffect(() => {
		if (!m || fresh.length === 0) return;
		const gap = motion.current ? 420 : 0;
		// The highest milestone crossed, so stamping several at once still reaches Gold.
		const crossed = [...MILESTONES]
			.reverse()
			.find((ms) => seenCount < ms.at && count >= ms.at);
		const added = count - seenCount;
		const toBlack = allSix && !hasAll(m.stamps.slice(0, m.seen));
		const timer = setTimeout(
			() => {
				if (toBlack) setJustBlack(true);
				markSeen();
				if (toBlack) {
					setSaid(
						`Black card. You opened all ${everything.length}. ${BLACK_PERK}`,
					);
					setFlipped(false);
					confetti();
				} else if (crossed) {
					setSaid(`${crossed.tier} status. ${crossed.reward}.`);
					if (crossed.at === SLOTS) {
						setFlipped(false);
						confetti();
					}
				} else {
					setSaid(
						`${added === 1 ? "Stamp" : `${added} stamps`} added. ${count} of ${SLOTS}.`,
					);
				}
			},
			600 + Math.max(added, 1) * gap,
		);
		return () => clearTimeout(timer);
	}, [m?.stamps.length, m?.seen]);

	const onReset = () => {
		reset();
		setFlipped(false);
		setJustBlack(false);
		setSaid(`Card reset. 0 of ${SLOTS}.`);
	};

	// Tilt toward the pointer; the foil follows the same point.
	const card = useRef<HTMLDivElement>(null);
	const onMove = (e: PointerEvent) => {
		if (e.pointerType !== "mouse" || !motion.current) return;
		const el = card.current!;
		const r = el.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = (e.clientY - r.top) / r.height;
		el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
		el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
		el.style.setProperty("--mx", `${x * 100}%`);
		el.style.setProperty("--my", `${y * 100}%`);
	};
	const onLeave = () => {
		const el = card.current!;
		["--rx", "--ry"].forEach((p) => el.style.setProperty(p, "0deg"));
		el.style.setProperty("--mx", "50%");
		el.style.setProperty("--my", "30%");
	};

	// Slots fill in the order stamps were earned.
	const filled = slotsOf(m?.stamps ?? []).slice(0, SLOTS);
	const firstNew = m ? filled.findIndex((f) => f.from >= m.seen) : -1;
	const titleOf = (slug: string) =>
		slug === BONUS.slug
			? BONUS_TITLE
			: (work.find((w) => w.slug === slug)?.title ?? slug);

	return (
		<div className="rw" data-tier={tier.toLowerCase()} data-x="Rewards.tsx">
			<svg
				width="0"
				height="0"
				aria-hidden="true"
				style={{ position: "absolute" }}
			>
				<filter id="rw-ink">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.9"
						numOctaves="2"
						seed="4"
					/>
					<feDisplacementMap in="SourceGraphic" scale="3" />
				</filter>
			</svg>

			<div className="rw-head">
				<div className="rw-intro">{children}</div>
				<div className="rw-hold">
					<div
						className="rw-stage"
						onPointerMove={onMove}
						onPointerLeave={onLeave}
					>
						<div
							className={`rw-card ${flipped ? "is-flipped" : ""} ${mounted ? "" : "is-loading"}`}
							ref={card}
						>
							<div className="rw-face rw-front">
								<div className="rw-foil" aria-hidden="true" />
								<div className="rw-top">
									<span className="rw-brand">
										Matt Kam
										<br />
										Rewards
									</span>
									<span className="rw-tier">{m ? tier : "Guest"}</span>
								</div>
								{complete ? (
									<div className="rw-contact">
										<p className="rw-contact-kicker">
											{black
												? `All ${everything.length} · Black card member`
												: "Card complete · Gold member"}
										</p>
										<p className="rw-contact-title">
											{black ? "At your service." : "Let's talk."}
										</p>
										<ul>
											{contactLinks.map((l) => (
												<li key={l.href}>
													<a
														href={l.href}
														{...(l.external
															? { target: "_blank", rel: "noopener noreferrer" }
															: {})}
													>
														{l.label}
													</a>
												</li>
											))}
										</ul>
										{black && (
											<p className="rw-contact-perk">
												<span aria-hidden="true">★</span> Perk: {BLACK_PERK}
											</p>
										)}
									</div>
								) : (
									<ol
										className="rw-slots"
										aria-label={
											m ? `${count} of ${SLOTS} stamps` : "Stamp slots"
										}
									>
										{Array.from({ length: SLOTS }, (_, i) => {
											const f = filled[i];
											const isNew = !!f && !!m && f.from >= m.seen;
											const delay = isNew
												? (i - firstNew) * (motion.current ? 0.42 : 0) + 0.35
												: 0;
											return (
												<li
													key={i}
													className="rw-slot"
													aria-label={
														f
															? `${titleOf(f.slug)}: stamped`
															: `Slot ${i + 1}: empty`
													}
												>
													{f ? (
														<Stamp
															id={`rw-rim-${i}`}
															rim={RIM[f.slug] ?? f.slug.toUpperCase()}
															angle={tilt(f.slug + i)}
															isNew={isNew}
															delay={delay}
														/>
													) : (
														<span className="rw-empty" aria-hidden="true">
															{String(i + 1).padStart(2, "0")}
														</span>
													)}
												</li>
											);
										})}
									</ol>
								)}
								{/* The stamp that didn't fit: pressed half off the card's edge. */}
								{black && (
									<div className="rw-over">
										<Stamp
											id="rw-rim-over"
											rim={`ALL ${everything.length} · BLACK CARD`}
											angle={-14}
											isNew={justBlack}
											delay={0.6}
										/>
									</div>
								)}
								<div className="rw-bottom">
									<span>
										<small>Member no.</small>
										{m ? m.number : "•••• ••••"}
									</span>
									<span>
										<small>Since</small>
										{m ? m.joined.slice(0, 4) : "—"}
									</span>
								</div>
							</div>
							<div className="rw-face rw-back" aria-hidden={!flipped}>
								<div className="rw-strip" />
								<dl>
									{MILESTONES.map((ms) => (
										<div key={ms.at}>
											<dt>
												{ms.at} stamps · {ms.tier}
											</dt>
											<dd>{ms.reward}</dd>
										</div>
									))}
									<div>
										<dt>All {everything.length} · Black</dt>
										<dd>{BLACK_PERK}</dd>
									</div>
								</dl>
								<p>
									Not transferable. No cash value. Valid wherever good
									interfaces are sold.
								</p>
							</div>
						</div>
					</div>

					<div className="rw-actions">
						{!mounted ? null : !m ? (
							<>
								<button type="button" className="rw-join" onClick={join}>
									Join the program
								</button>
								<p className="rw-small">
									Free. No email, no account. Your card lives in this browser
									only.
								</p>
							</>
						) : (
							<p className="rw-progress">
								{black ? (
									<>
										<strong>Black card.</strong> Quote member no. {m.number}{" "}
										when you message me.
									</>
								) : complete ? (
									<>
										<strong>Gold member achieved.</strong>
										<br /> Complete the remaining{" "}
										{everything.length - opened === 1
											? "stamp"
											: `${everything.length - opened} stamps`}{" "}
										to upgrade to Black!
									</>
								) : (
									<>
										<strong>
											{count} of {SLOTS}
										</strong>{" "}
										stamps
										{count < SLOTS && (
											<>
												{" "}
												· {MILESTONES.find((ms) => ms.at > count)!.at -
													count}{" "}
												to {MILESTONES.find((ms) => ms.at > count)!.tier}
											</>
										)}
									</>
								)}
							</p>
						)}
						<div className="rw-tools">
							{m && (
								<button type="button" onClick={() => setFlipped((f) => !f)}>
									{flipped ? "Turn to front" : "Turn over"}
								</button>
							)}
							{m && count > 0 && (
								<button type="button" onClick={onReset}>
									Reset card
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
			<p className="visually-hidden" role="status">
				{said}
			</p>

			<section className="rw-earn" id="work" aria-labelledby="rw-earn-title">
				<h2 id="rw-earn-title">Ways to earn</h2>
				<p className="rw-lede">
					Each case study has a working demo inside. Open one and it stamps your
					card. The side project counts double.
				</p>
				<ol className="rw-list">
					{work.map((w, i) => {
						const got = m?.stamps.includes(w.slug);
						return (
							<li key={w.slug}>
								<a href={`/work/${w.slug}`}>
									<span className="rw-n">{String(i + 1).padStart(2, "0")}</span>
									<span className="rw-what">
										<strong>{w.title}</strong>
										<span>
											{w.company} · {w.years}
										</span>
									</span>
									<span className={`rw-pts ${got ? "is-got" : ""}`}>
										{got ? "Stamped" : "+1 stamp"}
									</span>
								</a>
							</li>
						);
					})}
					<li>
						<a href={`/${BONUS.slug}`}>
							<span className="rw-n">
								{String(work.length + 1).padStart(2, "0")}
							</span>
							<span className="rw-what">
								<strong>{BONUS_TITLE}</strong>
								<span>Side project · in progress</span>
							</span>
							<span
								className={`rw-pts ${m?.stamps.includes(BONUS.slug) ? "is-got" : ""}`}
							>
								{m?.stamps.includes(BONUS.slug)
									? "Stamped ×2"
									: `+${BONUS.worth} stamps`}
							</span>
						</a>
					</li>
				</ol>
			</section>

			<section className="rw-rewards" aria-labelledby="rw-rewards-title">
				<h2 id="rw-rewards-title">Rewards</h2>
				{/* A ladder: each rung's rail fills toward the next one as stamps come in. */}
				<ol className="rw-ladder">
					{[
						{
							at: "0",
							open: !!m,
							fill: m ? Math.min(count / 3, 1) : 0,
							title: "Member",
							body: m ? (
								<span>
									Joined {m.joined.slice(0, 4)}. Member no. <b>{m.number}</b>.
								</span>
							) : (
								<span>
									Join the program above. It's free, and the card lives in this
									browser.
								</span>
							),
						},
						{
							at: "3",
							open: count >= 3,
							fill: Math.min(Math.max((count - 3) / (SLOTS - 3), 0), 1),
							title: "Silver: the résumé",
							body:
								count >= 3 ? (
									<a href={RESUME}>Download the PDF</a>
								) : (
									<span>
										Unlocks at 3 stamps. (Or <a href={RESUME}>skip the game</a>.
										I'm not going to gatekeep a PDF.)
									</span>
								),
						},
						{
							at: String(SLOTS),
							open: count >= SLOTS,
							fill: black ? 1 : count >= SLOTS ? opened / everything.length : 0,
							title: "Gold: a direct line",
							body:
								count >= SLOTS && m ? (
									<span>
										Your card is now my contact card. Message me on{" "}
										<a href={LINKEDIN}>LinkedIn</a> and quote member no.{" "}
										<b>{m.number}</b>. You go to the front of the line.
									</span>
								) : (
									<span>
										Unlocks at {SLOTS} stamps. Your card turns into my contact
										card.
									</span>
								),
						},
						{
							at: "All",
							open: black,
							fill: 0,
							title: "Black card: the Household beta",
							body:
								black && m ? (
									<span>
										You opened all {everything.length}. Message me on{" "}
										<a href={LINKEDIN}>LinkedIn</a> with member no.{" "}
										<b>{m.number}</b> and you're first in line when the
										Household beta opens.
									</span>
								) : (
									<span>
										Open all {everything.length}, the side project included,
										even after the card is full. The card turns black, and
										you're first in line for the Household beta.
									</span>
								),
						},
					].map((r, i, all) => {
						const next = !r.open && (i === 0 || all[i - 1].open);
						return (
							<li
								key={r.at}
								className={r.open ? "is-open" : next ? "is-next" : ""}
							>
								<div className="rw-rail" aria-hidden="true">
									<span className="rw-at">{r.open ? "✓" : r.at}</span>
									<span
										className="rw-seg"
										style={{ "--fill": r.fill } as React.CSSProperties}
									/>
								</div>
								<div className="rw-rung">
									<strong>
										{r.title}
										<span className="visually-hidden">
											{r.open ? " (unlocked)" : " (locked)"}
										</span>
									</strong>
									{r.body}
								</div>
							</li>
						);
					})}
				</ol>
				{m && (
					<button
						type="button"
						className="rw-leave"
						onClick={() => {
							leave();
							setFlipped(false);
						}}
					>
						Leave the program
					</button>
				)}
			</section>
		</div>
	);
}

function Stamp({
	id,
	rim,
	angle,
	isNew,
	delay,
}: {
	id: string;
	rim: string;
	angle: number;
	isNew: boolean;
	delay: number;
}) {
	return (
		<svg
			className={`rw-stamp ${isNew ? "is-new" : ""}`}
			viewBox="0 0 100 100"
			aria-hidden="true"
			style={
				{ "--a": `${angle}deg`, "--d": `${delay}s` } as React.CSSProperties
			}
		>
			<g filter="url(#rw-ink)">
				<circle cx="50" cy="50" r="45" className="rw-ring" />
				<circle cx="50" cy="50" r="27" className="rw-ring" />
				<path
					id={id}
					d="M 50 50 m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0"
					fill="none"
				/>
				<text className="rw-rim">
					<textPath href={`#${id}`} startOffset="25%" textAnchor="middle">
						{rim}
					</textPath>
				</text>
				<path
					d="M50 35l4.4 9 9.9 1.4-7.2 7 1.7 9.8L50 57.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z"
					className="rw-star"
				/>
			</g>
		</svg>
	);
}
