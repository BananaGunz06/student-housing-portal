import { FIT_ICON, FIT_LABEL, formatMoney } from '../lib/cost'
import type { ListingResult } from '../lib/filters'

/** HTML for a Leaflet divIcon: price on the pin, fit as colour + icon + label. */
export function pricePinHtml(r: ListingResult, selected = false, hovered = false): string {
  const price = formatMoney(r.cost.total)
  const label = `${price} a month, ${FIT_LABEL[r.fit]}: ${r.listing.title}`.replace(/"/g, '&quot;')
  const cls = `pin pin--${r.fit}${selected ? ' pin--selected' : ''}${hovered ? ' pin--hover' : ''}`
  return `<span class="${cls}" title="${label}"><span aria-hidden="true">${FIT_ICON[r.fit]}</span>${price}</span>`
}
