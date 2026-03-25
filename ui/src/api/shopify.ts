import { api } from "./client";

export interface ShopifySalesDay {
  date: string;
  orders: number;
  revenue: number;
  currency: string;
}

export interface ShopifySalesSummary {
  store: string;
  period_days: number;
  since: string;
  total_orders: number;
  total_revenue: string;
  currency: string;
  by_day: ShopifySalesDay[];
}

export const shopifyApi = {
  health: () => api.get<{ ok: boolean; store: string; hasToken: boolean }>("/integrations/shopify/health"),
  sales: (days = 7) => api.get<ShopifySalesSummary>(`/integrations/shopify/sales?days=${days}`),
  orders: (limit = 5) => api.get<unknown>(`/integrations/shopify/orders?limit=${limit}`),
};
