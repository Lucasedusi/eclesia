import "server-only";

type InvitationEmailInput = {
  to: string;
  invitedName: string;
  churchName: string;
  invitationUrl: string;
  expiresAt: string;
};

export type InvitationEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: "NOT_CONFIGURED" | "DELIVERY_FAILED" };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function formatExpiration(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function renderInvitationHtml(input: InvitationEmailInput) {
  const name = escapeHtml(input.invitedName);
  const church = escapeHtml(input.churchName);
  const invitationUrl = escapeHtml(input.invitationUrl);
  const expiresAt = escapeHtml(formatExpiration(input.expiresAt));

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#344054">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fa;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:18px;overflow:hidden">
          <tr><td style="background:#0b51b7;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:700">Eclésias</td></tr>
          <tr><td style="padding:36px 32px">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0b51b7">CONVITE DE ACESSO</p>
            <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25;color:#101828">Olá, ${name}!</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7">Você foi convidado para colaborar na administração de <strong>${church}</strong>.</p>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.7">Abra o link abaixo e crie somente a sua senha. Seu nome e e-mail já estarão preenchidos e, ao concluir, você entrará automaticamente no sistema.</p>
            <p style="margin:0 0 28px">
              <a href="${invitationUrl}" style="display:inline-block;background:#0b51b7;color:#ffffff;text-decoration:none;border-radius:10px;padding:15px 24px;font-size:14px;font-weight:700">Criar senha e acessar</a>
            </p>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#667085">Este convite é pessoal, só pode ser utilizado uma vez e expira em ${expiresAt}.</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#667085">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${invitationUrl}" style="color:#0b51b7;word-break:break-all">${invitationUrl}</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendInvitationEmail(
  input: InvitationEmailInput,
): Promise<InvitationEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Eclésias";

  if (!apiKey || !senderEmail) {
    return { ok: false, reason: "NOT_CONFIGURED" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: input.to, name: input.invitedName }],
        subject: `Convite para acessar ${input.churchName} no Eclésias`,
        htmlContent: renderInvitationHtml(input),
        tags: ["eclesias", "convite-de-acesso"],
      }),
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, reason: "DELIVERY_FAILED" };

    const payload = (await response.json()) as { messageId?: string };
    return { ok: true, messageId: payload.messageId ?? null };
  } catch {
    return { ok: false, reason: "DELIVERY_FAILED" };
  }
}
