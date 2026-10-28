import type { MenuCategory, MenuItem, Restaurant } from '../types'

export const demoRestaurant: Restaurant = {
  id: 'demo',
  slug: 'la-esquina',
  name: 'La Esquina Restaurants',
  logo_text: 'LE',
  logo_url: null,
  primary_color: '#e0b13c',
  wifi_ssid: 'LaEsquina_Clientes',
  wifi_password: 'esquina2026',
  whatsapp: '5215512345678',
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/',
  google_review_url: 'https://www.google.com/maps',
  maps_url: 'https://www.google.com/maps',
  address: 'Av. Principal 123, Centro',
  hours: 'Lun a Jue: 12:00 – 22:00\nVie y Sáb: 12:00 – 00:00\nDom: 12:00 – 18:00',
  currency: 'MXN',
}

export const demoCategories: MenuCategory[] = [
  { id: 'c1', name: 'Entradas', position: 1 },
  { id: 'c2', name: 'Platos fuertes', position: 2 },
  { id: 'c3', name: 'Bebidas', position: 3 },
  { id: 'c4', name: 'Postres', position: 4 },
]

const i = (id: string, category_id: string, name: string, price: number, description: string): MenuItem => ({
  id, category_id, name, price, description, image_url: null, available: true,
})

export const demoItems: MenuItem[] = [
  i('m1', 'c1', 'Guacamole con totopos', 95, 'Aguacate fresco, cebolla, cilantro y chile serrano.'),
  i('m2', 'c1', 'Queso fundido', 110, 'Con chorizo y tortillas de harina.'),
  i('m3', 'c2', 'Tacos al pastor (4)', 120, 'Piña, cebolla y cilantro.'),
  i('m4', 'c2', 'Enchiladas verdes', 145, 'Rellenas de pollo, crema y queso.'),
  i('m5', 'c2', 'Arrachera', 240, 'Con frijoles charros y guacamole.'),
  i('m6', 'c3', 'Agua de horchata', 45, 'Vaso de 500 ml.'),
  i('m7', 'c3', 'Limonada mineral', 50, 'Natural o de pepino.'),
  i('m8', 'c3', 'Café de olla', 40, 'Con canela y piloncillo.'),
  i('m9', 'c4', 'Flan napolitano', 65, 'Receta de la casa.'),
  i('m10', 'c4', 'Churros con chocolate', 75, 'Seis piezas.'),
]
