'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [showModal, setShowModal] = useState(false)

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
      options: {
        redirectTo: 'http://localhost:3000'
      }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const addBookmark = async () => {
    if (!title || !url) return

    await supabase.from('bookmarks').insert([
      { title, url, user_id: user.id },
    ])

    setTitle('')
    setUrl('')
    fetchBookmarks(user.id)
  }

  const deleteBookmark = async (id: string) => {
    await supabase.from('bookmarks').delete().eq('id', id)
    fetchBookmarks(user.id)
  }

  const filteredBookmarks = bookmarks.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className={`app ${darkMode ? 'dark' : ''}`}>

        <header className="header">
          <h1>SmartBookmark</h1>
          <div>
            <button onClick={() => setDarkMode(!darkMode)} className="toggle-btn">
              {darkMode ? '☀ Light' : '🌙 Dark'}
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
            <div className="login-card">
              <h2>Save Your Favorite Links</h2>
              <button onClick={handleLogin} className="primary-btn">
                Login with Google
              </button>
            </div>
          </div>
        ) : (
          <main className="dashboard">

            <p className="welcome">Welcome, {user.email}</p>

            <div className="card">
              <h3>Add Bookmark</h3>
              <input
                type="text"
                placeholder="Website Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button onClick={addBookmark} className="primary-btn">
                Add
              </button>
            </div>

            {/* VIEW ALL BUTTON */}
            <button className="view-btn" onClick={() => setShowModal(true)}>
              View All Bookmarks ({bookmarks.length})
            </button>

          </main>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">
              <h3>All Bookmarks</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>

            <input
              type="text"
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="modal-search"
            />

            <div className="bookmark-list">
              {filteredBookmarks.map((bookmark) => (
                <div key={bookmark.id} className="bookmark-item">
                  <a href={bookmark.url} target="_blank">
                    {bookmark.title}
                  </a>
                  <button onClick={() => deleteBookmark(bookmark.id)}>✕</button>
                </div>
              ))}

              {filteredBookmarks.length === 0 && (
                <p className="empty">No bookmarks found.</p>
              )}
            </div>

          </div>
        </div>
      )}

      <style jsx>{`

        .app {
          min-height: 100vh;
          padding: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
        }

        .dark {
          background: linear-gradient(135deg, #1f1f1f, #111);
        }

        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .toggle-btn, .logout-btn, .view-btn {
          margin-left: 10px;
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 8px 14px;
          border-radius: 20px;
          color: white;
          cursor: pointer;
        }

        .dashboard {
          max-width: 600px;
          margin: auto;
        }

        .card {
          background: rgba(255,255,255,0.15);
          padding: 20px;
          border-radius: 20px;
          backdrop-filter: blur(12px);
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        input {
          padding: 10px;
          border-radius: 10px;
          border: none;
        }

        .primary-btn {
          background: white;
          color: black;
          padding: 10px;
          border-radius: 25px;
          border: none;
          cursor: pointer;
        }

        /* MODAL */
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
          width: 90%;
          max-width: 500px;
          padding: 20px;
          border-radius: 20px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .modal-search {
          width: 100%;
          margin-bottom: 15px;
        }

        .bookmark-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }

        .bookmark-item a {
          color: white;
          text-decoration: none;
        }

      `}</style>
    </>
  )
}
