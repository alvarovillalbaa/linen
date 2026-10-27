'use client';

import { useEffect, useId, useState } from 'react';
import { LIMITS, normalizeHandle, safeHref } from '../lib/model';
import type { Card, CardSize, ProfilePage } from '../lib/types';

export type InspectorProps = {
  page: ProfilePage;
  card: Card | null;
  busy: boolean;
  handleLocked: boolean;
  onPage: (patch: Partial<ProfilePage>) => void;
  onCard: (patch: Partial<Card>) => void;
  onUpload: (target: 'avatar' | 'card') => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onMetadata: () => void;
  onClose: () => void;
};

const THEMES: { value: ProfilePage['theme']; label: string }[] = [
  { value: 'paper', label: 'Paper' }, { value: 'oat', label: 'Oat' },
  { value: 'night', label: 'Night' }, { value: 'rose', label: 'Rose' },
];
const SIZES: { value: CardSize; label: string }[] = [
  { value: 'small', label: 'Small · 1 × 1' }, { value: 'wide', label: 'Wide · 2 × 1' },
  { value: 'tall', label: 'Tall · 1 × 2' }, { value: 'large', label: 'Large · 2 × 2' },
];
const mib = (bytes: number) => bytes / (1024 * 1024);
const IMAGE_HINT = `JPEG, PNG, WebP or GIF, up to ${mib(LIMITS.imageBytes)} MiB. ${mib(LIMITS.mediaBytes)} MiB of media per page.`;

function CoordinateField({ label, value, limit, busy, onValue }: {
  label: string; value: number; limit: number; busy: boolean; onValue: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  function commit() {
    if (busy) return;
    const next = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(next) || Math.abs(next) > limit) {
      setError(`Enter a number between −${limit} and ${limit}.`);
      return;
    }
    setError(''); setDraft(String(next));
    if (next !== value) onValue(next);
  }
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" inputMode="decimal" value={draft} maxLength={32}
      disabled={busy} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`}
      onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
    <p id={`${id}-help`} className="hint" role={error ? 'alert' : undefined}>{error || `−${limit} to ${limit}`}</p>
  </div>;
}

export function Inspector({ page, card, busy, handleLocked, onPage, onCard, onUpload, onDelete, onMove, onDuplicate, onMetadata, onClose }: InspectorProps) {
  const prefix = useId();
  const index = card ? page.cards.findIndex(item => item.id === card.id) : -1;
  const mediaCard = card && ['link', 'image', 'video'].includes(card.kind);
  const imageCard = card && (card.kind === 'image' || card.kind === 'link');
  const showUrl = card && ['link', 'image', 'video', 'embed', 'map'].includes(card.kind);
  const href = card ? safeHref(card.url) : null;
  const canPreview = Boolean(href?.startsWith('https://'));
  const titleLabel = card?.kind === 'section' ? 'Section heading' : card?.kind === 'map' ? 'Location label'
    : card?.kind === 'image' || card?.kind === 'text' || card?.kind === 'embed' ? 'Title (optional)' : 'Title';
  const urlLabel = card?.kind === 'image' ? card.mediaId ? 'Image link (optional)' : 'Image URL'
    : card?.kind === 'video' ? card.mediaId ? 'Video link (optional)' : 'Video URL'
      : card?.kind === 'map' ? 'Location link (optional)' : card?.kind === 'embed' ? 'Embed or content URL' : 'Destination';

  return <aside className="inspector" aria-label={card ? 'Card settings' : 'Profile settings'} aria-busy={busy}>
    <div className="panel-title">
      <h2>{card ? 'Edit card' : 'Your profile'}</h2>
      <button type="button" onClick={onClose} aria-label="Close settings">Close</button>
    </div>
    {busy && <p className="hint" role="status">An action is in progress. Editing will be available when it finishes.</p>}

    {!card ? <fieldset disabled={busy}>
      <legend className="hint">Introduce yourself</legend>
      <label className="field">Name
        <input type="text" autoComplete="name" value={page.name} maxLength={120} onChange={event => onPage({ name: event.target.value })} />
      </label>
      <label className="field">Biography
        <textarea rows={4} value={page.bio} maxLength={2000} onChange={event => onPage({ bio: event.target.value })} />
      </label>
      <label className="field">Location
        <input type="text" autoComplete="address-level2" value={page.location} maxLength={160} onChange={event => onPage({ location: event.target.value })} />
      </label>
      <label className="field" htmlFor={`${prefix}-handle`}>Public handle
        <input id={`${prefix}-handle`} type="text" value={page.handle} maxLength={30} disabled={handleLocked}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={`${prefix}-handle-help`}
          onChange={event => onPage({ handle: event.target.value })}
          onBlur={event => { if (!handleLocked && !busy) { const handle = normalizeHandle(event.target.value); if (handle !== page.handle) onPage({ handle }); } }} />
      </label>
      <p id={`${prefix}-handle-help`} className="hint">{handleLocked ? 'This handle is reserved for your profile and cannot be changed.' : '3–30 lower-case letters, digits or hyphens. Start and finish with a letter or digit. Your handle is fixed once claimed.'}</p>

      <div className="field">
        <span>Profile photo</span>
        <div className="control-row">
          <button type="button" className="file-choice" onClick={() => onUpload('avatar')}>{page.avatarId ? 'Replace photo' : 'Choose photo'}</button>
          {page.avatarId && <button type="button" className="danger-link" onClick={() => onPage({ avatarId: '' })}>Remove photo</button>}
        </div>
        <p className="hint">{IMAGE_HINT}</p>
      </div>

      <fieldset className="field">
        <legend>Page theme</legend>
        <div className="choices">{THEMES.map(theme => <button type="button" key={theme.value} aria-pressed={page.theme === theme.value}
          onClick={() => onPage({ theme: theme.value })}>{theme.label}</button>)}</div>
      </fieldset>
      <fieldset className="field">
        <legend>Typeface</legend>
        <div className="choices">
          <button type="button" aria-pressed={page.font === 'sans'} onClick={() => onPage({ font: 'sans' })}>Sans</button>
          <button type="button" aria-pressed={page.font === 'serif'} onClick={() => onPage({ font: 'serif' })}>Serif</button>
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${prefix}-accent`}>Accent color</label>
        <div className="control-row">
          <input type="color" aria-label="Choose accent color" value={/^#[0-9a-f]{6}$/i.test(page.accent) ? page.accent : '#C66D4A'} onChange={event => onPage({ accent: event.target.value })} />
          <input id={`${prefix}-accent`} type="text" value={page.accent} maxLength={32} spellCheck={false} autoCapitalize="none"
            aria-describedby={`${prefix}-accent-help`} onChange={event => onPage({ accent: event.target.value })} />
        </div>
        <p id={`${prefix}-accent-help`} className="hint">Use a six-digit hex color, such as #C66D4A.</p>
      </div>
    </fieldset> : <fieldset disabled={busy}>
      <legend className="hint">{card.kind === 'section' ? 'Section' : `${card.kind.charAt(0).toUpperCase()}${card.kind.slice(1)} card`}</legend>
      <label className="field">{titleLabel}
        <input type="text" value={card.title} maxLength={200} onChange={event => onCard({ title: event.target.value })} />
      </label>
      {card.kind !== 'section' && <label className="field">{card.kind === 'text' ? 'Text' : card.kind === 'link' ? 'Description (optional)' : 'Caption (optional)'}
        <textarea rows={card.kind === 'text' ? 6 : 3} value={card.text} maxLength={6000} onChange={event => onCard({ text: event.target.value })} />
      </label>}
      {showUrl && <div className="field">
        <label htmlFor={`${prefix}-url`}>{urlLabel}</label>
        <input id={`${prefix}-url`} type="text" inputMode="url" value={card.url} maxLength={2048} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-describedby={`${prefix}-url-help`} onChange={event => onCard({ url: event.target.value })} />
        <p id={`${prefix}-url-help`} className="hint">{card.kind === 'embed' ? 'Supported players appear in the card. Other HTTPS links stay usable as outbound links.'
          : (card.kind === 'image' || card.kind === 'video') && !card.mediaId ? `Use a direct HTTPS ${card.kind} URL, or choose a file below.`
            : card.kind === 'link' ? 'Use a web, email or telephone link.' : 'An optional destination opens when a visitor follows the link.'}</p>
        {card.kind === 'link' && <>
          <button type="button" disabled={!canPreview} onClick={onMetadata}>Try link preview</button>
          <p className="hint">Preview support varies. You can always write your own title and choose a cover image.</p>
        </>}
      </div>}

      {(card.kind === 'link' || card.kind === 'video') && <div className="field">
        <label htmlFor={`${prefix}-cover`}>Cover image URL (optional)</label>
        <input id={`${prefix}-cover`} type="text" inputMode="url" value={card.coverUrl} maxLength={2048} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-describedby={`${prefix}-cover-help`} onChange={event => onCard({ coverUrl: event.target.value })} />
        <p id={`${prefix}-cover-help`} className="hint">{card.kind === 'video' ? 'Use a direct HTTPS image URL for the video poster.' : card.mediaId ? 'Your uploaded cover is used first. A direct HTTPS image URL can be kept as a fallback.' : 'Use a direct HTTPS image URL, or choose a cover file below.'}</p>
      </div>}

      {mediaCard && <div className="field">
        <span>{card.kind === 'link' ? 'Cover image (optional)' : card.kind === 'video' ? 'Video file' : 'Image file'}</span>
        <div className="control-row">
          <button type="button" className="file-choice" onClick={() => onUpload('card')}>{card.mediaId ? 'Replace file' : card.kind === 'video' ? 'Choose video' : 'Choose image'}</button>
          {card.mediaId && <button type="button" className="danger-link" onClick={() => onCard({ mediaId: '' })}>Remove file</button>}
        </div>
        <p className="hint">{card.kind === 'video' ? `MP4 or WebM, up to ${mib(LIMITS.videoBytes)} MiB. ${mib(LIMITS.mediaBytes)} MiB of media per page.` : IMAGE_HINT}</p>
      </div>}
      {imageCard && <label className="field">{card.kind === 'link' ? 'Cover image description (optional)' : 'Image description'}
        <textarea rows={2} value={card.alt} maxLength={500} onChange={event => onCard({ alt: event.target.value })} />
        <span className="hint">Describe the image for someone who cannot see it.</span>
      </label>}
      {card.kind === 'map' && <div className="control-row">
        <CoordinateField key={`${card.id}-lat`} label="Latitude" value={card.lat} limit={90} busy={busy} onValue={lat => onCard({ lat })} />
        <CoordinateField key={`${card.id}-lng`} label="Longitude" value={card.lng} limit={180} busy={busy} onValue={lng => onCard({ lng })} />
      </div>}

      <fieldset className="field">
        <legend>Card size</legend>
        <div className="size-options">{SIZES.map(size => <button type="button" key={size.value} aria-pressed={card.size === size.value}
          onClick={() => onCard({ size: size.value })}>{size.label}</button>)}</div>
      </fieldset>
      <div className="control-row">
        <button type="button" disabled={index <= 0} onClick={() => onMove(-1)}>Move earlier</button>
        <button type="button" disabled={index < 0 || index >= page.cards.length - 1} onClick={() => onMove(1)}>Move later</button>
      </div>
      <div className="control-row">
        <button type="button" disabled={page.cards.length >= LIMITS.cards} onClick={onDuplicate}>Duplicate card</button>
        <button type="button" className="danger-link" onClick={onDelete}>Delete card</button>
      </div>
      {page.cards.length >= LIMITS.cards && <p className="hint">This page has {LIMITS.cards} cards. Remove one before adding another copy.</p>}
    </fieldset>}
  </aside>;
}

export default Inspector;
