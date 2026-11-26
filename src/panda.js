// Original panda drawings for Deborah's app. Simple shapes, no outside images.
const INK = "#1d1f24", WHITE = "#ffffff", BLUSH = "#ffb3c1";
const head = (cx, cy, r, { eyes = "open" } = {}) => `
  <circle cx="${cx - r * 0.72}" cy="${cy - r * 0.72}" r="${r * 0.36}" fill="${INK}"/>
  <circle cx="${cx + r * 0.72}" cy="${cy - r * 0.72}" r="${r * 0.36}" fill="${INK}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.9}" fill="${WHITE}" stroke="${INK}" stroke-width="${r * 0.06}"/>
  <ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.02}" rx="${r * 0.24}" ry="${r * 0.3}" fill="${INK}" transform="rotate(-25 ${cx - r * 0.38} ${cy})"/>
  <ellipse cx="${cx + r * 0.38}" cy="${cy - r * 0.02}" rx="${r * 0.24}" ry="${r * 0.3}" fill="${INK}" transform="rotate(25 ${cx + r * 0.38} ${cy})"/>
  ${eyes === "closed"
    ? `<path d="M${cx - r * 0.5} ${cy + r * 0.02} q${r * 0.12} ${r * 0.1} ${r * 0.24} 0 M${cx + r * 0.26} ${cy + r * 0.02} q${r * 0.12} ${r * 0.1} ${r * 0.24} 0" stroke="${WHITE}" stroke-width="${r * 0.06}" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${cx - r * 0.36}" cy="${cy - r * 0.02}" r="${r * 0.09}" fill="${WHITE}"/><circle cx="${cx + r * 0.36}" cy="${cy - r * 0.02}" r="${r * 0.09}" fill="${WHITE}"/>
       <circle cx="${cx - r * 0.33}" cy="${cy - r * 0.06}" r="${r * 0.035}" fill="${INK}"/><circle cx="${cx + r * 0.39}" cy="${cy - r * 0.06}" r="${r * 0.035}" fill="${INK}"/>`}
  <ellipse cx="${cx}" cy="${cy + r * 0.3}" rx="${r * 0.12}" ry="${r * 0.08}" fill="${INK}"/>
  <path d="M${cx - r * 0.14} ${cy + r * 0.42} q${r * 0.14} ${r * 0.14} ${r * 0.14} 0 q0 ${r * 0.14} ${r * 0.14} 0" stroke="${INK}" stroke-width="${r * 0.045}" fill="none" stroke-linecap="round"/>
  <ellipse cx="${cx - r * 0.62}" cy="${cy + r * 0.32}" rx="${r * 0.13}" ry="${r * 0.08}" fill="${BLUSH}" opacity=".8"/>
  <ellipse cx="${cx + r * 0.62}" cy="${cy + r * 0.32}" rx="${r * 0.13}" ry="${r * 0.08}" fill="${BLUSH}" opacity=".8"/>`;

const svg = (vb, body, size, label) => `<svg class="panda" viewBox="${vb}" width="${size}" height="${size}" role="img" aria-label="${label}">${body}</svg>`;

export const pandaFace = (size = 44) => svg("0 0 100 100", head(50, 56, 36), size, "Panda");

export const pandaWave = (size = 120) => svg("0 0 120 130", `
  <ellipse cx="45" cy="118" rx="11" ry="8" fill="${INK}"/><ellipse cx="75" cy="118" rx="11" ry="8" fill="${INK}"/>
  <ellipse cx="60" cy="98" rx="27" ry="22" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M36 86 Q60 96 84 86 L84 80 Q60 90 36 80Z" fill="${INK}"/>
  <ellipse cx="33" cy="100" rx="8" ry="13" fill="${INK}" transform="rotate(15 33 100)"/>
  <g class="wave"><ellipse cx="94" cy="70" rx="8" ry="15" fill="${INK}" transform="rotate(35 94 70)"/></g>
  ${head(60, 50, 32)}`, size, "Panda waving hello");

export const pandaSleep = (size = 90) => svg("0 0 140 90", `
  <ellipse cx="122" cy="74" rx="10" ry="7" fill="${INK}"/>
  <ellipse cx="88" cy="62" rx="40" ry="20" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>
  <ellipse cx="66" cy="62" rx="11" ry="19" fill="${INK}"/>
  <ellipse cx="104" cy="78" rx="11" ry="7" fill="${INK}"/>
  <ellipse cx="50" cy="78" rx="12" ry="7" fill="${INK}"/>
  ${head(38, 54, 25, { eyes: "closed" })}
  <text x="62" y="22" font-size="14" font-weight="700" fill="currentColor" opacity=".55">z</text>
  <text x="74" y="12" font-size="11" font-weight="700" fill="currentColor" opacity=".4">z</text>`, size, "Sleeping panda");

export const pandaHeart = (size = 64) => svg("0 0 100 100", `
  ${head(50, 52, 30)}
  <path d="M50 96 C30 82 24 72 32 64 C38 58 46 62 50 68 C54 62 62 58 68 64 C76 72 70 82 50 96Z" fill="#ff6b81" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="30" cy="80" rx="8" ry="10" fill="${INK}"/><ellipse cx="70" cy="80" rx="8" ry="10" fill="${INK}"/>`, size, "Panda holding a heart");

// Empty list message with a sleepy panda
export const emptyPanda = text => `<div class="empty-panda">${pandaSleep(84)}<p class="empty">${text}</p></div>`;
