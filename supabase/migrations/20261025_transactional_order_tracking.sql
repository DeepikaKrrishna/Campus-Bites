-- Transactional order creation and lifecycle updates for CampusBites.
-- Apply through the normal Supabase migration workflow after review.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order JSONB, p_items JSONB)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized order creation';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order requires at least one item';
  END IF;

  INSERT INTO public.orders (
    id, user_id, order_number, token_number, items, status, payment_status,
    payment, subtotal, tax, packing, total, currency, stage, eta_minutes,
    estimated_ready_at, created_at, updated_at
  ) VALUES (
    COALESCE(NULLIF(p_order->>'id', '')::UUID, gen_random_uuid()),
    (p_order->>'user_id')::UUID,
    p_order->>'order_number',
    (p_order->>'token_number')::INTEGER,
    p_items,
    'PLACED',
    COALESCE(p_order->>'payment_status', 'PENDING'),
    COALESCE(p_order->>'payment', 'upi'),
    (p_order->>'subtotal')::NUMERIC,
    (p_order->>'tax')::NUMERIC,
    (p_order->>'packing')::NUMERIC,
    (p_order->>'total')::NUMERIC,
    COALESCE(p_order->>'currency', 'INR'),
    0,
    (p_order->>'eta_minutes')::INTEGER,
    NULLIF(p_order->>'estimated_ready_at', '')::TIMESTAMPTZ,
    NOW(), NOW()
  ) RETURNING * INTO v_order;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, menu_item_id, item_name, unit_price, quantity, subtotal,
      customizations, image_url
    ) VALUES (
      v_order.id,
      (v_item->>'id')::INTEGER,
      v_item->>'name',
      (v_item->>'price')::NUMERIC,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'subtotal')::NUMERIC,
      COALESCE(v_item->'customizations', '{}'::JSONB),
      NULLIF(v_item->>'image', '')
    );
  END LOOP;

  INSERT INTO public.order_status_history
    (order_id, previous_status, new_status, actor_role, status_note)
  VALUES
    (v_order.id, NULL, 'PLACED', 'system', 'Order placed and queued for kitchen');

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_expected_status TEXT,
  p_new_status TEXT,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_note TEXT DEFAULT NULL,
  p_updates JSONB DEFAULT '{}'::JSONB
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_timestamp_column TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized order status update';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'ORDER_CONFLICT';
  END IF;

  IF NOT (
    (p_expected_status = 'PLACED' AND p_new_status IN ('ACCEPTED', 'CANCELLED')) OR
    (p_expected_status = 'ACCEPTED' AND p_new_status IN ('PREPARING', 'CANCELLED')) OR
    (p_expected_status = 'PREPARING' AND p_new_status IN ('READY_FOR_PICKUP', 'CANCELLED')) OR
    (p_expected_status = 'READY_FOR_PICKUP' AND p_new_status = 'PICKED_UP')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition';
  END IF;

  UPDATE public.orders SET
    status = p_new_status,
    stage = CASE p_new_status
      WHEN 'ACCEPTED' THEN 1 WHEN 'PREPARING' THEN 2
      WHEN 'READY_FOR_PICKUP' THEN 3 WHEN 'PICKED_UP' THEN 4
      WHEN 'CANCELLED' THEN -1 ELSE stage END,
    cancellation_reason = CASE WHEN p_new_status = 'CANCELLED'
      THEN COALESCE(NULLIF(p_updates->>'cancellation_reason', ''), cancellation_reason)
      ELSE cancellation_reason END,
    notes = COALESCE(NULLIF(p_updates->>'notes', ''), notes),
    accepted_at = CASE WHEN p_new_status = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
    preparing_at = CASE WHEN p_new_status = 'PREPARING' THEN NOW() ELSE preparing_at END,
    ready_at = CASE WHEN p_new_status = 'READY_FOR_PICKUP' THEN NOW() ELSE ready_at END,
    picked_up_at = CASE WHEN p_new_status = 'PICKED_UP' THEN NOW() ELSE picked_up_at END,
    cancelled_at = CASE WHEN p_new_status = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_status_history
    (order_id, previous_status, new_status, actor_id, actor_role, status_note)
  VALUES
    (p_order_id, p_expected_status, p_new_status, p_actor_id, p_actor_role, p_note);

  RETURN v_order;
END;
$$;

-- Order writes now go through the authenticated server, which uses the two
-- service-role-only RPCs above. Remove direct client writes that bypass pricing,
-- transition checks, or the transactional history entry.
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update any order" ON public.orders;
DROP POLICY IF EXISTS "Customers can update own order ratings or cancel" ON public.orders;
DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
DROP POLICY IF EXISTS "System and staff can insert status history" ON public.order_status_history;

-- The previous public routine did not verify order ownership and let any
-- authenticated user request kitchen transitions. Keep it unavailable to clients.
REVOKE ALL ON FUNCTION public.update_order_status(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_order_with_items(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_order_status(UUID, TEXT, TEXT, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID, TEXT, TEXT, UUID, TEXT, TEXT, JSONB) TO service_role;
