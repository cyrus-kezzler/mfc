import { Metadata } from 'next'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: "Wholesale Pricing — MFC Admin",
  description: "Single source of truth for MFC ingredient costs, COGS, and wholesale prices",
}

export default function PricingPage() {
  return <PricingClient />
}
