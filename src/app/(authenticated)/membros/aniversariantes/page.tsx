import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { BirthdayControls } from "@/modules/members/components/birthday-controls";
import { BirthdayList } from "@/modules/members/components/birthday-list";
import { MemberListTabs } from "@/modules/members/components/member-list-tabs";
import { Panel } from "@/modules/members/components/members.styles";
import { birthdayCongregations, listBirthdays } from "@/modules/members/services/member-birthdays.service";
import { getMemberCapabilities } from "@/modules/members/services/member.service";
import { birthdayCalendar, birthdayHref, birthdayPageSchema } from "@/modules/members/validations/member-birthdays";
import BirthdaysLoading from "./loading";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function BirthdaysContent({ searchParams }: Props) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const parsed = birthdayPageSchema.safeParse(await searchParams);
  if (!parsed.success) return <Panel className="p-6">
    <p>Algum filtro é inválido.</p><Link className="text-[#415ba5] underline" href="/membros/aniversariantes">Voltar aos aniversariantes de hoje</Link>
  </Panel>;
  const { page, ...filters } = parsed.data;
  const caps = getMemberCapabilities(context);
  const calendar = birthdayCalendar(filters);
  const [result, congregations] = await Promise.all([
    listBirthdays(context, filters, calendar.ranges, page), birthdayCongregations(context),
  ]);
  if (result.outOfRange) redirect(birthdayHref(filters));
  return <Panel>
    <BirthdayControls filters={filters} month={calendar.month} label={calendar.label}
      total={result.total} canExport={caps.exportSheet} congregations={congregations}>
      <BirthdayList filters={filters} items={result.items} total={result.total} page={page} viewContact={caps.viewFull} viewRoles={caps.viewRoles} />
    </BirthdayControls>
  </Panel>;
}

export default function MemberBirthdaysPage(props: Props) {
  return <>
    <PageHeader title="Membros" subtitle="Consulte os aniversários de membros e crianças ativos." badge="Administração" />
    <MemberListTabs active="birthdays" />
    <Suspense fallback={<BirthdaysLoading />}><BirthdaysContent {...props} /></Suspense>
  </>;
}
