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
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  // ✅ FIX: dynamic redirect for local + Vercel
 const PROD_URL = 'https://smart-boolkmark-app-7n2l.vercel.app/'

// LOGIN
const handleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: PROD_URL,
    },
  })
}

// LOGOUT
const handleLogout = async () => {
  await supabase.auth.signOut()
  setUser(null)
  setBookmarks([])

  // redirect back to your vercel home
  if (typeof window !== 'undefined') {
    window.location.href = PROD_URL
  }
}

  const normalizeUrl = (u: string) => {
    const s = u.trim()
    if (!s) return s
    if (s.startsWith('http://') || s.startsWith('https://')) return s
    return `https://${s}`
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

    setTitle('')
    setUrl('')
    setTag('General')
    setShowModal(false)
    setViewFilter('Recent')
    showToast('Bookmark added')
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
        <div className="fw-semibold">Collections</div>
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
                <div className="fw-bold fs-5 lh-1">SmartBookmark</div>
                <div className="small text-muted">Save links. Find fast.</div>
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

                  <button className="btn btn-primary btn-sm px-3" onClick={() => setShowModal(true)}>
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
                      <div className="fw-bold fs-4">Your bookmarks</div>
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
                                  {/* ✅ FAVICON REMOVED COMPLETELY */}
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
        <div className="modalBackdrop" onClick={() => setShowModal(false)}>
          <div className="modalCard card border-0 shadow" onClick={(e) => e.stopPropagation()}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="fw-bold fs-5">Add Bookmark</div>
                <button className="iconBtn" onClick={() => setShowModal(false)} title="Close">
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

              <button className="btn btn-primary w-100" onClick={addBookmark} disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle me-2" />
                    Save
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
        :global(body) {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
          letter-spacing: -0.2px;
        }

        /* Hide Next.js DevTools bubble */
        :global([data-nextjs-devtools]),
        :global(#__nextjs_devtools),
        :global(.nextjs-devtools),
        :global(.nextjs-devtools-button),
        :global(.nextjs-devtools-panel) {
          display: none !important;
        }

.themeDark {
  /* treat "dark" as a second light theme */
  --panel: rgba(255, 255, 255, 0.78);
  --panel2: rgba(255, 255, 255, 0.60);
  --border: rgba(17, 17, 17, 0.14);
  --border2: rgba(17, 17, 17, 0.10);
  --text: #111;
  --muted: rgba(17, 17, 17, 0.62);
  --shadow: 0 12px 34px rgba(0, 0, 0, 0.12);

  background:
    radial-gradient(1100px 600px at 15% 15%, rgba(255, 160, 140, 0.55), transparent 70%),
    radial-gradient(900px 520px at 85% 20%, rgba(255, 200, 175, 0.40), transparent 75%),
    radial-gradient(700px 420px at 50% 90%, rgba(255, 140, 120, 0.25), transparent 80%),
    linear-gradient(160deg, #fff6f3 0%, #ffe9e2 45%, #ffd9cf 75%, #ffc8bb 100%);

  color: var(--text);
}


        .themeLight {
          --panel: rgba(255, 255, 255, 0.9);
          --panel2: rgba(255, 255, 255, 0.75);
          --border: rgba(17, 17, 17, 0.12);
          --border2: rgba(17, 17, 17, 0.1);
          --text: #111;
          --muted: rgba(17, 17, 17, 0.65);
          --shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
          background: linear-gradient(160deg, #f7f7ff, #f2fbff);
          color: var(--text);
        }

        .topbar {
          border-radius: 22px;
          background: var(--panel);
          backdrop-filter: blur(18px);
          position: sticky;
          top: 12px;
          z-index: 50;
          box-shadow: var(--shadow);
        }

     .glassCard {
  border-radius: 22px;
  background: var(--panel);
  border: 1px solid var(--border2);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}


        .stickySide {
          position: sticky;
          top: 92px;
        }

        .logoBubble {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(255, 140, 120, 0.25), rgba(255, 190, 170, 0.12));
          border: 1px solid var(--border);
        }

        .loadingBox {
          border: 1px dashed var(--border);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.04);
          display: inline-flex;
          align-items: center;
        }

        .searchWrap {
          position: relative;
        }
        .searchIcon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.75;
        }
        .clearBtn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: inherit;
          opacity: 0.75;
          padding: 6px;
          border-radius: 10px;
        }
        .clearBtn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.06);
        }

        .searchInput {
          border-radius: 16px !important;
          background: var(--panel2);
          border: 1px solid var(--border2);
          color: inherit;
          padding-left: 38px;
          padding-right: 40px;
        }
        .searchInput:focus {
          box-shadow: 0 0 0 0.2rem rgba(255, 140, 120, 0.18);
          border-color: rgba(255, 160, 140, 0.55);
        }

        .listGroupSoft .list-group-item {
          border: 1px solid transparent;
          border-radius: 16px;
          margin-bottom: 8px;
          background: var(--panel2);
          color: inherit;
          transition: 0.15s ease;
        }
        .listGroupSoft .list-group-item:hover {
          transform: translateY(-1px);
          border-color: var(--border2);
        }
        .listGroupSoft .list-group-item.active {
          background: rgba(255, 140, 120, 0.85);
          border-color: rgba(255, 140, 120, 0.85);
          color: #fff;
        }

        .tagBtn {
          border-radius: 999px;
          border-color: var(--border2);
        }

        .navPillsSoft .nav-link {
          border-radius: 999px;
          font-size: 0.9rem;
          background: var(--panel2);
          color: inherit;
          border: 1px solid var(--border2);
        }
        .navPillsSoft .nav-link.active {
          background: rgba(255, 140, 120, 0.9);
          border-color: rgba(255, 140, 120, 0.9);
          color: #fff;
        }

  .bookmarkCard {
  border-radius: 22px;
  background: var(--panel);
  border: 1px solid var(--border2);
  transition: 0.18s ease;
}
.bookmarkCard:hover {
  transform: translateY(-3px);
  border-color: var(--border);
}

        .favWrap {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.06);
          flex: 0 0 auto;
          overflow: hidden;
        }

     .pillSoft {
  background: rgba(255, 255, 255, 0.55) !important;
  border: 1px solid var(--border2);
  color: var(--text) !important;
}


       .iconBtn {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid var(--border2);
  background: rgba(255, 255, 255, 0.55);
  color: var(--text);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.15s ease;
}
.iconBtn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.75);
}

       
        .iconBtn.danger {
          background: rgba(220, 53, 69, 0.12);
          border-color: rgba(220, 53, 69, 0.35);
        }

       .starBtn {
  color: rgba(17, 17, 17, 0.72) !important;
}
.starBtn.favOn {
  color: #ffc107 !important;
  filter: drop-shadow(0 6px 12px rgba(255, 193, 7, 0.25));
}

        .themeLight .starBtn {
          color: rgba(17, 17, 17, 0.7) !important;
        }
        .starBtn.favOn {
          color: #ffc107 !important;
          filter: drop-shadow(0 6px 12px rgba(255, 193, 7, 0.2));
        }

        .urlClamp {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .emptyBox {
          border-radius: 20px;
          border: 1px dashed var(--border);
          background: rgba(255, 255, 255, 0.05);
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1000;
        }
        .modalCard {
          width: min(460px, 96vw);
          border-radius: 22px;
          background: var(--panel);
          backdrop-filter: blur(18px);
          border: 1px solid var(--border2);
        }

        .toastBox {
          position: fixed;
          left: 50%;
          bottom: 22px;
          transform: translateX(-50%);
          z-index: 1100;
        }
        .toastPill {
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(14px);
        }

        .drawerBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          z-index: 1200;
          display: flex;
          justify-content: flex-end;
        }
        .drawer {
          width: min(420px, 92vw);
          height: 100%;
          background: var(--panel);
          backdrop-filter: blur(18px);
          border-left: 1px solid var(--border2);
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.18s ease-out;
        }
        @keyframes slideIn {
          from {
            transform: translateX(18px);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .drawerHeader {
          padding: 14px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border2);
        }
        .drawerBody {
          padding: 14px;
          overflow: auto;
        }
        .drawerIcon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.06);
        }

        @media (max-width: 576px) {
          .topbar {
            top: 8px;
          }
          .searchInput {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  )
}
