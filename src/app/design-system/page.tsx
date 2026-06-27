"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Trash2,
  UserRoundPlus,
  Users,
  Wallet,
  X,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableCheckbox,
  TableHead,
  TableHeader,
  TableRoot,
  TableRow,
  TableToolbar,
} from "@/components/ui/table";
import { Toast } from "@/components/ui/toast";
import { FormContainer, FormSection } from "@/components/form/form-section";

const tableRows = Array.from({ length: 8 }).map((_, index) => ({
  id: index + 1,
  selected: index < 4,
  status: index % 3 === 0 ? "inactive" : "active",
}));

type ToastTestVariant = "success" | "danger" | "warning" | "neutral";

type ToastTestState = {
  title: string;
  variant: ToastTestVariant;
  filled?: boolean;
};

const defaultToastTest: ToastTestState = {
  title: "Cadastro salvo com sucesso",
  variant: "success",
  filled: false,
};

function ModalPreview({
  variant = "confirm",
}: {
  variant?: "confirm" | "danger";
}) {
  const danger = variant === "danger";

  return (
    <div className="rounded-[6px] bg-white p-6 shadow-[var(--shadow-modal)]">
      <div className="flex items-start gap-4">
        <span
          className={
            danger
              ? "flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[#ff2f25]"
              : "flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"
          }
        >
          {danger ? (
            <Trash2 size={22} strokeWidth={1.8} />
          ) : (
            <CheckCircle2 size={23} strokeWidth={1.8} />
          )}
        </span>

        <div className="flex-1">
          <h3 className="text-[18px] font-bold text-[var(--text-title)]">
            {danger ? "Confirmação de Delete" : "Confirmação"}
          </h3>
          <p className="mt-1 text-[14px] font-medium leading-6 text-[var(--text-body)]">
            {danger
              ? "Tem certeza que deseja excluir, essa ação apagará tudo."
              : "Tem certeza que deseja confirmar esta ação?"}
          </p>
        </div>

        <X size={21} strokeWidth={1.8} className="text-[#5E6366]" />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button variant={danger ? "danger" : "primary"}>
          {danger ? "Delete" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [activeToast, setActiveToast] = useState<ToastTestState | null>(
    defaultToastTest,
  );

  return (
    <AppShell
      title="Design System"
      subtitle="Componentes visuais base da plataforma"
    >
      <PageHeader
        title="Design System"
        badge="Base visual"
        subtitle="Padrões principais para layout, formulários, botões, modais, tabelas e feedbacks."
        action={
          <Button>
            <Plus size={18} />
            Novo componente
          </Button>
        }
      />

      {activeToast && (
        <div className="fixed right-6 top-6 z-[9999] w-[353px] max-w-[calc(100vw-48px)]">
          <Toast
            title={activeToast.title}
            variant={activeToast.variant}
            filled={activeToast.filled}
          />
        </div>
      )}

      <div className="space-y-8">
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

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Botões</CardTitle>
              <CardDescription>
                Variantes principais, relatório/exportação, contorno e ação
                destrutiva.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Button fullWidth>Continue</Button>
              <Button fullWidth variant="report">
                Relatório
              </Button>
              <Button fullWidth>
                <Plus size={18} />
                Normal Button
              </Button>
              <Button fullWidth variant="report">
                <FileText size={18} />
                Relatório
              </Button>
              <Button fullWidth variant="outline">
                <FileText size={18} />
                Teste Button
              </Button>
              <Button fullWidth variant="danger">
                <Trash2 size={18} />
                Normal Button
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>
                Label flutuante, foco em azul e estado de erro em vermelho.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input
                id="first-name"
                label="First Name"
                defaultValue="Janet Do"
              />
              <Input
                id="last-name"
                label="Last Name"
                placeholder="Your Last Name"
              />
              <Input
                id="email"
                label="Email"
                defaultValue="john@udidssds"
                error="Invalid email address, please check and try again"
              />
              <Select
                id="account-type"
                label="Account Type"
                options={[
                  { label: "Membro", value: "membro" },
                  { label: "Obreiro", value: "obreiro" },
                  { label: "Pastor", value: "pastor" },
                ]}
              />
            </CardContent>
          </Card>
        </section>

        <FormContainer
          title="Complete Account Setup"
          step={1}
          totalSteps={4}
          footer={
            <>
              <Button variant="outline">
                <RotateCcw size={18} />
                Retornar
              </Button>
              <Button>
                Avançar
                <FileText size={18} />
              </Button>
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              id="fc-first"
              label="First Name"
              placeholder="Your First Name"
            />
            <Input
              id="fc-first-2"
              label="First Name"
              placeholder="Your First Name"
            />
            <Input
              id="fc-last"
              label="Last Name"
              placeholder="Your Last Name"
            />
            <Input
              id="fc-last-2"
              label="Last Name"
              placeholder="Your Last Name"
            />
            <Input
              id="fc-email"
              label="Email"
              placeholder="Your Email Address"
            />
            <Input
              id="fc-email-2"
              label="Email"
              placeholder="Your Email Address"
            />
            <Select
              id="fc-type"
              label="Account Type"
              options={[{ label: "Secretaria", value: "secretaria" }]}
            />
            <Select
              id="fc-type-2"
              label="Account Type"
              options={[{ label: "Tesouraria", value: "tesouraria" }]}
            />
          </div>
        </FormContainer>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <FormSection
            title="Exemplo de formulário"
            description="Padrão que será usado nos cadastros da plataforma."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="nome"
                label="Nome completo"
                placeholder="Ex: João da Silva"
              />
              <Input
                id="telefone"
                label="Telefone"
                placeholder="(00) 00000-0000"
              />
              <Select
                id="congregacao"
                label="Congregação"
                options={[
                  { label: "Sede", value: "sede" },
                  { label: "Vila Planaltina", value: "vila-planaltina" },
                  { label: "Outra congregação", value: "outra" },
                ]}
              />
              <Input id="data" label="Data de cadastro" type="date" />
              <div className="md:col-span-2">
                <Checkbox
                  id="termos"
                  label="Aceito os termos de cadastro"
                  defaultChecked
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button>
                <UserRoundPlus size={18} />
                Salvar cadastro
              </Button>
              <Button variant="outline">
                <X size={18} />
                Cancelar
              </Button>
            </div>
          </FormSection>

          <Card>
            <CardHeader>
              <CardTitle>Modais e feedback</CardTitle>
              <CardDescription>
                Modelo visual para confirmações, alertas e notificações rápidas.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="rounded-[6px] border border-[#EAECF0] bg-[#F9FAFB] p-4">
                <div className="mb-4">
                  <h3 className="text-[15px] font-bold text-[var(--text-title)]">
                    Teste temporário dos Toasts
                  </h3>
                  <p className="mt-1 text-[13px] font-medium leading-5 text-[var(--text-body)]">
                    Clique em uma opção para manter o toast fixo na tela
                    enquanto ajusta o estilo do componente.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Cadastro salvo com sucesso",
                        variant: "success",
                      })
                    }
                  >
                    Toast sucesso
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Membro cadastrado com sucesso",
                        variant: "success",
                        filled: true,
                      })
                    }
                  >
                    Sucesso filled
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Não foi possível salvar agora",
                        variant: "danger",
                      })
                    }
                  >
                    Toast erro
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Já existe um membro com este CPF",
                        variant: "danger",
                        filled: true,
                      })
                    }
                  >
                    Erro filled
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Revise os campos obrigatórios",
                        variant: "warning",
                      })
                    }
                  >
                    Toast alerta
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveToast({
                        title: "Salvando cadastro do membro",
                        variant: "neutral",
                        filled: true,
                      })
                    }
                  >
                    Toast neutro
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveToast(null)}
                  >
                    Ocultar toast
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ModalPreview />
                <ModalPreview variant="danger" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Toast title="Lorem ipsum est" />
                <Toast title="Lorem ipsum in" variant="danger" filled />
                <Toast title="Lorem ipsum integer" variant="warning" />
                <Toast title="Lorem ipsum amet" variant="warning" filled />
              </div>
            </CardContent>
          </Card>
        </section>

        <TableRoot
          toolbar={
            <TableToolbar
              actions={
                <>
                  <Button variant="ghost" size="sm">
                    <Trash2 size={17} />
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Filter size={17} />
                    Filters
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download size={17} />
                    Export
                  </Button>
                </>
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[56px]">
                  <TableCheckbox />
                </TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead sortable>Column heading</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <TableCheckbox checked={row.selected} />
                  </TableCell>
                  <TableCell strong>Bold text column</TableCell>
                  <TableCell>Regular text column</TableCell>
                  <TableCell>Regular text column</TableCell>
                  <TableCell>Regular text column</TableCell>
                  <TableCell>Regular text column</TableCell>
                  <TableCell>
                    {row.status === "active" ? (
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="neutral" dot>
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>Regular text column</TableCell>
                  <TableCell>
                    <TableActions />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>

        <Card>
          <CardHeader>
            <CardTitle>Princípios do padrão</CardTitle>
            <CardDescription>
              Leve, moderno, com bordas suaves, sombra discreta e ícones finos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[6px] border border-[#EAECF0] p-4">
              <p className="text-[13px] font-bold text-[#101828]">
                Cor principal
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#667085]">
                #415BA5
              </p>
            </div>
            <div className="rounded-[6px] border border-[#EAECF0] p-4">
              <p className="text-[13px] font-bold text-[#101828]">Sidebar</p>
              <p className="mt-1 text-[13px] font-medium text-[#667085]">
                #071426
              </p>
            </div>
            <div className="rounded-[6px] border border-[#EAECF0] p-4">
              <p className="text-[13px] font-bold text-[#101828]">
                Borda padrão
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#667085]">
                #CFD3D4
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
