CREATE OR REPLACE FUNCTION public.clear_organization_test_data(target_organization_id uuid)
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
    RAISE EXCEPTION 'Not authorized to clear test data for this organization';
  END IF;

  DELETE FROM public.tickets
  WHERE order_id IN (
    SELECT o.id
    FROM public.orders o
    JOIN public.events e ON e.id = o.event_id
    WHERE e.organization_id = target_organization_id
  );

  DELETE FROM public.orders o
  USING public.events e
  WHERE e.id = o.event_id
    AND e.organization_id = target_organization_id;

  DELETE FROM public.registrations r
  USING public.events e
  WHERE e.id = r.event_id
    AND e.organization_id = target_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_organization_test_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_organization_test_data(uuid) TO authenticated;