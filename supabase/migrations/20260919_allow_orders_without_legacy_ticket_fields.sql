-- Paid ticket identity now lives in tickets, not on orders.
ALTER TABLE public.orders
  ALTER COLUMN ticket_code DROP NOT NULL,
  ALTER COLUMN checked_in_at DROP NOT NULL;
