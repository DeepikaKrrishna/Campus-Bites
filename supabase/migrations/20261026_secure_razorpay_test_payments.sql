-- Persist verified Razorpay outcomes atomically and make webhook processing durable.

DROP POLICY IF EXISTS "Users can insert payments for own orders" ON public.payments;
DROP POLICY IF EXISTS "Staff and system can update payments" ON public.payments;

CREATE OR REPLACE FUNCTION public.process_razorpay_payment_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_gateway_order_id TEXT,
    p_payment_id TEXT,
    p_amount INTEGER,
    p_currency TEXT,
    p_failure_reason TEXT DEFAULT NULL,
    p_failure_is_final BOOLEAN DEFAULT TRUE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.payments%ROWTYPE;
    v_order public.orders%ROWTYPE;
BEGIN
    IF p_event_id IS NOT NULL THEN
        INSERT INTO public.payment_webhooks (event_id, event_type, payload)
        VALUES (
            p_event_id,
            p_event_type,
            jsonb_strip_nulls(jsonb_build_object(
                'gateway_order_id', p_gateway_order_id,
                'payment_id', p_payment_id,
                'amount', p_amount,
                'currency', p_currency
            ))
        )
        ON CONFLICT (event_id) DO NOTHING;

        IF NOT FOUND THEN
            RETURN 'DUPLICATE';
        END IF;
    END IF;

    IF p_event_type NOT IN ('payment.captured', 'payment.failed') THEN
        RETURN 'IGNORED';
    END IF;

    IF p_gateway_order_id IS NULL
       OR p_payment_id IS NULL
       OR p_amount IS NULL
       OR p_currency IS NULL THEN
        RAISE EXCEPTION 'Incomplete Razorpay payment event';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE gateway_order_id = p_gateway_order_id
      AND gateway = 'razorpay'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Razorpay order is not associated with a payment record';
    END IF;

    IF v_payment.amount <> p_amount OR upper(v_payment.currency) <> upper(p_currency) THEN
        RAISE EXCEPTION 'Razorpay payment amount or currency does not match the order';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_payment.order_id
      AND user_id = v_payment.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Razorpay payment is not associated with its customer order';
    END IF;

    IF p_event_type = 'payment.failed' THEN
        IF v_payment.status = 'PAID' THEN
            RETURN 'PAID';
        END IF;

        IF NOT p_failure_is_final THEN
            UPDATE public.payments
            SET failure_reason = left(COALESCE(p_failure_reason, 'Payment attempt failed'), 500),
                updated_at = NOW()
            WHERE id = v_payment.id;
            RETURN v_payment.status;
        END IF;

        UPDATE public.payments
        SET status = 'FAILED',
            gateway_payment_id = p_payment_id,
            failure_reason = left(COALESCE(p_failure_reason, 'Payment failed'), 500),
            updated_at = NOW()
        WHERE id = v_payment.id;

        UPDATE public.orders
        SET payment_status = 'FAILED',
            updated_at = NOW()
        WHERE id = v_order.id
          AND payment_status <> 'PAID';

        RETURN 'FAILED';
    END IF;

    IF v_payment.status = 'REFUNDED' THEN
        RETURN 'REFUNDED';
    END IF;

    IF v_payment.status = 'PAID' THEN
        IF v_payment.gateway_payment_id IS DISTINCT FROM p_payment_id THEN
            RAISE EXCEPTION 'A different payment has already been recorded for this Razorpay order';
        END IF;
        RETURN 'PAID';
    END IF;

    UPDATE public.payments
    SET status = 'PAID',
        gateway_payment_id = p_payment_id,
        failure_reason = NULL,
        verified_at = COALESCE(verified_at, NOW()),
        updated_at = NOW()
    WHERE id = v_payment.id;

    UPDATE public.orders
    SET payment_status = 'PAID',
        updated_at = NOW()
    WHERE id = v_order.id;

    RETURN 'PAID';
END;
$$;

REVOKE ALL ON FUNCTION public.process_razorpay_payment_event(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_razorpay_payment_event(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN)
    TO service_role;
