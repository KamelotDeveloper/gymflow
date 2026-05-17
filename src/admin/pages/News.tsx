import { useEffect, useState } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { useAuthContext } from '../../shared/components/AuthContext'
import { Plus, Trash2, Loader2, X } from 'lucide-react'

type NewsItem = {
  id: string
  title: string
  tag: string
  tag_color: string
  created_at: string
  is_active: boolean
}

const TAG_COLORS: Record<string, string> = {
  Aviso: 'red',
  Nuevo: 'blue',
  Importante: 'yellow',
  Promoción: 'green',
}

const TAG_OPTIONS = ['Aviso', 'Nuevo', 'Importante', 'Promoción']

const COLORS: Record<string, { bg: string; text: string }> = {
  red: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
  green: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
}

export default function News() {
  const { profile } = useAuthContext()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formTag, setFormTag] = useState('Aviso')
  const [saving, setSaving] = useState(false)

  const fetchNews = async () => {
    setLoading(true)
    try {
      const { data } = await (supabase as any)
        .from('gym_news')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setNews(data as NewsItem[])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleToggle = async (item: NewsItem) => {
    await (supabase as any)
      .from('gym_news')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    setNews((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_active: !n.is_active } : n))
    )
  }

  const handleDelete = async (id: string) => {
    await (supabase as any).from('gym_news').delete().eq('id', id)
    setNews((prev) => prev.filter((n) => n.id !== id))
  }

  const handleCreate = async () => {
    if (!formTitle.trim()) return
    setSaving(true)
    try {
      const color = TAG_COLORS[formTag] ?? 'red'
      const { data } = await (supabase as any)
        .from('gym_news')
        .insert({
          title: formTitle.trim(),
          tag: formTag,
          tag_color: color,
          created_by: profile!.id,
        })
        .select()
        .single()

      if (data) {
        setNews((prev) => [data as NewsItem, ...prev])
        setShowModal(false)
        setFormTitle('')
        setFormTag('Aviso')
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout pageTitle="Noticias del gym">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{news.length} noticia{news.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#DC2626] text-white text-sm font-semibold px-4 py-2 hover:bg-[#b71c1c] transition-colors"
        >
          <Plus size={16} />
          Nueva noticia
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No hay noticias todavía.</p>
          <p className="text-gray-400 text-xs mt-1">Creá la primera noticia para los miembros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((item) => {
            const c = COLORS[item.tag_color] ?? COLORS.red
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4"
              >
                {/* Tag badge */}
                <span
                  className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${c.bg} ${c.text}`}
                >
                  {item.tag}
                </span>

                {/* Title */}
                <p className={`flex-1 text-sm font-medium truncate ${item.is_active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                  {item.title}
                </p>

                {/* Date */}
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">
                  {new Date(item.created_at).toLocaleDateString('es-AR')}
                </span>

                {/* Toggle active */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={() => handleToggle(item)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Nueva noticia
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: El gym cierra el 25 de mayo"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
                />
              </div>

              {/* Tag */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Tag
                </label>
                <select
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
                >
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Color asignado: <span className="font-medium">{TAG_COLORS[formTag]}</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim() || saving}
                className="rounded-lg bg-[#DC2626] text-white text-sm font-semibold px-4 py-2 hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
