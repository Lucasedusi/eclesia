"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { MapPinned, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatBrazilPhone } from "@/utils/input-masks";
import { createRegionAction, updateRegionAction } from "../actions/organization.actions";
import type { RegionItem } from "../types/organization.types";
import { INITIAL_ORGANIZATION_ACTION_STATE } from "../types/organization.types";
import { regionSchema } from "../validations/organization.schemas";
import * as S from "./organization.styles";

type RegionFormProps = {
  region: RegionItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function RegionForm({ region, onClose, onSuccess, onError }: RegionFormProps) {
  const formId = useId();
  const action = region ? updateRegionAction : createRegionAction;
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ORGANIZATION_ACTION_STATE,
  );
  const [values, setValues] = useState({
    name: region?.name ?? "",
    description: region?.description ?? "",
    coordinatorName: region?.coordinatorName ?? "",
    coordinatorPhone: region?.coordinatorPhone ?? "",
    displayOrder: String(region?.displayOrder ?? 0),
    status: region?.status ?? "ACTIVE",
  });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
    if (state.status === "error") onError(state.message);
  }, [onError, onSuccess, state]);

  const errors = useMemo(() => {
    const server = Object.fromEntries(
      Object.entries(state.fieldErrors ?? {}).map(([key, messages]) => [
        key,
        messages[0] ?? "Campo inválido.",
      ]),
    );
    return { ...server, ...localErrors };
  }, [localErrors, state.fieldErrors]);

  function update(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setLocalErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  return (
    <Modal
      open
      title={region ? "Editar Regional" : "Nova Regional"}
      description="Organize as Congregações por área administrativa."
      icon={<MapPinned size={22} />}
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <S.ModalFooter>
          <span />
          <div>
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" form={formId} loading={pending}>
              {!pending && <Save size={16} />}
              {pending ? "Salvando..." : "Salvar Regional"}
            </Button>
          </div>
        </S.ModalFooter>
      }
    >
      <S.Form
        id={formId}
        action={formAction}
        onSubmit={(event) => {
          const parsed = regionSchema.safeParse({ id: region?.id ?? "", ...values });
          if (!parsed.success) {
            event.preventDefault();
            setLocalErrors(
              Object.fromEntries(
                Object.entries(parsed.error.flatten().fieldErrors).map(([key, messages]) => [
                  key,
                  messages[0] ?? "Campo inválido.",
                ]),
              ),
            );
          }
        }}
      >
        {region && <input type="hidden" name="id" value={region.id} />}
        {state.status === "error" && <S.FormAlert role="alert">{state.message}</S.FormAlert>}
        <S.FormIntro>
          O nome deve ser único dentro da igreja. A ordem define a posição padrão nas listagens.
        </S.FormIntro>
        <S.FieldGrid>
          <S.Field $span={2}>
            <span>Nome da Regional *</span>
            <S.Control
              data-autofocus
              name="name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Ex.: Regional 01"
              maxLength={120}
              required
              $invalid={Boolean(errors.name)}
            />
            {errors.name && <S.FieldError>{errors.name}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Nome do Coordenador</span>
            <S.Control
              name="coordinatorName"
              value={values.coordinatorName}
              onChange={(event) => update("coordinatorName", event.target.value)}
              placeholder="Nome completo"
              maxLength={160}
              $invalid={Boolean(errors.coordinatorName)}
            />
            {errors.coordinatorName && <S.FieldError>{errors.coordinatorName}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Telefone do Coordenador</span>
            <S.Control
              name="coordinatorPhone"
              value={values.coordinatorPhone}
              onChange={(event) => update("coordinatorPhone", formatBrazilPhone(event.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              maxLength={15}
              $invalid={Boolean(errors.coordinatorPhone)}
            />
            {errors.coordinatorPhone && <S.FieldError>{errors.coordinatorPhone}</S.FieldError>}
          </S.Field>
          <S.Field $span={2}>
            <span>Descrição</span>
            <S.Textarea
              name="description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Área atendida ou composição da Regional"
              maxLength={500}
              $invalid={Boolean(errors.description)}
            />
            {errors.description && <S.FieldError>{errors.description}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Ordem de exibição</span>
            <S.Control
              name="displayOrder"
              value={values.displayOrder}
              onChange={(event) => update("displayOrder", event.target.value)}
              type="number"
              min={0}
              step={1}
              $invalid={Boolean(errors.displayOrder)}
            />
            {errors.displayOrder && <S.FieldError>{errors.displayOrder}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Status</span>
            <S.SelectControl
              name="status"
              value={values.status}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="ACTIVE">Ativa</option>
              <option value="INACTIVE">Inativa</option>
            </S.SelectControl>
          </S.Field>
        </S.FieldGrid>
      </S.Form>
    </Modal>
  );
}

