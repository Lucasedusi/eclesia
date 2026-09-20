import { describe, expect, it } from "vitest";
import { registrationsWithReceiptsUnderReview } from "./registration-payment-status";

describe("status visual do pagamento da inscrição", () => {
  it("marca somente comprovantes públicos de Pix estático ainda pendentes", () => {
    const registrations = registrationsWithReceiptsUnderReview([
      {
        registrationId: "registration-review",
        status: "PENDING",
        receiptStoragePath: "church/events/event/public-individuals/checkout/receipt.pdf",
        source: "PUBLIC",
        paymentFlow: "STATIC_PIX",
      },
      {
        registrationId: "registration-paid",
        status: "CONFIRMED",
        receiptStoragePath: "church/events/event/public-individuals/checkout/paid.pdf",
        source: "PUBLIC",
        paymentFlow: "STATIC_PIX",
      },
      {
        registrationId: "registration-internal",
        status: "PENDING",
        receiptStoragePath: "church/events/event/payments/internal.pdf",
        source: "INTERNAL",
        paymentFlow: null,
      },
      {
        registrationId: "registration-automatic",
        status: "PENDING",
        receiptStoragePath: "church/events/event/payments/automatic.pdf",
        source: "PUBLIC",
        paymentFlow: "AUTOMATIC_PIX",
      },
      {
        registrationId: "registration-without-receipt",
        status: "PENDING",
        receiptStoragePath: null,
        source: "PUBLIC",
        paymentFlow: "STATIC_PIX",
      },
    ]);

    expect([...registrations]).toEqual(["registration-review"]);
  });
});
