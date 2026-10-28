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
  sinpe_phone: string | null
  sinpe_name: string | null
  instagram: string | null
  tiktok: string | null
  google_review_url: string | null
  maps_url: string | null
  address: string | null
  hours: string | null
  currency: string
  table_count: number
  active: boolean
  /** custom = menú armado en ColonTab, pdf = archivo PDF, url = menú en otro sitio */
  menu_type?: MenuType
  menu_url?: string | null
}

export type MenuType = 'custom' | 'pdf' | 'url'

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

/** waiter = llamar al mesero, bill = pedir la cuenta, order = listo para ordenar */
export type ServiceType = 'waiter' | 'bill' | 'order'
/** 'transferencia' se muestra como SINPE Móvil */
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'

export type OrderStatus = 'nuevo' | 'preparando' | 'servido' | 'pagado' | 'cancelado'

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
}

export interface Order {
  id: string
  restaurant_id: string
  table_number: number
  guests: number | null
  notes: string | null
  total: number
  status: OrderStatus
  created_at: string
  order_items: OrderItem[]
}

export interface ServiceRequest {
  id: string
  restaurant_id: string
  table_number: number
  type: ServiceType
  guests: number | null
  payment_method: PaymentMethod | null
  status: 'pendiente' | 'atendido'
  created_at: string
}

export interface Suggestion {
  id: string
  restaurant_id: string
  table_number: number | null
  rating: number | null
  message: string
  created_at: string
}

/** Cómo entró el cliente a la mesa */
export type VisitSource = 'nfc' | 'qr' | 'link'

export interface Visit {
  id: string
  restaurant_id: string
  table_number: number
  source: VisitSource
  created_at: string
}

/** Código secreto de una mesa (va en el QR / NFC) */
export interface TableToken {
  number: number
  token: string
}

export type MemberRole = 'owner' | 'staff'

export interface Member {
  id: string
  restaurant_id: string
  email: string
  role: MemberRole
}

export interface RestaurantSummary extends Restaurant {
  owner_email: string | null
  request_count: number
}
