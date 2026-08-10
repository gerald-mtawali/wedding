/**
 * Decorative botanical sprig, used to frame the sealed envelope the way the
 * dried stems do in the reference photograph. Purely ornamental.
 */
export default function Sprig({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 160 60"
      aria-hidden
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 52C34 46 78 34 152 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {[
        { x: 26, y: 45, r: -28 },
        { x: 50, y: 38, r: -24 },
        { x: 74, y: 31, r: -22 },
        { x: 98, y: 24, r: -20 },
        { x: 120, y: 17, r: -18 },
      ].map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
          {/* Two leaves per node, mirrored above and below the stem. */}
          <path
            d="M0 0C8 -12 22 -14 28 -9C22 2 8 4 0 0Z"
            fill="currentColor"
            opacity="0.85"
          />
          <path
            d="M0 0C8 12 22 14 28 9C22 -2 8 -4 0 0Z"
            fill="currentColor"
            opacity="0.6"
          />
        </g>
      ))}
      <path
        d="M148 4C154 0 158 2 159 6C155 11 149 10 148 4Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
