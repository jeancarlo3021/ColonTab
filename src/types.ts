export interface Restaurant {
  id: string
  slug: string
  name: string
  logo_text: string
  logo_url: string | null
  primary_color: string
  wifi_ssid: string | null
  wifi_password: string | null
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  google_review_url: string | null
  maps_url: string | null
  address: string | null
  hours: string | null
  currency: string
}

export interface MenuCategory {
  id: string
  name: string
  position: number
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  available: boolean
}

export interface CartLine {
  item: MenuItem
  quantity: number
}

export type ServiceType = 'waiter' | 'bill'
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'
