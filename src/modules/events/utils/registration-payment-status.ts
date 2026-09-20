type RegistrationPaymentCandidate = {
  registrationId: string | null;
  status: string;
  receiptStoragePath: string | null;
  source: "PUBLIC" | "INTERNAL";
  paymentFlow: string | null;
};

export function registrationsWithReceiptsUnderReview(
  payments: readonly RegistrationPaymentCandidate[],
) {
  return new Set(
    payments
      .filter((payment) =>
        Boolean(payment.registrationId)
        && payment.status === "PENDING"
        && Boolean(payment.receiptStoragePath)
        && payment.source === "PUBLIC"
        && payment.paymentFlow === "STATIC_PIX")
      .map((payment) => payment.registrationId as string),
  );
}
