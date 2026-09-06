import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type { PublicCheckoutItem, PublicCheckoutStatus } from "../types/event.types";
import { ensureEventCredential } from "./event-credential.service";

type Row = Record<string, unknown>;
const number = (value: unknown) => Number.isFinite(Number(value ?? 0)) ? Number(value ?? 0) : 0;
const relation = (value: unknown) => Array.isArray(value) ? value[0] as Row | undefined : value as Row | null | undefined;

export async function getInternalRegistrationReceipt(eventId: string, registrationId: string): Promise<PublicCheckoutStatus> {
  const context = await requireAccessContext(PERMISSIONS.eventRegistrationsManage);
  const admin = createAdminClient();
  const [eventResult, registrationResult, itemResult, paymentResult] = await Promise.all([
    admin.from("events").select("id,name,starts_at,location_name,city,state").eq("id", eventId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle(),
    admin.from("event_registrations").select("id,registration_number,participant_name,congregation_id,status,payment_status,preferred_payment_method,total_amount,registered_at,confirmed_at,credential_version,congregations!event_registrations_congregation_tenant_fkey(name,regions(name))").eq("id", registrationId).eq("event_id", eventId).eq("church_id", context.church.id).is("event_group_id", null).is("deleted_at", null).maybeSingle(),
    admin.from("event_registration_items").select("event_item_id,item_name,quantity,unit_price,total_price").eq("event_registration_id", registrationId).is("deleted_at", null).order("created_at"),
    admin.from("event_payments").select("provider_payment_id,provider_status").eq("event_registration_id", registrationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (eventResult.error || !eventResult.data || registrationResult.error || !registrationResult.data) throw new Error("EVENT_REGISTRATION_RECEIPT_NOT_FOUND");
  const event = eventResult.data as Row;
  const registration = registrationResult.data as Row;
  const congregation = relation(registration.congregations);
  const region = relation(congregation?.regions);
  const status = String(registration.status);
  const credentialToken = await ensureEventCredential({ id: String(registration.id), credentialVersion: number(registration.credential_version), status });
  const items: PublicCheckoutItem[] = ((itemResult.data ?? []) as Row[]).map((item) => ({
    id: String(item.event_item_id), name: String(item.item_name), quantity: number(item.quantity), unitPrice: number(item.unit_price),
    totalPrice: number(item.total_price) || number(item.unit_price) * number(item.quantity),
  }));
  return {
    checkoutId: "internal", eventId: String(event.id), eventName: String(event.name), eventStartsAt: String(event.starts_at),
    eventLocation: [event.location_name, event.city, event.state].filter(Boolean).join(" · ") || null,
    registrationId: String(registration.id), registrationNumber: String(registration.registration_number), participantName: String(registration.participant_name),
    congregationName: congregation?.name ? String(congregation.name) : null, regionName: region?.name ? String(region.name) : null,
    registeredAt: String(registration.registered_at), confirmedAt: registration.confirmed_at ? String(registration.confirmed_at) : null,
    registrationStatus: status, paymentStatus: String(registration.payment_status),
    paymentMethod: String(registration.preferred_payment_method ?? "NOT_APPLICABLE") as PublicCheckoutStatus["paymentMethod"],
    checkoutStatus: status, totalAmount: number(registration.total_amount), items, expiresAt: null, credentialToken,
    providerPaymentId: paymentResult.data?.provider_payment_id ? String(paymentResult.data.provider_payment_id) : null,
    providerStatus: paymentResult.data?.provider_status ? String(paymentResult.data.provider_status) : null,
    paymentSimulationEnabled: false, isSimulatedPayment: false, pix: null,
  };
}
