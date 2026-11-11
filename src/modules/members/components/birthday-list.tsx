import Link from "next/link";
import { ArrowLeft, ArrowRight, Cake, MessageCircle } from "lucide-react";
import { BirthdayPageLink } from "./birthday-controls";
import { MemberIdentity } from "./member-list-fields";
import * as B from "./birthdays.styles";
import { BIRTHDAY_PAGE_SIZE, type BirthdayMember } from "../services/member-birthdays.service";
import { formatDateOnly, whatsappUrl } from "../utils/member-formatters";
import { birthdayHref, type BirthdayFilters } from "../validations/member-birthdays";
import * as S from "./members.styles";

function Contact({ member }: { member: BirthdayMember }) {
  const url = whatsappUrl(member.whatsapp);
  if (!url) return <>Não informado</>;
  return <B.Contact href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${member.name}`}>
    <MessageCircle size={15} aria-hidden />{member.whatsapp}
  </B.Contact>;
}

type Props = { items: BirthdayMember[]; total: number; page: number; filters: BirthdayFilters; viewContact: boolean; viewRoles: boolean };

export function BirthdayList({ items, total, page, filters, viewContact, viewRoles }: Props) {
  const pages = Math.ceil(total / BIRTHDAY_PAGE_SIZE);
  if (!items.length) return <S.Empty><div>
    <Cake className="mx-auto mb-3 text-[#667085]" size={26} aria-hidden />
    <h3>{filters.period === "today" ? "Nenhum aniversariante hoje" : "Nenhum aniversariante encontrado"}</h3>
    {filters.period === "today" ? <Link className="mt-3 inline-block text-[#415ba5] underline" href={birthdayHref({ ...filters, period: "month", month: undefined })}>Ver aniversariantes do mês</Link>
      : <p>Ajuste o período ou os filtros da consulta.</p>}
  </div></S.Empty>;
  return <>
    <S.TableWrap><S.Table aria-label="Aniversariantes" $lastColumnAlign="left">
      <thead><tr><th>Membro</th><th>Congregação</th>{viewRoles && <th>Cargo</th>}<th>Data de nascimento</th>{viewContact && <th>WhatsApp</th>}</tr></thead>
      <tbody>{items.map((member) => <tr key={member.id}>
        <td><MemberIdentity name={member.name} code={member.code} /></td>
        <td>{member.congregation || "Não informada"}<br /><small>{member.region}</small></td>
        {viewRoles && <td>{member.role || "—"}</td>}
        <td><time dateTime={member.birthDate}>{formatDateOnly(member.birthDate)}</time></td>
        {viewContact && <td><Contact member={member} /></td>}
      </tr>)}</tbody>
    </S.Table></S.TableWrap>
    <S.MobileList>{items.map((member) => <S.MobileCard key={member.id}>
      <MemberIdentity name={member.name} code={member.code} />
      <S.MobileMeta>
        <div><span>Congregação</span><strong>{member.congregation || "Não informada"}</strong></div>
        <div><span>Regional</span><strong>{member.region || "Não informada"}</strong></div>
        {viewRoles && <div><span>Cargo</span><strong>{member.role || "—"}</strong></div>}
        <div><span>Data de nascimento</span><strong><time dateTime={member.birthDate}>{formatDateOnly(member.birthDate)}</time></strong></div>
        {viewContact && <div><span>WhatsApp</span><strong><Contact member={member} /></strong></div>}
      </S.MobileMeta>
    </S.MobileCard>)}</S.MobileList>
    <S.Pagination>
      <span>Página {page} de {pages} · {total} registro(s)</span>
      <nav aria-label="Paginação de aniversariantes" className="flex flex-wrap gap-2">
        <BirthdayPageLink href={page > 1 ? birthdayHref(filters, page - 1) : undefined}><ArrowLeft size={14} /> Anterior</BirthdayPageLink>
        <BirthdayPageLink href={page < pages ? birthdayHref(filters, page + 1) : undefined}>Próxima <ArrowRight size={14} /></BirthdayPageLink>
      </nav>
    </S.Pagination>
  </>;
}
