'use client';

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { assetIds, blankPage, createCard, LIMITS, moveCard, normalizeHandle, packCards, publicationIssues, safeImageUrl, validatePage } from '../lib/model';
import { getMedia, listMedia, loadWorkspace, putMedia, replaceWorkspace, saveWorkspace, deleteMedia } from '../lib/local';
import { inspectMedia, validateMediaFile } from '../lib/media';
import { exportBackup, exportSite, importBackup } from '../lib/archive';
import { download, request, RequestError, syncPage } from '../lib/client';
import { renderCard } from '../lib/render';
import type { Card, CardKind, MediaFile, OwnerSnapshot, ProfilePage, RemoteBinding, Workspace } from '../lib/types';
import Inspector from './inspector';

const kinds: { kind: CardKind; icon: string; name: string; description: string }[] = [
  { kind: 'link', icon: '↗', name: 'Link', description: 'A project, a profile, a good corner of the internet.' },
  { kind: 'text', icon: 'Aa', name: 'Note', description: 'A few words that sound like you.' },
  { kind: 'image', icon: '▧', name: 'Image', description: 'Something worth a thousand words.' },
  { kind: 'video', icon: '▷', name: 'Video', description: 'A little movement. Your own upload.' },
  { kind: 'embed', icon: '♫', name: 'Music & embeds', description: 'A track, a film, a thing you made.' },
  { kind: 'map', icon: '⌖', name: 'Location', description: 'Somewhere you call home. Or somewhere good.' },
  { kind: 'section', icon: '—', name: 'Heading', description: 'Make a little space between chapters.' },
];
const message = (error: unknown) => error instanceof Error ? error.message : 'That didn’t finish. Your draft is still here.';
const snapshot = (page: ProfilePage) => structuredClone(page);
const NoticeContext = createContext('');

function Editable({ value, label, className, multiline = false, placeholder, onChange, disabled }: { value: string; label: string; className: string; multiline?: boolean; placeholder: string; onChange: (value: string) => boolean; disabled: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => { if (element.current && document.activeElement !== element.current) element.current.textContent = value; }, [value]);
  return <div ref={element} className={className} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline={multiline} data-placeholder={placeholder} spellCheck
    onInput={event => { const next = event.currentTarget.innerText; if (!onChange(next)) event.currentTarget.textContent = value; }}
    onKeyDown={event => { if (!multiline && event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    onPaste={event => { event.preventDefault(); const text = event.clipboardData.getData('text/plain'); const selection = window.getSelection(); if (!selection?.rangeCount) return; const range = selection.getRangeAt(0); if (!element.current?.contains(range.commonAncestorContainer)) return; range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); const next = event.currentTarget.innerText; if (!onChange(next)) event.currentTarget.textContent = value; }}
  />;
}
function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const notice = useContext(NoticeContext);
  const dialog = useRef<HTMLDialogElement>(null), prior = useRef<HTMLElement | null>(null);
  useEffect(() => { prior.current = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); prior.current?.focus(); }; }, []);
  return <dialog ref={dialog} className="editor-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><div className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}>×</button></div>{notice && <p className="editor-notice" role="status">{notice}</p>}{children}</dialog>;
}

export default function Editor() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null), current = useRef<Workspace | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [inspectorOpen, setInspectorOpen] = useState(false);
  const [preview, setPreview] = useState(false), [screen, setScreen] = useState<'desktop' | 'mobile'>('desktop');
  const [modal, setModal] = useState<'add' | 'publish' | 'files' | 'recover' | null>(null), [narrow, setNarrow] = useState(false);
  const [notice, setNotice] = useState(''), [localStatus, setLocalStatus] = useState('Opening your workspace…');
  const [storageEnabled, setStorageEnabled] = useState(true), [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(''), working = useRef(false), saveQueue = useRef(Promise.resolve());
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({}), [mediaTick, setMediaTick] = useState(0);
  const [history, setHistory] = useState<ProfilePage[]>([]), [future, setFuture] = useState<ProfilePage[]>([]);
  const [dragging, setDragging] = useState<string | null>(null), dragTarget = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(''), [recoverHandle, setRecoverHandle] = useState(''), [recoverKey, setRecoverKey] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), backupInput = useRef<HTMLInputElement>(null), recoveryInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<'avatar' | { card: string } | 'new'>('new');

  function store(value: Workspace) { current.current = value; setWorkspace(value); }
  function applyPage(next: ProfilePage, track = true): boolean {
    const before = current.current; if (!before) return false;
    try {
      next = validatePage({ ...next, handle: before.remote?.handle ?? next.handle });
      if (JSON.stringify(next) === JSON.stringify(before.page)) return true;
      if (track) { setHistory(items => [...items.slice(-29), snapshot(before.page)]); setFuture([]); }
      store({ ...before, page: next, updatedAt: Date.now() }); return true;
    } catch (error) { setNotice(message(error)); return false; }
  }
  function patchPage(patch: Partial<ProfilePage>): boolean { return !working.current && !!current.current && applyPage({ ...current.current.page, ...patch }); }
  function patchCard(id: string, patch: Partial<Card>): boolean { return !working.current && !!current.current && applyPage({ ...current.current.page, cards: current.current.page.cards.map(card => card.id === id ? { ...card, ...patch } : card) }); }
  function bindingChanged(remote: RemoteBinding) { if (current.current) store({ ...current.current, remote, updatedAt: Date.now() }); }
  function undo() {
    if (working.current || !current.current || !history.length) return;
    const last = history.at(-1)!; setFuture(items => [...items, snapshot(current.current!.page)]); setHistory(items => items.slice(0, -1)); applyPage(last, false);
  }
  function redo() {
    if (working.current || !current.current || !future.length) return;
    const last = future.at(-1)!; setHistory(items => [...items, snapshot(current.current!.page)]); setFuture(items => items.slice(0, -1)); applyPage(last, false);
  }
  useEffect(() => {
    let cancelled = false;
    void loadWorkspace().then(saved => { if (!cancelled) { store(saved || { version: 1, page: blankPage(), remote: null, updatedAt: Date.now() }); setLocalStatus('Saved on this device'); } }).catch(error => {
      if (!cancelled) { store({ version: 1, page: blankPage(), remote: null, updatedAt: Date.now() }); setStorageEnabled(false); setLocalStatus('This visit only'); setNotice(`${message(error)} Existing saved data has not been replaced.`); }
    });
    void request<{ publishing: boolean }>('/api/config').then(value => { if (!cancelled) setConfigured(value.publishing === true); }).catch(() => {});
    const media = window.matchMedia('(max-width: 1050px)'), changed = () => setNarrow(media.matches); changed(); media.addEventListener('change', changed);
    return () => { cancelled = true; media.removeEventListener('change', changed); };
  }, []);
  useEffect(() => {
    if (!workspace || !storageEnabled || busy) return;
    setLocalStatus('Saving on this device…');
    const timer = setTimeout(() => {
      if (working.current) return;
      const captured = workspace;
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        try { await saveWorkspace(captured); if (current.current?.updatedAt === captured.updatedAt) setLocalStatus('Saved on this device'); }
        catch (error) { if (current.current?.updatedAt === captured.updatedAt) { setLocalStatus('Not saved'); setNotice(`${message(error)} Keep this tab open and export a backup.`); } }
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [workspace, storageEnabled, busy]);
  const assetKey = workspace ? assetIds(workspace.page).join(',') : '';
  useEffect(() => {
    let cancelled = false; const urls: string[] = [], ids = assetKey ? assetKey.split(',') : [];
    void Promise.all(ids.map(async id => { const file = await getMedia(id); if (!file) return [id, '']; const url = URL.createObjectURL(file.blob); urls.push(url); return [id, url]; })).then(entries => { if (!cancelled) setMediaUrls(Object.fromEntries(entries)); else urls.forEach(URL.revokeObjectURL); }).catch(error => { if (!cancelled) setNotice(message(error)); });
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); };
  }, [assetKey, mediaTick]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || target.closest('input,textarea,select,dialog') || !(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });

  async function run(label: string, action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(label); setNotice('');
    try { await saveQueue.current; await action(); }
    catch (error) {
      if (error instanceof RequestError && error.code === 'handle_taken' && current.current?.remote?.revision === 0) {
        const value = { ...current.current, remote: null, updatedAt: Date.now() };
        store(value); await saveWorkspace(value).catch(() => { setLocalStatus('Not saved'); });
      }
      setNotice(`${message(error)}${error instanceof RequestError && error.status === 409 && error.code !== 'handle_taken' ? ' Export a backup before loading another version.' : ''}`);
    }
    finally { working.current = false; setBusy(''); }
  }
  function addCard(kind: CardKind) {
    if (!current.current || working.current) return;
    const card = createCard(kind);
    if (applyPage({ ...current.current.page, cards: [...current.current.page.cards, card] })) { setSelected(card.id); setModal(null); setInspectorOpen(true); }
  }
  function move(id: string, delta: number) {
    if (!current.current || working.current) return;
    const page = current.current.page, index = page.cards.findIndex(card => card.id === id);
    if (applyPage(moveCard(page, id, index + delta))) setNotice('Card moved.');
  }
  function duplicate() {
    if (!current.current || !selected || working.current) return;
    const page = current.current.page, index = page.cards.findIndex(card => card.id === selected);
    if (index < 0) return;
    const card = { ...page.cards[index], id: crypto.randomUUID() }, cards = [...page.cards]; cards.splice(index + 1, 0, card);
    if (applyPage({ ...page, cards })) setSelected(card.id);
  }
  async function filesFor(page: ProfilePage): Promise<MediaFile[]> {
    return Promise.all(assetIds(page).map(async id => { const file = await getMedia(id); if (!file) throw new Error('A referenced file is missing. Recover it before exporting or publishing.'); return file; }));
  }
  function chooseUpload(target: 'avatar' | 'card' | 'new') {
    if (target === 'card' && !selected) return;
    uploadTarget.current = target === 'card' ? { card: selected! } : target;
    if (fileInput.current) { fileInput.current.accept = target === 'avatar' ? 'image/jpeg,image/png,image/webp,image/gif' : 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'; fileInput.current.click(); }
  }
  async function acceptMedia(file: File) {
    const target = uploadTarget.current;
    await run('Adding your file…', async () => {
      if (!current.current) return;
      const inspected = await inspectMedia(file), existing = typeof target === 'object' ? current.current.page.cards.find(card => card.id === target.card) : null;
      if ((target === 'avatar' || existing && existing.kind !== 'video') && inspected.kind !== 'image') throw new Error('Choose an image for this part of the page.');
      if (existing?.kind === 'video' && inspected.kind !== 'video') throw new Error('Choose an MP4 or WebM video for this card.');
      const page = current.current.page;
      if (target === 'new' && page.cards.length >= LIMITS.cards) throw new Error('This page has 32 cards. Remove a card before adding another.');
      if (typeof target === 'object' && !existing) throw new Error('That card is no longer here. Choose a card before adding its file.');
      const media = await putMedia(file);
      let next: ProfilePage, addedCard: Card | null = null;
      if (target === 'avatar') next = { ...page, avatarId: media.id };
      else if (typeof target === 'object') next = { ...page, cards: page.cards.map(card => card.id === target.card ? { ...card, mediaId: media.id, alt: card.alt || media.name } : card) };
      else {
        addedCard = { ...createCard(inspected.kind === 'video' ? 'video' : 'image'), mediaId: media.id, alt: media.name, title: inspected.kind === 'video' ? media.name.slice(0, 200).replace(/[\uD800-\uDBFF]$/, '') : '' };
        next = { ...page, cards: [...page.cards, addedCard] };
      }
      try { validatePage(next); }
      catch (error) { await deleteMedia(media.id); throw error; }
      if (!applyPage(next)) { await deleteMedia(media.id); throw new Error('The file could not attach to this draft. Your existing files are unchanged.'); }
      if (addedCard) { setSelected(addedCard.id); setInspectorOpen(true); }
      setMediaTick(value => value + 1); setNotice('File added to this device.');
    });
  }
  async function metadata() {
    const card = current.current?.page.cards.find(item => item.id === selected); if (!card) return;
    await run('Finding a little context…', async () => {
      const details = await request<{ title: string; description: string; image: string; manual: boolean }>(`/api/link-preview?url=${encodeURIComponent(card.url)}`);
      const page = current.current!.page;
      applyPage({ ...page, cards: page.cards.map(item => item.id === card.id && item.url === card.url ? { ...item, title: item.title || details.title, text: item.text || details.description, coverUrl: item.coverUrl || details.image } : item) });
      setNotice(details.manual ? 'Automatic details are unavailable here. Add your own title and cover.' : 'Preview details added. You can make them your own.');
    });
  }
  async function saveCloud(publish: boolean) {
    await run(publish ? 'Preparing your page…' : 'Saving your cloud draft…', async () => {
      if (!current.current || !configured) throw new Error('Publishing is not configured on this installation. Your local editor and exports still work.');
      const captured = current.current, files = await filesFor(captured.page);
      if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(captured.page.handle)) throw new Error('Choose a handle with 3–30 lowercase letters, numbers or hyphens, beginning and ending with a letter or number.');
      if (publish) {
        const issues = publicationIssues(captured.page, files.map(file => file.id));
        if (issues.length) throw new Error(issues.slice(0, 4).join(' '));
      }
      let remote = await syncPage(captured, setBusy, bindingChanged);
      if (publish) {
        const result = await request<OwnerSnapshot>(`/api/profiles/${remote.handle}/publish`, 'POST', { revision: remote.revision }, remote.ownerKey);
        remote = { ...remote, revision: result.revision, publishedRevision: result.publishedRevision }; bindingChanged(remote);
        await saveWorkspace(current.current!); setNotice('Your page is published. Download your recovery key and keep it private.');
      } else setNotice('Cloud draft saved. Your public version is unchanged.');
    });
  }
  async function recover() {
    if (!window.confirm('Load this cloud page and replace the current local draft? Export your current work first if you want to keep it.')) return;
    await run('Recovering your page…', async () => {
      const handle = normalizeHandle(recoverHandle), key = recoverKey.trim();
      const remote = await request<OwnerSnapshot>(`/api/profiles/${encodeURIComponent(handle)}`, 'GET', undefined, key);
      const page = validatePage(remote.page), media: MediaFile[] = [];
      for (const id of assetIds(page)) {
        const asset = remote.assets.find(item => item.id === id); if (!asset || !asset.url.startsWith(`/api/media/${handle}/`)) throw new Error('A cloud file could not be verified.');
        const response = await fetch(asset.url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error('A cloud file could not load. Your current local draft is unchanged.');
        media.push(await validateMediaFile({ id, name: asset.name, type: asset.type, size: asset.size, blob: await response.blob(), createdAt: Date.now() }));
      }
      const value: Workspace = { version: 1, page, remote: { handle, ownerKey: key, revision: remote.revision, publishedRevision: remote.publishedRevision }, updatedAt: Date.now() };
      await replaceWorkspace(value, media); store(value); setHistory([]); setFuture([]); setSelected(null); setRecoverKey(''); setModal(null); setStorageEnabled(true); setMediaTick(value => value + 1); setNotice('Your page and files are available on this device.');
    });
  }
  async function importProject(file: File) {
    await run('Reading your backup…', async () => {
      const restored = await importBackup(file);
      if (!window.confirm('Replace the local draft with this backup? Public pages stay unchanged. Keep your recovery key separately.')) return;
      const before = current.current, keep = before?.page.id === restored.page.id && before.remote?.handle === restored.page.handle ? before.remote : null;
      const value: Workspace = { version: 1, page: restored.page, remote: keep, updatedAt: Date.now() };
      await replaceWorkspace(value, restored.media); store(value); setHistory([]); setFuture([]); setSelected(null); setModal(null); setStorageEnabled(true); setMediaTick(value => value + 1); setNotice('Backup restored locally. Nothing was published.');
    });
  }
  function recoveryFile() {
    const remote = current.current?.remote; if (!remote) return;
    download(new Blob([JSON.stringify({ format: 'linen-owner-key', version: 1, handle: remote.handle, ownerKey: remote.ownerKey }, null, 2)], { type: 'application/json' }), `linen-${remote.handle}-recovery.json`);
    setNotice('Recovery key downloaded. Keep this file private.');
  }
  async function cloudAction(action: 'unpublish' | 'preview' | 'revoke' | 'delete') {
    const remote = current.current?.remote; if (!remote || remote.revision === 0) return;
    if (action === 'delete' && !window.confirm('Delete this cloud page and its uploads? Your local draft stays here. This cannot be undone.')) return;
    await run('Updating your page…', async () => {
      const base = `/api/profiles/${remote.handle}`;
      if (action === 'preview') { const result = await request<{ url: string }>(`${base}/preview`, 'POST', {}, remote.ownerKey); setPreviewUrl(result.url); setNotice('Private preview ready. It shows the saved cloud draft.'); }
      else if (action === 'revoke') { await request(`${base}/preview`, 'DELETE', {}, remote.ownerKey); setPreviewUrl(''); setNotice('Previous private preview links are revoked.'); }
      else if (action === 'unpublish') { const result = await request<OwnerSnapshot>(`${base}/publish`, 'DELETE', {}, remote.ownerKey); bindingChanged({ ...remote, revision: result.revision, publishedRevision: result.publishedRevision }); setNotice('Public page unpublished. Your draft and recovery key remain available.'); }
      else { await request(base, 'DELETE', { confirm: true }, remote.ownerKey); store({ ...current.current!, page: { ...current.current!.page, id: crypto.randomUUID(), handle: '' }, remote: null, updatedAt: Date.now() }); setPreviewUrl(''); setHistory([]); setFuture([]); setNotice('Cloud page deleted. Your local content remains; choose a new handle to publish again.'); }
      await saveWorkspace(current.current!);
    });
  }
  async function cleanupMedia() {
    if (!current.current) return;
    await run('Making a little room…', async () => {
      const persisted = await loadWorkspace();
      const keep = new Set([...assetIds(current.current!.page), ...(persisted ? assetIds(persisted.page) : []), ...history.flatMap(assetIds), ...future.flatMap(assetIds)]), unused = (await listMedia()).filter(file => !keep.has(file.id));
      if (!unused.length) { setNotice('All local files are still used by this draft or its undo history.'); return; }
      if (!window.confirm(`Remove ${unused.length} unused local files? Cloud uploads are unchanged.`)) return;
      for (const file of unused) await deleteMedia(file.id);
      setNotice('Unused local files removed.');
    });
  }

  if (!workspace) return <main className="loading-screen"><span className="wordmark">linen<span>•</span></span><p>Opening your little corner…</p></main>;
  const page = workspace.page, card = page.cards.find(item => item.id === selected) || null, remote = workspace.remote;
  const desktop = packCards(page.cards, 4), mobile = packCards(page.cards, 2);
  const inspector = <Inspector page={page} card={card} busy={!!busy} handleLocked={!!remote} onPage={patchPage} onCard={patch => { if (selected) patchCard(selected, patch); }} onUpload={chooseUpload} onDelete={() => { if (selected && patchPage({ cards: page.cards.filter(item => item.id !== selected) })) setSelected(null); }} onMove={delta => { if (selected) move(selected, delta); }} onDuplicate={duplicate} onMetadata={() => void metadata()} onClose={() => setInspectorOpen(false)}/>;

  return <NoticeContext.Provider value={notice}><div className="editor-shell">
    <a href="#page-canvas" className="skip-link">Skip to your page</a>
    <header className="editor-header"><a href="/" className="wordmark" aria-label="Linen editor">linen<span>•</span></a><span className="header-divider"/><span className="workspace-title">Your little corner</span><span className="save-status" role="status">{busy || localStatus}</span><div className="header-actions"><button type="button" className="quiet-button" disabled={!!busy} onClick={() => setModal('files')}>Your files ↗</button><button type="button" className="primary-button" disabled={!!busy} onClick={() => setModal('publish')}>Publish <span aria-hidden="true">↗</span></button></div></header>
    <div className="editor-main"><aside className="tool-rail" aria-label="Editor tools"><button type="button" className="rail-button active" aria-label="Add a card" disabled={!!busy} onClick={() => setModal('add')}>＋</button><button type="button" className="rail-button" aria-label="Edit profile and appearance" onClick={() => { setSelected(null); setInspectorOpen(true); }}>◐</button><div className="rail-spacer"/><button type="button" className="rail-button" aria-label="Undo" disabled={!history.length || !!busy} onClick={undo}>↶</button><button type="button" className="rail-button" aria-label="Redo" disabled={!future.length || !!busy} onClick={redo}>↷</button><a className="rail-button" href="https://github.com/alvarovillalbaa/linen" target="_blank" rel="noopener noreferrer" aria-label="Open Linen source">⌘</a></aside>
      <main className="canvas-area" id="page-canvas"><div className="canvas-tools"><div className="segmented" role="group" aria-label="Page width"><button type="button" aria-pressed={screen === 'desktop'} onClick={() => setScreen('desktop')}>Desktop</button><button type="button" aria-pressed={screen === 'mobile'} onClick={() => setScreen('mobile')}>Mobile</button></div><button type="button" className="preview-button" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Back to editing' : 'Preview page'} <span aria-hidden="true">↗</span></button></div>
        <div className={`page-frame ${screen} ${preview ? 'viewing' : 'editing'}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); if (event.dataTransfer.files.length !== 1) { setNotice('Drop one image or video at a time.'); return; } uploadTarget.current = 'new'; void acceptMedia(event.dataTransfer.files[0]); }}>
          <div className="linen-page" data-theme={page.theme} data-font={page.font} style={{ '--ln-accent': /^#[\da-f]{6}$/i.test(page.accent) ? page.accent : '#315b4b' } as CSSProperties}>
            <header className="ln-header"><button type="button" className="ln-avatar avatar-edit" aria-label="Change profile photo" disabled={preview || !!busy} onClick={() => chooseUpload('avatar')}>{mediaUrls[page.avatarId] ? <img src={mediaUrls[page.avatarId]} alt="Profile photo"/> : <span>{page.name.slice(0, 1) || '＋'}</span>}</button>
              <Editable className="ln-name" label="Your name" value={page.name} placeholder="Your name, your space." disabled={preview || !!busy} onChange={value => patchPage({ name: value })}/>
              <Editable className="ln-bio" label="About you" value={page.bio} placeholder="A few words about you. What do you make? What makes you, you?" multiline disabled={preview || !!busy} onChange={value => patchPage({ bio: value })}/>
              {page.location && <span className="ln-location">⌖ {page.location}</span>}
            </header>
            {page.cards.length ? <section className="ln-grid" aria-label="Your cards">{page.cards.map((item, index) => {
              const d = desktop.find(position => position.id === item.id)!, m = mobile.find(position => position.id === item.id)!;
              const style = { '--ln-dc': d.column, '--ln-dr': d.row, '--ln-dw': d.columns, '--ln-dh': d.rows, '--ln-mc': m.column, '--ln-mr': m.row, '--ln-mw': m.columns, '--ln-mh': m.rows } as CSSProperties;
              return <article key={item.id} data-card-id={item.id} data-kind={item.kind} style={style} className={`ln-card ${selected === item.id && !preview ? 'selected' : ''} ${dragging === item.id ? 'dragging' : ''} ${item.kind === 'link' && (mediaUrls[item.mediaId] || safeImageUrl(item.coverUrl)) ? 'ln-with-cover' : ''}`} onClick={event => { if (!preview && !(event.target as HTMLElement).isContentEditable) { event.preventDefault(); setSelected(item.id); setInspectorOpen(true); } }}>
                <div className="ln-content">{!preview && (item.kind === 'text' || item.kind === 'section') ? item.kind === 'section' ? <Editable className="ln-section" value={item.title} label="Section heading" placeholder="A new chapter" disabled={!!busy} onChange={value => patchCard(item.id, { title: value })}/> : <div className="ln-text">{item.title && <div className="ln-text-title">{item.title}</div>}<Editable className="inline-note" value={item.text} label="Note text" placeholder="A thought, a note, a little about you." multiline disabled={!!busy} onChange={value => patchCard(item.id, { text: value })}/></div> : <div className="rendered-card" inert={!preview} dangerouslySetInnerHTML={{ __html: renderCard(item, mediaUrls) }}/>}</div>
                {!preview && <div className="card-controls"><button type="button" className="drag-grip" disabled={!!busy} aria-label={`Move ${item.title || item.kind} card. Use arrow keys to reorder.`} title="Drag, or use arrow keys" onClick={event => event.stopPropagation()} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); move(item.id, event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -2 : 2); } }} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSelected(item.id); setDragging(item.id); dragTarget.current = null; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (dragging !== item.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-card-id]')?.dataset.cardId; if (!target || target === item.id || target === dragTarget.current || !current.current) return; dragTarget.current = target; applyPage(moveCard(current.current.page, item.id, current.current.page.cards.findIndex(entry => entry.id === target))); }} onPointerUp={event => { setDragging(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => setDragging(null)}>⠿</button><button type="button" aria-label={`Edit ${item.title || item.kind} card`} disabled={!!busy} onClick={event => { event.stopPropagation(); setSelected(item.id); setInspectorOpen(true); }}>✎</button><span className="card-count">{index + 1}</span></div>}
              </article>;
            })}</section> : <button type="button" className="empty-canvas" disabled={!!busy || preview} onClick={() => setModal('add')}><span className="empty-grid" aria-hidden="true"><i/><i/><i/><i/></span><strong>Everything you do.<br/>A little place for it.</strong><span>Add your first card. A link, a thought,<br/>something you’re proud of.</span><b>＋ Add a card</b></button>}
            {!preview && page.cards.length > 0 && <button type="button" className="add-below" disabled={!!busy || page.cards.length >= LIMITS.cards} onClick={() => setModal('add')}>＋ Add something good</button>}
            <footer className="ln-footer"><span>Made with <strong>linen</strong> ↗</span><span>Your space. Your pace.</span></footer>
          </div>
        </div><p className="canvas-hint">{preview ? 'This is a local preview. Publish to make a public page.' : 'Click to edit. Drag the dots to rearrange. Make it yours.'}</p>
      </main>{!narrow && inspector}</div>
    {notice && !modal && !(narrow && inspectorOpen) && <div className="editor-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}>×</button></div>}
    {!storageEnabled && <div className="storage-banner">This draft is in memory only. <button type="button" onClick={() => void run('Retrying local save…', async () => { if (!window.confirm('Save this in-memory draft over the current Linen local draft? Export first if you need both.')) return; await saveWorkspace(current.current!); setStorageEnabled(true); setNotice('Local saving is available again.'); })}>Retry saving</button></div>}
    <input ref={fileInput} type="file" hidden aria-label="Add a profile file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void acceptMedia(file); }}/>
    <input ref={backupInput} type="file" hidden accept=".zip" aria-label="Import a Linen backup" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importProject(file); }}/>
    <input ref={recoveryInput} type="file" hidden accept="application/json,.json" aria-label="Read a recovery key file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 4096) { setNotice('This recovery file is too large.'); return; } void file.text().then(text => { const value = JSON.parse(text); if (!value || value.format !== 'linen-owner-key' || value.version !== 1 || typeof value.handle !== 'string' || typeof value.ownerKey !== 'string') throw new Error('Choose a Linen recovery key file.'); setRecoverHandle(value.handle); setRecoverKey(value.ownerKey); }).catch(error => setNotice(message(error))); }}/>
    {narrow && inspectorOpen && !modal && <Modal title={card ? 'Make it yours' : 'Your profile'} onClose={() => setInspectorOpen(false)}>{inspector}</Modal>}
    {modal === 'add' && <Modal title="A little bit of you." onClose={() => setModal(null)}><p className="dialog-copy">Pick a card. There’s room for all the things you do.</p><div className="add-options">{kinds.map(item => <button type="button" key={item.kind} disabled={!!busy || page.cards.length >= LIMITS.cards} onClick={() => addCard(item.kind)}><span className="type-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span aria-hidden="true">↗</span></button>)}</div><p className="hint">Or drop one image or video onto your page. Up to 32 cards.</p></Modal>}
    {modal === 'publish' && <Modal title="Give your page a home." busy={!!busy} onClose={() => setModal(null)}><p className="dialog-copy">A public address that stays yours as your work grows.</p><label className="field">Your public handle<div className="handle-input"><span>@</span><input value={page.handle} disabled={!!remote || !!busy} maxLength={30} autoCapitalize="none" spellCheck={false} placeholder="your-name" onChange={event => patchPage({ handle: normalizeHandle(event.target.value) })}/></div></label>{!configured && <p className="setup-note">Publishing is not configured on this installation yet. Your local editor, backup and static website export are available.</p>}{remote && <div className="cloud-summary"><strong>@{remote.handle}</strong><span>{remote.publishedRevision === null ? 'No published version' : `Last published: revision ${remote.publishedRevision}`}</span><button type="button" className="text-button" disabled={!!busy} onClick={recoveryFile}>Download private recovery key ↗</button></div>}<div className="publish-actions"><button type="button" className="primary-button" disabled={!configured || !!busy} onClick={() => void saveCloud(true)}>{busy || (remote?.publishedRevision ? 'Publish changes' : 'Publish page')} ↗</button><button type="button" className="secondary-button" disabled={!configured || !!busy} onClick={() => void saveCloud(false)}>Save cloud draft</button></div><p className="hint">Published pages and their media are public. Local edits become public only when you publish.</p>{remote?.publishedRevision !== null && remote?.publishedRevision !== undefined && <a className="public-url" href={`/@${remote.handle}`} target="_blank" rel="noopener noreferrer">Open /@{remote.handle} ↗</a>}{remote && remote.revision > 0 && <div className="cloud-controls"><button type="button" disabled={!!busy} onClick={() => void cloudAction('preview')}>Create private preview</button><button type="button" disabled={!!busy} onClick={() => void cloudAction('revoke')}>Revoke preview links</button><button type="button" disabled={!!busy || remote.publishedRevision === null} onClick={() => void cloudAction('unpublish')}>Unpublish public page</button><button type="button" className="danger-link" disabled={!!busy} onClick={() => void cloudAction('delete')}>Delete cloud page</button></div>}{previewUrl && <div className="field"><label htmlFor="preview-link">Private preview link</label><input id="preview-link" readOnly value={previewUrl}/><button type="button" className="text-button" onClick={() => void navigator.clipboard.writeText(previewUrl).then(() => setNotice('Private preview link copied.')).catch(() => setNotice('Select the preview link to copy it.'))}>Copy preview link</button></div>}<button type="button" className="text-button" disabled={!!busy} onClick={() => { setModal('recover'); setRecoverHandle(remote?.handle || ''); }}>Already have a page? Recover it ↗</button></Modal>}
    {modal === 'files' && <Modal title="Yours to keep." busy={!!busy} onClose={() => setModal(null)}><p className="dialog-copy">Take your page with you. No editing credentials are included in the public files.</p><div className="file-actions"><button type="button" disabled={!!busy} onClick={() => void run('Packing your backup…', async () => { const page = current.current!.page; download(await exportBackup(page, await filesFor(page)), 'linen-backup.zip'); setNotice('Page backup downloaded. Keep your recovery key separately.'); })}><strong>Download page backup ↗</strong><span>Page data and uploaded files. Ready to restore in Linen.</span></button><button type="button" disabled={!!busy} onClick={() => void run('Packing your website…', async () => { const page = current.current!.page; download(await exportSite(page, await filesFor(page)), 'linen-site.zip'); setNotice('Static website downloaded. Upload its contents to a static host.'); })}><strong>Export static website ↗</strong><span>A portable index.html and your files. Links and embeds still need the internet.</span></button><button type="button" disabled={!!busy} onClick={() => backupInput.current?.click()}><strong>Import a page backup ↙</strong><span>Validate first, then confirm replacement. Nothing publishes automatically.</span></button>{remote && <button type="button" disabled={!!busy} onClick={recoveryFile}><strong>Download private recovery key ↗</strong><span>Anyone with this file can edit your cloud page. Keep it private.</span></button>}</div><button type="button" className="text-button" disabled={!!busy} onClick={() => void cleanupMedia()}>Remove unused local files</button></Modal>}
    {modal === 'recover' && <Modal title="Welcome back." busy={!!busy} onClose={() => setModal(null)}><p className="dialog-copy">Use the handle and private recovery key for your page. There is no email account to reset.</p><form onSubmit={event => { event.preventDefault(); void recover(); }}><label className="field">Page handle<input value={recoverHandle} onChange={event => setRecoverHandle(event.target.value)} disabled={!!busy} autoCapitalize="none" spellCheck={false} required/></label><label className="field">Private recovery key<input type="password" value={recoverKey} onChange={event => setRecoverKey(event.target.value)} disabled={!!busy} autoComplete="off" required/></label><button type="button" className="text-button" disabled={!!busy} onClick={() => recoveryInput.current?.click()}>Read a recovery key file ↙</button><button type="submit" className="primary-button" disabled={!!busy || !configured}>{busy || 'Load my cloud page'} ↗</button></form><p className="hint">If every copy of the owner key is lost, this installation cannot recover the page for you.</p></Modal>}
  </div></NoticeContext.Provider>;
}
