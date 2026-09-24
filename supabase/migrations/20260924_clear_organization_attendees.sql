ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz;

CREATE OR REPLACE FUNCTION public.clear_organization_attendees(target_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = target_organization_id
      AND role IN ('organizer_admin', 'platform_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to clear these attendees';
  END IF;

  UPDATE public.tickets
  SET invalidated_at = COALESCE(invalidated_at, now())
  WHERE order_id IN (
    SELECT o.id
    FROM public.orders o
    JOIN public.events e ON e.id = o.event_id
    WHERE e.organization_id = target_organization_id
  );

  DELETE FROM public.registrations r
  USING public.events e
  WHERE e.id = r.event_id
    AND e.organization_id = target_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_organization_attendees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_organization_attendees(uuid) TO authenticated;