import Avatar from "./Avatar";
import type { MemberTotal } from "@/lib/types";

const THEME_A = "#29F1D6";

export default function Podium({ memberTotals, goalKm }: { memberTotals: MemberTotal[]; goalKm?: number }) {
  const order = [memberTotals[1], memberTotals[0], memberTotals[2]].filter(Boolean);
  const medals = ["🥈", "🥇", "🥉"];

  // Sem meta definida: mantém o visual antigo, altura relativa a quem lidera
  if (!goalKm || goalKm <= 0) {
    const heights = [70, 100, 50];
    const maxKm = Math.max(...memberTotals.map((m) => m.km), 0);
    const isZero = maxKm === 0;

    return (
      <div className="flex items-end justify-center gap-2.5 pt-4 pb-1" style={{ minHeight: 226 }}>
        {order.map((m, i) => (
          <div key={m.id} className="flex flex-col items-center flex-1">
            <div className="text-lg mb-1">{medals[i]}</div>
            <div className="mb-1.5">
              <Avatar profile={m} size={36} />
            </div>
            <div className="text-xs font-bold mb-1.5">{m.name}</div>
            {isZero ? (
              <>
                <div className="text-xs font-extrabold mb-1.5 text-muted">0.0</div>
                <div className="w-full rounded-t-xl" style={{ height: 5, background: "#29F1D633" }} />
              </>
            ) : (
              <div
                className="w-full rounded-t-xl flex items-start justify-center pt-1.5 text-xs font-extrabold"
                style={{
                  height: `${Math.max(28, (m.km / maxKm) * heights[i])}px`,
                  background: "linear-gradient(180deg, #29F1D655, #8B5CF633)",
                  border: "1px solid #29F1D655",
                }}
              >
                {m.km.toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Com meta: escala fixa em km, linha pontilhada da meta individual, e réguas leves a cada 25km —
  // se alguém passar da meta, a barra continua subindo e o gráfico todo se reajusta pra caber.
  const individualTarget = goalKm / memberTotals.length;
  const maxAchieved = Math.max(...memberTotals.map((m) => m.km), 0);
  const scaleTop = Math.max(25, Math.ceil((Math.max(individualTarget, maxAchieved) * 1.15) / 25) * 25);

  const gridLines: number[] = [];
  for (let v = 25; v < scaleTop; v += 25) gridLines.push(v);

  const CHART_HEIGHT = 190;
  const kmToY = (km: number) => CHART_HEIGHT - (km / scaleTop) * CHART_HEIGHT;

  return (
    <div className="pt-2 pb-1">
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {gridLines.map((v) => (
          <div key={v} className="absolute left-0 right-0 flex items-center" style={{ top: kmToY(v) }}>
            <span className="text-[9px] w-7 shrink-0 text-right pr-1" style={{ color: "#8890B540" }}>
              {v}
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
        ))}

        <div className="absolute left-0 right-0 flex items-center" style={{ top: kmToY(individualTarget) }}>
          <span className="text-[9px] font-bold w-7 shrink-0 text-right pr-1" style={{ color: THEME_A }}>
            {individualTarget.toFixed(0)}
          </span>
          <div className="flex-1" style={{ height: 0, borderTop: `1.5px dashed ${THEME_A}99` }} />
        </div>

        <div className="absolute left-7 right-0 top-0 bottom-0 flex items-end justify-center gap-2.5">
          {order.map((m) => {
            const reached = m.km >= individualTarget;
            const barH = Math.max(4, CHART_HEIGHT - kmToY(m.km));
            return (
              <div key={m.id} className="flex-1 h-full flex flex-col justify-end items-center">
                <div
                  className="w-full rounded-t-xl flex items-start justify-center pt-1.5 text-xs font-extrabold"
                  style={{
                    height: barH,
                    background: reached ? "linear-gradient(180deg, #5CFF8F88, #29F1D655)" : "linear-gradient(180deg, #29F1D655, #8B5CF633)",
                    border: `1px solid ${reached ? "#5CFF8F" : THEME_A}55`,
                  }}
                >
                  {m.km.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-2.5 pl-7 mt-2">
        {order.map((m, i) => (
          <div key={m.id} className="flex-1 flex flex-col items-center">
            <div className="text-base leading-none mb-1">{medals[i]}</div>
            <div className="mb-1">
              <Avatar profile={m} size={32} />
            </div>
            <div className="text-[11px] font-bold text-center">{m.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
