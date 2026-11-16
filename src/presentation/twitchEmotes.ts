/**
 * Crisp inline SVG Twitch / 7TV-style channel emotes so every browser & OS
 * renders vivid custom stream emotes with zero missing-glyph boxes.
 */
const EMOTE_SVGS: Record<string, string> = {
  ':BOOBA:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="BOOBA">
    <circle cx="14" cy="15" r="11" fill="#ffd166" stroke="#1f1300" stroke-width="1.8"/>
    <ellipse cx="9.5" cy="12.5" rx="5.2" ry="6" fill="#fff" stroke="#1f1300" stroke-width="1.6"/>
    <ellipse cx="19.5" cy="12.5" rx="5.2" ry="6" fill="#fff" stroke="#1f1300" stroke-width="1.6"/>
    <circle cx="10.2" cy="12.5" r="2.1" fill="#111"/>
    <circle cx="18.8" cy="12.5" r="2.1" fill="#111"/>
    <ellipse cx="14.5" cy="21.2" rx="4.2" ry="2.6" fill="#ef476f"/>
  </svg>`,

  ':peepoShy:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="peepoShy">
    <ellipse cx="14" cy="16" rx="11.5" ry="9.5" fill="#6ab04c" stroke="#1e3d14" stroke-width="1.7"/>
    <circle cx="9.5" cy="11.5" r="3.6" fill="#fff"/>
    <circle cx="18.5" cy="11.5" r="3.6" fill="#fff"/>
    <circle cx="10.2" cy="12" r="2" fill="#111"/>
    <circle cx="17.8" cy="12" r="2" fill="#111"/>
    <ellipse cx="7.2" cy="16.2" rx="3" ry="1.6" fill="#ff6b9d" opacity="0.88"/>
    <ellipse cx="20.8" cy="16.2" rx="3" ry="1.6" fill="#ff6b9d" opacity="0.88"/>
    <path d="M11 18.8 Q14 20.5 17 18.8" stroke="#1e3d14" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  </svg>`,

  ':Kreygasm:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="Kreygasm">
    <circle cx="14" cy="14" r="11.5" fill="#ffcad4" stroke="#590d22" stroke-width="1.7"/>
    <path d="M6.8 11.5 Q9.8 14.2 12.2 11.5" stroke="#590d22" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M15.8 11.5 Q18.2 14.2 21.2 11.5" stroke="#590d22" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="8" cy="15.2" rx="3.1" ry="1.7" fill="#ff4d6d" opacity="0.8"/>
    <ellipse cx="20" cy="15.2" rx="3.1" ry="1.7" fill="#ff4d6d" opacity="0.8"/>
    <ellipse cx="14" cy="19.5" rx="3.6" ry="3.2" fill="#c9184a"/>
    <ellipse cx="14" cy="20.7" rx="2.3" ry="1.5" fill="#ff758f"/>
  </svg>`,

  ':Pog:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="Pog">
    <circle cx="14" cy="14" r="11.5" fill="#ffb703" stroke="#3d2600" stroke-width="1.7"/>
    <circle cx="9.8" cy="10.5" r="2.7" fill="#fff"/>
    <circle cx="18.2" cy="10.5" r="2.7" fill="#fff"/>
    <circle cx="10.2" cy="10.5" r="1.4" fill="#111"/>
    <circle cx="17.8" cy="10.5" r="1.4" fill="#111"/>
    <ellipse cx="14" cy="18.8" rx="4.2" ry="5" fill="#5a189a" stroke="#3d2600" stroke-width="1.5"/>
  </svg>`,

  ':miyaLove:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="miyaLove">
    <path d="M14 24.2 C14 24.2 4 17.6 4 10.5 C4 6.8 6.9 4.2 10.2 4.2 C12.2 4.2 13.4 5.3 14 6.6 C14.6 5.3 15.8 4.2 17.8 4.2 C21.1 4.2 24 6.8 24 10.5 C24 17.6 14 24.2 14 24.2 Z" fill="url(#mlg)" stroke="#fff" stroke-width="1.3"/>
    <defs>
      <linearGradient id="mlg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff4da6"/>
        <stop offset="100%" stop-color="#9147ff"/>
      </linearGradient>
    </defs>
  </svg>`,

  ':LUL:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="LUL">
    <circle cx="14" cy="14" r="11.5" fill="#ffd166" stroke="#3d2600" stroke-width="1.7"/>
    <path d="M6.8 11 L11.5 13 L6.8 14.5" stroke="#3d2600" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21.2 11 L16.5 13 L21.2 14.5" stroke="#3d2600" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7.5 17.2 Q14 24.5 20.5 17.2 Z" fill="#c9184a" stroke="#3d2600" stroke-width="1.4"/>
  </svg>`,

  ':SubHype:': `<svg class="tw-emote" viewBox="0 0 28 28" aria-label="SubHype">
    <rect x="3" y="5" width="22" height="18" rx="5" fill="#9147ff" stroke="#f3e8ff" stroke-width="1.5"/>
    <polygon points="14,7.5 16,12 20.8,12.4 17.2,15.5 18.3,20.2 14,17.7 9.7,20.2 10.8,15.5 7.2,12.4 12,12" fill="#ffd54f"/>
  </svg>`,
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderChatTextWithEmotes(raw: string): string {
  let html = escapeHtml(raw);
  for (const [token, svg] of Object.entries(EMOTE_SVGS)) {
    if (html.includes(token)) {
      html = html.split(token).join(svg);
    }
  }
  return html;
}
