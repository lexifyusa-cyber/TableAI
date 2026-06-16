import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem } from "@/types/api";

export type CustomerOrderMode = "dine-in" | "take-out";
export type CustomerOrderStatus = "received" | "preparing" | "ready";

export interface CustomerCartItem {
  item_id: string;
  name: string;
  price_cents?: number | null;
  quantity: number;
}

export interface CustomerOrder {
  id: string;
  tenant: string;
  customer_id: string;
  mode: CustomerOrderMode;
  token_number: number;
  table_number?: number | null;
  payment_status: "paid";
  payment_reference: string;
  paid_at: string;
  status: CustomerOrderStatus;
  items: CustomerCartItem[];
  total_cents: number;
  created_at: string;
  updated_at: string;
}

interface CustomerOrderState {
  carts: Record<string, CustomerCartItem[]>;
  orders: Record<string, CustomerOrder[]>;
  addItem: (tenant: string, item: MenuItem) => void;
  updateQuantity: (tenant: string, itemId: string, quantity: number) => void;
  clearCart: (tenant: string) => void;
  submitOrder: (
    tenant: string,
    customerId: string,
    mode: CustomerOrderMode,
    paymentReference: string,
  ) => CustomerOrder | null;
  updateOrderStatus: (tenant: string, orderId: string, status: CustomerOrderStatus) => void;
}

function cartKey(tenant: string, customerId?: string) {
  return customerId ? `${tenant}:${customerId}` : tenant;
}

function totalCents(items: CustomerCartItem[]) {
  return items.reduce((sum, item) => sum + (item.price_cents ?? 0) * item.quantity, 0);
}

function tokenNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

function tableNumber() {
  return Math.floor(1 + Math.random() * 40);
}

export const customerOrderKey = cartKey;

export const useCustomerOrderStore = create<CustomerOrderState>()(
  persist(
    (set, get) => ({
      carts: {},
      orders: {},
      addItem: (tenant, item) =>
        set((state) => {
          const key = cartKey(tenant);
          const cart = state.carts[key] ?? [];
          const existing = cart.find((cartItem) => cartItem.item_id === item.id);
          const nextCart = existing
            ? cart.map((cartItem) =>
                cartItem.item_id === item.id
                  ? { ...cartItem, quantity: cartItem.quantity + 1 }
                  : cartItem,
              )
            : [
                ...cart,
                {
                  item_id: item.id,
                  name: item.name,
                  price_cents: item.price_cents,
                  quantity: 1,
                },
              ];
          return { carts: { ...state.carts, [key]: nextCart } };
        }),
      updateQuantity: (tenant, itemId, quantity) =>
        set((state) => {
          const key = cartKey(tenant);
          const cart = state.carts[key] ?? [];
          const nextCart = quantity <= 0
            ? cart.filter((item) => item.item_id !== itemId)
            : cart.map((item) => (item.item_id === itemId ? { ...item, quantity } : item));
          return { carts: { ...state.carts, [key]: nextCart } };
        }),
      clearCart: (tenant) =>
        set((state) => {
          const key = cartKey(tenant);
          return { carts: { ...state.carts, [key]: [] } };
        }),
      submitOrder: (tenant, customerId, mode, paymentReference) => {
        const key = cartKey(tenant);
        const cart = get().carts[key] ?? [];
        if (cart.length === 0) return null;
        const now = new Date().toISOString();
        const order: CustomerOrder = {
          id: crypto.randomUUID(),
          tenant,
          customer_id: customerId,
          mode,
          token_number: tokenNumber(),
          table_number: tableNumber(),
          payment_status: "paid",
          payment_reference: paymentReference,
          paid_at: now,
          status: "received",
          items: cart,
          total_cents: totalCents(cart),
          created_at: now,
          updated_at: now,
        };
        set((state) => ({
          carts: { ...state.carts, [key]: [] },
          orders: { ...state.orders, [tenant]: [order, ...(state.orders[tenant] ?? [])] },
        }));
        return order;
      },
      updateOrderStatus: (tenant, orderId, status) =>
        set((state) => ({
          orders: {
            ...state.orders,
            [tenant]: (state.orders[tenant] ?? []).map((order) =>
              order.id === orderId
                ? { ...order, status, updated_at: new Date().toISOString() }
                : order,
            ),
          },
        })),
    }),
    { name: "tableai.customer-orders" },
  ),
);
