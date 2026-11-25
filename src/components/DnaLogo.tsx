export function DnaLogo({ size = 36, inverted = false }: { size?: number; inverted?: boolean }) {
  const strokeMain = inverted ? '#ECFDF5' : '#064E3B';
  const strokeAccent = inverted ? '#34D399' : '#059669';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        stroke={strokeMain}
        strokeWidth="1.75"
        fill={inverted ? 'rgba(255,255,255,0.06)' : '#ECFDF5'}
      />
      <path
        d="M13 10C13 15 27 17 27 22C27 27 13 28 13 31"
        stroke={strokeMain}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M27 10C27 15 13 17 13 22C13 27 27 28 27 31"
        stroke={strokeAccent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="15" y1="13" x2="25" y2="13" stroke={strokeMain} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="20" x2="24" y2="20" stroke={strokeAccent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="27" x2="25" y2="27" stroke={strokeMain} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AnimatedDnaHelix() {
  const rungs = Array.from({ length: 12 }, (_, idx) => {
    const y = 26 + idx * 24;
    const phase = (idx / 11) * Math.PI * 2;
    const xOffset = Math.sin(phase) * 34;
    const x1 = 70 - xOffset;
    const x2 = 70 + xOffset;
    return { y, x1, x2, depth: Math.cos(phase) };
  });

  return (
    <svg
      viewBox="0 0 140 320"
      className="w-28 h-64 animate-helix-float"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Animated DNA Double Helix"
    >
      {rungs.map((r, i) => (
        <g key={i}>
          <line
            x1={r.x1}
            y1={r.y}
            x2={r.x2}
            y2={r.y}
            stroke={r.depth >= 0 ? '#10B981' : '#6EE7B7'}
            strokeOpacity={r.depth >= 0 ? 0.8 : 0.45}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={r.x1} cy={r.y} r="4.2" fill="#047857" stroke="#ECFDF5" strokeWidth="1.2" />
          <circle cx={r.x2} cy={r.y} r="4.2" fill="#34D399" stroke="#064E3B" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}
