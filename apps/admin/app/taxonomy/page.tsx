'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type TaxonomyAdminCategory, type TaxonomySubtypeRow } from '@/lib/api-client';
import './console.css';

type Editing = { kind: 'cat' | 'fam' | 'sub'; id: string; value: string } | null;
type DragRef =
  | { kind: 'cat'; index: number }
  | { kind: 'fam'; catId: string; index: number }
  | { kind: 'sub'; catId: string; familyId: string | null; index: number }
  | null;

function Toggle({
  checked,
  onClick,
  disabled,
  sm,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  sm?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`toggle ${sm ? 'sm' : ''} ${checked ? 'on' : ''}`}
      onClick={onClick}
      title={checked ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <span className="knob" />
    </button>
  );
}

export default function TaxonomyConsole() {
  const [tree, setTree] = useState<TaxonomyAdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newFam, setNewFam] = useState<Record<string, string>>({}); // by categoryId
  const [newSub, setNewSub] = useState<Record<string, string>>({}); // by bucket key
  const [editing, setEditing] = useState<Editing>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [drag, setDrag] = useState<DragRef>(null);
  const [over, setOver] = useState<DragRef>(null);

  const bkey = (catId: string, famId: string | null) => `${catId}:${famId ?? '_'}`;

  const reload = () =>
    api.taxonomy
      .adminTree()
      .then(setTree)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load taxonomy'));

  useEffect(() => {
    reload();
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    run(() => api.taxonomy.createCategory({ name })).then(() => setNewCat(''));
  };
  const addFamily = (categoryId: string) => {
    const name = (newFam[categoryId] ?? '').trim();
    if (!name) return;
    run(() => api.taxonomy.createFamily({ categoryId, name })).then(() =>
      setNewFam((m) => ({ ...m, [categoryId]: '' })),
    );
  };
  const addSubtype = (categoryId: string, familyId: string | null) => {
    const key = bkey(categoryId, familyId);
    const name = (newSub[key] ?? '').trim();
    if (!name) return;
    run(() => api.taxonomy.createSubtype({ categoryId, familyId: familyId ?? undefined, name })).then(() =>
      setNewSub((m) => ({ ...m, [key]: '' })),
    );
  };
  const saveEdit = () => {
    if (!editing) return;
    const value = editing.value.trim();
    const { kind, id } = editing;
    setEditing(null);
    if (!value) return;
    run(() =>
      kind === 'cat'
        ? api.taxonomy.updateCategory(id, { name: value })
        : kind === 'fam'
          ? api.taxonomy.updateFamily(id, { name: value })
          : api.taxonomy.updateSubtype(id, { name: value }),
    );
  };
  const toggleCollapse = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const moveSubtype = (sub: TaxonomySubtypeRow, value: string) => {
    if (value === 'ungroup') run(() => api.taxonomy.updateSubtype(sub.id, { familyId: null }));
    else if (value.startsWith('fam:')) run(() => api.taxonomy.updateSubtype(sub.id, { familyId: value.slice(4) }));
    else if (value.startsWith('cat:')) run(() => api.taxonomy.updateSubtype(sub.id, { categoryId: value.slice(4) }));
  };

  const persistOrder = (items: Array<{ id: string }>, kind: 'cat' | 'fam' | 'sub') => {
    const upd =
      kind === 'cat' ? api.taxonomy.updateCategory : kind === 'fam' ? api.taxonomy.updateFamily : api.taxonomy.updateSubtype;
    run(() => Promise.all(items.map((it, i) => upd(it.id, { sortOrder: (i + 1) * 10 }))));
  };

  const onCatDrop = (targetIdx: number) => {
    if (tree && drag?.kind === 'cat' && drag.index !== targetIdx) {
      const arr = [...tree];
      const [m] = arr.splice(drag.index, 1);
      arr.splice(targetIdx, 0, m);
      setTree(arr);
      persistOrder(arr, 'cat');
    }
    setDrag(null);
    setOver(null);
  };
  const onFamDrop = (catId: string, targetIdx: number) => {
    if (tree && drag?.kind === 'fam' && drag.catId === catId && drag.index !== targetIdx) {
      const cat = tree.find((c) => c.id === catId);
      if (cat) {
        const arr = [...cat.families];
        const [m] = arr.splice(drag.index, 1);
        arr.splice(targetIdx, 0, m);
        setTree(tree.map((c) => (c.id === catId ? { ...c, families: arr } : c)));
        persistOrder(arr, 'fam');
      }
    }
    setDrag(null);
    setOver(null);
  };
  const onSubDrop = (catId: string, familyId: string | null, targetIdx: number) => {
    if (tree && drag?.kind === 'sub' && drag.catId === catId && drag.familyId === familyId && drag.index !== targetIdx) {
      const cat = tree.find((c) => c.id === catId);
      if (cat) {
        const list = familyId ? (cat.families.find((f) => f.id === familyId)?.subtypes ?? []) : cat.subtypes;
        const arr = [...list];
        const [m] = arr.splice(drag.index, 1);
        arr.splice(targetIdx, 0, m);
        setTree(
          tree.map((c) =>
            c.id !== catId
              ? c
              : {
                  ...c,
                  families: familyId ? c.families.map((f) => (f.id === familyId ? { ...f, subtypes: arr } : f)) : c.families,
                  subtypes: familyId ? c.subtypes : arr,
                },
          ),
        );
        persistOrder(arr, 'sub');
      }
    }
    setDrag(null);
    setOver(null);
  };

  const q = search.trim().toLowerCase();
  const view = useMemo(() => {
    if (!tree) return [];
    if (!q) return tree;
    return tree
      .map((c) => {
        if (c.name.toLowerCase().includes(q)) return c;
        const families = (c.families ?? [])
          .map((f) => {
            const famMatch = f.name.toLowerCase().includes(q);
            const subtypes = famMatch ? f.subtypes : f.subtypes.filter((s) => s.name.toLowerCase().includes(q));
            return famMatch || subtypes.length ? { ...f, subtypes } : null;
          })
          .filter((f): f is TaxonomyAdminCategory['families'][number] => f !== null);
        const subtypes = (c.subtypes ?? []).filter((s) => s.name.toLowerCase().includes(q));
        return families.length || subtypes.length ? { ...c, families, subtypes } : null;
      })
      .filter((c): c is TaxonomyAdminCategory => c !== null);
  }, [tree, q]);

  if (!tree) return <div className="center-msg">Loading taxonomy…</div>;

  const editInput = (val: string) => (
    <input
      className="edit-input"
      autoFocus
      value={val}
      onChange={(e) => editing && setEditing({ ...editing, value: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') setEditing(null);
      }}
      onBlur={saveEdit}
      disabled={busy}
    />
  );

  const renderSubtype = (cat: TaxonomyAdminCategory, familyId: string | null, sub: TaxonomySubtypeRow, si: number) => {
    const isEdit = editing?.kind === 'sub' && editing.id === sub.id;
    const dragging = drag?.kind === 'sub' && drag.catId === cat.id && drag.familyId === familyId && drag.index === si;
    const isOver = over?.kind === 'sub' && over.catId === cat.id && over.familyId === familyId && over.index === si;
    return (
      <div
        key={sub.id}
        className={`sub ${sub.enabled ? '' : 'off'} ${dragging ? 'dragging' : ''} ${isOver ? 'drop-before' : ''}`}
        draggable={!q && !isEdit}
        onDragStart={(e) => {
          if (q || isEdit) return;
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', sub.id);
          setDrag({ kind: 'sub', catId: cat.id, familyId, index: si });
        }}
        onDragOver={(e) => {
          if (drag?.kind === 'sub' && drag.catId === cat.id && drag.familyId === familyId) {
            e.preventDefault();
            setOver({ kind: 'sub', catId: cat.id, familyId, index: si });
          }
        }}
        onDrop={(e) => {
          e.stopPropagation();
          onSubDrop(cat.id, familyId, si);
        }}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
      >
        {!q && <span className="handle" title="Drag to reorder">⠿</span>}
        {isEdit ? (
          editInput(editing!.value)
        ) : (
          <button className="sub-name" onClick={() => setEditing({ kind: 'sub', id: sub.id, value: sub.name })}>
            {sub.name}
          </button>
        )}
        <span className="spacer" />
        <div className="actions">
          <select
            className="move"
            value=""
            title="Move to a family or category"
            disabled={busy}
            onChange={(e) => e.target.value && moveSubtype(sub, e.target.value)}
          >
            <option value="">Move…</option>
            {familyId !== null && <option value="ungroup">Ungroup</option>}
            {(cat.families ?? [])
              .filter((f) => f.id !== familyId)
              .map((f) => (
                <option key={f.id} value={`fam:${f.id}`}>
                  Into “{f.name}”
                </option>
              ))}
            {tree
              .filter((c) => c.id !== cat.id)
              .map((c) => (
                <option key={c.id} value={`cat:${c.id}`}>
                  To “{c.name}”
                </option>
              ))}
          </select>
          <Toggle
            sm
            checked={sub.enabled}
            disabled={busy}
            onClick={() => run(() => api.taxonomy.updateSubtype(sub.id, { enabled: !sub.enabled }))}
          />
          <button
            className="icon-btn danger"
            title="Delete subtype"
            disabled={busy}
            onClick={() => run(() => api.taxonomy.deleteSubtype(sub.id))}
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  const renderBucket = (cat: TaxonomyAdminCategory, familyId: string | null, subs: TaxonomySubtypeRow[]) => {
    const key = bkey(cat.id, familyId);
    return (
      <>
        <div className="sub-list">{subs.map((s, i) => renderSubtype(cat, familyId, s, i))}</div>
        <div className="add-sub">
          <input
            type="text"
            placeholder="Add a subtype…"
            value={newSub[key] ?? ''}
            onChange={(e) => setNewSub((m) => ({ ...m, [key]: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && addSubtype(cat.id, familyId)}
            disabled={busy}
          />
          <button onClick={() => addSubtype(cat.id, familyId)} disabled={busy || !(newSub[key] ?? '').trim()}>
            + Add
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="tx">
      <div className="tx-head">
        <div>
          <h1>Role taxonomy</h1>
          <p className="tx-sub">Category → Family (optional) → Subtype. Drag ⠿ to reorder · click a name to rename.</p>
        </div>
        <input
          className="tx-search"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="err">{error}</div>}

      <div className="tx-add">
        <input
          type="text"
          placeholder="New category name…"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          disabled={busy}
        />
        <button className="btn-primary" onClick={addCategory} disabled={busy || !newCat.trim()}>
          Add category
        </button>
      </div>

      {view.length === 0 && <div className="tx-empty">No categories match “{search}”.</div>}

      {view.map((cat, ci) => {
        const open = q ? true : !collapsed.has(cat.id);
        const catEditing = editing?.kind === 'cat' && editing.id === cat.id;
        const total =
          (cat.families ?? []).reduce((n, f) => n + (f.subtypes ?? []).length, 0) + (cat.subtypes ?? []).length;
        return (
          <section
            key={cat.id}
            className={`cat ${cat.enabled ? '' : 'off'} ${drag?.kind === 'cat' && drag.index === ci ? 'dragging' : ''} ${
              over?.kind === 'cat' && over.index === ci ? 'drop-before' : ''
            }`}
            draggable={!q && !catEditing}
            onDragStart={(e) => {
              if (q || catEditing) return;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', cat.id);
              setDrag({ kind: 'cat', index: ci });
            }}
            onDragOver={(e) => {
              if (drag?.kind === 'cat') {
                e.preventDefault();
                setOver({ kind: 'cat', index: ci });
              }
            }}
            onDrop={() => onCatDrop(ci)}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
          >
            <div className="cat-bar">
              {!q && <span className="handle" title="Drag to reorder">⠿</span>}
              <button className={`chevron ${open ? 'open' : ''}`} onClick={() => toggleCollapse(cat.id)} type="button">
                ▶
              </button>
              {catEditing ? (
                editInput(editing!.value)
              ) : (
                <button className="cat-name" onClick={() => setEditing({ kind: 'cat', id: cat.id, value: cat.name })}>
                  {cat.name}
                </button>
              )}
              <span className="count">{total}</span>
              <span className="spacer" />
              <Toggle
                checked={cat.enabled}
                disabled={busy}
                onClick={() => run(() => api.taxonomy.updateCategory(cat.id, { enabled: !cat.enabled }))}
              />
              <button
                className="icon-btn danger"
                title="Delete category"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete "${cat.name}" and its ${total} subtype(s)?`)) {
                    run(() => api.taxonomy.deleteCategory(cat.id));
                  }
                }}
              >
                ✕
              </button>
            </div>

            {open && (
              <div className="cat-body">
                {(cat.families ?? []).map((fam, fi) => {
                  const famEditing = editing?.kind === 'fam' && editing.id === fam.id;
                  const famDragging = drag?.kind === 'fam' && drag.catId === cat.id && drag.index === fi;
                  const famOver = over?.kind === 'fam' && over.catId === cat.id && over.index === fi;
                  return (
                    <div
                      key={fam.id}
                      className={`fam ${fam.enabled ? '' : 'off'} ${famDragging ? 'dragging' : ''} ${famOver ? 'drop-before' : ''}`}
                      draggable={!q && !famEditing}
                      onDragStart={(e) => {
                        if (q || famEditing) return;
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', fam.id);
                        setDrag({ kind: 'fam', catId: cat.id, index: fi });
                      }}
                      onDragOver={(e) => {
                        if (drag?.kind === 'fam' && drag.catId === cat.id) {
                          e.preventDefault();
                          setOver({ kind: 'fam', catId: cat.id, index: fi });
                        }
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        onFamDrop(cat.id, fi);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                    >
                      <div className="fam-bar">
                        {!q && <span className="handle" title="Drag to reorder">⠿</span>}
                        {famEditing ? (
                          editInput(editing!.value)
                        ) : (
                          <button className="fam-name" onClick={() => setEditing({ kind: 'fam', id: fam.id, value: fam.name })}>
                            {fam.name}
                          </button>
                        )}
                        <span className="count">{fam.subtypes.length}</span>
                        <span className="spacer" />
                        <Toggle
                          sm
                          checked={fam.enabled}
                          disabled={busy}
                          onClick={() => run(() => api.taxonomy.updateFamily(fam.id, { enabled: !fam.enabled }))}
                        />
                        <button
                          className="icon-btn danger"
                          title="Delete family (its subtypes move to ungrouped)"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Delete family "${fam.name}"? Its ${fam.subtypes.length} subtype(s) move to Ungrouped.`)) {
                              run(() => api.taxonomy.deleteFamily(fam.id));
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="fam-body">{renderBucket(cat, fam.id, fam.subtypes)}</div>
                    </div>
                  );
                })}

                {(cat.families ?? []).length > 0 && (cat.subtypes ?? []).length > 0 && (
                  <div className="bucket-label">Ungrouped</div>
                )}
                {renderBucket(cat, null, cat.subtypes ?? [])}

                <div className="add-fam">
                  <input
                    type="text"
                    placeholder="New family (optional grouping)…"
                    value={newFam[cat.id] ?? ''}
                    onChange={(e) => setNewFam((m) => ({ ...m, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addFamily(cat.id)}
                    disabled={busy}
                  />
                  <button onClick={() => addFamily(cat.id)} disabled={busy || !(newFam[cat.id] ?? '').trim()}>
                    + Family
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
