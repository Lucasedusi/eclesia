import {
  CalendarDays,
  FileArchive,
  Plus,
  Save,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/form/form-section";

export default function DesignSystemPage() {
  return (
    <AppShell
      title="Design System"
      subtitle="Componentes visuais base da plataforma"
    >
      <PageHeader
        title="Design System"
        subtitle="Página temporária para validar botões, inputs, cards, badges e formulários."
        action={
          <Button>
            <Plus size={18} />
            Novo exemplo
          </Button>
        }
      />

      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Membros"
            value="0"
            description="Cadastros ativos"
            icon={Users}
            variation="+0%"
          />

          <StatCard
            title="Eventos"
            value="0"
            description="Eventos ativos"
            icon={CalendarDays}
            variation="+0%"
          />

          <StatCard
            title="Financeiro"
            value="R$ 0,00"
            description="Resumo mensal"
            icon={Wallet}
            variation="+0%"
          />

          <StatCard
            title="Documentos"
            value="0"
            description="Arquivos internos"
            icon={FileArchive}
            variation="+0%"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <FormSection
            title="Exemplo de formulário"
            description="Padrão visual que será usado nos cadastros da plataforma."
            darkHeader
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="nome"
                label="Nome completo"
                placeholder="Ex: João da Silva"
                helperText="Informe o nome completo conforme documento."
              />

              <Input
                id="telefone"
                label="Telefone"
                placeholder="(00) 00000-0000"
              />

              <Select
                id="congregacao"
                label="Congregação"
                placeholder="Selecione a congregação"
                options={[
                  { label: "Sede", value: "sede" },
                  { label: "Vila Planaltina", value: "vila-planaltina" },
                  { label: "Outra congregação", value: "outra" },
                ]}
              />

              <Input id="data" label="Data de cadastro" type="date" />

              <div className="md:col-span-2">
                <Textarea
                  id="observacoes"
                  label="Observações"
                  placeholder="Digite observações internas, se necessário..."
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary">Cancelar</Button>

              <Button>
                <Save size={18} />
                Salvar cadastro
              </Button>
            </div>
          </FormSection>

          <Card>
            <CardHeader>
              <CardTitle>Estados visuais</CardTitle>
              <CardDescription>
                Badges e botões disponíveis para uso nos módulos.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-extrabold text-slate-800">
                  Badges
                </p>

                <div className="flex flex-wrap gap-2">
                  <Badge>Primário</Badge>
                  <Badge variant="success">Ativo</Badge>
                  <Badge variant="warning">Pendente</Badge>
                  <Badge variant="danger">Inativo</Badge>
                  <Badge variant="neutral">Neutro</Badge>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-extrabold text-slate-800">
                  Botões
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Primário</Button>
                  <Button size="sm" variant="secondary">
                    Secundário
                  </Button>
                  <Button size="sm" variant="ghost">
                    Ghost
                  </Button>
                  <Button size="sm" variant="danger">
                    Perigo
                  </Button>
                </div>
              </div>

              <div className="rounded-[14px] bg-[#f7f7f4] p-4">
                <p className="text-sm font-extrabold text-slate-950">
                  Padrão definido
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Estes componentes serão reaproveitados nos módulos reais para
                  manter consistência visual.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
