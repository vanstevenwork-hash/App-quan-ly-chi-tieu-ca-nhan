// Card artwork helpers — tiny on purpose (no catalog import) so every place
// that draws a card can use them without pulling in the design catalog.

// Only our own bundled designs or the app's Cloudinary uploads are rendered,
// and the URL is validated before it goes into a CSS url(): a stored value
// can never break out of the declaration.
const SAFE = /^(\/cards\/[\w./-]+\.webp|https:\/\/res\.cloudinary\.com\/[\w.\-/%]+)$/;

export function safeCardImage(url?: string | null): string | null {
    if (!url) return null;
    const u = url.trim();
    return SAFE.test(u) && !u.includes('..') ? u : null;
}

// Darkening scrim so white text stays readable on any artwork.
const SCRIM = {
    full: 'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.12) 38%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.62) 100%)',
    light: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 100%)',
    none: '',
};

/** CSS `background` value for a card with artwork, or null when it has none. */
export function cardArtBackground(url?: string | null, scrim: keyof typeof SCRIM = 'full'): string | null {
    const safe = safeCardImage(url);
    if (!safe) return null;
    const layer = `url("${safe}") center / cover no-repeat`;
    return SCRIM[scrim] ? `${SCRIM[scrim]}, ${layer}` : layer;
}

/** Text colours used on top of artwork (always light, with a soft shadow). */
export const ART_TEXT = {
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.88)',
    border: undefined as string | undefined,
    shadow: '0 1px 2px rgba(0,0,0,0.55)',
};
