export type MenuItem = {
  id: number
  name: string
  counter: string
  time: string
  description: string
  price: number
  rating: number
  ratingCount: number
  image: string
  badge?: string
  category: string
}

export const menuItems: MenuItem[] = [
  {
    id: 1,
    name: 'Hot & Cheesy Omelette',
    counter: 'Tiffin counter',
    time: '8 min',
    description: 'Three-egg omelette folded over molten cheese, onion and fresh herbs.',
    price: 70,
    rating: 4.7,
    ratingCount: 126,
    image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=300&fit=crop&auto=format',
    badge: 'SPECIAL',
    category: 'Breakfast',
  },
  {
    id: 2,
    name: 'Masala Dosa',
    counter: 'Tiffin counter',
    time: '10 min',
    description: 'Crisp golden crepe with soft potato masala, coconut chutney and sambar.',
    price: 60,
    rating: 4.8,
    ratingCount: 312,
    image: 'https://images.unsplash.com/photo-1694849789325-914b71ab4075?w=400&h=300&fit=crop&auto=format',
    category: 'Breakfast',
  },
  {
    id: 3,
    name: 'Idli Sambar',
    counter: 'Tiffin counter',
    time: '8 min',
    description: 'Soft steamed rice cakes with piping hot sambar and coconut chutney.',
    price: 45,
    rating: 4.6,
    ratingCount: 204,
    image: 'https://images.unsplash.com/photo-1668236499396-a62d2d1cb0cf?w=400&h=300&fit=crop&auto=format',
    category: 'Breakfast',
  },
  {
    id: 4,
    name: 'Filter Coffee',
    counter: 'Beverages',
    time: '3 min',
    description: 'Strong south Indian filter coffee pulled the proper way.',
    price: 25,
    rating: 4.9,
    ratingCount: 456,
    image: 'https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?w=400&h=300&fit=crop&auto=format',
    category: 'Snacks',
  },
  {
    id: 5,
    name: 'Chicken Biryani',
    counter: 'Main counter',
    time: '15 min',
    description: 'Aromatic seeraga samba rice layered with tender marinated chicken.',
    price: 160,
    rating: 4.9,
    ratingCount: 478,
    image: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop&auto=format',
    badge: 'SPECIAL',
    category: 'Lunch',
  },
  {
    id: 6,
    name: 'Paneer Butter Masala',
    counter: 'Main counter',
    time: '12 min',
    description: 'Creamy tomato-cashew gravy with soft paneer cubes.',
    price: 150,
    rating: 4.7,
    ratingCount: 289,
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop&auto=format',
    category: 'Lunch',
  },
  {
    id: 7,
    name: 'Cheese Burger',
    counter: 'Snacks counter',
    time: '10 min',
    description: 'Loaded with double cheese, onion and fresh lettuce.',
    price: 130,
    rating: 4.8,
    ratingCount: 167,
    image: 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400&h=300&fit=crop&auto=format',
    badge: 'SPECIAL',
    category: 'Snacks',
  },
  {
    id: 8,
    name: 'Chicken Burger',
    counter: 'Snacks counter',
    time: '10 min',
    description: 'Crispy chicken fillet with house sauce and pickles.',
    price: 120,
    rating: 4.6,
    ratingCount: 143,
    image: 'https://images.unsplash.com/photo-1460306855393-0410f61241c7?w=400&h=300&fit=crop&auto=format',
    category: 'Snacks',
  },
  {
    id: 9,
    name: 'Grilled Veg Sandwich',
    counter: 'Snacks counter',
    time: '7 min',
    description: 'Crunchy grilled sandwich with fresh veggies and cheese.',
    price: 55,
    rating: 4.3,
    ratingCount: 98,
    image: 'https://images.unsplash.com/photo-1655279562015-047c3da9a271?w=400&h=300&fit=crop&auto=format',
    category: 'Snacks',
  },
]

export const categories = ['All', 'Breakfast', 'Snacks', 'Lunch']
