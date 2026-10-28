import type { Restaurant } from '../types'

export function Logo({ restaurant, size = 96 }: { restaurant: Restaurant; size?: number }) {
  if (restaurant.logo_url) {
    return <img className="logo" src={restaurant.logo_url} alt={restaurant.name} width={size} height={size} />
  }
  return (
    <div className="logo" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {restaurant.logo_text}
    </div>
  )
}
