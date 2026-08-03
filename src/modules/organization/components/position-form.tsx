"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createPositionAction, updatePositionAction } from "../actions/organization.actions";
import type { PositionItem } from "../types/organization.types";
import { INITIAL_ORGANIZATION_ACTION_STATE } from "../types/organization.types";
import { positionSchema } from "../validations/organization.schemas";
import * as S from "./organization.styles";

type PositionFormProps = {
  position: PositionItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function PositionForm({ position, onClose, onSuccess, onError }: PositionFormProps) {
  const formId = useId();
  const action = position ? updatePositionAction : createPositionAction;
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ORGANIZATION_ACTION_STATE,
  );
  const [values, setValues] = useState({
    name: position?.name ?? "",
    femaleName: position?.femaleName ?? "",
    abbreviation: position?.abbreviation ?? "",
    femaleAbbreviation: position?.femaleAbbreviation ?? "",
    description: position?.description ?? "",
    displayOrder: String(position?.displayOrder ?? 0),
    status: position?.status ?? "ACTIVE",
  });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
    if (state.status === "error") onError(state.message);
  }, [onError, onSuccess, state]);

  const errors = useMemo(() => ({
    ...Object.fromEntries(
      Object.entries(state.fieldErrors ?? {}).map(([key, messages]) => [
        key,
        messages[0] ?? "Campo inválido.",
      ]),
    ),
    ...localErrors,
  }), [localErrors, state.fieldErrors]);

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
      title={position ? "Editar Cargo" : "Novo Cargo"}
      description="Mantenha o catálogo eclesiástico separado dos papéis de acesso ao sistema."
      icon={<BadgeCheck size={22} />}
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
              {pending ? "Salvando..." : "Salvar Cargo"}
            </Button>
          </div>
        </S.ModalFooter>
      }
    >
      <S.Form
        id={formId}
        action={formAction}
        onSubmit={(event) => {
          const parsed = positionSchema.safeParse({ id: position?.id ?? "", ...values });
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
        {position && <input type="hidden" name="id" value={position.id} />}
        {state.status === "error" && <S.FormAlert role="alert">{state.message}</S.FormAlert>}
        <S.FormIntro>
          Cargos não concedem permissões. Administrador e Secretário continuam sendo papéis de acesso, não Cargos eclesiásticos.
        </S.FormIntro>
        <S.FieldGrid>
          <S.Field>
            <span>Nome do Cargo *</span>
            <S.Control
              data-autofocus
              name="name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Ex.: Pastor"
              maxLength={120}
              required
              $invalid={Boolean(errors.name)}
            />
            {errors.name && <S.FieldError>{errors.name}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Variação feminina</span>
            <S.Control
              name="femaleName"
              value={values.femaleName}
              onChange={(event) => update("femaleName", event.target.value)}
              placeholder="Ex.: Pastora"
              maxLength={120}
              $invalid={Boolean(errors.femaleName)}
            />
            {errors.femaleName && <S.FieldError>{errors.femaleName}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Abreviação</span>
            <S.Control
              name="abbreviation"
              value={values.abbreviation}
              onChange={(event) => update("abbreviation", event.target.value)}
              placeholder="Ex.: Pr."
              maxLength={30}
              $invalid={Boolean(errors.abbreviation)}
            />
            {errors.abbreviation && <S.FieldError>{errors.abbreviation}</S.FieldError>}
          </S.Field>
          <S.Field>
            <span>Abreviação feminina</span>
            <S.Control
              name="femaleAbbreviation"
              value={values.femaleAbbreviation}
              onChange={(event) => update("femaleAbbreviation", event.target.value)}
              placeholder="Ex.: Pra."
              maxLength={30}
              $invalid={Boolean(errors.femaleAbbreviation)}
            />
            {errors.femaleAbbreviation && <S.FieldError>{errors.femaleAbbreviation}</S.FieldError>}
          </S.Field>
          <S.Field $span={2}>
            <span>Descrição</span>
            <S.Textarea
              name="description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Descrição institucional breve"
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
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </S.SelectControl>
          </S.Field>
        </S.FieldGrid>
      </S.Form>
    </Modal>
  );
}

