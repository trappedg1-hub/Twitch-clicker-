/**
 * Authentic 112x112 Retina WebP Twitch / 7TV / BTTV illustrated channel emotes
 * (`Pog`, `BOOBA`, `peepoShy`, `monkaS`, `Kreygasm`, `EZ`, `LUL`, `miyaLove`,
 *  `Nosebleed`, `AWOOGA`, `Overheat`, `ClipIt`) + Twitch Star (`:SubHype:`, and `:sub2:` for a
 *  Tier-2 sub, which Twitch renders as the same purple star badge).
 */
function emoteImg(slug: string, name: string): string {
  return `<img class="tw-emote" src="/emotes/${slug}.webp" alt="${name}" title="${name}" decoding="async" />`;
}

/** The purple star badge every sub notification in the copy uses; `aria-label` carries the token name. */
function SUB_STAR_SVG(label: string): string {
  return `<svg class="tw-emote tw-emote-svg" viewBox="0 0 28 28" aria-label="${label}">
    <rect x="2.5" y="4" width="23" height="20" rx="5.5" fill="#9147ff" stroke="#e9d5ff" stroke-width="1.5"/>
    <polygon points="14,6.8 16.2,11.6 21.4,12.1 17.5,15.5 18.7,20.6 14,17.9 9.3,20.6 10.5,15.5 6.6,12.1 11.8,11.6" fill="#ffd54f"/>
  </svg>`;
}

const EMOTE_HTML: Record<string, string> = {
  ':Pog:': emoteImg('pog', 'PogChamp'),
  ':BOOBA:': emoteImg('booba', 'BOOBA'),
  ':peepoShy:': emoteImg('peeposhy', 'peepoShy'),
  ':monkaS:': emoteImg('monkas', 'monkaS'),
  ':Kreygasm:': emoteImg('kreygasm', 'Kreygasm'),
  ':EZ:': emoteImg('ez', 'EZ'),
  ':LUL:': emoteImg('lul', 'LUL'),
  ':miyaLove:': emoteImg('miyalove', 'miyaLove'),
  ':Nosebleed:': emoteImg('nosebleed', 'Nosebleed'),
  ':AWOOGA:': emoteImg('awooga', 'AWOOGA'),
  ':Overheat:': emoteImg('overheat', 'Overheat'),
  ':ClipIt:': emoteImg('clipit', 'ClipIt'),
  ':SubHype:': SUB_STAR_SVG('SubHype'),
  ':sub2:': SUB_STAR_SVG('sub2'),
};

/** Every token the chat renderer knows. Copy audits use this to refuse tokens that would print raw. */
export const EMOTE_TOKENS: readonly string[] = Object.keys(EMOTE_HTML);

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderChatTextWithEmotes(raw: string): string {
  let html = escapeHtml(raw);
  for (const [token, markup] of Object.entries(EMOTE_HTML)) {
    if (html.includes(token)) {
      html = html.split(token).join(markup);
    }
  }
  return html;
}
