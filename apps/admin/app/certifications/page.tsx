'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type TaxonomyAdminCategory } from '@/lib/api-client';
import { Button, Spinner } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import { CERT_LEVELS } from '@cotailor/shared';
import './certifications.css';

type AdminCert = Awaited<ReturnType<typeof api.admin.certifications.list>>[number];
type CertTodo = Awaited<ReturnType<typeof api.admin.certifications.todos>>[number];

interface EditorState {
  id: string | null;
  name: string;
  issuer: string;
  level: string;
  subtypes: string[]; // tagged subtype names; categories derive from these
  aliases: string;
  enabled: boolean;
}

const blankEditor = (seed?: Partial<EditorState>): EditorState => ({
  id: null,
  name: '',
  issuer: '',
  level: '',
  subtypes: [],
  aliases: '',
  enabled: true,
  ...seed,
});

export default function AdminCertifications() {
  const [certs, setCerts] = useState<AdminCert[] | null>(null);
  const [todos, setTodos] = useState<CertTodo[]>([]);
  const [tree, setTree] = useState<TaxonomyAdminCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminCert | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  // Load independently so a taxonomy hiccup can never blank the cert list.
  const reload = () => {
    setError(null);
    api.admin.certifications.todos('open').then(setTodos).catch(() => {});
    api.taxonomy.adminTree().then(setTree).catch(() => setTree([]));
    return api.admin.certifications
      .list()
      .then(setCerts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load certifications'));
  };

  useEffect(() => {
    reload();
  }, []);

  // subtype name → its category (for deriving a cert's categories on save).
  const subtypeToCategory = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of tree) {
      for (const f of c.families ?? []) for (const s of f.subtypes ?? []) m.set(s.name, c.name);
      for (const s of c.subtypes ?? []) m.set(s.name, c.name);
    }
    return m;
  }, [tree]);

  const derivedCategories = (subs: string[]) =>
    Array.from(new Set(subs.map((s) => subtypeToCategory.get(s)).filter((x): x is string => !!x)));

  const openEditor = (c?: AdminCert) =>
    setEditor(
      c
        ? {
            id: c.id,
            name: c.name,
            issuer: c.issuer,
            level: c.level ?? '',
            subtypes: c.subtypes,
            aliases: c.aliases.join(', '),
            enabled: c.enabled,
          }
        : blankEditor(),
    );

  const toggleSubtype = (s: string) =>
    setEditor((prev) =>
      prev
        ? { ...prev, subtypes: prev.subtypes.includes(s) ? prev.subtypes.filter((x) => x !== s) : [...prev.subtypes, s] }
        : prev,
    );

  const toggleFamily = (names: string[]) =>
    setEditor((prev) => {
      if (!prev) return prev;
      const allOn = names.length > 0 && names.every((n) => prev.subtypes.includes(n));
      const set = new Set(prev.subtypes);
      names.forEach((n) => (allOn ? set.delete(n) : set.add(n)));
      return { ...prev, subtypes: [...set] };
    });

  const saveEditor = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const aliases = editor.aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const categories = derivedCategories(editor.subtypes);
    try {
      if (editor.id === null) {
        await api.admin.certifications.create({
          name: editor.name.trim(),
          issuer: editor.issuer.trim(),
          level: editor.level.trim() || undefined,
          categories,
          subtypes: editor.subtypes,
          aliases,
          enabled: editor.enabled,
        });
      } else {
        await api.admin.certifications.update(editor.id, {
          name: editor.name.trim(),
          issuer: editor.issuer.trim(),
          level: editor.level.trim() || null,
          categories,
          subtypes: editor.subtypes,
          aliases,
          enabled: editor.enabled,
        });
      }
      setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (c: AdminCert) => {
    setBusy(true);
    setError(null);
    try {
      await api.admin.certifications.update(c.id, { enabled: !c.enabled });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (c: AdminCert) => {
    setBusy(true);
    setError(null);
    try {
      await api.admin.certifications.delete(c.id);
      if (editor?.id === c.id) setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const resolveTodo = async (id: string, status: 'done' | 'dismissed') => {
    setBusy(true);
    try {
      await api.admin.certifications.resolveTodo(id, status);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const addFromTodo = (t: CertTodo) =>
    setEditor(blankEditor({ name: t.rawText, issuer: t.issuer ?? '', subtypes: t.subtype ? [t.subtype] : [] }));

  if (!certs) return <Spinner text="Loading certifications..." />;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? certs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.issuer.toLowerCase().includes(q) ||
          c.aliases.some((a) => a.toLowerCase().includes(q)),
      )
    : certs;

  // All subtype names in the taxonomy → used to detect "untagged" certs.
  const allSubtypeNames = new Set<string>();
  for (const c of tree) {
    for (const f of c.families ?? []) for (const s of f.subtypes ?? []) allSubtypeNames.add(s.name);
    for (const s of c.subtypes ?? []) allSubtypeNames.add(s.name);
  }
  // Certs whose subtypes include any of the given subtype names.
  const certsFor = (names: string[]) => {
    const set = new Set(names);
    return filtered.filter((c) => c.subtypes.some((s) => set.has(s)));
  };
  const untagged = filtered.filter((c) => !c.subtypes.some((s) => allSubtypeNames.has(s)));

  const renderRow = (c: AdminCert) => (
    <div key={c.id} className={`cert-row ${editor?.id === c.id ? 'editing' : ''}`}>
      <div className="cert-row-main">
        <div className="cert-row-title">
          <strong>{c.name}</strong>
          <span className="admin-muted">{c.issuer}</span>
          {c.level && <span className="cert-level">{c.level}</span>}
          {!c.enabled && <span className="status-badge suspended">disabled</span>}
        </div>
        <div className="cert-subtypes">
          {c.subtypes.length ? (
            c.subtypes.map((s) => (
              <span key={s} className="cert-chip">
                {s}
              </span>
            ))
          ) : (
            <span className="admin-muted">no subtypes</span>
          )}
        </div>
      </div>
      <div className="cert-row-actions">
        <button type="button" onClick={() => openEditor(c)} disabled={busy}>
          Edit
        </button>
        <button type="button" onClick={() => toggleEnabled(c)} disabled={busy}>
          {c.enabled ? 'Disable' : 'Enable'}
        </button>
        <button type="button" className="danger" onClick={() => setDeleteTarget(c)} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="certs-page">
      <div className="certs-header">
        <h1>Certifications</h1>
        <button className="cert-create-action" onClick={() => openEditor()} disabled={busy} type="button">
          + New certification
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {todos.length > 0 && (
        <div className="cert-todos">
          <div className="cert-todos-title">
            To-do — {todos.length} cert{todos.length === 1 ? '' : 's'} users couldn&apos;t find
          </div>
          {todos.map((t) => (
            <div key={t.id} className="cert-todo-row">
              <div className="cert-todo-main">
                <strong>{t.rawText}</strong>
                <span className="admin-muted">
                  {[t.issuer, t.category, t.subtype].filter(Boolean).join(' · ') || 'no details'}
                </span>
              </div>
              <div className="cert-todo-actions">
                <button type="button" onClick={() => addFromTodo(t)} disabled={busy}>
                  Add to catalog
                </button>
                <button type="button" onClick={() => resolveTodo(t.id, 'done')} disabled={busy}>
                  Mark done
                </button>
                <button type="button" onClick={() => resolveTodo(t.id, 'dismissed')} disabled={busy}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="certs-toolbar">
        <input
          type="search"
          placeholder="Search name, issuer, or alias…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="certs-search"
        />
        <span className="admin-muted">
          {filtered.length} of {certs.length}
        </span>
      </div>

      {/* Mirror the taxonomy tree: Category → Family → certifications. */}
      <div className="certs-list">
        {tree.map((cat) => {
          const catOpen = q ? true : !collapsed.has(cat.id);
          const families = (cat.families ?? []).map((f) => ({ f, certs: certsFor((f.subtypes ?? []).map((s) => s.name)) }));
          const ungrouped = certsFor((cat.subtypes ?? []).map((s) => s.name));
          const catCount = new Set([...families.flatMap((x) => x.certs), ...ungrouped].map((c) => c.id)).size;
          return (
            <div key={cat.id} className="ctree-cat">
              <button type="button" className="ctree-head" onClick={() => toggleCollapse(cat.id)}>
                <span className={`chev ${catOpen ? 'open' : ''}`}>▶</span>
                <strong>{cat.name}</strong>
                <span className="count">{catCount}</span>
              </button>
              {catOpen && (
                <div className="ctree-body">
                  {families.map(({ f, certs: fcerts }) => {
                    const fkey = `${cat.id}:${f.id}`;
                    const famOpen = q ? true : !collapsed.has(fkey);
                    return (
                      <div key={f.id} className="ctree-fam">
                        <button type="button" className="ctree-subhead" onClick={() => toggleCollapse(fkey)}>
                          <span className={`chev ${famOpen ? 'open' : ''}`}>▶</span>
                          {f.name}
                          <span className="count">{fcerts.length}</span>
                        </button>
                        {famOpen && (
                          <div className="ctree-rows">
                            {fcerts.length ? (
                              fcerts.map(renderRow)
                            ) : (
                              <div className="admin-muted certs-empty">No certifications yet</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ungrouped.length > 0 && (
                    <div className="ctree-fam">
                      <div className="ctree-subhead muted">
                        Ungrouped <span className="count">{ungrouped.length}</span>
                      </div>
                      <div className="ctree-rows">{ungrouped.map(renderRow)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {untagged.length > 0 && (
          <div className="ctree-cat">
            <div className="ctree-head muted">
              Untagged <span className="count">{untagged.length}</span>
            </div>
            <div className="ctree-body">
              <div className="ctree-rows">{untagged.map(renderRow)}</div>
            </div>
          </div>
        )}

        {/* Fallback if the taxonomy is unavailable — still show every cert. */}
        {tree.length === 0 && filtered.length > 0 && (
          <div className="ctree-cat">
            <div className="ctree-head muted">
              All certifications <span className="count">{filtered.length}</span>
            </div>
            <div className="ctree-body">
              <div className="ctree-rows">{filtered.map(renderRow)}</div>
            </div>
          </div>
        )}

        {filtered.length === 0 && <div className="admin-muted certs-empty">No certifications match.</div>}
      </div>

      {editor && (
        <div className="cert-editor">
          <h2 className="admin-section-title">{editor.id === null ? 'New certification' : `Edit "${editor.name}"`}</h2>
          <div className="cert-editor-grid">
            <div className="ce-field">
              <label>Name</label>
              <input
                type="text"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="e.g. AWS Certified Solutions Architect - Associate"
                disabled={busy}
              />
            </div>
            <div className="ce-field">
              <label>Issuer</label>
              <input
                type="text"
                value={editor.issuer}
                onChange={(e) => setEditor({ ...editor, issuer: e.target.value })}
                placeholder="e.g. AWS"
                disabled={busy}
              />
            </div>
            <div className="ce-field">
              <label>Level</label>
              <select value={editor.level} onChange={(e) => setEditor({ ...editor, level: e.target.value })} disabled={busy}>
                <option value="">—</option>
                {CERT_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="ce-field ce-field-wide">
              <label>Applies to — tick subtypes (or a whole family). Categories follow automatically.</label>
              <div className="ce-tax">
                {tree.map((cat) => (
                  <div key={cat.id} className="ce-tax-cat-block">
                    <div className="ce-tax-cat">{cat.name}</div>
                    {(cat.families ?? []).map((fam) => {
                      const names = (fam.subtypes ?? []).map((s) => s.name);
                      const allOn = names.length > 0 && names.every((n) => editor.subtypes.includes(n));
                      return (
                        <div key={fam.id} className="ce-tax-fam-block">
                          <label className={`ce-tax-fam ${allOn ? 'on' : ''}`}>
                            <input type="checkbox" checked={allOn} onChange={() => toggleFamily(names)} disabled={busy} />
                            {fam.name}
                          </label>
                          <div className="ce-subtypes">
                            {(fam.subtypes ?? []).map((s) => (
                              <label key={s.id} className={`ce-subtype ${editor.subtypes.includes(s.name) ? 'on' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={editor.subtypes.includes(s.name)}
                                  onChange={() => toggleSubtype(s.name)}
                                  disabled={busy}
                                />
                                {s.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {(cat.subtypes ?? []).length > 0 && (
                      <div className="ce-tax-fam-block">
                        <div className="ce-tax-fam muted">Ungrouped</div>
                        <div className="ce-subtypes">
                          {(cat.subtypes ?? []).map((s) => (
                            <label key={s.id} className={`ce-subtype ${editor.subtypes.includes(s.name) ? 'on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={editor.subtypes.includes(s.name)}
                                onChange={() => toggleSubtype(s.name)}
                                disabled={busy}
                              />
                              {s.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {editor.subtypes.length > 0 && (
                <p className="ce-derived">Categories: {derivedCategories(editor.subtypes).join(', ') || '—'}</p>
              )}
            </div>

            <div className="ce-field ce-field-wide">
              <label>Aliases / nicknames (comma-separated — used for matching)</label>
              <input
                type="text"
                value={editor.aliases}
                onChange={(e) => setEditor({ ...editor, aliases: e.target.value })}
                placeholder="e.g. AWS SAA, SAA-C03"
                disabled={busy}
              />
            </div>
            <div className="ce-field ce-check">
              <label>
                <input
                  type="checkbox"
                  checked={editor.enabled}
                  onChange={(e) => setEditor({ ...editor, enabled: e.target.checked })}
                  disabled={busy}
                />{' '}
                Enabled (offered to the AI and the profile picker)
              </label>
            </div>
          </div>
          <div className="ce-actions">
            <Button
              variant="primary"
              onClick={saveEditor}
              disabled={busy || !editor.name.trim() || !editor.issuer.trim() || editor.subtypes.length === 0}
            >
              {busy ? 'Saving…' : editor.id === null ? 'Create certification' : 'Save changes'}
            </Button>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete certification?"
        message="This removes it from the catalog. Profiles that already picked it keep their copy."
        itemName={deleteTarget?.name}
        isDangerous
        confirmText="Delete"
        onConfirm={() => deleteTarget && doDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
