/**
 * CRM request-body validation + mass-assignment guard (Zod).
 *
 * Each create/update/transition body is validated against a whitelist schema. Zod strips unknown keys
 * by default, which does three things at once:
 *   1. type safety     -> a bad type returns 400 with a clear message (never a 500 from the service),
 *   2. anti-crash      -> junk/oversized/missing fields can't reach Prisma and blow up as a 500,
 *   3. mass-assignment -> server-controlled fields are simply not in the whitelist, so a client cannot
 *      set them: createdBy/updatedBy, sourceFile/legacyId, subtotal/total, status (via /transition
 *      only), reattemptCount, isDeleted, quotation version/isActive/parentId. `agentId` is allowed but
 *      is still scope-checked in the service; `scope` is allowed only on the SalesAgent endpoints.
 *
 * `validate(schema)` is Express middleware: it rejects a non-object body, runs safeParse, returns 400
 * on failure, and on success replaces req.body with the parsed (coerced, stripped) object.
 */
import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// ---- reusable field builders ----
const idStr = z.string().trim().min(1).max(64);
const name = z.string().trim().min(1).max(256);
const shortStr = (max = 256) => z.string().trim().max(max);
const longStr = z.string().trim().max(5000);
const money = z.coerce.number().int().min(0).max(1_000_000_000);
const qty = z.coerce.number().int().min(1).max(1_000_000);
const pct = z.coerce.number().min(0).max(100);
const dt = z.coerce.date();
const bool = z.coerce.boolean();

const Company = z.enum(["SOLARMAX", "POWERHIGHWAY", "OKASHASMART"]);
const Channel = z.enum(["WALK_IN", "PHONE", "WHATSAPP", "REFERRAL", "SOCIAL_MEDIA", "OFFLINE_MARKETING", "ONLINE_STORE", "OTHER"]);
const LeadStage = z.enum(["DRAFT", "NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "WON", "LOST", "ON_HOLD"]);
const LeadPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);
const ActivityType = z.enum(["CALL", "WHATSAPP", "VISIT", "EMAIL", "QUOTATION_SENT", "NOTE", "OTHER"]);
const PriceTier = z.enum(["RETAIL", "DEALER", "OUTLET"]);
const CrmProtocol = z.enum(["WIFI", "ZIGBEE", "BLUETOOTH", "RF", "WIRED", "OTHER"]);
const ProductStatus = z.enum(["ACTIVE", "DISCONTINUED"]);
const QuotationStatus = z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]);
const OrderStatus = z.enum(["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "RETURNED", "CANCELLED"]);
const ReturnStatus = z.enum(["REPORTED", "RECEIVED_BACK", "RESTOCKED", "DAMAGED"]);
const PaymentType = z.enum(["COD", "ADVANCE", "PARTIAL"]);
const AgentScope = z.enum(["OWN", "TEAM", "ALL"]);

const lineItem = z.object({
  productId: idStr.optional(), variantId: idStr.optional(), description: shortStr(500).optional(),
  quantity: qty, unitPrice: money.optional(), unitCost: money.optional(), lineDiscount: money.optional(),
});
const returnLineItem = z.object({ productId: idStr.optional(), description: shortStr(500).optional(), quantity: qty });
const items = (schema: z.ZodTypeAny) => z.array(schema).max(500);

// ---- schemas ----
export const schemas = {
  // list reads: coerce + CLAMP pagination to a max page size of 200, keep arbitrary filter keys (passthrough)
  readList: z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).transform((v) => Math.min(v, 200)).optional(),
  }).passthrough(),
  // id-only / simple action bodies (guard reads too, so a missing id is 400 not a Prisma 500)
  idOnly: z.object({ id: idStr }),
  leadId: z.object({ leadId: idStr }),
  fromVisitor: z.object({ visitorId: idStr }),
  fromQuotation: z.object({ quotationId: idStr }),
  fromOrder: z.object({ orderId: idStr, reason: longStr.min(1) }),
  leadAssign: z.object({ id: idStr, agentId: idStr.nullable().optional() }),
  byProduct: z.object({ productId: idStr }),
  byCategory: z.object({ categoryId: idStr }),
  bundleAddItem: z.object({ bundleId: idStr, productId: idStr, quantity: qty }),

  lead: {
    create: z.object({
      customerName: name, phone: shortStr(40).optional(), city: shortStr(120).optional(), area: shortStr(160).optional(),
      address: shortStr(500).optional(), notes: longStr.optional(), outlet: shortStr(120).optional(),
      channel: Channel.optional(), stage: LeadStage.optional(), priority: LeadPriority.optional(),
      estimatedValue: money.optional(), productId: idStr.optional(), requirement: longStr.optional(),
      agentId: idStr.nullable().optional(), dateReceived: dt.optional(), lastContactAt: dt.optional(),
      nextFollowUpAt: dt.optional(), visitorId: idStr.optional(), company: Company.optional(), leadNo: shortStr(64).optional(),
    }),
    update: z.object({
      id: idStr, customerName: name.optional(), phone: shortStr(40).optional(), city: shortStr(120).optional(),
      area: shortStr(160).optional(), address: shortStr(500).optional(), notes: longStr.optional(), outlet: shortStr(120).optional(),
      channel: Channel.optional(), priority: LeadPriority.optional(), estimatedValue: money.optional(),
      productId: idStr.optional(), requirement: longStr.optional(), agentId: idStr.nullable().optional(),
      lastContactAt: dt.optional(), nextFollowUpAt: dt.optional(), company: Company.optional(),
    }), // NOTE: no `stage` — stage changes go through /transition only
    transition: z.object({ id: idStr, to: LeadStage, reason: longStr.optional() }),
  },

  leadActivity: {
    create: z.object({
      leadId: idStr, type: ActivityType, outcome: shortStr(500).optional(), occurredAt: dt.optional(),
      nextFollowUpAt: dt.optional(), agentId: idStr.optional(), notes: longStr.optional(),
    }),
    update: z.object({ id: idStr, type: ActivityType.optional(), outcome: shortStr(500).optional(), nextFollowUpAt: dt.optional(), notes: longStr.optional() }),
    byLead: z.object({ leadId: idStr }),
  },

  quotation: {
    create: z.object({
      customerName: name, phone: shortStr(40).optional(), leadId: idStr.optional(), quotationNo: shortStr(64).optional(),
      tier: PriceTier.optional(), discount: money.optional(), validUntil: dt.optional(),
      agentId: idStr.nullable().optional(), outlet: shortStr(120).optional(), company: Company.optional(),
      items: items(lineItem).optional(),
    }),
    update: z.object({
      id: idStr, customerName: name.optional(), phone: shortStr(40).optional(), tier: PriceTier.optional(),
      discount: money.optional(), validUntil: dt.optional(), agentId: idStr.nullable().optional(),
      outlet: shortStr(120).optional(), items: items(lineItem).optional(),
    }), // no status/subtotal/total/version
    transition: z.object({ id: idStr, to: QuotationStatus, reason: longStr.optional() }),
  },

  order: {
    create: z.object({
      customerName: name, phone: shortStr(40).optional(), city: shortStr(120).optional(), outlet: shortStr(120).optional(),
      address: shortStr(500).optional(), area: shortStr(160).optional(), leadId: idStr.optional(), quotationId: idStr.optional(),
      channel: Channel.optional(), externalOrderNo: shortStr(64).optional(), courier: shortStr(64).optional(),
      trackingNo: shortStr(80).optional(), paymentType: PaymentType.optional(), amountReceived: money.optional(),
      dispatchedAt: dt.optional(), deliveredAt: dt.optional(), discount: money.optional(),
      agentId: idStr.nullable().optional(), company: Company.optional(), items: items(lineItem).optional(),
      tier: PriceTier.optional(), // transient: prices product-linked lines, not stored on the order
    }),
    update: z.object({
      id: idStr, customerName: name.optional(), phone: shortStr(40).optional(), city: shortStr(120).optional(),
      outlet: shortStr(120).optional(), address: shortStr(500).optional(), area: shortStr(160).optional(),
      channel: Channel.optional(), externalOrderNo: shortStr(64).optional(), courier: shortStr(64).optional(),
      trackingNo: shortStr(80).optional(), paymentType: PaymentType.optional(), amountReceived: money.optional(),
      dispatchedAt: dt.optional(), deliveredAt: dt.optional(), discount: money.optional(),
      agentId: idStr.nullable().optional(), items: items(lineItem).optional(),
      tier: PriceTier.optional(), // transient: prices product-linked lines, not stored on the order
    }), // no status/subtotal/total/reattemptCount
    transition: z.object({ id: idStr, to: OrderStatus, reason: longStr.optional() }),
  },

  salesReturn: {
    create: z.object({
      customerName: name, reason: longStr.min(1), orderId: idStr.optional(), phone: shortStr(40).optional(),
      city: shortStr(120).optional(), courier: shortStr(64).optional(), trackingNo: shortStr(80).optional(),
      reportedAt: dt.optional(), agentId: idStr.nullable().optional(), company: Company.optional(),
      items: items(returnLineItem).optional(),
    }),
    update: z.object({
      id: idStr, customerName: name.optional(), reason: longStr.optional(), phone: shortStr(40).optional(),
      city: shortStr(120).optional(), courier: shortStr(64).optional(), trackingNo: shortStr(80).optional(),
      reportedAt: dt.optional(), agentId: idStr.nullable().optional(),
    }), // no status
    transition: z.object({ id: idStr, to: ReturnStatus, reason: longStr.optional() }),
  },

  agent: {
    create: z.object({
      agentCode: shortStr(40).min(1), employeeId: idStr, userId: idStr.nullable().optional(), outlet: shortStr(120).optional(),
      teamLeadId: idStr.nullable().optional(), scope: AgentScope.optional(), monthlyTarget: money.optional(),
      commissionPct: pct.optional(), company: Company.optional(), isActive: bool.optional(),
    }),
    update: z.object({
      id: idStr, agentCode: shortStr(40).optional(), userId: idStr.nullable().optional(), outlet: shortStr(120).optional(),
      teamLeadId: idStr.nullable().optional(), scope: AgentScope.optional(), monthlyTarget: money.optional(),
      commissionPct: pct.optional(), company: Company.optional(), isActive: bool.optional(),
    }),
  },

  category: {
    create: z.object({ name, description: longStr.optional(), sortOrder: z.coerce.number().int().optional(), isActive: bool.optional() }),
    update: z.object({ id: idStr, name: name.optional(), description: longStr.optional(), sortOrder: z.coerce.number().int().optional(), isActive: bool.optional() }),
  },
  brand: {
    create: z.object({ name, categoryId: idStr.optional(), isActive: bool.optional() }),
    update: z.object({ id: idStr, name: name.optional(), categoryId: idStr.optional(), isActive: bool.optional() }),
  },
  product: {
    create: z.object({
      name, categoryId: idStr, sku: shortStr(64).optional(), brandId: idStr.optional(), protocol: CrmProtocol.optional(),
      description: longStr.optional(), specs: z.any().optional(), status: ProductStatus.optional(), stockItemId: idStr.optional(),
    }),
    update: z.object({
      id: idStr, name: name.optional(), categoryId: idStr.optional(), sku: shortStr(64).optional(), brandId: idStr.optional(),
      protocol: CrmProtocol.optional(), description: longStr.optional(), specs: z.any().optional(), status: ProductStatus.optional(), stockItemId: idStr.optional(),
    }),
    variant: z.object({ productId: idStr, sku: shortStr(64).optional(), name: shortStr(256).optional(), attributes: z.any().optional() }),
    image: z.object({ productId: idStr, url: shortStr(1000), alt: shortStr(256).optional(), sortOrder: z.coerce.number().int().optional() }),
  },
  priceList: {
    create: z.object({ productId: idStr, variantId: idStr.optional(), tier: PriceTier.optional(), price: money.optional(), cost: money.optional(), pricePending: bool.optional(), validFrom: dt.optional(), validTo: dt.optional() }),
    update: z.object({ id: idStr, tier: PriceTier.optional(), price: money.optional(), cost: money.optional(), pricePending: bool.optional(), validFrom: dt.optional(), validTo: dt.optional() }),
  },
  bundle: {
    create: z.object({ name, description: longStr.optional(), price: money.optional(), isActive: bool.optional(), items: z.array(z.object({ productId: idStr, quantity: qty })).max(200).optional() }),
    update: z.object({ id: idStr, name: name.optional(), description: longStr.optional(), price: money.optional(), isActive: bool.optional() }),
  },
};

/** Express middleware: validate req.body against `schema`; 400 on failure, else replace body with the parsed value. */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: "Invalid request body: expected a JSON object." });
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.join(".") || "body";
      return res.status(400).json({ success: false, message: `Validation failed: ${path} ${issue?.message || "is invalid"}` });
    }
    req.body = result.data;
    return next();
  };
}
