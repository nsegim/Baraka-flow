// This file defines the shape of ALL data in BarakaFlow
// Every piece of data in the app will match one of these interfaces

export interface StatCard {
  title: string
  value: string
  change: string      // e.g. "+12% from last month"
  positive: boolean   // true = green change, false = red change
  icon: string        // icon name
}

export interface RecentOrder {
  id: string
  customer: string
  product: string
  amount: number
  status: "pending" | "completed" | "cancelled"
  date: string
}

export interface LowStockItem {
  id: string
  name: string
  category: string
  stock: number
  minStock: number    // minimum before alert triggers
}