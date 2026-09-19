export type Organization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  payment_provider: 'paystack' | 'hubtel' | null
  payment_account_reference: string | null
  status: 'pending' | 'approved' | 'suspended'
  commission_rate: number
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  role: 'attendee' | 'organizer_admin' | 'platform_admin'
  organization_id: string | null
  access_status: 'pending' | 'active' | 'declined' | null
  created_at?: string
}

export type EventRow = {
  id: string
  organization_id: string
  title: string
  slug: string
  description: string | null
  banner_image_url: string | null
  venue_name: string | null
  venue_address: string | null
  start_datetime: string
  end_datetime: string | null
  is_paid: boolean
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  capacity: number | null
  registration_starts_at: string | null
  registration_ends_at: string | null
  deleted_at: string | null
  organizations?: Organization
}

export type TicketType = {
  id: string
  event_id: string
  name: string
  price: number
  quantity_available: number
  quantity_sold: number
  admits_count: number
  sales_start_at: string | null
  sales_end_at: string | null
}

export type Registration = {
  id: string
  event_id: string
  attendee_full_name: string
  attendee_email: string | null
  attendee_phone: string | null
  registration_code: string
  status: 'pending' | 'confirmed'
  checked_in_at: string | null
  created_at: string
}

export type Order = {
  id: string
  event_id: string
  ticket_type_id: string
  buyer_full_name: string
  buyer_email: string | null
  buyer_phone: string | null
  quantity: number
  total_amount: number
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_reference: string | null
  created_at: string
}

export type Ticket = {
  id: string
  order_id: string
  ticket_code: string
  max_admits: number
  check_in_count: number
  checked_in_at: string | null
  created_at?: string
}

export type Member = {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  nickname: string | null
  whatsapp_number: string | null
  call_number: string | null
  email: string | null
  location: string | null
  reason: string | null
  membership_code: string
  status: 'pending' | 'active' | 'inactive'
  created_at: string
}

export type GalleryImage = {
  id: string
  organization_id: string
  event_id: string | null
  image_url: string
  caption: string | null
  created_at: string
  deleted_at: string | null
}
