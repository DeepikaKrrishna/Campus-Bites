import { supabase, isSupabaseConfigured } from './supabase'
import { menuItems as localMenu, type MenuItem } from '../data/menuItems'

export async function fetchMenu(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) return localMenu

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('id')

    if (error || !data || data.length === 0) {
      return localMenu
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      counter: row.counter,
      time: row.time,
      description: row.description,
      price: row.price,
      rating: Number(row.rating),
      ratingCount: row.rating_count,
      image: row.image,
      badge: row.badge ?? undefined,
      category: row.category,
    }))
  } catch (err) {
    console.warn('Failed to fetch menu from Supabase, using local data:', err)
    return localMenu
  }
}
