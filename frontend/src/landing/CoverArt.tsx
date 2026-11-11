/**
 * The design system's cover composition (components/Cover): an accent slab bled off the top, the marker once,
 * an accent-soft tile with a dot grid at a space-6 pitch, an ink block, and a column of dots cut out of the slab.
 * Every fill is a token, so it follows the theme. Decorative.
 */
const GRID_X = [180, 204, 228, 252, 276, 300];
const GRID_Y = [124, 148, 172, 196, 220, 244];
const CUT_Y = [148, 172, 196, 220, 244];

export function CoverArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 496 288" aria-hidden="true" focusable="false">
      <rect className="cover-slab" x="16" y="-16" width="128" height="280" rx="10" />
      <rect className="cover-marker" x="160" y="40" width="96" height="40" rx="6" />
      <rect className="cover-tint" x="160" y="104" width="160" height="160" rx="10" />
      <rect className="cover-ink" x="336" y="56" width="176" height="208" rx="10" />
      <g className="cover-dots">
        {GRID_Y.flatMap((cy) => GRID_X.map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />))}
      </g>
      <g className="cover-cut">
        {CUT_Y.map((cy) => (
          <circle key={cy} cx="120" cy={cy} r="2" />
        ))}
      </g>
    </svg>
  );
}
