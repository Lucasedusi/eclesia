type JsonObject = Record<string, unknown>;

export type StaticPixCheckoutSnapshot = {
  key: string;
  holderName: string;
  qrStorageBucket: string | null;
  qrStoragePath: string | null;
  paymentInstructions: string;
};

export type ManualCheckoutSnapshot = {
  whatsappNumber: string;
  paymentInstructions: string;
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown) {
  const parsed = text(value);
  return parsed || null;
}

export function readCheckoutPaymentSnapshot(value: unknown): {
  staticPix: StaticPixCheckoutSnapshot | null;
  manualPayment: ManualCheckoutSnapshot | null;
} {
  const payload = object(value);
  const snapshot = object(payload?.paymentSnapshot);
  if (!snapshot || snapshot.version !== 1) return { staticPix: null, manualPayment: null };

  if (snapshot.flow === "STATIC_PIX") {
    return {
      staticPix: {
        key: text(snapshot.pixKey),
        holderName: text(snapshot.pixHolderName),
        qrStorageBucket: optionalText(snapshot.pixQrStorageBucket),
        qrStoragePath: optionalText(snapshot.pixQrStoragePath),
        paymentInstructions: text(snapshot.paymentInstructions),
      },
      manualPayment: null,
    };
  }

  if (snapshot.flow === "MANUAL") {
    return {
      staticPix: null,
      manualPayment: {
        whatsappNumber: text(snapshot.whatsappNumber),
        paymentInstructions: text(snapshot.paymentInstructions),
      },
    };
  }

  return { staticPix: null, manualPayment: null };
}
