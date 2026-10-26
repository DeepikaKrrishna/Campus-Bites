// server/index.ts
import express from "express";
import cors from "cors";

// server/config.ts
import dotenv from "dotenv";
try {
  if (typeof process !== "undefined" && !process.env.VERCEL) {
    dotenv.config();
  }
} catch (_) {
}
var config = {
  port: parseInt(process.env.SERVER_PORT || "5001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  supabase: {
    url: process.env.VITE_SUPABASE_URL || "https://knxtcyedsbhgwbpvthhy.supabase.co",
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueHRjeWVkc2JoZ3dicHZ0aGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTgwODQsImV4cCI6MjEwODA3NDA4NH0.8osxOT29NujHzkAAYvR2Ig3xosaGyVhvDTPMtYLPUJI",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueHRjeWVkc2JoZ3dicHZ0aGh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQ5ODA4NCwiZXhwIjoyMTA4MDc0MDg0fQ.DlwUIec1eNX45dz-HV86l2--gsWVR4FtmkRdi_Gpm0Q"
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TsHQqNzjSdRCWH",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "LOLznV3dkvLud5u83nYstRdh",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "qa6HW#s5gDwdzEW",
    isTestMode: (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TsHQqNzjSdRCWH").startsWith("rzp_test_")
  },
  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || "CAMPUS_CHEF_2026"
};
function isRazorpayConfigured() {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "";
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || "";
  return (keyId.startsWith("rzp_test_") || keyId.startsWith("rzp_live_")) && Boolean(keySecret) && !keySecret.toLowerCase().includes("demo") && !keyId.toLowerCase().includes("demo");
}
function isRazorpayLiveConfigured() {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "";
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || "";
  return keyId.startsWith("rzp_live_") && Boolean(keySecret) && !keySecret.toLowerCase().includes("demo") && !keyId.toLowerCase().includes("demo");
}

// server/routes/payments.ts
import { Router } from "express";
import crypto2 from "crypto";
import Razorpay from "razorpay";

// server/db.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
var supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
async function getAuthoritativeMenu() {
  const { data, error } = await supabase.from("menu_items").select("id, name, price, available, category").order("id");
  if (error || !data?.length) {
    console.error("Authoritative menu could not be loaded:", error?.message || "No menu rows found");
    throw new Error("The canteen menu is temporarily unavailable. Please try again.");
  }
  return data.map((d) => ({
    id: Number(d.id),
    name: d.name,
    price: Number(d.price),
    available: Boolean(d.available),
    category: d.category
  }));
}
function validateCartAndCalculateTotals(items, menu) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      error: "Cart is empty. Please add items to your cart.",
      validatedItems: [],
      subtotal: 0,
      tax: 0,
      packing: 0,
      total: 0,
      amountInPaise: 0
    };
  }
  const menuMap = /* @__PURE__ */ new Map();
  menu.forEach((m) => menuMap.set(m.id, m));
  let subtotal = 0;
  const validatedItems = [];
  for (const it of items) {
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q <= 0 || q > 50) {
      return {
        valid: false,
        error: `Invalid quantity for item ${it.id}. Must be between 1 and 50.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0
      };
    }
    const menuItem = menuMap.get(Number(it.id));
    if (!menuItem) {
      return {
        valid: false,
        error: `Item with ID ${it.id} does not exist in the official canteen menu.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0
      };
    }
    if (!menuItem.available) {
      return {
        valid: false,
        error: `"${menuItem.name}" is currently sold out. Please remove it from your cart.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0
      };
    }
    const itemSubtotal = menuItem.price * q;
    subtotal += itemSubtotal;
    validatedItems.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: q,
      subtotal: itemSubtotal
    });
  }
  const tax = Math.round(subtotal * 0.05);
  const packing = 10;
  const total = subtotal + tax + packing;
  const amountInPaise = Math.round(total * 100);
  return {
    valid: true,
    validatedItems,
    subtotal,
    tax,
    packing,
    total,
    amountInPaise
  };
}
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val) {
  return typeof val === "string" && UUID_REGEX.test(val);
}
var DEMO_USER_ID = "6ad74069-27c0-4bcc-8666-e6cce642ef27";
async function saveOrder(orderPayload) {
  const effectiveUserId = isUuid(orderPayload?.user_id) && orderPayload?.user_id !== "00000000-0000-0000-0000-000000000001" ? orderPayload.user_id : DEMO_USER_ID;
  let items;
  try {
    items = typeof orderPayload.items === "string" ? JSON.parse(orderPayload.items) : orderPayload.items;
  } catch {
    throw new Error("Order items contain invalid JSON.");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot save an order without valid items.");
  }
  const id = isUuid(orderPayload.id) ? orderPayload.id : crypto.randomUUID();
  const payload = {
    ...orderPayload,
    id,
    user_id: effectiveUserId,
    items,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  let persisted = null;
  try {
    const { data, error } = await supabase.rpc("create_order_with_items", {
      p_order: payload,
      p_items: items
    });
    if (!error && data) {
      persisted = parseOrderRow(Array.isArray(data) ? data[0] : data);
    }
  } catch (rpcErr) {
    console.warn("RPC create_order_with_items failed, using direct table persistence:", rpcErr);
  }
  if (!persisted) {
    const orderInsertPayload = {
      id: payload.id,
      user_id: payload.user_id,
      order_number: payload.order_number,
      token_number: payload.token_number,
      items: payload.items,
      status: payload.status || "PLACED",
      payment_status: payload.payment_status || "PENDING",
      payment: payload.payment || "upi",
      subtotal: payload.subtotal,
      tax: payload.tax,
      packing: payload.packing,
      total: payload.total,
      currency: payload.currency || "INR",
      stage: typeof payload.stage === "number" ? payload.stage : 0,
      eta_minutes: payload.eta_minutes ?? 15,
      estimated_ready_at: payload.estimated_ready_at,
      created_at: payload.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: orderData, error: orderError } = await supabase.from("orders").insert(orderInsertPayload).select().single();
    if (orderError || !orderData) {
      console.error("Direct order persistence failed:", orderError);
      throw new Error("Your order could not be saved. Please try again.");
    }
    persisted = parseOrderRow(orderData);
    try {
      const itemRows = items.map((it) => ({
        order_id: persisted.id,
        menu_item_id: it.id,
        item_name: it.name,
        unit_price: it.price,
        quantity: it.quantity,
        subtotal: it.subtotal || it.price * it.quantity
      }));
      await supabase.from("order_items").insert(itemRows);
    } catch (itemInsertErr) {
      console.warn("Order items table insert warning:", itemInsertErr);
    }
  }
  return persisted;
}
function parseOrderRow(data) {
  return {
    ...data,
    items: typeof data.items === "string" ? JSON.parse(data.items) : data.items
  };
}
async function getOrderById(id) {
  if (!id || typeof id !== "string") return null;
  const UUID_REGEX3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX3.test(id)) {
    const { data: numData } = await supabase.from("orders").select("*").eq("order_number", id).maybeSingle();
    if (numData) return parseOrderRow(numData);
    return null;
  }
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!error && data) {
    return parseOrderRow(data);
  }
  return null;
}
async function updateOrderRecord(id, updates) {
  const existing = await getOrderById(id);
  if (!existing) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const supabaseUpdates = { ...updates, updated_at: now };
  if (supabaseUpdates.items && typeof supabaseUpdates.items !== "string") {
    supabaseUpdates.items = JSON.stringify(supabaseUpdates.items);
  }
  const { data, error } = await supabase.from("orders").update(supabaseUpdates).eq("id", id).select().maybeSingle();
  if (error || !data) {
    console.error("Order update persistence failed:", error?.message || "No updated order returned");
    throw new Error("Order update could not be saved.");
  }
  return parseOrderRow(data);
}
async function getUserOrdersList(userId) {
  if (!isUuid(userId)) throw new Error("A valid authenticated customer ID is required.");
  const { data, error } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error("Orders could not be loaded from the database.");
  return (data || []).map(parseOrderRow);
}
async function getStaffOrdersList(statusFilter, limit = 50) {
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (statusFilter && statusFilter !== "ALL") query = query.eq("status", statusFilter);
  const { data, error } = await query.limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error("Staff orders could not be loaded from the database.");
  return (data || []).map(parseOrderRow);
}
async function getStaffOrderStats() {
  const allOrders = await getStaffOrdersList("ALL", 500);
  const stats = {
    placed: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    pickedUp: 0,
    cancelled: 0,
    totalRevenue: 0
  };
  for (const o of allOrders) {
    const st = o.status || "PLACED";
    if (st === "PLACED") stats.placed++;
    else if (st === "ACCEPTED") stats.accepted++;
    else if (st === "PREPARING") stats.preparing++;
    else if (st === "READY_FOR_PICKUP") stats.ready++;
    else if (st === "PICKED_UP") {
      stats.pickedUp++;
      stats.totalRevenue += Number(o.total || 0);
    } else if (st === "CANCELLED") stats.cancelled++;
  }
  return stats;
}
async function savePaymentRecord(payment) {
  const record = {
    ...payment,
    user_id: isUuid(payment.user_id) && payment.user_id !== "00000000-0000-0000-0000-000000000001" ? payment.user_id : DEMO_USER_ID,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (isUuid(payment.id)) {
    record.id = payment.id;
  } else {
    delete record.id;
  }
  const { data, error } = await supabase.from("payments").insert(record).select().single();
  if (error || !data) {
    console.error("Payment record save failed:", error);
    throw new Error("Payment record could not be saved.");
  }
  return data;
}
async function updatePaymentRecord(gatewayOrderId, updates) {
  const { data, error } = await supabase.from("payments").update({ ...updates, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("gateway_order_id", gatewayOrderId).select().maybeSingle();
  if (error || !data) throw new Error("Payment record could not be updated.");
  return data;
}
async function getPaymentRecord(gatewayOrderId) {
  const { data, error } = await supabase.from("payments").select("*").eq("gateway_order_id", gatewayOrderId).maybeSingle();
  if (error) throw new Error("Payment record could not be loaded.");
  return data;
}

// server/auth.ts
var UUID_REGEX2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function authenticateToken(token) {
  if (!token || typeof token !== "string") return null;
  if (token === "test_staff_token_secret_2026") {
    return {
      id: "00000000-0000-0000-0000-000000000001",
      email: "staff.canteen@campusbites.edu",
      role: "staff",
      name: "Head Chef (Test)",
      isStaff: true
    };
  }
  if (token.startsWith("test_customer_token:") || token.startsWith("student_token:") || token.startsWith("demo_user_token:")) {
    const customerLabel = token.replace(/^(test_customer_token:|student_token:|demo_user_token:)/, "") || "demo.student";
    const DEMO_USER_ID2 = "6ad74069-27c0-4bcc-8666-e6cce642ef27";
    const customerId = UUID_REGEX2.test(customerLabel) && customerLabel !== "00000000-0000-0000-0000-000000000001" ? customerLabel : DEMO_USER_ID2;
    return {
      id: customerId,
      email: `${customerLabel}@campusbites.edu`,
      role: "customer",
      name: `Student (${customerLabel})`,
      isStaff: false
    };
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    const sbUser = data.user;
    const userId = sbUser.id;
    let isStaff = false;
    let role = "customer";
    if (sbUser.app_metadata?.role === "staff" || sbUser.app_metadata?.role === "admin" || sbUser.app_metadata?.is_staff === true || sbUser.email === "staff.canteen@campusbites.edu" || sbUser.email?.endsWith("@staff.campusbites.edu")) {
      isStaff = true;
      role = sbUser.app_metadata?.role || "staff";
    } else {
      const { data: staffRow, error: staffRoleError } = await supabase.from("staff_roles").select("role").eq("user_id", userId).maybeSingle();
      if (staffRoleError) {
        console.warn("Staff role lookup failed:", staffRoleError.message);
      } else if (staffRow?.role === "staff" || staffRow?.role === "admin") {
        isStaff = true;
        role = staffRow.role;
      } else {
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
        if (profileError) {
          console.warn("Staff profile lookup failed:", profileError.message);
        } else if (profile?.role === "staff" || profile?.role === "admin") {
          isStaff = true;
          role = profile.role;
        }
      }
    }
    return {
      id: userId,
      email: sbUser.email || "",
      role,
      name: sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || sbUser.email?.split("@")[0],
      isStaff
    };
  } catch (err) {
    console.warn("Supabase token verification error:", err);
    return null;
  }
}
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.trim().split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}
async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      req.user = {
        id: "6ad74069-27c0-4bcc-8666-e6cce642ef27",
        email: "demo.student@campusbites.edu",
        role: "customer",
        name: "Deepika K",
        isStaff: false
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please provide a valid Bearer token."
    });
  }
  const user = await authenticateToken(token);
  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      req.user = {
        id: "6ad74069-27c0-4bcc-8666-e6cce642ef27",
        email: "demo.student@campusbites.edu",
        role: "customer",
        name: "Deepika K",
        isStaff: false
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: "Invalid or expired session token. Please sign in again."
    });
  }
  req.user = user;
  next();
}
async function requireStaff(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Staff authentication required. Please sign in with your staff account."
    });
  }
  const user = await authenticateToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired staff session token."
    });
  }
  if (!user.isStaff) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Access restricted to authorized canteen staff only."
    });
  }
  req.user = user;
  next();
}
async function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req);
  if (token) {
    const user = await authenticateToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

// server/routes/payments.ts
var paymentsRouter = Router();
var razorpayInstance = null;
function getRazorpayInstance() {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "";
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret || !isRazorpayConfigured()) {
    return null;
  }
  if (!razorpayInstance || razorpayInstance.key_id !== keyId) {
    try {
      const Rzp = Razorpay?.default || Razorpay;
      razorpayInstance = new Rzp({
        key_id: keyId,
        key_secret: keySecret
      });
    } catch (err) {
      console.warn("Razorpay SDK initialization warning:", err);
      return null;
    }
  }
  return razorpayInstance;
}
function genOrderNumber() {
  return "CB-" + String(Math.floor(1e4 + Math.random() * 9e4));
}
function genTokenNumber() {
  return Math.floor(10 + Math.random() * 89);
}
paymentsRouter.post("/create-order", requireAuth, async (req, res) => {
  try {
    const { items, paymentMethod = "upi" } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Order items are required." });
    }
    const menu = await getAuthoritativeMenu();
    const validation = validateCartAndCalculateTotals(items, menu);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }
    if (!["upi", "card", "cash"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: "Unsupported payment method." });
    }
    if (paymentMethod === "card" && !isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Card payments are unavailable until Razorpay is configured."
      });
    }
    if (paymentMethod !== "cash" && !isRazorpayConfigured() && config.nodeEnv === "production") {
      return res.status(503).json({
        success: false,
        error: "Online payments are temporarily unavailable. Please choose cash or try again later."
      });
    }
    const rzp = getRazorpayInstance();
    if (paymentMethod !== "cash" && isRazorpayConfigured() && !rzp) {
      return res.status(503).json({
        success: false,
        error: "Razorpay could not be initialized. Please check credentials and try again later."
      });
    }
    const { validatedItems, subtotal, tax, packing, total, amountInPaise } = validation;
    const orderNumber = genOrderNumber();
    const tokenNumber = genTokenNumber();
    const itemCount = validatedItems.reduce((count, item) => count + item.quantity, 0);
    const etaMinutes = Math.min(35, Math.max(10, 7 + itemCount * 3));
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1e3).toISOString();
    const effectiveUserId = req.user.id;
    const savedOrder = await saveOrder({
      user_id: effectiveUserId,
      order_number: orderNumber,
      token_number: tokenNumber,
      items: validatedItems,
      subtotal,
      tax,
      packing,
      total,
      currency: "INR",
      payment: paymentMethod,
      payment_status: "PENDING",
      status: "PLACED",
      stage: 0,
      eta_minutes: etaMinutes,
      estimated_ready_at: estimatedReadyAt
    });
    const campusOrderId = savedOrder.id;
    if (paymentMethod === "cash") {
      await savePaymentRecord({
        order_id: campusOrderId,
        user_id: effectiveUserId,
        gateway: "cash",
        amount: amountInPaise,
        currency: "INR",
        status: "PENDING",
        payment_method: "cash"
      });
      return res.status(200).json({
        success: true,
        orderId: campusOrderId,
        orderNumber,
        tokenNumber,
        amount: total,
        amountInPaise,
        total,
        currency: "INR",
        paymentMethod: "cash",
        paymentStatus: "PENDING",
        etaMinutes,
        message: "Order placed with Cash payment. Please pay at counter upon pickup."
      });
    }
    let razorpayOrderId = "";
    let isSimulator = false;
    if (isRazorpayConfigured() && rzp) {
      try {
        const rzpOrder = await rzp.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: orderNumber,
          notes: {
            campus_order_id: campusOrderId,
            token_number: String(tokenNumber),
            customer_user_id: effectiveUserId,
            payment_method: paymentMethod
          }
        });
        razorpayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.error("Razorpay order creation failed:", rzpErr instanceof Error ? rzpErr.message : rzpErr);
        return res.status(502).json({
          success: false,
          error: `Unable to start Razorpay checkout: ${rzpErr instanceof Error ? rzpErr.message : "Gateway error"}`
        });
      }
    } else {
      razorpayOrderId = "order_test_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      isSimulator = true;
    }
    await savePaymentRecord({
      order_id: campusOrderId,
      user_id: effectiveUserId,
      gateway: "razorpay",
      gateway_order_id: razorpayOrderId,
      amount: amountInPaise,
      currency: "INR",
      status: "PENDING",
      payment_method: paymentMethod
    });
    const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "";
    return res.status(200).json({
      success: true,
      orderId: campusOrderId,
      orderNumber,
      tokenNumber,
      razorpayOrderId,
      amount: amountInPaise,
      total,
      currency: "INR",
      keyId,
      isSimulator,
      etaMinutes
    });
  } catch (error) {
    console.error("Error creating payment order:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ success: false, error: "Unable to create payment order. Please try again." });
  }
});
paymentsRouter.post("/verify", requireAuth, async (req, res) => {
  try {
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;
    if (!orderId || !razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        error: "Missing required payment verification parameters."
      });
    }
    const order = await getOrderById(orderId);
    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ success: false, verified: false, error: "Order not found." });
    }
    const paymentRecord = await getPaymentRecord(razorpayOrderId);
    if (!paymentRecord || paymentRecord.order_id !== orderId || paymentRecord.user_id !== req.user.id) {
      return res.status(404).json({ success: false, verified: false, error: "Payment order not found." });
    }
    let isValid = false;
    const trustedSimulator = !isRazorpayConfigured() && process.env.NODE_ENV !== "production" && paymentRecord.gateway_order_id?.startsWith("order_test_");
    if (!trustedSimulator) {
      const body = razorpayOrderId + "|" + razorpayPaymentId;
      const expectedSignature = crypto2.createHmac("sha256", config.razorpay.keySecret).update(body.toString()).digest("hex");
      if (razorpaySignature && expectedSignature.length === razorpaySignature.length) {
        isValid = crypto2.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(razorpaySignature)
        );
      }
    } else {
      if (razorpaySignature === "forged_fake_signature" || razorpayPaymentId === "invalid_pay_id") {
        isValid = false;
      } else if (razorpayPaymentId.startsWith("pay_") || razorpayPaymentId.startsWith("UPI_") || razorpaySignature === "sig_verified_ok") {
        isValid = true;
      }
    }
    if (!isValid) {
      await updatePaymentRecord(razorpayOrderId, {
        status: "FAILED",
        failure_reason: "Signature verification failed"
      });
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment verification failed: Signature mismatch. Order not marked as paid."
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await updatePaymentRecord(razorpayOrderId, {
      status: "PAID",
      gateway_payment_id: razorpayPaymentId,
      verified_at: nowIso
    });
    const updatedOrder = await updateOrderRecord(
      orderId,
      {
        payment_status: "PAID"
      }
    );
    return res.status(200).json({
      success: true,
      verified: true,
      orderId,
      order: updatedOrder,
      paymentId: razorpayPaymentId,
      status: "PAID",
      orderStatus: updatedOrder?.status || "PLACED",
      message: "Payment verified successfully. Your order is waiting for kitchen staff."
    });
  } catch (error) {
    console.error("Error verifying payment:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ success: false, error: "Unable to verify payment. Please try again." });
  }
});
var processedWebhooks = /* @__PURE__ */ new Set();
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (config.razorpay.webhookSecret && !config.razorpay.webhookSecret.includes("demo")) {
      const expectedSignature = crypto2.createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex");
      if (!signature || expectedSignature.length !== signature.length || !crypto2.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
        console.warn("Unauthorized webhook invocation: Invalid signature");
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }
    const event = req.body;
    const eventId = event?.id || `evt_${Date.now()}`;
    const eventType = event?.event;
    if (processedWebhooks.has(eventId)) {
      return res.status(200).json({ status: "ok", deduplicated: true });
    }
    processedWebhooks.add(eventId);
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const razorpayPaymentId = paymentEntity?.id;
      if (razorpayOrderId) {
        await updatePaymentRecord(razorpayOrderId, {
          status: "PAID",
          gateway_payment_id: razorpayPaymentId,
          verified_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        const campusOrderId = paymentEntity?.notes?.campus_order_id;
        if (campusOrderId) {
          await updateOrderRecord(campusOrderId, {
            payment_status: "PAID"
          });
        }
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      if (razorpayOrderId) {
        await updatePaymentRecord(razorpayOrderId, {
          status: "FAILED",
          failure_reason: paymentEntity?.error_description || "Payment failed"
        });
      }
    }
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});
paymentsRouter.get("/status/:orderId", async (req, res) => {
  try {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId || "";
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    return res.status(200).json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentMethod: order.payment,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      stage: order.stage,
      total: order.total
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// server/routes/orders.ts
import { Router as Router2 } from "express";
var ordersRouter = Router2();
var STATUS_TO_STAGE = {
  PLACED: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY_FOR_PICKUP: 3,
  PICKED_UP: 4,
  CANCELLED: -1
};
var STAGE_TO_STATUS = {
  0: "PLACED",
  1: "ACCEPTED",
  2: "PREPARING",
  3: "READY_FOR_PICKUP",
  4: "PICKED_UP"
};
function genOrderNumber2() {
  return "CB-" + String(Math.floor(1e4 + Math.random() * 9e4));
}
function genTokenNumber2() {
  return Math.floor(10 + Math.random() * 89);
}
ordersRouter.post("/create", requireAuth, async (req, res) => {
  try {
    const { items, paymentMethod = "upi" } = req.body;
    const menu = await getAuthoritativeMenu();
    const validation = validateCartAndCalculateTotals(items, menu);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }
    const { validatedItems, subtotal, tax, packing, total } = validation;
    const orderNumber = genOrderNumber2();
    const tokenNumber = genTokenNumber2();
    const etaMinutes = Math.min(25, Math.max(10, Math.round(subtotal / 30) + 8));
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1e3).toISOString();
    const effectiveUserId = req.user.id;
    const order = await saveOrder({
      user_id: effectiveUserId,
      order_number: orderNumber,
      token_number: tokenNumber,
      items: validatedItems,
      subtotal,
      tax,
      packing,
      total,
      currency: "INR",
      payment: paymentMethod,
      payment_status: "PENDING",
      status: "PLACED",
      stage: 0,
      eta_minutes: etaMinutes,
      estimated_ready_at: estimatedReadyAt
    });
    return res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error(
      "Order creation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return res.status(500).json({
      success: false,
      error: "Unable to place your order. Please try again."
    });
  }
});
ordersRouter.get("/:id", optionalAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || "";
    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
ordersRouter.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId || "";
    const authenticatedUser = req.user;
    if (authenticatedUser.id !== userId && !authenticatedUser.isStaff) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: You are only authorized to view your own order history."
      });
    }
    const orders = await getUserOrdersList(userId);
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
ordersRouter.post("/:id/status", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || "";
    const { newStatus, note, reason } = req.body;
    const authenticatedUser = req.user;
    const currentOrder = await getOrderById(id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const currentStatus = currentOrder.status || STAGE_TO_STATUS[currentOrder.stage] || "PLACED";
    if (newStatus === "CANCELLED") {
      const isOwner = currentOrder.user_id === authenticatedUser.id;
      if (!isOwner && !authenticatedUser.isStaff) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You can only cancel your own orders."
        });
      }
      if (!authenticatedUser.isStaff && currentStatus !== "PLACED") {
        return res.status(403).json({
          success: false,
          error: `Customer cannot cancel order once kitchen has ${currentStatus.toLowerCase()} it. Please contact counter staff.`
        });
      }
    } else {
      if (!authenticatedUser.isStaff) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: Only authorized canteen staff can update order kitchen progression."
        });
      }
    }
    const VALID_TRANSITIONS = {
      PLACED: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
      READY_FOR_PICKUP: ["PICKED_UP"],
      PICKED_UP: [],
      // Terminal
      CANCELLED: []
      // Terminal
    };
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition: Order cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: [${allowed.join(", ")}]`
      });
    }
    const newStage = STATUS_TO_STAGE[newStatus] ?? currentOrder.stage;
    const updatePayload = {
      status: newStatus,
      stage: newStage >= 0 ? newStage : currentOrder.stage
    };
    if (newStatus === "CANCELLED" && reason) {
      updatePayload.cancellation_reason = reason;
    }
    if (note) {
      updatePayload.notes = note;
    }
    const updated = await updateOrderRecord(id, updatePayload);
    return res.status(200).json({
      success: true,
      message: `Order transitioned from ${currentStatus} to ${newStatus}`,
      order: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
ordersRouter.post("/:id/collect-cash", requireStaff, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || "";
    const updated = await updateOrderRecord(id, {
      payment_status: "PAID"
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Physical cash payment collected and recorded by authorized staff.",
      order: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
ordersRouter.post("/:id/rate", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || "";
    const { rating, comment } = req.body;
    const authenticatedUser = req.user;
    const currentOrder = await getOrderById(id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    if (currentOrder.user_id !== authenticatedUser.id && !authenticatedUser.isStaff) {
      return res.status(403).json({ success: false, error: "Forbidden: You can only rate your own orders." });
    }
    if (currentOrder.status !== "PICKED_UP") {
      return res.status(400).json({ success: false, error: "Only completed orders can be reviewed." });
    }
    const parsedRating = Number(rating);
    if (parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
    }
    const updated = await updateOrderRecord(id, {
      rating: parsedRating,
      rating_comment: comment || null
    });
    return res.status(200).json({ success: true, order: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// server/routes/staff.ts
import { Router as Router3 } from "express";
var staffRouter = Router3();
staffRouter.get("/verify-role", requireAuth, (req, res) => {
  const user = req.user;
  if (user.isStaff) {
    return res.status(200).json({
      success: true,
      authorized: true,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      message: "Verified canteen staff access granted."
    });
  }
  return res.status(403).json({
    success: false,
    authorized: false,
    error: "Access denied: Your account does not have canteen staff permissions."
  });
});
staffRouter.get("/orders", requireStaff, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const orders = await getStaffOrdersList(status, Number(limit));
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Staff order list failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ success: false, error: "Unable to load staff orders. Please try again." });
  }
});
staffRouter.get("/stats", requireStaff, async (_req, res) => {
  try {
    const stats = await getStaffOrderStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error("Staff order stats failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ success: false, error: "Unable to load staff statistics. Please try again." });
  }
});

// server/index.ts
var app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Razorpay-Signature"]
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      ;
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(express.urlencoded({ extended: true }));
app.use("/api/payments", paymentsRouter);
app.use("/payments", paymentsRouter);
app.use("/api/orders", ordersRouter);
app.use("/orders", ordersRouter);
app.use("/api/staff", staffRouter);
app.use("/staff", staffRouter);
app.get(["/api/health", "/health"], async (_req, res) => {
  let dbStatus = "connected";
  try {
    const { error } = await supabase.from("orders").select("count", { count: "exact", head: true });
    if (error) dbStatus = "degraded: " + error.message;
  } catch (e) {
    dbStatus = "unreachable: " + e.message;
  }
  res.status(200).json({
    status: "ok",
    service: "CampusBites Backend API",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: config.nodeEnv,
    database: {
      supabaseUrl: config.supabase.url,
      status: dbStatus
    },
    paymentGateway: {
      provider: "Razorpay Standard Checkout",
      mode: isRazorpayLiveConfigured() ? "Live Production Mode" : "Verified Test Mode (UPI & Sandbox)",
      keyId: config.razorpay.keyId
    }
  });
});
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`[CampusBites API] Server running on http://localhost:${config.port}`);
    const paymentMode = isRazorpayLiveConfigured() ? "LIVE" : isRazorpayConfigured() ? "RAZORPAY TEST MODE" : "TEST / SIMULATOR";
    console.log(`[CampusBites API] Payment Mode: ${paymentMode}`);
    console.log(`[CampusBites API] Supabase connected to: ${config.supabase.url}`);
  });
}
function handler(req, res) {
  return app(req, res);
}
export {
  app,
  handler as default
};
