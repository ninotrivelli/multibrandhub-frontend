// Mirrors the backend contract under MultiBrandHub.Application.Sales and
// MultiBrandHub.Domain.Enums. All enums serialize as strings. Keep field
// names in sync with the backend records if they change.

export type PaymentMethod = 'Cash' | 'CreditCard' | 'DebitCard' | 'Transfer' | 'MercadoPago';

export type CardBrand = 'Visa' | 'MasterCard' | 'Oca' | 'Other';

export type SaleType = 'Sale' | 'Return';

export type SaleStatus = 'Completed' | 'Canceled' | 'Pending' | 'Refunded';

// Per-detail discount. Serializes as a string (JsonStringEnumConverter on the
// backend). 'None' means no discount; the value rules are enforced server-side.
export type SaleDetailDiscountType = 'None' | 'Percentage' | 'FixedAmount';

export interface CreateSaleDetailRequest {
  productId: string;
  quantity: number;
  // Omitted (or 'None'/null) when there is no discount. For 'Percentage',
  // discountValue is 0–100; for 'FixedAmount', it is a per-unit amount > 0 and
  // <= the unit price. The backend recomputes all money from these.
  discountType?: SaleDetailDiscountType;
  discountValue?: number | null;
}

export interface CreateSaleRequest {
  paymentMethod: PaymentMethod;
  // Required iff paymentMethod is CreditCard or DebitCard; must be null otherwise.
  cardBrand: CardBrand | null;
  details: CreateSaleDetailRequest[];
  // Optional free-text "Notas". <= 500 chars. null when empty.
  observations: string | null;
  // The backend derives the seller from the JWT and ignores it, so we do not
  // send it. Discounts now live per detail (see CreateSaleDetailRequest).
}

export interface CreateReturnDetailRequest {
  // The original sale's detail-line id. Returns target the exact line (a product
  // can appear in several lines with different discounts), not the product.
  originalSaleDetailId: string;
  // Positive in the request; the backend stores returned quantities negative.
  quantity: number;
}

export interface CreateReturnRequest {
  originalSaleId: string;
  details: CreateReturnDetailRequest[];
  observations: string | null;
}

export interface SaleDetailResponse {
  id: string;
  productId: string;
  // Set on return details: points back to the original sale's detail line.
  originalSaleDetailId: string | null;
  productName: string | null;
  brandName: string | null;
  quantity: number;
  unitPrice: number;
  discountType: SaleDetailDiscountType;
  discountValue: number | null;
  // Per-unit discount applied; unitNetPrice = unitPrice - unitDiscountAmount.
  unitDiscountAmount: number;
  unitNetPrice: number;
  subTotal: number;
  // TODO: confirm with user — the backend SaleDetailResponse does NOT return
  // these yet. Needed to render the product thumbnail in the sale-detail modal
  // (falls back to the category placeholder, then a generic one). Optional until
  // the backend adds ImageUrl + CategoryName to the sale detail projection.
  imageUrl?: string | null;
  categoryName?: string | null;
}

export interface SaleResponse {
  id: string;
  ticketId: string | null;
  date: string;
  type: SaleType;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cardBrand: CardBrand | null;
  status: SaleStatus;
  sellerId: string | null;
  sellerName: string | null;
  originalSaleId: string | null;
  details: SaleDetailResponse[];
  createdAt: string;
  observations: string | null;
}

export interface SaleSearchBrandResponse {
  brandId: string;
  brandName: string;
}

export interface SaleSearchResponse {
  id: string;
  ticketId: string | null;
  date: string;
  type: SaleType;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  // Null for non-card methods (Cash/Transfer/MercadoPago). On returns the
  // backend copies the original sale's method/brand.
  cardBrand: CardBrand | null;
  status: SaleStatus;
  sellerId: string | null;
  sellerName: string | null;
  createdAt: string;
  observations: string | null;
  brands: SaleSearchBrandResponse[];
}

export interface SaleSearchParams {
  searchTerm?: string;
  ticketId?: string;
  brandId?: string;
  // Restrict the feed to sales ('Sale') or returns ('Return'). Omitted = both.
  saleType?: SaleType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
