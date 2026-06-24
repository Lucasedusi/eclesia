import { createClient } from "@/lib/supabase/server";

function TestSection({
  title,
  data,
  error,
}: {
  title: string;
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  return (
    <section style={{ marginTop: "32px" }}>
      <h2>{title}</h2>

      {error ? (
        <div style={{ color: "red" }}>
          <strong>Erro:</strong>
          <pre>{error.message}</pre>
        </div>
      ) : (
        <div style={{ color: "green" }}>
          <strong>Conexão OK.</strong>
          <p>Registros encontrados: {data?.length ?? 0}</p>

          <pre
            style={{
              background: "#f4f4f4",
              color: "#111",
              padding: "16px",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "280px",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  const { data: churches, error: churchesError } = await supabase
    .from("churches")
    .select("id, name, status, city, state")
    .limit(5);

  const { data: congregations, error: congregationsError } = await supabase
    .from("congregations")
    .select("id, church_id, name, status, city, state")
    .limit(5);

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select(
      "id, church_id, name, category, level, is_ministerial, is_leadership, status",
    )
    .limit(5);

  const { data: ministries, error: ministriesError } = await supabase
    .from("ministries")
    .select("id, church_id, congregation_id, name, category, is_global, status")
    .limit(5);

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select(
      "id, church_id, congregation_id, full_name, member_status, member_type, created_at",
    )
    .limit(5);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>Teste de conexão com Supabase</h1>

      <p style={{ maxWidth: "760px", lineHeight: 1.6 }}>
        Esta página é temporária e serve apenas para validar se o projeto
        consegue ler dados reais do Supabase e se as policies/RLS estão
        liberadas durante o desenvolvimento.
      </p>

      <TestSection
        title="1. Tabela churches"
        data={churches}
        error={churchesError}
      />

      <TestSection
        title="2. Tabela congregations"
        data={congregations}
        error={congregationsError}
      />

      <TestSection title="3. Tabela roles" data={roles} error={rolesError} />

      <TestSection
        title="4. Tabela ministries"
        data={ministries}
        error={ministriesError}
      />

      <TestSection
        title="5. Tabela members"
        data={members}
        error={membersError}
      />
    </main>
  );
}
