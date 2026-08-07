import { NextResponse } from "next/server";

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ cep: string }> },
) {
  const { cep: rawCep } = await context.params;
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) {
    return NextResponse.json({ message: "Informe um CEP com 8 dígitos." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("CEP_SERVICE_UNAVAILABLE");
    const address = (await response.json()) as ViaCepResponse;
    if (address.erro) {
      return NextResponse.json({ message: "CEP não encontrado. Preencha o endereço manualmente." }, { status: 404 });
    }
    return NextResponse.json({
      street: address.logradouro ?? "",
      district: address.bairro ?? "",
      city: address.localidade ?? "",
      state: address.uf ?? "",
    });
  } catch {
    return NextResponse.json(
      { message: "A consulta de CEP está indisponível. Você pode preencher o endereço manualmente." },
      { status: 503 },
    );
  }
}
