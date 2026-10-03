ALTER TABLE public.ticket_types
  DROP COLUMN IF EXISTS sales_start_at,
  DROP COLUMN IF EXISTS sales_end_at;

ALTER TABLE public.events
  ADD COLUMN event_date_edit_deadline_at timestamptz;

UPDATE public.events
SET event_date_edit_deadline_at =
  (((start_datetime AT TIME ZONE 'Africa/Accra')::date + 5)::timestamp AT TIME ZONE 'Africa/Accra');

ALTER TABLE public.events
  ALTER COLUMN event_date_edit_deadline_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_event_date_edit_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.event_date_edit_deadline_at :=
      (((NEW.start_datetime AT TIME ZONE 'Africa/Accra')::date + 5)::timestamp AT TIME ZONE 'Africa/Accra');
  ELSE
    NEW.event_date_edit_deadline_at := OLD.event_date_edit_deadline_at;
    IF NEW.start_datetime IS DISTINCT FROM OLD.start_datetime
      AND now() >= OLD.event_date_edit_deadline_at THEN
      RAISE EXCEPTION 'The event date can no longer be changed; the four-day edit period has ended.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_date_edit_deadline ON public.events;
CREATE TRIGGER enforce_event_date_edit_deadline
  BEFORE INSERT OR UPDATE OF start_datetime, event_date_edit_deadline_at
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_date_edit_deadline();
