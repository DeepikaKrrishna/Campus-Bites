-- ==============================================================================
-- CAMPUS BITES: HARDENED DATABASE SECURITY & STRICT RLS POLICIES
-- Migration: 20261025_harden_security_and_rls.sql
-- ==============================================================================

-- 1. PREVENT CUSTOMERS FROM ESCALATING TO STAFF OR ADMIN ROLES
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Permit trusted backend: direct DB superuser or Supabase service-role JWT
    IF current_user IN ('postgres', 'service_role', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_staff(auth.uid()) THEN
            RAISE EXCEPTION 'Unauthorized: Only canteen administrators can modify user roles';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK (
        (SELECT auth.uid()) = id AND (
            role = 'customer' OR public.is_staff((SELECT auth.uid()))
        )
    );

-- 2. SECURE ORDERS TABLE RLS & PREVENT TAMPERING
DROP POLICY IF EXISTS "Staff can update any order" ON public.orders;
CREATE POLICY "Staff can update any order" ON public.orders
    FOR UPDATE TO authenticated
    USING (public.is_staff((SELECT auth.uid())))
    WITH CHECK (public.is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Customers can update own order ratings or cancel" ON public.orders;
CREATE POLICY "Customers can update own order ratings or cancel" ON public.orders
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Strict immutability trigger: Prevent customers from changing prices, payment status, customer IDs, or arbitrary stages
CREATE OR REPLACE FUNCTION public.protect_order_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_is_staff BOOLEAN;
BEGIN
    -- Permit trusted backend: direct DB superuser or Supabase service-role JWT
    IF current_user IN ('postgres', 'service_role', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role' THEN
        RETURN NEW;
    END IF;

    v_is_staff := public.is_staff(auth.uid());

    -- Customer update restrictions
    IF NOT v_is_staff THEN
        -- Customer can never alter financial totals or user_id (null-safe IS DISTINCT FROM check)
        IF NEW.total IS DISTINCT FROM OLD.total 
           OR NEW.subtotal IS DISTINCT FROM OLD.subtotal 
           OR NEW.tax IS DISTINCT FROM OLD.tax 
           OR NEW.packing IS DISTINCT FROM OLD.packing THEN
            RAISE EXCEPTION 'Unauthorized: Order totals and items are immutable once created';
        END IF;

        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Unauthorized: Order customer ID cannot be reassigned';
        END IF;

        -- Customer can never alter payment_status
        IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
            RAISE EXCEPTION 'Unauthorized: Customer cannot modify payment verification status directly';
        END IF;

        -- Customer can only change status if cancelling a PLACED order
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT (OLD.status = 'PLACED' AND NEW.status = 'CANCELLED') THEN
                RAISE EXCEPTION 'Unauthorized: Customer cannot update order status beyond cancelling placed orders';
            END IF;
        END IF;
    ELSE
        -- Staff restrictions: Customer ID is immutable even for staff
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Unauthorized: Order customer ownership is immutable';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_order_immutability ON public.orders;
CREATE TRIGGER trg_protect_order_immutability
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_order_immutability();

-- 3. SECURE PAYMENTS TABLE (PREVENT CUSTOMER MANIPULATION)
DROP POLICY IF EXISTS "Staff and system can update payments" ON public.payments;
CREATE POLICY "Staff and system can update payments" ON public.payments
    FOR UPDATE TO authenticated
    USING (public.is_staff((SELECT auth.uid())))
    WITH CHECK (public.is_staff((SELECT auth.uid())));

-- 4. SECURE ORDER STATUS HISTORY (OWNERSHIP VERIFICATION)
DROP POLICY IF EXISTS "System and staff can insert status history" ON public.order_status_history;
CREATE POLICY "System and staff can insert status history" ON public.order_status_history
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_staff((SELECT auth.uid())) OR (
            actor_id = (SELECT auth.uid()) 
            AND new_status = 'CANCELLED'
            AND EXISTS (
                SELECT 1 FROM public.orders
                WHERE orders.id = order_status_history.order_id
                  AND orders.user_id = (SELECT auth.uid())
            )
        )
    );
