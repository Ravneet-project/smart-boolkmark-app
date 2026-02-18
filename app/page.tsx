'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [selectedTag, setSelectedTag] = useState('All')
  const [darkMode, setDarkMode] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [tag, setTag] = useState('General')

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setUser(data.user)
      fetchBookmarks(data.user.id)
    }
  }

  const fetchBookmarks = async (userId: string) => {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setBookmarks(data)
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000' }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const addBookmark = async () => {
    if (!title || !url) return

    await supabase.from('bookmarks').insert([
      { title, url, tag, user_id: user.id },
    ])

    setTitle('')
    setUrl('')
    setTag('General')
    setShowModal(false)
    fetchBookmarks(user.id)
  }

  const deleteBookmark = async (id: string) => {
    await supabase.from('bookmarks').delete().eq('id', id)
    fetchBookmarks(user.id)
  }

  const uniqueTags = ['All', ...new Set(bookmarks.map(b => b.tag || 'General'))]

  const filteredBookmarks =
    selectedTag === 'All'
      ? bookmarks
      : bookmarks.filter(b => b.tag === selectedTag)

  return (
    <>
      <div className={`app ${darkMode ? 'dark' : ''}`}>

        {/* HEADER */}
        <header className="header">
          <h2>SmartBookmark</h2>
          <div>
            <button onClick={() => setShowModal(true)} className="create-btn">
              + Create
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="toggle-btn">
              {darkMode ? '☀' : '🌙'}
            </button>
            {user && (
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            )}
          </div>
        </header>

        {!user ? (
          <div className="login-screen">
            <button onClick={handleLogin} className="primary-btn">
              Login with Google
            </button>
          </div>
        ) : (
          <div className="layout">

            {/* SIDEBAR */}
            <aside className="sidebar">
              {uniqueTags.map((t) => (
                <div
                  key={t}
                  className={`tag ${selectedTag === t ? 'active' : ''}`}
                  onClick={() => setSelectedTag(t)}
                >
                  {t}
                </div>
              ))}
            </aside>

            {/* CONTENT */}
            <main className="content">
              {filteredBookmarks.map((bookmark) => (
                <div key={bookmark.id} className="card">
                  <div>
                    <h4>{bookmark.title}</h4>
                    <p>{bookmark.url}</p>
                    <small>{bookmark.tag}</small>
                  </div>

                  <div className="card-actions">
                    <a href={bookmark.url} target="_blank">
                      Open
                    </a>
                    <button onClick={() => deleteBookmark(bookmark.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredBookmarks.length === 0 && (
                <p>No bookmarks in this tag.</p>
              )}
            </main>

          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Bookmark</h3>

            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              type="text"
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <input
              type="text"
              placeholder="Tag (Work, Study...)"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />

            <button onClick={addBookmark} className="primary-btn">
              Add
            </button>
          </div>
        </div>
      )}

      <style jsx>{`

        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 20px;
        }

        .dark {
          background: #111;
        }

        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .create-btn, .toggle-btn, .logout-btn {
          margin-left: 10px;
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }

        .layout {
          display: flex;
          gap: 20px;
        }

        .sidebar {
          width: 200px;
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 10px;
        }

        .tag {
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .tag:hover {
          background: rgba(255,255,255,0.2);
        }

        .active {
          background: white;
          color: black;
        }

        .content {
          flex: 1;
          display: grid;
          gap: 15px;
        }

        .card {
          background: rgba(255,255,255,0.15);
          padding: 15px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
        }

        .card-actions a {
          margin-right: 10px;
          color: #00ffcc;
          text-decoration: none;
        }

        .card-actions button {
          background: red;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .modal {
          background: #222;
          padding: 20px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 300px;
        }

        input {
          padding: 8px;
          border-radius: 6px;
          border: none;
        }

        .primary-btn {
          background: white;
          color: black;
          padding: 8px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }

      `}</style>
    </>
  )
}
