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
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [tag, setTag] = useState('General')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setUser(data.user)
      fetchBookmarks(data.user.id)
    } else {
      setLoading(false)
    }
  }

  const fetchBookmarks = async (userId: string) => {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setBookmarks(data as Bookmark[])
    setLoading(false)
  }

  const normalizeUrl = (u: string) => {
    if (u.startsWith('http')) return u
    return `https://${u}`
  }

  const addBookmark = async () => {
    if (!title || !url || !user) return
    setSaving(true)

    const { data } = await supabase
      .from('bookmarks')
      .insert([
        {
          title,
          url: normalizeUrl(url),
          tag,
          user_id: user.id,
        },
      ])
      .select('*')
      .single()

    if (data) {
      setBookmarks([data as Bookmark, ...bookmarks])
      setTitle('')
      setUrl('')
      setTag('General')
      setShowModal(false)
    }

    setSaving(false)
  }

  const deleteBookmark = async (id: number) => {
    await supabase.from('bookmarks').delete().eq('id', id)
    setBookmarks(bookmarks.filter((b) => b.id !== id))
  }

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) =>
      `${b.title} ${b.url} ${b.tag}`.toLowerCase().includes(search.toLowerCase())
    )
  }, [bookmarks, search])

  return (
    <div className={`${darkMode ? 'themeDark' : 'themeLight'} min-vh-100`}>
      <div className="container py-4">
        <div className="card glassCard p-4 shadow-lg border-0">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-bold m-0">SmartBookmark</h4>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => setDarkMode(!darkMode)}
            >
              Toggle Theme
            </button>
          </div>

          <div className="mb-3">
            <input
              className="form-control"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary mb-4"
            onClick={() => setShowModal(true)}
          >
            Add Bookmark
          </button>

          <div className="row g-3">
            {filteredBookmarks.map((b) => (
              <div className="col-md-4" key={b.id}>
                <div className="card bookmarkCard p-3 border-0 shadow-sm h-100">
                  <h6 className="fw-bold">{b.title}</h6>
                  <p className="small opacity-75 mb-2">{b.url}</p>
                  <span className="badge bg-light text-dark mb-2">
                    {b.tag}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteBookmark(b.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modalBackdrop">
          <div className="modalCard p-4">
            <h5 className="fw-bold mb-3">Add Bookmark</h5>
            <input
              className="form-control mb-2"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="form-control mb-2"
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <input
              className="form-control mb-3"
              placeholder="Tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <button
              className="btn btn-primary w-100"
              onClick={addBookmark}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .themeLight {
          background: linear-gradient(
            135deg,
            #3b82f6 0%,
            #6366f1 50%,
            #8b5cf6 100%
          );
          color: white;
        }

        .themeDark {
          background: linear-gradient(
            135deg,
            #1e1b4b 0%,
            #312e81 50%,
            #4c1d95 100%
          );
          color: white;
        }

        .glassCard {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          border-radius: 20px;
        }

        .bookmarkCard {
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          border-radius: 16px;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: grid;
          place-items: center;
        }

        .modalCard {
          width: 400px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          color: white;
        }
      `}</style>
    </div>
  )
}
