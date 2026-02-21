'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Bookmark = {
  id: number
  title: string
  url: string
  tag?: string | null
  user_id: string
  created_at?: string
  favorite?: boolean
  pinned?: boolean
  is_read?: boolean
  archived?: boolean
}

type ViewFilter = 'All' | 'Recent' | 'Favorites'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [selectedTag, setSelectedTag] = useState('All')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('All')
  const [darkMode, setDarkMode] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [tag, setTag] = useState('General')
  const [search, setSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  

  // ✅ NEW: edit mode
  const [editId, setEditId] = useState<number | null>(null)

  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' })
  const showToast = (msg: string) => {
    setToast({ show: true, msg })
    setTimeout(() => setToast({ show: false, msg: '' }), 1700)
  }

  useEffect(() => {
    getUser()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault()
        ;(document.getElementById('searchBox') as HTMLInputElement | null)?.focus()
      }
      if (e.key === 'Escape') {
        setShowModal(false)
        setShowFilters(false)
        setEditId(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getUser = async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setUser(data.user)
      await fetchBookmarks(data.user.id)
    } else {
      setLoading(false)
    }
  }

  const fetchBookmarks = async (userId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setBookmarks(data as Bookmark[])
    setLoading(false)
  }

  // ✅ FIX: Always redirect to current origin (works on localhost + vercel)
  const getRedirectTo = () => {
    if (typeof window === 'undefined') return 'https://smart-boolkmark-app-7n2l.vercel.app/'
    return `${window.location.origin}/`
  }

  // LOGIN
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectTo(),
      },
    })
  }

  // LOGOUT
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setBookmarks([])

    if (typeof window !== 'undefined') {
      window.location.href = getRedirectTo()
    }
  }

  const normalizeUrl = (u: string) => {
    const s = u.trim()
    if (!s) return s
    if (s.startsWith('http://') || s.startsWith('https://')) return s
    return `https://${s}`
  }

  const resetModalFields = () => {
    setTitle('')
    setUrl('')
    setTag('General')
    setEditId(null)
  }

  const addBookmark = async () => {
    if (!title.trim() || !url.trim() || !user?.id || saving) return
    setSaving(true)

    const payload = {
      title: title.trim(),
      url: normalizeUrl(url),
      tag: tag?.trim() ? tag.trim() : 'General',
      user_id: user.id,
      favorite: false,
      pinned: false,
      is_read: true,
      archived: false,
    }

    const tempId = Date.now() * -1
    const tempRow: Bookmark = {
      ...(payload as any),
      id: tempId,
      created_at: new Date().toISOString(),
    }
    setBookmarks((prev) => [tempRow, ...prev])

    const res = await supabase.from('bookmarks').insert([payload]).select('*').single()

    if (res.error || !res.data) {
      setBookmarks((prev) => prev.filter((x) => x.id !== tempId))
      showToast('Save failed')
      setSaving(false)
      return
    }

    setBookmarks((prev) => prev.map((x) => (x.id === tempId ? (res.data as Bookmark) : x)))

    resetModalFields()
    setShowModal(false)
    setViewFilter('Recent')
    showToast('Bookmark added')
    setSaving(false)
  }

  // ✅ NEW: open edit modal
  const openEdit = (b: Bookmark) => {
    setEditId(b.id)
    setTitle(b.title || '')
    setUrl(b.url || '')
    setTag(b.tag && b.tag.trim() ? b.tag : 'General')
    setShowModal(true)
  }

  // ✅ NEW: update bookmark
  const updateBookmark = async () => {
    if (!editId || !title.trim() || !url.trim() || !user?.id || saving) return
    setSaving(true)

    const payload = {
      title: title.trim(),
      url: normalizeUrl(url),
      tag: tag?.trim() ? tag.trim() : 'General',
    }

    // optimistic UI update
    const snapshot = bookmarks
    setBookmarks((prev) => prev.map((x) => (x.id === editId ? { ...x, ...payload } : x)))

    const res = await supabase
      .from('bookmarks')
      .update(payload)
      .eq('id', editId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (res.error || !res.data) {
      setBookmarks(snapshot)
      showToast('Update failed')
      setSaving(false)
      return
    }

    setBookmarks((prev) => prev.map((x) => (x.id === editId ? (res.data as Bookmark) : x)))

    resetModalFields()
    setShowModal(false)
    showToast('Bookmark updated')
    setSaving(false)
  }

  const deleteBookmark = async (id: number) => {
    if (!user?.id) return

    const snapshot = bookmarks
    setBookmarks((prev) => prev.filter((x) => x.id !== id))

    const { error } = await supabase.from('bookmarks').delete().eq('id', id).eq('user_id', user.id)

    if (error) {
      setBookmarks(snapshot)
      showToast('Delete failed')
      return
    }
    showToast('Deleted')
  }

  const safeDomain = (link: string) => {
    try {
      const u = new URL(link)
      return u.hostname.replace('www.', '')
    } catch {
      return link
    }
  }

  const clickTimers = useRef<Record<number, any>>({})

  const setFavorite = async (b: Bookmark, val: boolean) => {
    if (!user?.id) return

    setBookmarks((prev) => prev.map((x) => (x.id === b.id ? { ...x, favorite: val } : x)))

    const res = await supabase
      .from('bookmarks')
      .update({ favorite: val })
      .eq('id', b.id)
      .eq('user_id', user.id)
      .select('id,favorite')

    if (res.error) {
      setBookmarks((prev) => prev.map((x) => (x.id === b.id ? { ...x, favorite: !val } : x)))
      showToast('Favorite update failed')
      return
    }

    if (!res.data || res.data.length === 0) {
      setBookmarks((prev) => prev.map((x) => (x.id === b.id ? { ...x, favorite: !val } : x)))
      showToast('Blocked by RLS')
      return
    }

    const row = res.data[0] as { id: number; favorite: boolean }
    setBookmarks((prev) => prev.map((x) => (x.id === row.id ? { ...x, favorite: row.favorite } : x)))
  }

  const onStarClick = (b: Bookmark) => {
    if (clickTimers.current[b.id]) clearTimeout(clickTimers.current[b.id])
    clickTimers.current[b.id] = setTimeout(() => {
      setFavorite(b, true)
      clickTimers.current[b.id] = null
    }, 230)
  }

  const onStarDoubleClick = (b: Bookmark) => {
    if (clickTimers.current[b.id]) {
      clearTimeout(clickTimers.current[b.id])
      clickTimers.current[b.id] = null
    }
    setFavorite(b, false)
  }

  const uniqueTags = useMemo(() => {
    const set = new Set(bookmarks.map((b) => (b.tag && b.tag.trim() ? b.tag : 'General')))
    return ['All', ...Array.from(set)]
  }, [bookmarks])

  const filteredBookmarks = useMemo(() => {
    let list =
      selectedTag === 'All'
        ? bookmarks
        : bookmarks.filter((b) => (b.tag && b.tag.trim() ? b.tag : 'General') === selectedTag)

    const now = Date.now()
    const last24h = 24 * 60 * 60 * 1000

    if (viewFilter === 'Recent') {
      const recent24 = list.filter((b) => {
        const t = b.created_at ? new Date(b.created_at).getTime() : 0
        return t && now - t <= last24h
      })
      list = recent24.length > 0 ? recent24 : list.slice(0, 6)
    }

    if (viewFilter === 'Favorites') list = list.filter((b) => Boolean(b.favorite))

    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter((b) => `${b.title} ${b.url} ${(b.tag || 'General')}`.toLowerCase().includes(s))
  }, [bookmarks, selectedTag, search, viewFilter])

  const FiltersContent = ({ compact }: { compact?: boolean }) => (
    <div className={compact ? 'filtersCompact' : ''}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold sidebarTitle">Collections</div>
        <span className="badge rounded-pill pillSoft">{uniqueTags.length - 1}</span>
      </div>

      <div className="list-group listGroupSoft">
        {uniqueTags.map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelectedTag(t)
              if (compact) setShowFilters(false)
            }}
            className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between ${
              selectedTag === t ? 'active' : ''
            }`}
          >
            <span className="text-truncate">{t}</span>
            {t !== 'All' && <i className="bi bi-chevron-right opacity-75" />}
          </button>
        ))}
      </div>

      <hr className="my-3 opacity-25" />

      <div className="fw-semibold mb-2">Quick Tags</div>
      <div className="d-flex flex-wrap gap-2">
        {uniqueTags
          .filter((t) => t !== 'All')
          .slice(0, 12)
          .map((t) => (
            <button
              key={t}
              className="btn btn-sm btn-outline-secondary tagBtn"
              onClick={() => {
                setSelectedTag(t)
                if (compact) setShowFilters(false)
              }}
            >
              <i className="bi bi-hash me-1" />
              {t.toLowerCase()}
            </button>
          ))}
      </div>
    </div>
  )

  return (
    <div className={`${darkMode ? 'themeDark' : 'themeLight'} min-vh-100`}>
      {showFilters && user && (
        <div className="drawerBackdrop" onClick={() => setShowFilters(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHeader">
              <div className="d-flex align-items-center gap-2">
                <div className="drawerIcon">
                  <i className="bi bi-funnel" />
                </div>
                <div>
                  <div className="fw-bold">Filters</div>
                  <div className="small text-muted">Choose collection quickly</div>
                </div>
              </div>
              <button className="iconBtn" onClick={() => setShowFilters(false)} title="Close">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="drawerBody">
              <FiltersContent compact />
            </div>
          </div>
        </div>
      )}

      <div className="container py-3">
        <div className="topbar card border-0 shadow-sm">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <div className="logoBubble">
                <i className="bi bi-bookmark-star-fill" />
              </div>
              <div className="min-w-0">
  <div className="fw-bold fs-5 lh-1 brandTitle">SmartBookmark</div>
  <div className="small brandSub">Save links. Find fast.</div>
</div>
            </div>

            <div className="flex-grow-1 mx-lg-3" style={{ maxWidth: 740 }}>
              <div className="searchWrap">
                <i className="bi bi-search searchIcon" />
                <input
                  id="searchBox"
                  className="form-control searchInput"
                  placeholder="Search bookmarks (press /)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search.trim() && (
                  <button className="clearBtn" onClick={() => setSearch('')} title="Clear">
                    <i className="bi bi-x-circle" />
                  </button>
                )}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {user && (
                <>
                  <button className="btn btn-outline-secondary btn-sm d-lg-none" onClick={() => setShowFilters(true)} title="Filters">
                    <i className="bi bi-funnel me-2" />
                    Filters
                  </button>

                  <button
  className="btn btn-primary btn-sm px-3 btnPremium"
  onClick={() => {
    resetModalFields()
    setShowModal(true)
  }}
>
  <i className="bi bi-plus-lg me-2" />
  New
</button>
                </>
              )}

              <button className="btn btn-outline-secondary btn-sm" onClick={() => setDarkMode(!darkMode)} title="Theme">
                <i className={`bi ${darkMode ? 'bi-sun' : 'bi-moon-stars'}`} />
              </button>

              {user ? (
                <button className="btn btn-outline-danger btn-sm" onClick={handleLogout} title="Logout">
                  <i className="bi bi-box-arrow-right" />
                </button>
              ) : (
                <button className="btn btn-dark btn-sm px-3" onClick={handleLogin}>
                  <i className="bi bi-google me-2" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>

        {!user ? (
          <div className="row justify-content-center mt-4">
            <div className="col-md-7 col-lg-5">
              <div className="card border-0 shadow-sm glassCard">
                <div className="card-body p-4 text-center">
                  <div className="display-6 fw-bold">Welcome</div>
                  <p className="text-muted mb-4">Login to save and favorite your bookmarks.</p>
                  <button onClick={handleLogin} className="btn btn-primary w-100">
                    <i className="bi bi-google me-2" />
                    Continue with Google
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-3 mt-2">
            <div className="col-lg-3 d-none d-lg-block">
              <div className="card border-0 shadow-sm glassCard h-100 stickySide">
                <div className="card-body">
                  <FiltersContent />
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-9">
              <div className="card border-0 shadow-sm glassCard">
                <div className="card-body">
                  <div className="d-flex flex-wrap gap-2 align-items-end justify-content-between mb-3">
                    <div className="min-w-0">
                      <div className="fw-bold fs-4 bookmarksTitle">Your bookmarks</div>
                    </div>

                    <ul className="nav nav-pills navPillsSoft">
                      {(['All', 'Recent', 'Favorites'] as ViewFilter[]).map((f) => (
                        <li className="nav-item" key={f}>
                          <button className={`nav-link ${viewFilter === f ? 'active' : ''}`} onClick={() => setViewFilter(f)} type="button">
                            {f === 'All' && <i className="bi bi-grid-3x3-gap me-2" />}
                            {f === 'Recent' && <i className="bi bi-clock-history me-2" />}
                            {f === 'Favorites' && <i className="bi bi-star me-2" />}
                            {f}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {loading ? (
                    <div className="loadingBox">
                      <div className="spinner-border spinner-border-sm me-2" role="status" />
                      Loading bookmarks
                    </div>
                  ) : (
                    <div className="row g-3">
                      {filteredBookmarks.map((b) => {
                        const domain = safeDomain(b.url)
                        const tagLabel = b.tag && b.tag.trim() ? b.tag : 'General'
                        const isFav = Boolean(b.favorite)

                        return (
                          <div className="col-12 col-sm-6 col-xl-4" key={b.id}>
                            <div className="card bookmarkCard border-0 shadow-sm h-100">
                              <div className="card-body d-flex flex-column">
                                <div className="d-flex align-items-start gap-2">
                                  <div className="favWrap" aria-hidden="true">
                                    <i className="bi bi-link-45deg" />
                                  </div>

                                  <div className="flex-grow-1 min-w-0">
                                    <div className="fw-semibold text-truncate" title={b.title}>
                                      {b.title}
                                    </div>
                                    <div className="small text-muted text-truncate">{domain}</div>
                                  </div>

                                  <div className="d-flex gap-1">
                                    <button
                                      className={`iconBtn starBtn ${isFav ? 'favOn' : ''}`}
                                      title={isFav ? 'Double click to remove favorite' : 'Favorite'}
                                      onClick={() => onStarClick(b)}
                                      onDoubleClick={() => onStarDoubleClick(b)}
                                    >
                                      <i className={`bi ${isFav ? 'bi-star-fill' : 'bi-star'}`} />
                                    </button>
                                  </div>
                                </div>

                                <div className="d-flex flex-wrap gap-2 mt-3">
                                  <span className="badge rounded-pill pillSoft">
                                    <i className="bi bi-tag me-1" />
                                    {tagLabel}
                                  </span>
                                </div>

                                <div className="small text-muted mt-2 urlClamp" title={b.url}>
                                  {b.url}
                                </div>

                                <div className="mt-auto pt-3 d-flex justify-content-between align-items-center">
                                  <a className="btn btn-sm btn-primary" href={b.url} target="_blank" rel="noreferrer">
                                    <i className="bi bi-box-arrow-up-right me-2" />
                                    Open
                                  </a>

                                  <div className="d-flex gap-1">
                                    {/* ✅ Edit button */}
                                    <button className="iconBtn" title="Edit" onClick={() => openEdit(b)}>
                                      <i className="bi bi-pencil-square" />
                                    </button>

                                    <button className="iconBtn danger" title="Delete" onClick={() => deleteBookmark(b.id)}>
                                      <i className="bi bi-trash3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {filteredBookmarks.length === 0 && (
                        <div className="col-12">
                          <div className="emptyBox text-center p-5">
                            <div className="fw-bold fs-5">No bookmarks found</div>
                            <div className="text-muted">Try changing tag, filter, or search.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="modalBackdrop"
          onClick={() => {
            setShowModal(false)
            setEditId(null)
          }}
        >
          <div className="modalCard card border-0 shadow" onClick={(e) => e.stopPropagation()}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="fw-bold fs-5">{editId ? 'Edit Bookmark' : 'Add Bookmark'}</div>
                <button
                  className="iconBtn"
                  onClick={() => {
                    setShowModal(false)
                    setEditId(null)
                  }}
                  title="Close"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="mb-3">
                <label className="form-label text-muted small">Title</label>
                <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. UI inspirations" />
              </div>

              <div className="mb-3">
                <label className="form-label text-muted small">URL</label>
                <input className="form-control" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div className="mb-3">
                <label className="form-label text-muted small">Tag</label>
                <input className="form-control" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Work / Study / Tools" />
              </div>

              <button className="btn btn-primary w-100" onClick={editId ? updateBookmark : addBookmark} disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    {editId ? 'Updating' : 'Saving'}
                  </>
                ) : (
                  <>
                    <i className={`bi ${editId ? 'bi-arrow-repeat' : 'bi-check2-circle'} me-2`} />
                    {editId ? 'Update' : 'Save'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="toastBox">
          <div className="toastPill">
            <i className="bi bi-info-circle me-2" />
            {toast.msg}
          </div>
        </div>
      )}

     <style jsx>{`

/* ===============================
   🌌 ULTRA GALAXY THEME (FINAL)
   =============================== */

.themeDark {
  --text: #eaf0ff;
  --muted: #9aa3c7;
  --glass: rgba(20, 25, 60, 0.55);
  --glass2: rgba(30, 35, 90, 0.45);
  --border: rgba(255,255,255,0.15);

  background: radial-gradient(circle at center, #0b0f2f 0%, #05010f 70%);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}
  

/* ☀️ LIGHT THEME */
.themeLight {
  --text: #0f172a;
  --muted: #475569;
  --glass: rgba(255, 255, 255, 0.75);
  --glass2: rgba(255, 255, 255, 0.6);
  --border: rgba(0,0,0,0.08);

  background:
    radial-gradient(circle at 15% 20%, #e0e7ff 0%, transparent 40%),
    radial-gradient(circle at 85% 30%, #f5d0fe 0%, transparent 40%),
    radial-gradient(circle at 50% 90%, #cffafe 0%, transparent 50%),
    #f8fafc;

  color: var(--text);
  min-height: 100vh;
}

/* ✨ GLASS CONTAINERS */
.glassCard,
.topbar,
.bookmarkCard,
.modalCard {
  background: linear-gradient(135deg, var(--glass), var(--glass2));
  backdrop-filter: blur(30px);
  border-radius: 26px;
  border: 1px solid var(--border);
  box-shadow:
    0 0 40px rgba(139,92,246,0.15),
    0 30px 80px rgba(0,0,0,0.6);
}

/* 🔮 TOPBAR GLOW */
.topbar {
  position: sticky;
  top: 16px;
  z-index: 50;
  box-shadow:
    0 0 50px rgba(124,58,237,0.25),
    0 25px 60px rgba(0,0,0,0.6);
}

/* 🔍 SEARCH BAR */
.searchInput {
  border-radius: 999px !important;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(139,92,246,0.35);
  color: var(--text);
}

.searchInput:focus {
  box-shadow: 0 0 0 3px rgba(139,92,246,0.35);
  border-color: #8b5cf6;
}

/* 🎯 SIDEBAR */
.listGroupSoft .list-group-item {
  border-radius: 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid transparent;
  color: var(--text);
  margin-bottom: 10px;
  transition: 0.25s ease;
}

.listGroupSoft .list-group-item:hover {
  background: rgba(139,92,246,0.18);
  border-color: rgba(139,92,246,0.5);
}

.listGroupSoft .list-group-item.active {
  background: linear-gradient(135deg,#8b5cf6,#6366f1);
  color: #fff;
}

/* 💎 BOOKMARK CARD */
.bookmarkCard {
  transition: 0.3s ease;
}

.bookmarkCard:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 0 50px rgba(99,102,241,0.45),
    0 40px 100px rgba(0,0,0,0.7);
  border-color: rgba(139,92,246,0.6);
}

/* 🟢 OPEN BUTTON (GREEN GLOW LIKE IMAGE) */
.btn-primary {
  background: linear-gradient(135deg,#22c55e,#16a34a);
  border: none;
  border-radius: 14px;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(34,197,94,0.5);
  transition: 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 50px rgba(34,197,94,0.7);
}

/* ⭐ ICON BUTTON */
.iconBtn {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  color: var(--text);
  display: grid;
  place-items: center;
  transition: 0.2s ease;
}

.iconBtn:hover {
  background: rgba(139,92,246,0.25);
  border-color: rgba(139,92,246,0.6);
  transform: translateY(-2px);
}

.iconBtn.danger {
  background: rgba(220,53,69,0.15);
  border-color: rgba(220,53,69,0.5);
}

/* ⭐ FAVORITE STAR GLOW */
.starBtn.favOn {
  color: #ffd54a !important;
  filter: drop-shadow(0 0 12px #ffd54a);
}

/* 🏷 TAG PILL */
.pillSoft {
  background: rgba(139,92,246,0.25) !important;
  border: 1px solid rgba(139,92,246,0.6);
  color: #dcd7ff !important;
}

/* 📦 EMPTY STATE */
.emptyBox {
  border-radius: 24px;
  border: 1px dashed rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
}

/* 📱 MODAL */
.modalBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,20,0.85);
  display: grid;
  place-items: center;
  z-index: 1000;
}

/* 🍞 TOAST */
.toastPill {
  border-radius: 999px;
  padding: 10px 18px;
  background: rgba(15,20,50,0.95);
  border: 1px solid rgba(139,92,246,0.5);
  backdrop-filter: blur(20px);
}

/* NAV PILLS */
.navPillsSoft .nav-link {
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  color: var(--text);
  border: 1px solid transparent;
}

.navPillsSoft .nav-link.active {
  background: linear-gradient(135deg,#8b5cf6,#6366f1);
  color: white;
}
/* ===== TEXT VISIBILITY FIX ===== */

/* force readable text */
body {
  color: inherit;
}

/* ===== 🎯 THEME BASED HEADING FIX ===== */

/* dark mode headings */
.themeDark h1,
.themeDark h2,
.themeDark h3,
.themeDark h4,
.themeDark h5,
.themeDark h6,
.themeDark .bookmarksTitle,
.themeDark .brandTitle {
  color: #f5f7ff !important;
  text-shadow:
    0 0 18px rgba(139,92,246,0.45),
    0 2px 10px rgba(0,0,0,0.6);
}

/* light mode headings */
.themeLight h1,
.themeLight h2,
.themeLight h3,
.themeLight h4,
.themeLight h5,
.themeLight h6,
.themeLight .bookmarksTitle,
.themeLight .brandTitle {
  color: #0f172a !important; /* dark text */
  text-shadow: none !important;
}
  /* muted text per theme */
.themeDark .text-muted {
  color: #aab2ff !important;
}

.themeLight .text-muted {
  color: #64748b !important;
}



/* ===============================
   🎯 FINAL HEADING VISIBILITY FIX
   =============================== */

/* DARK MODE */
.themeDark .brandTitle,
.themeDark .bookmarksTitle {
  color: #f5f7ff !important;
  text-shadow:
    0 0 18px rgba(139,92,246,0.45),
    0 2px 10px rgba(0,0,0,0.6);
}

/* LIGHT MODE */
.themeLight .brandTitle,
.themeLight .bookmarksTitle {
  color: #0f172a !important;
  text-shadow: none !important;
}

/* subtitle fix */
.themeDark .brandSub {
  color: #aab2ff !important;
}

.themeLight .brandSub {
  color: #64748b !important;
}



/* quick tag buttons */
.btn-outline-secondary {
  color: #cfd6ff !important;
  border-color: rgba(255,255,255,0.25);
}

.btn-outline-secondary:hover {
  background: rgba(139,92,246,0.25);
  color: #fff;
}

/* 🔗 bookmark leading icon */
.favWrap {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg,#8b5cf6,#6366f1);
  color: #ffffff;
  box-shadow: 0 10px 25px rgba(99,102,241,0.45);
  flex-shrink: 0;
}

.favWrap i {
  font-size: 18px;
  color: #ffffff;
}
  /* 🎯 ensure icons always visible */
.iconBtn i,
.nav-link i,
.btn i,
.badge i {
  color: inherit;
  font-size: 16px;
}
  .themeDark .iconBtn {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.18);
}
  /* ===================================
   🎯 MASTER TEXT SYSTEM (FINAL FIX)
   =================================== */

/* ---------- DARK MODE ---------- */

.themeDark .form-control,
.themeDark .searchInput {
  color: #ffffff !important;
}

.themeDark .form-control::placeholder,
.themeDark .searchInput::placeholder {
  color: #8f96c9 !important;
}

.themeDark .list-group-item {
  color: #f7eaff !important;
}

.themeDark .nav-link {
  color: #dfe3ff !important;
}

.themeDark .bookmarkCard .fw-semibold {
  color: #f5f7ff !important;
}

.themeDark .bookmarkCard .small.text-muted {
  color: #9aa3c7 !important;
}

.themeDark .brandSub {
  color: #aab2ff !important;
}

/* ---------- LIGHT MODE ---------- */

.themeLight .form-control,
.themeLight .searchInput {
  color: #0f172a !important;
}

.themeLight .form-control::placeholder,
.themeLight .searchInput::placeholder {
  color: #64748b !important;
}

.themeLight .list-group-item {
  color: #0f172a !important;
}

.themeLight .nav-link {
  color: #334155 !important;
}

.themeLight .bookmarkCard .fw-semibold {
  color: #0f172a !important;
}

.themeLight .bookmarkCard .small.text-muted {
  color: #64748b !important;
}

.themeLight .brandSub {
  color: #64748b !important;
}

.themeDark .iconBtn:hover {
  background: rgba(139,92,246,0.35);
}
  .themeLight .iconBtn {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.08);
  color: #334155;
}

.themeLight .iconBtn:hover {
  background: rgba(99,102,241,0.15);
  color: #111827;
}  
  /* ==============================
   🧭 SIDEBAR HEADING VISIBILITY
   ============================== */

/* dark mode */
.themeDark .fw-semibold {
  color: #f5f7ff !important;
}

/* light mode */
.themeLight .fw-semibold {
  color: #0f172a !important;
}

/* sidebar count badge readability */
.themeDark .pillSoft {
  color: #ffffff !important;
}

.themeLight .pillSoft {
  color: #1e293b !important;
}

/* quick tags heading specifically */
.themeDark .filtersCompact .fw-semibold,
.themeDark .stickySide .fw-semibold {
  color: #f5f7ff !important;
}

.themeLight .filtersCompact .fw-semibold,
.themeLight .stickySide .fw-semibold {
  color: #0f172a !important;
}
  .themeDark .sidebarTitle {
  color: #f5f7ff;
  text-shadow: 0 0 12px rgba(139,92,246,0.35);
}

.themeLight .sidebarTitle {
  color: #0f172a;
}
/* ==============================
   🔥 ULTIMATE VISIBILITY PATCH
   ============================== */

/* force theme text everywhere */
.themeDark,
.themeDark * {
  color: var(--text);
}

/* stronger sidebar contrast */
.themeDark .listGroupSoft .list-group-item {
  background: rgba(255,255,255,0.08) !important;
  color: #eef2ff !important;
}

/* active sidebar glow */
.themeDark .listGroupSoft .list-group-item.active {
  background: linear-gradient(135deg,#8b5cf6,#6366f1) !important;
  color: #ffffff !important;
}

/* search box better contrast */
.themeDark .searchInput {
  background: rgba(10,12,40,0.6) !important;
  border-color: rgba(139,92,246,0.5) !important;
}

/* cards text boost */
.themeDark .bookmarkCard {
  color: #eef2ff !important;
}

/* nav pills readability */
.themeDark .navPillsSoft .nav-link {
  background: rgba(255,255,255,0.08);
  color: #e5e9ff !important;
}

/* modal input visibility */
.themeDark .modalCard .form-control {
  background: rgba(10,12,40,0.6);
  color: #ffffff !important;
  border-color: rgba(139,92,246,0.4);
}

/* toast readability */
.themeDark .toastPill {
  color: #ffffff;
}

/* small muted fix */
.themeDark .text-muted {
  color: #aab2ff !important;
}

/*mine*/
/* ===============================
   🌌 PREMIUM ANIMATED BACKGROUND
   =============================== */

.themeDark body::before {
  content: "";
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba(139,92,246,0.25), transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(59,130,246,0.25), transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(236,72,153,0.18), transparent 45%);
  filter: blur(40px);
  z-index: -1;
  animation: bgFloat 18s ease-in-out infinite alternate;
}

@keyframes bgFloat {
  from { transform: translateY(-20px) scale(1); }
  to { transform: translateY(20px) scale(1.05); }
}
/* ===============================
   🧲 MAGNETIC CARD HOVER
   =============================== */

.bookmarkCard {
  transition: all 0.25s ease;
  transform-style: preserve-3d;
}

.bookmarkCard:hover {
  transform: translateY(-6px) scale(1.015);
  box-shadow:
    0 20px 60px rgba(139,92,246,0.25),
    0 10px 30px rgba(0,0,0,0.35);
}
/* ===============================
   ✨ GLOW BUTTON
   =============================== */

.btnPremium {
  position: relative;
  overflow: hidden;
}

.btnPremium::after {
  content: "";
  position: absolute;
  inset: -2px;
  background: linear-gradient(120deg,#8b5cf6,#6366f1,#22c55e);
  filter: blur(14px);
  opacity: 0;
  transition: opacity 0.25s ease;
  z-index: -1;
}

.btnPremium:hover::after {
  opacity: 0.7;
}
  /* ===============================
   🚀 SIDEBAR ACTIVE BOOST
   =============================== */

.themeDark .listGroupSoft .list-group-item.active {
  background: linear-gradient(135deg,#8b5cf6,#6366f1) !important;
  box-shadow: 0 10px 30px rgba(139,92,246,0.45);
}
  /* ===============================
   🎯 GLOBAL SMOOTHNESS
   =============================== */

* {
  scroll-behavior: smooth;
}

.card,
.list-group-item,
.nav-link,
.btn {
  transition: all 0.18s ease;
}
`}</style>
    </div>
  )
}
