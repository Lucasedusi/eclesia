"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Church,
  Eye,
  FileText,
  ListOrdered,
  Loader2,
  MapPin,
  Network,
  Paperclip,
  Pencil,
  Power,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  getCongregationDetailsAction,
  getRegionDetailsAction,
} from "../actions/organization-details.actions";
import type {
  CongregationDetails,
  CongregationItem,
  OrganizationStatus,
  RegionDetails,
  RegionItem,
} from "../types/organization.types";
import * as S from "./organization-details.styles";

export type OrganizationDetailsTarget = { id: string; name: string };

type LoadState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

type RegionDetailsModalProps = {
  target: OrganizationDetailsTarget;
  canManage: boolean;
  onClose: () => void;
  onEdit: (region: RegionItem) => void;
  onOpenCongregation: (target: OrganizationDetailsTarget) => void;
};

type CongregationDetailsModalProps = {
  target: OrganizationDetailsTarget;
  canManage: boolean;
  canViewDocuments: boolean;
  onClose: () => void;
  onEdit: (congregation: CongregationItem) => void;
  onOpenDocuments: (congregation: CongregationItem) => void;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLocation(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(" / ") || "Não informada";
}

function formatAddress(congregation: CongregationDetails) {
  return (
    [congregation.address, congregation.number].filter(Boolean).join(", ") ||
    "Não informado"
  );
}

function Status({ value }: { value: OrganizationStatus }) {
  return (
    <S.StatusBadge $active={value === "ACTIVE"}>
      {value === "ACTIVE" ? "Ativa" : "Inativa"}
    </S.StatusBadge>
  );
}

function LoadingDetails({ entity }: { entity: "Regional" | "Congregação" }) {
  return (
    <S.LoadingState role="status" aria-live="polite">
      <Loader2 aria-hidden="true" />
      <strong>Carregando detalhes</strong>
      <span>Buscando as informações mais recentes da {entity}.</span>
      <S.SkeletonGrid aria-hidden="true">
        <i />
        <i />
        <i />
      </S.SkeletonGrid>
    </S.LoadingState>
  );
}

function DetailsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <S.ErrorState role="alert">
      <span>
        <AlertCircle />
      </span>
      <strong>Não foi possível carregar os detalhes</strong>
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </S.ErrorState>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  tone: "primary" | "success" | "neutral" | "warning";
}) {
  return (
    <S.SummaryCard $tone={tone}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </S.SummaryCard>
  );
}

function Info({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <S.InfoItem $wide={wide}>
      <dt>{label}</dt>
      <dd>{value || "Não informado"}</dd>
    </S.InfoItem>
  );
}

export function RegionDetailsModal({
  target,
  canManage,
  onClose,
  onEdit,
  onOpenCongregation,
}: RegionDetailsModalProps) {
  const [state, setState] = useState<LoadState<RegionDetails>>({
    status: "loading",
  });
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    void getRegionDetailsAction(target.id)
      .then((result) => {
        if (!active) return;
        setState(
          result.status === "success"
            ? { status: "success", data: result.data }
            : { status: "error", message: result.message },
        );
      })
      .catch(() => {
        if (active) {
          setState({
            status: "error",
            message:
              "Ocorreu uma falha ao consultar a Regional. Tente novamente.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [retry, target.id]);

  function retryLoad() {
    setState({ status: "loading" });
    setRetry((value) => value + 1);
  }

  const filteredCongregations = useMemo(() => {
    if (state.status !== "success") return [];
    const needle = normalize(search);
    if (!needle) return state.data.congregations;
    return state.data.congregations.filter((item) =>
      normalize(
        `${item.name} ${item.code} ${item.pastorName} ${item.city} ${item.state}`,
      ).includes(needle),
    );
  }, [search, state]);

  const details = state.status === "success" ? state.data : null;
  const inactiveCount = details
    ? details.congregationCount - details.activeCongregationCount
    : 0;

  return (
    <Modal
      open
      title="Detalhes da Regional"
      description={target.name}
      icon={<Network size={22} />}
      onClose={onClose}
      size="xl"
      footer={
        <S.FooterActions>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {canManage && details ? (
            <Button onClick={() => onEdit(details)}>
              <Pencil size={15} /> Editar Regional
            </Button>
          ) : null}
        </S.FooterActions>
      }
    >
      {state.status === "loading" ? <LoadingDetails entity="Regional" /> : null}
      {state.status === "error" ? (
        <DetailsError message={state.message} onRetry={retryLoad} />
      ) : null}
      {details ? (
        <S.Content>
          <S.SummaryGrid>
            <SummaryCard
              icon={<Church />}
              value={details.congregationCount}
              label="Congregações"
              tone="primary"
            />
            <SummaryCard
              icon={<Power />}
              value={details.activeCongregationCount}
              label="Congregações ativas"
              tone="success"
            />
            <SummaryCard
              icon={<Power />}
              value={inactiveCount}
              label="Congregações inativas"
              tone="neutral"
            />
          </S.SummaryGrid>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Informações da Regional</h3>
                <p>Identificação, coordenação e situação cadastral.</p>
              </div>
              <Status value={details.status} />
            </S.SectionHeader>
            <S.InfoGrid>
              <Info label="Nome" value={details.name} />
              <Info label="Coordenador" value={details.coordinatorName} />
              <Info
                label="Telefone do coordenador"
                value={
                  details.coordinatorPhone ? (
                    <S.Link
                      href={`tel:${details.coordinatorPhone.replace(/\D/g, "")}`}
                    >
                      {details.coordinatorPhone}
                    </S.Link>
                  ) : null
                }
              />
              <Info
                label="Ordem de exibição"
                value={String(details.displayOrder)}
              />
              <Info
                label="Cadastrada em"
                value={formatDateTime(details.createdAt)}
              />
              <Info
                label="Última atualização"
                value={formatDateTime(details.updatedAt)}
              />
              <Info label="Descrição" value={details.description} wide />
            </S.InfoGrid>
          </S.Section>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Congregações pertencentes</h3>
                <p>
                  Consulte as Congregações atualmente vinculadas a esta
                  Regional.
                </p>
              </div>
              <S.CountBadge>
                {details.congregationCount} registro
                {details.congregationCount === 1 ? "" : "s"}
              </S.CountBadge>
            </S.SectionHeader>

            {details.congregationCount > 0 ? (
              <S.SearchBox>
                <Search aria-hidden="true" />
                <input
                  aria-label="Buscar Congregação nesta Regional"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar Congregação..."
                />
              </S.SearchBox>
            ) : null}

            {details.congregationCount === 0 ? (
              <S.EmptyState>
                <Building2 />
                <strong>Nenhuma Congregação vinculada</strong>
                <p>Quando houver vínculos, eles aparecerão nesta seção.</p>
              </S.EmptyState>
            ) : filteredCongregations.length === 0 ? (
              <S.EmptyState>
                <Search />
                <strong>Nenhuma Congregação encontrada</strong>
                <p>Tente buscar por outro nome, código, dirigente ou cidade.</p>
              </S.EmptyState>
            ) : (
              <S.LinkedList>
                {filteredCongregations.map((congregation) => (
                  <S.LinkedItem key={congregation.id}>
                    <S.LinkedPrimary>
                      <strong>
                        <Church />
                        {congregation.name}
                      </strong>
                      <small>
                        {congregation.isHeadquarters
                          ? "Congregação Sede"
                          : congregation.code || "Sem código"}
                      </small>
                    </S.LinkedPrimary>
                    <S.LinkedMeta>
                      <small>Dirigente</small>
                      <span>{congregation.pastorName || "Não informado"}</span>
                    </S.LinkedMeta>
                    <S.LinkedMeta>
                      <small>Localidade</small>
                      <span>
                        {formatLocation(congregation.city, congregation.state)}
                      </span>
                    </S.LinkedMeta>
                    <Status value={congregation.status} />
                    <S.ViewButton
                      type="button"
                      title="Ver detalhes"
                      aria-label={`Ver detalhes de ${congregation.name}`}
                      onClick={() =>
                        onOpenCongregation({
                          id: congregation.id,
                          name: congregation.name,
                        })
                      }
                    >
                      <Eye />
                    </S.ViewButton>
                  </S.LinkedItem>
                ))}
              </S.LinkedList>
            )}
          </S.Section>
        </S.Content>
      ) : null}
    </Modal>
  );
}

export function CongregationDetailsModal({
  target,
  canManage,
  canViewDocuments,
  onClose,
  onEdit,
  onOpenDocuments,
}: CongregationDetailsModalProps) {
  const [state, setState] = useState<LoadState<CongregationDetails>>({
    status: "loading",
  });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    void getCongregationDetailsAction(target.id)
      .then((result) => {
        if (!active) return;
        setState(
          result.status === "success"
            ? { status: "success", data: result.data }
            : { status: "error", message: result.message },
        );
      })
      .catch(() => {
        if (active) {
          setState({
            status: "error",
            message:
              "Ocorreu uma falha ao consultar a Congregação. Tente novamente.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [retry, target.id]);

  function retryLoad() {
    setState({ status: "loading" });
    setRetry((value) => value + 1);
  }

  const details = state.status === "success" ? state.data : null;

  return (
    <Modal
      open
      title="Detalhes da Congregação"
      description={target.name}
      icon={<Church size={22} />}
      onClose={onClose}
      size="xl"
      footer={
        <S.FooterActions>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {canViewDocuments && details ? (
            <Button variant="outline" onClick={() => onOpenDocuments(details)}>
              <Paperclip size={15} /> Documentos
            </Button>
          ) : null}
          {canManage && details ? (
            <Button onClick={() => onEdit(details)}>
              <Pencil size={15} /> Editar Congregação
            </Button>
          ) : null}
        </S.FooterActions>
      }
    >
      {state.status === "loading" ? (
        <LoadingDetails entity="Congregação" />
      ) : null}
      {state.status === "error" ? (
        <DetailsError message={state.message} onRetry={retryLoad} />
      ) : null}
      {details ? (
        <S.Content>
          <S.SummaryGrid>
            <SummaryCard
              icon={<Power />}
              value={details.status === "ACTIVE" ? "Ativa" : "Inativa"}
              label="Situação atual"
              tone={details.status === "ACTIVE" ? "success" : "neutral"}
            />
            <SummaryCard
              icon={<Network />}
              value={details.regionName || "Sem Regional"}
              label="Regional"
              tone="primary"
            />
            <SummaryCard
              icon={<ListOrdered />}
              value={details.displayOrder}
              label="Ordem de exibição"
              tone="neutral"
            />
            {details.documentCount !== null ? (
              <SummaryCard
                icon={<FileText />}
                value={details.documentCount}
                label="Documentos anexados"
                tone="warning"
              />
            ) : null}
          </S.SummaryGrid>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Identificação</h3>
                <p>Informações gerais e vínculo administrativo.</p>
              </div>
              <Status value={details.status} />
            </S.SectionHeader>
            <S.InfoGrid>
              <Info label="Nome" value={details.name} />
              <Info label="Código" value={details.code} />
              <Info
                label="Tipo"
                value={
                  details.isHeadquarters ? "Congregação Sede" : "Congregação"
                }
              />
              <Info
                label="Regional"
                value={details.regionName || "Sem Regional"}
              />
              <Info
                label="Ordem de exibição"
                value={String(details.displayOrder)}
              />
              <Info label="País" value={details.country} />
            </S.InfoGrid>
          </S.Section>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Liderança e contato</h3>
                <p>Responsáveis e canais institucionais cadastrados.</p>
              </div>
              <UserRound size={18} />
            </S.SectionHeader>
            <S.InfoGrid>
              <Info label="Dirigente ou Pastor" value={details.pastorName} />
              <Info label="Cônjuge" value={details.pastorSpouseName} />
              <Info
                label="Telefone"
                value={
                  details.phone ? (
                    <S.Link href={`tel:${details.phone.replace(/\D/g, "")}`}>
                      {details.phone}
                    </S.Link>
                  ) : null
                }
              />
              <Info
                label="WhatsApp"
                value={
                  details.whatsapp ? (
                    <S.Link href={`tel:${details.whatsapp.replace(/\D/g, "")}`}>
                      {details.whatsapp}
                    </S.Link>
                  ) : null
                }
              />
              <Info
                label="E-mail"
                value={
                  details.email ? (
                    <S.Link href={`mailto:${details.email}`}>
                      {details.email}
                    </S.Link>
                  ) : null
                }
                wide
              />
            </S.InfoGrid>
          </S.Section>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Endereço</h3>
                <p>Localização registrada para a Congregação.</p>
              </div>
              <MapPin size={18} />
            </S.SectionHeader>
            <S.InfoGrid>
              <Info
                label="Logradouro e número"
                value={formatAddress(details)}
              />
              <Info label="Complemento" value={details.complement} />
              <Info label="Bairro" value={details.district} />
              <Info label="Cidade" value={details.city} />
              <Info label="Estado" value={details.state} />
              <Info label="CEP" value={details.zipCode} />
            </S.InfoGrid>
          </S.Section>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Observações</h3>
                <p>Informações administrativas adicionais.</p>
              </div>
              <FileText size={18} />
            </S.SectionHeader>
            <S.Notes>
              {details.notes || "Nenhuma observação cadastrada."}
            </S.Notes>
          </S.Section>

          <S.Section>
            <S.SectionHeader>
              <div>
                <h3>Histórico do cadastro</h3>
                <p>Datas de criação e última alteração do registro.</p>
              </div>
              <CalendarClock size={18} />
            </S.SectionHeader>
            <S.InfoGrid>
              <Info
                label="Cadastrada em"
                value={formatDateTime(details.createdAt)}
              />
              <Info
                label="Última atualização"
                value={formatDateTime(details.updatedAt)}
              />
            </S.InfoGrid>
          </S.Section>
        </S.Content>
      ) : null}
    </Modal>
  );
}
