import { useNavigate } from "react-router-dom";
import { useApp } from "@/app/AppContext";
import { WINDOW_DAYS } from "@/entries/api";
import { LogList } from "@/entries/rows";
import { num } from "@/lib/format";
import { dayStatus, entriesOfDay, timeIn } from "@/lib/rules";
import { addDays, ageDays, dayLabel, dayRange, dowLetter, dur, keyToDate, MON, todayKey } from "@/lib/time";
import { SheetLayout, useSheet } from "@/ui/Overlay";

const STATUS_TEXT = {
  ok: "Journée sans signal particulier.",
  check: "Quelque chose est à vérifier ce jour-là : quantité de lait en baisse ou peu de couches mouillées.",
  alert: "Une alerte a été relevée ce jour-là (température ou couleur des selles).",
} as const;

function DaySheet({ k }: { k: string }) {
  const { baby, entries, now, setViewDay } = useApp();
  const sheet = useSheet();
  const navigate = useNavigate();
  if (!baby) return null;
  const info = dayStatus(baby, entries, k, now);
  const [s0, s1] = dayRange(k);
  const dia = entriesOfDay(entries, k).filter((e) => e.type === "diaper");
  return (
    <SheetLayout title={dayLabel(k)} onClose={() => sheet.close()}
      footer={<button type="button" className="btn wide" onClick={() => sheet.close(() => { setViewDay(k); navigate("/"); window.scrollTo(0, 0); })}>Afficher ce jour sur l’accueil</button>}>
      <div className="daystats" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
        <div><span className="num">{num(info.ml)} ml</span><span>de lait</span></div>
        <div><span className="num">{info.feeds}</span><span>repas</span></div>
        <div><span className="num">{dia.filter((e) => e.type === "diaper" && e.data.pee).length} / {dia.filter((e) => e.type === "diaper" && e.data.poo).length}</span><span>pipi / caca</span></div>
        <div><span className="num">{dur(timeIn(entries, "sleep", s0, s1, now))}</span><span>de sommeil</span></div>
      </div>
      {info.status && <p className={`small ${info.status === "alert" ? "tx-urgent" : info.status === "check" ? "tx-warn" : "muted"}`}>{STATUS_TEXT[info.status]}</p>}
      <LogList entries={info.list} empty="Aucune saisie ce jour-là." />
    </SheetLayout>
  );
}

/** Journal par semaine de vie : un jour par tuile, avec son total et son statut. */
export function JournalPage() {
  const { baby, entries, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const age = ageDays(baby.birthDate);
  if (age == null || age < 0) return <p className="empty">Indiquez la date de naissance dans Réglages pour afficher le journal.</p>;
  const current = Math.floor(age / 7) + 1;
  const first = Math.max(1, current - Math.floor(WINDOW_DAYS / 7) + 1);
  const weeks = Array.from({ length: current - first + 1 }, (_, i) => current - i);
  const today = todayKey();

  return (
    <>
      <h1 className="ptitle">Journal</h1>
      <div className="jlegend"><span><i className="ok" />Normal</span><span><i className="check" />À vérifier</span><span><i className="alert" />Alerte</span><span className="muted">Touchez un jour pour le détail</span></div>
      {weeks.map((w) => {
        const keys = Array.from({ length: 7 }, (_, i) => addDays(baby.birthDate, (w - 1) * 7 + i));
        const infos = keys.map((k) => dayStatus(baby, entries, k, now));
        const withMl = infos.filter((x) => x.ml > 0 && !x.future);
        const d0 = keyToDate(keys[0]), d6 = keyToDate(keys[6]);
        return (
          <div className="week" key={w}>
            <div className="wh">
              <div><b>Semaine {w}</b><span>{d0.getDate()}{d0.getMonth() !== d6.getMonth() ? ` ${MON[d0.getMonth()]}` : ""} au {d6.getDate()} {MON[d6.getMonth()]}</span></div>
              <div className="wr">{withMl.length > 0 && <><span>moyenne</span><b className="num">{num(withMl.reduce((a, x) => a + x.ml, 0) / withMl.length)} ml/j</b></>}</div>
            </div>
            <div className="wdays">
              {keys.map((k, i) => {
                const x = infos[i];
                return (
                  <button key={k} type="button" disabled={x.future} className={`wd${x.future ? " fut" : ""}${k === today ? " today" : ""}${x.status ? ` ${x.status}` : ""}`} onClick={() => sheet.open(<DaySheet k={k} />)}>
                    <span className="wdl">{dowLetter(k)}</span><b>{keyToDate(k).getDate()}</b>
                    <span className="wdv">{x.ml ? num(x.ml) : x.feeds ? `${x.feeds} rep.` : "–"}</span><i />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {first > 1 && <p className="small muted">Le journal affiche les {WINDOW_DAYS} derniers jours.</p>}
    </>
  );
}
