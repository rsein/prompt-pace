export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: "#05070F" }}>
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="pp-loading-ring absolute inset-0" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            stroke="url(#pp-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="120 200"
          />
          <defs>
            <linearGradient id="pp-grad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0" stopColor="#29F1D6" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="pp-loading-icon w-9 h-9 rounded-xl" />
      </div>
      <div className="text-xs font-bold tracking-widest text-muted uppercase">Prompt & Pace</div>
    </div>
  );
}
