import Avatar from "./Avatar";
import type { MemberTotal } from "@/lib/types";

export default function Podium({ memberTotals }: { memberTotals: MemberTotal[] }) {
  const order = [memberTotals[1], memberTotals[0], memberTotals[2]].filter(Boolean);
  const heights = [70, 100, 50];
  const medals = ["🥈", "🥇", "🥉"];
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
