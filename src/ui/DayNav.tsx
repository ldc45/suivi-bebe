import { useApp } from "@/app/AppContext";
import { addDays, dayLabel, todayKey } from "@/lib/time";
import { Icon } from "./Icon";

/** Navigation jour par jour, partagée par les onglets. */
export function DayNav() {
  const { viewDay, isToday, setViewDay } = useApp();
  return (
    <>
      <div className="dnav">
        <button className="dbtn" type="button" onClick={() => setViewDay(addDays(viewDay, -1))} aria-label="Jour précédent"><Icon name="back" /></button>
        <label className="dcur">
          {isToday ? "Aujourd’hui" : dayLabel(viewDay)}
          <input type="date" max={todayKey()} value={viewDay} onChange={(e) => e.target.value && setViewDay(e.target.value)} aria-label="Choisir un jour" />
        </label>
        <button className="dbtn" type="button" disabled={isToday} onClick={() => setViewDay(addDays(viewDay, 1))} aria-label="Jour suivant"><Icon name="chevron" /></button>
      </div>
      {!isToday && <button className="dback" type="button" onClick={() => setViewDay(null)}>Revenir à aujourd’hui</button>}
    </>
  );
}
