-- ==============================================================================
-- CAMPUS BITES: COMPLETE REAL-TIME ORDER TRACKING & SECURE PAYMENT GATEWAY SCHEMA
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (with staff role support)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '+91 98765 43210',
    roll_no TEXT DEFAULT '',
    room_no TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '+91 98765 43210';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_no TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS room_no TEXT DEFAULT '';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id OR role IN ('staff', 'admin'));

DROP POLICY IF EXISTS "Users upsert own profile" ON public.profiles;
CREATE POLICY "Users upsert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

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

-- 3. Staff Roles Table (Dedicated Secure Staff Role Registry)
CREATE TABLE IF NOT EXISTS public.staff_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
    assigned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff roles viewable by authenticated users" ON public.staff_roles;
CREATE POLICY "Staff roles viewable by authenticated users" ON public.staff_roles
    FOR SELECT TO authenticated
    USING (true);

-- Helper function to check if current user has staff privileges
CREATE OR REPLACE FUNCTION public.is_staff(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_roles WHERE user_id = check_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = check_user_id AND role IN ('staff', 'admin')
    );
$$;

-- 4. Menu Items Table (Authoritative Menu & Pricing)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    counter TEXT NOT NULL,
    time TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    rating NUMERIC(3,1) DEFAULT 4.5,
    rating_count INTEGER DEFAULT 0,
    image TEXT NOT NULL,
    badge TEXT,
    category TEXT NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view available menu items" ON public.menu_items;
CREATE POLICY "Public can view available menu items" ON public.menu_items
    FOR SELECT TO authenticated, anon
    USING (true);

-- Seed authoritative menu items if table is empty
INSERT INTO public.menu_items (id, name, counter, time, description, price, rating, rating_count, image, badge, category, available)
VALUES
(1, 'Hot & Cheesy Omelette', 'Tiffin counter', '8 min', 'Three-egg omelette folded over molten cheese, onion and fresh herbs.', 70.00, 4.7, 126, 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Breakfast', true),
(2, 'Masala Dosa', 'Tiffin counter', '10 min', 'Crisp golden crepe with soft potato masala, coconut chutney and sambar.', 60.00, 4.8, 312, 'https://images.unsplash.com/photo-1694849789325-914b71ab4075?w=400&h=300&fit=crop&auto=format', NULL, 'Breakfast', true),
(3, 'Idli Sambar', 'Tiffin counter', '8 min', 'Soft steamed rice cakes with piping hot sambar and coconut chutney.', 45.00, 4.6, 204, 'https://images.unsplash.com/photo-1668236499396-a62d2d1cb0cf?w=400&h=300&fit=crop&auto=format', NULL, 'Breakfast', true),
(4, 'Filter Coffee', 'Beverages', '3 min', 'Strong south Indian filter coffee pulled the proper way.', 25.00, 4.9, 456, 'https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks', true),
(5, 'Chicken Biryani', 'Main counter', '15 min', 'Aromatic seeraga samba rice layered with tender marinated chicken.', 160.00, 4.9, 478, 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Lunch', true),
(6, 'Paneer Butter Masala', 'Main counter', '12 min', 'Creamy tomato-cashew gravy with soft paneer cubes.', 150.00, 4.7, 289, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop&auto=format', NULL, 'Lunch', true),
(7, 'Cheese Burger', 'Snacks counter', '10 min', 'Loaded with double cheese, onion and fresh lettuce.', 130.00, 4.8, 167, 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Snacks', true),
(8, 'Chicken Burger', 'Snacks counter', '10 min', 'Crispy chicken fillet with house sauce and pickles.', 120.00, 4.6, 143, 'https://images.unsplash.com/photo-1460306855393-0410f61241c7?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks', true),
(9, 'Grilled Veg Sandwich', 'Snacks counter', '7 min', 'Crunchy grilled sandwich with fresh veggies and cheese.', 55.00, 4.3, 98, 'https://images.unsplash.com/photo-1655279562015-047c3da9a271?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL UNIQUE,
    token_number INTEGER NOT NULL DEFAULT 12,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    payment TEXT NOT NULL DEFAULT 'upi', -- 'upi' | 'card' | 'cash'
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    packing NUMERIC(10,2) NOT NULL DEFAULT 10,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    stage INTEGER NOT NULL DEFAULT 0, -- 0=Placed, 1=Accepted, 2=Preparing, 3=Ready for Pickup, 4=Picked up
    eta_minutes INTEGER NOT NULL DEFAULT 15,
    estimated_ready_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    rating_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all required columns exist on orders (for safe upgrades)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS token_number INTEGER NOT NULL DEFAULT 12;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

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

-- 6. Order Items Table (Authoritative Historical Item Snapshot)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    customizations JSONB DEFAULT '{}'::jsonb,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;
CREATE POLICY "Users can view order items for their orders" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
              AND (orders.user_id = (SELECT auth.uid()) OR public.is_staff((SELECT auth.uid())))
        )
    );

DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
CREATE POLICY "Users can insert order items for own orders" ON public.order_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
              AND orders.user_id = (SELECT auth.uid())
        )
    );

-- 7. Order Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    actor_role TEXT NOT NULL DEFAULT 'customer',
    status_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view status history for their orders" ON public.order_status_history;
CREATE POLICY "Users can view status history for their orders" ON public.order_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_status_history.order_id
              AND (orders.user_id = (SELECT auth.uid()) OR public.is_staff((SELECT auth.uid())))
        )
    );

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

-- 8. Payments Table (Gateway Records & Reconciliation)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    gateway TEXT NOT NULL DEFAULT 'razorpay', -- 'razorpay' | 'cash'
    gateway_order_id TEXT UNIQUE,
    gateway_payment_id TEXT UNIQUE,
    amount INTEGER NOT NULL, -- in paise (e.g. 18500 = ₹185.00)
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    payment_method TEXT DEFAULT 'upi',
    failure_reason TEXT,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON public.payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments or staff can view all" ON public.payments;
CREATE POLICY "Users can view own payments or staff can view all" ON public.payments
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can insert payments for own orders" ON public.payments;
CREATE POLICY "Users can insert payments for own orders" ON public.payments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Staff and system can update payments" ON public.payments;
CREATE POLICY "Staff and system can update payments" ON public.payments
    FOR UPDATE TO authenticated
    USING (public.is_staff((SELECT auth.uid())))
    WITH CHECK (public.is_staff((SELECT auth.uid())));

-- 9. Payment Webhooks Table (Idempotent Webhook Deduplication)
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- 10. Strict Order Lifecycle State Machine Database Function
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_prev_status TEXT;
    v_actor UUID;
    v_actor_role TEXT;
    v_new_stage INTEGER;
BEGIN
    v_actor := auth.uid();

    -- Check staff permission (customers may only cancel when PLACED)
    IF public.is_staff(v_actor) THEN
        v_actor_role := 'staff';
    ELSE
        v_actor_role := 'customer';
    END IF;

    -- Fetch current order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    v_prev_status := v_order.status;

    -- Check if transition is valid
    IF p_new_status = 'CANCELLED' THEN
        IF v_order.status IN ('READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED') THEN
            RAISE EXCEPTION 'Cannot cancel an order that is already %', v_order.status;
        END IF;
        IF v_actor_role = 'customer' AND v_order.status NOT IN ('PLACED') THEN
            RAISE EXCEPTION 'Customer cannot cancel order once kitchen has accepted it';
        END IF;
        v_new_stage := -1;
    ELSIF v_order.status = 'PLACED' AND p_new_status = 'ACCEPTED' THEN
        v_new_stage := 1;
    ELSIF v_order.status = 'ACCEPTED' AND p_new_status = 'PREPARING' THEN
        v_new_stage := 2;
    ELSIF v_order.status = 'PREPARING' AND p_new_status = 'READY_FOR_PICKUP' THEN
        v_new_stage := 3;
    ELSIF v_order.status = 'READY_FOR_PICKUP' AND p_new_status = 'PICKED_UP' THEN
        v_new_stage := 4;
    ELSE
        RAISE EXCEPTION 'Invalid order status transition from % to %', v_order.status, p_new_status;
    END IF;

    -- Perform update
    UPDATE public.orders
    SET
        status = p_new_status,
        stage = CASE WHEN v_new_stage >= 0 THEN v_new_stage ELSE v_order.stage END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    -- Record in history
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        actor_id,
        actor_role,
        status_note
    ) VALUES (
        p_order_id,
        v_prev_status,
        p_new_status,
        v_actor,
        v_actor_role,
        p_note
    );

    RETURN v_order;
END;
$$;

-- 11. Profile creation trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'name',
            NEW.raw_user_meta_data ->> 'full_name',
            split_part(COALESCE(NEW.email, ''), '@', 1),
            ''
        ),
        COALESCE(NEW.email, ''),
        CASE
            WHEN NEW.email LIKE '%staff%@%' OR NEW.email LIKE '%canteen%@%' OR NEW.email = 'staff.canteen@campusbites.edu' THEN 'staff'
            ELSE 'customer'
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = CASE
            WHEN public.profiles.name = '' THEN EXCLUDED.name
            ELSE public.profiles.name
        END;

    -- If user is staff, register into staff_roles
    IF NEW.email LIKE '%staff%@%' OR NEW.email LIKE '%canteen%@%' OR NEW.email = 'staff.canteen@campusbites.edu' THEN
        INSERT INTO public.staff_roles (user_id, role)
        VALUES (NEW.id, 'staff')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 12. Enable Supabase Realtime for Tables
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
    -- Add orders to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- Add order_status_history to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'order_status_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
    END IF;

    -- Add payments to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
$$;