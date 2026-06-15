// lib/ folder is for utility functions and data
// "lib" is short for "library" — shared logic used across the app

import { RecentOrder, LowStockItem } from "@/types"

export const recentOrders: RecentOrder[] = [
  {
    id: "ORD-001",
    customer: "Karemera Furniture Store",
    product: "Sofa Set 3-Piece",
    amount: 450000,
    status: "completed",
    date: "2025-01-15",
  },
  {
    id: "ORD-002",
    customer: "Kigali Office Supplies",
    product: "Executive Dining Table",
    amount: 280000,
    status: "pending",
    date: "2025-01-15",
  },
  {
    id: "ORD-003",
    customer: "Gasabo District Office",
    product: "Office Chair Set x10",
    amount: 950000,
    status: "completed",
    date: "2025-01-14",
  },
  {
    id: "ORD-004",
    customer: "Muhanga Hotel",
    product: "King Bed Frame",
    amount: 320000,
    status: "pending",
    date: "2025-01-14",
  },
  {
    id: "ORD-005",
    customer: "Remera Shop",
    product: "Wardrobe 4-Door",
    amount: 185000,
    status: "cancelled",
    date: "2025-01-13",
  },
]

export const lowStockItems: LowStockItem[] = [
  {
    id: "PRD-023",
    name: "L-Shaped Office Desk",
    category: "Office Furniture",
    stock: 2,
    minStock: 5,
  },
  {
    id: "PRD-045",
    name: "Leather Executive Chair",
    category: "Chairs",
    stock: 1,
    minStock: 3,
  },
  {
    id: "PRD-067",
    name: "King Bed Frame (Dubai Import)",
    category: "Bedroom",
    stock: 3,
    minStock: 5,
  },
  {
    id: "PRD-089",
    name: "Glass Coffee Table",
    category: "Living Room",
    stock: 2,
    minStock: 4,
  },
]