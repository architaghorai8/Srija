import { useState } from 'react';

const PALETTE = [
  '#064E3B',
  '#059669',
  '#10B981',
  '#34D399',
  '#0D9488',
  '#1E293B',
  '#65A30D',
  '#0F766E',
];

export interface ChartDatum {
  label: string;
  value: number;
  sublabel?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
}

export function TaxonomicPieChart({
  data,
  donut = false,
  emptyText = 'No taxonomic records match the current filter.',
}: {
  data: ChartDatum[];
  donut?: boolean;
  emptyText?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0 || data.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">{emptyText}</div>;
  }

  let currentAngle = 0;
  const slices = data.slice(0, 8).map((d, idx) => {
    const pct = (d.value / total) * 100;
    const sweep = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + (sweep >= 359.99 ? 359.99 : sweep);
    currentAngle += sweep;
    return {
      ...d,
      pct,
      color: PALETTE[idx % PALETTE.length],
      path: describeArc(100, 100, 86, startAngle, endAngle),
    };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-48 h-48 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {slices.map((s, idx) => (
            <path
              key={s.label}
              d={s.path}
              fill={s.color}
              stroke="#FFFFFF"
              strokeWidth="2"
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              className="transition-opacity cursor-pointer"
              opacity={hovered === null || hovered === idx ? 1 : 0.65}
            />
          ))}
          {donut && <circle cx="100" cy="100" r="48" fill="#FFFFFF" />}
        </svg>
        {donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <span className="text-lg font-mono font-semibold text-[#141E1A] tabular-nums">
              {active ? `${active.pct.toFixed(1)}%` : `${total}`}
            </span>
            <span className="text-[11px] text-slate-500 truncate max-w-[90px]">
              {active ? active.label : 'Total reads'}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 w-full space-y-2">
        {slices.map((s, idx) => (
          <div
            key={s.label}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[#F6FAF8] transition-colors cursor-default"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-slate-800 truncate">{s.label}</span>
            </div>
            <div className="font-mono tabular-nums text-slate-600 shrink-0 ml-3">
              {s.value} ({s.pct.toFixed(1)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpeciesAbundanceBarChart({ data }: { data: ChartDatum[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">No abundance records available.</div>;
  }
  const top = data.slice(0, 10);
  const maxVal = Math.max(...top.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {top.map((item, idx) => {
        const widthPct = Math.max(4, (item.value / maxVal) * 100);
        return (
          <div
            key={item.label}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800 italic truncate pr-3">{item.label}</span>
              <span className="font-mono tabular-nums text-slate-600 shrink-0">
                {item.value} reads{item.sublabel ? ` · ${item.sublabel}` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#F0F7F4] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: hovered === idx ? '#059669' : '#064E3B',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface TrendPoint {
  date: string;
  label: string;
  shannon: number;
  richness: number;
}

export function BiodiversityTrendLineChart({ points }: { points: TrendPoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">Upload datasets across sampling dates to view temporal trends.</div>;
  }

  const width = 560;
  const height = 210;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxY = Math.max(3.5, ...points.map((p) => p.shannon)) * 1.1;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? padL + chartW / 2 : padL + (i / (points.length - 1)) * chartW;
    const y = padT + chartH - (p.shannon / maxY) * chartH;
    return { ...p, x, y };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const active = activeIdx !== null ? coords[activeIdx] : coords[coords.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Shannon Diversity Index (H&apos;) over collection dates</span>
        {active && (
          <span className="font-mono tabular-nums text-[#064E3B] font-semibold">
            {active.date} · H&apos; = {active.shannon.toFixed(3)} · S = {active.richness}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padT + chartH * (1 - frac);
          const val = (maxY * frac).toFixed(1);
          return (
            <g key={frac}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E2ECE7" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                {val}
              </text>
            </g>
          );
        })}

        {coords.length > 1 && (
          <polyline fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        )}

        {coords.map((c, idx) => (
          <g key={`${c.date}-${idx}`}>
            <circle
              cx={c.x}
              cy={c.y}
              r={activeIdx === idx ? 6 : 4.5}
              fill={activeIdx === idx ? '#064E3B' : '#10B981'}
              stroke="#FFFFFF"
              strokeWidth="2"
              className="cursor-pointer"
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
            />
            <text
              x={c.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-mono"
            >
              {c.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export interface GeoSamplePoint {
  id: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  richness: number;
  shannon: number;
}

export function SamplingGeoMap({ samples }: { samples: GeoSamplePoint[] }) {
  const [selected, setSelected] = useState<GeoSamplePoint | null>(null);
  const geoSamples = samples.filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number'
  ) as Array<GeoSamplePoint & { latitude: number; longitude: number }>;

  const projectX = (lng: number) => ((lng + 180) / 360) * 640;
  const projectY = (lat: number) => ((90 - lat) / 180) * 300;

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-[#D8E6DF] bg-[#F3F8F5] overflow-hidden">
        <svg viewBox="0 0 640 300" className="w-full h-56 block">
          {/* Latitude / Longitude coordinate graticule */}
          {[-60, -30, 0, 30, 60].map((lat) => (
            <line
              key={`lat-${lat}`}
              x1="0"
              y1={projectY(lat)}
              x2="640"
              y2={projectY(lat)}
              stroke="#DCE9E2"
              strokeWidth="1"
            />
          ))}
          {[-120, -60, 0, 60, 120].map((lng) => (
            <line
              key={`lng-${lng}`}
              x1={projectX(lng)}
              y1="0"
              x2={projectX(lng)}
              y2="300"
              stroke="#DCE9E2"
              strokeWidth="1"
            />
          ))}

          {/* Simplified continental land silhouettes for geographic orientation */}
          <g fill="#D7E7DF" stroke="#BDD4C9" strokeWidth="0.8">
            <path d="M55 60 L155 45 L185 88 L155 128 L112 142 L85 110 Z" />
            <path d="M148 152 L205 162 L218 220 L185 268 L155 245 L142 185 Z" />
            <path d="M295 48 L365 44 L388 85 L345 106 L296 95 Z" />
            <path d="M295 115 L368 118 L398 168 L365 238 L322 228 L292 162 Z" />
            <path d="M385 48 L535 55 L565 115 L505 152 L420 142 L385 102 Z" />
            <path d="M495 188 L565 195 L575 242 L515 248 L488 218 Z" />
          </g>

          {geoSamples.map((s) => {
            const x = projectX(s.longitude);
            const y = projectY(s.latitude);
            const isSel = selected?.id === s.id;
            return (
              <g
                key={s.id}
                className="cursor-pointer"
                onMouseEnter={() => setSelected(s)}
                onClick={() => setSelected(s)}
              >
                <circle cx={x} cy={y} r={isSel ? 11 : 8} fill="#10B981" fillOpacity="0.25" />
                <circle
                  cx={x}
                  cy={y}
                  r={isSel ? 5.5 : 4.5}
                  fill="#064E3B"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {geoSamples.length === 0 ? (
        <p className="text-xs text-slate-500">
          Add latitude and longitude coordinates when uploading datasets to plot sample sites on the map.
        </p>
      ) : selected ? (
        <div className="p-3 rounded-lg bg-[#F6FAF8] border border-[#D8E6DF] text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-[#141E1A]">{selected.name}</span>
            <span className="text-slate-500 ml-2">{selected.location}</span>
          </div>
          <div className="font-mono tabular-nums text-[#064E3B]">
            {selected.latitude?.toFixed(3)}, {selected.longitude?.toFixed(3)} · Richness {selected.richness} · H&apos;{' '}
            {selected.shannon.toFixed(2)}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Showing {geoSamples.length} geo-referenced sample location(s). Hover or click a coordinate marker to inspect metrics.
        </p>
      )}
    </div>
  );
}
