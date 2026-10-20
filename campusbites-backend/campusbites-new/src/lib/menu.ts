import { supabase, isSupabaseConfigured } from './supabase'
import { menuItems as localMenu, type MenuItem } from '../data/menuItems'

// Fetch menu from Supabase if configured, otherwise use local data
export async function fetchMenu(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured) return localMenu

  const { data, error } = await supabase!
    .from('menu_items')
    .select('*')
    .eq('available', true)
    .order('id')

  if (error) {
    console.warn('Failed to fetch menu from Supabase, using local data:', error.message)
    return localMenu
  }

  return (data ?? []).map(row => ({
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
}
