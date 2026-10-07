"use client";
import { formatFinanceMonth } from "../utils/finance-period";
import { Banknote, CreditCard, QrCode, ReceiptText, Check } from "lucide-react";
import { FinanceMoneyInput } from "./finance-money-input";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { saveFinanceCatalogAction } from "../actions/finance-catalog.actions";
import type {
  FinanceCatalogs,
  FinanceCatalogMutation,
} from "../types/finance-catalog.types";
import { parseMoneyInput, formatMoney } from "../utils/finance-money";
import { useFinanceDirtyGuard, useFinanceNavigation } from "./finance-shell";
export type CatalogEntity = FinanceCatalogMutation["entity"];
export const catalogLabels: Record<CatalogEntity, string> = {
  DEPARTMENT: "Departamento",
  CATEGORY: "Categoria",
  CLASSIFICATION: "Classificação",
  PAYMENT_METHOD: "Forma de pagamento",
  CASHBOX: "Caixa ou conta",
};
export const methodLabels: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BANK_TRANSFER: "Transferência bancária",
  BANK_SLIP: "Boleto",
  CHECK: "Cheque",
  OTHER: "Outro",
};
export function FinanceCatalogForm({
  entity,
  id,
  unit,
  month,
  catalogs,
  roles,
  onClose,
}: {
  entity: CatalogEntity;
  id?: string;
  unit: string;
  month: string;
  catalogs: FinanceCatalogs;
  roles: { id: string; name: string }[];
  onClose: () => void;
}) {
  const financeNavigation = useFinanceNavigation(),
    form = useRef<HTMLFormElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const dept = catalogs.departments.find((v) => v.id === id),
    category = catalogs.categories.find((v) => v.id === id),
    classification = catalogs.classifications.find((v) => v.id === id),
    method = catalogs.paymentMethods.find((v) => v.id === id),
    box = catalogs.cashboxes.find((v) => v.id === id);
  const current = {
    DEPARTMENT: dept,
    CATEGORY: category,
    CLASSIFICATION: classification,
    PAYMENT_METHOD: method,
    CASHBOX: box,
  }[entity];
  const [boxKind, setBoxKind] = useState(box?.kind ?? "CASH");
  const effective = dept?.baseVersions.find((v) => v.effectiveMonth <= month);
  async function save() {
    if (busy || !form.current?.reportValidity()) return false;
    const data = new FormData(form.current),
      value = (key: string) => String(data.get(key) ?? ""),
      checked = (key: string) => data.has(key);
    setBusy(true);
    setError("");
    try {
      const base = {
        entity,
        id,
        congregationId: unit,
        name: value("name"),
        status: value("status"),
      };
      let input: unknown;
      if (entity === "DEPARTMENT")
        input = {
          ...base,
          participatesInBase: checked("base"),
          effectiveMonth: value("month"),
          ...(value("reason") ? { reason: value("reason") } : {}),
        };
      if (entity === "CATEGORY")
        input = {
          ...base,
          direction: value("direction"),
          departmentId: value("department") || null,
          isTithe: checked("tithe"),
          isOffering: checked("offering"),
          requiresPerson: checked("person"),
        };
      if (entity === "CLASSIFICATION")
        input = { ...base, roleId: value("role") || null };
      if (entity === "PAYMENT_METHOD") input = { ...base, kind: value("kind") };
      if (entity === "CASHBOX") {
        if (box && value("status") === "INACTIVE" && box.balanceCents !== 0) {
          setError("O saldo precisa estar zerado para inativar este caixa.");
          return false;
        }
        input = {
          ...base,
          kind: boxKind,
          paymentMethodIds: data.getAll("methods"),
          bankName: value("bank"),
          agency: value("agency"),
          accountNumber: value("account"),
          ...(!id
            ? {
                openingDate: value("date"),
                openingCents: parseMoneyInput(value("opening")),
              }
            : {}),
        };
      }
      const result = await saveFinanceCatalogAction(input);
      if (!result.ok) {
        setError(
          result.message +
            (result.fieldErrors
              ? " " + Object.values(result.fieldErrors).flat().join(" ")
              : ""),
        );
        return false;
      }
      setDirty(false);
      financeNavigation.refresh();
      onClose();
      return true;
    } catch {
      setError("Confira os valores informados e tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  useFinanceDirtyGuard(dirty, save, onClose);
  return (
    <Modal
      title={`${id ? "Editar" : "Novo"} ${catalogLabels[entity].toLowerCase()}`}
      busy={busy}
      onClose={() => {
        if (!dirty || window.confirm("Descartar as alterações deste cadastro?"))
          onClose();
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Salvar cadastro
          </Button>
        </>
      }
    >
      <form
        ref={form}
        className="stack"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && <div role="alert">{error}</div>}
        <label>
          Nome
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={current?.name}
            autoFocus
          />
        </label>
        <label>
          Situação
          <select name="status" defaultValue={current?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </label>
        {entity === "DEPARTMENT" && (
          <>
            <label className="check">
              <input
                name="base"
                type="checkbox"
                defaultChecked={effective?.participatesInBase ?? false}
              />
              Participa da base de cálculo
            </label>
            <p className="muted">
              Departamentos fora da base continuam aparecendo no demonstrativo.
            </p>
            <label>
              Vigência a partir de
              <input name="month" type="month" defaultValue={month} required />
            </label>
            <label>
              Justificativa da revisão retroativa
              <textarea name="reason" minLength={5} maxLength={1000} />
            </label>
            {dept && (
              <details>
                <summary>Histórico de vigências</summary>
                {dept.baseVersions.map((v) => (
                  <p key={v.id} className="muted">
                    {formatFinanceMonth(v.effectiveMonth, true)} · Versão{" "}
                    {v.revision} ·{" "}
                    {v.participatesInBase ? "Incluído na base" : "Fora da base"}
                  </p>
                ))}
              </details>
            )}
          </>
        )}
        {entity === "CATEGORY" && (
          <>
            <label>
              Natureza
              <select
                name="direction"
                defaultValue={category?.direction ?? "INCOME"}
              >
                <option value="INCOME">Entrada</option>
                <option value="EXPENSE">Saída</option>
                <option value="BOTH">Entrada e saída</option>
              </select>
            </label>
            <label>
              Departamento sugerido
              <select
                name="department"
                defaultValue={category?.departmentId ?? ""}
              >
                <option value="">Sem sugestão</option>
                {catalogs.departments
                  .filter(
                    (v) =>
                      v.status === "ACTIVE" || v.id === category?.departmentId,
                  )
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="tithe"
                defaultChecked={category?.isTithe}
              />
              É dízimo
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="offering"
                defaultChecked={category?.isOffering}
              />
              É oferta
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="person"
                defaultChecked={category?.requiresPerson}
              />
              Exige identificação da pessoa
            </label>
          </>
        )}
        {entity === "CLASSIFICATION" && (
          <>
            <label>
              Cargo para sugestão automática
              <select name="role" defaultValue={classification?.roleId ?? ""}>
                <option value="">Sem sugestão</option>
                {roles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              A classificação poderá ser ajustada no lançamento, sem alterar o
              cadastro do membro.
            </p>
          </>
        )}
        {entity === "PAYMENT_METHOD" && (
          <label>
            Tipo
            <select name="kind" defaultValue={method?.kind ?? "CASH"}>
              {Object.entries(methodLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {entity === "CASHBOX" && (
          <>
            <label>
              Tipo
              <select
                value={boxKind}
                onChange={(e) => setBoxKind(e.target.value)}
                disabled={Boolean(id)}
              >
                <option value="CASH">Caixa em dinheiro</option>
                <option value="BANK_ACCOUNT">Conta bancária</option>
              </select>
            </label>
            {!id ? (
              <div className="grid">
                <label>
                  Data de abertura
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={`${month}-01`}
                  />
                </label>
                <label>
                  Saldo de abertura (R$)
                  <FinanceMoneyInput
                    name="opening"
                    inputMode="decimal"
                    required
                    defaultValue="0,00"
                  />
                </label>
              </div>
            ) : (
              <p className="notice">
                Saldo atual: {formatMoney(box?.balanceCents ?? 0)}. A abertura é
                preservada; use ajuste de saldo para uma correção justificada.
              </p>
            )}
            <fieldset className="finance-form-section finance-payment-tiles">
              <legend>Formas de pagamento permitidas</legend>
              {catalogs.paymentMethods
                .filter(
                  (v) =>
                    v.status === "ACTIVE" &&
                    (boxKind === "CASH"
                      ? v.kind === "CASH"
                      : v.kind !== "CASH"),
                )
                .map((v) => (
                  <label className="finance-payment-tile" key={v.id}>
                    <input
                      type="checkbox"
                      name="methods"
                      value={v.id}
                      defaultChecked={box?.paymentMethodIds.includes(v.id)}
                    />
                    {v.kind === "CASH" ? (
                      <Banknote size={23} />
                    ) : v.kind === "PIX" ? (
                      <QrCode size={23} />
                    ) : v.kind.includes("CARD") ? (
                      <CreditCard size={23} />
                    ) : (
                      <ReceiptText size={23} />
                    )}
                    <span>{v.name}</span>
                    <Check className="finance-payment-check" size={16} />
                  </label>
                ))}
              {!catalogs.paymentMethods.some(
                (v) =>
                  v.status === "ACTIVE" &&
                  (boxKind === "CASH" ? v.kind === "CASH" : v.kind !== "CASH"),
              ) && (
                <p className="muted">
                  Cadastre primeiro uma forma de pagamento compatível nas
                  configurações.
                </p>
              )}
            </fieldset>
            {boxKind === "BANK_ACCOUNT" && (
              <>
                <label>
                  Banco
                  <input name="bank" defaultValue={box?.bankName ?? ""} />
                </label>
                <div className="grid">
                  <label>
                    Agência
                    <input name="agency" defaultValue={box?.agency ?? ""} />
                  </label>
                  <label>
                    Conta
                    <input
                      name="account"
                      defaultValue={box?.accountNumber ?? ""}
                    />
                  </label>
                </div>
              </>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
