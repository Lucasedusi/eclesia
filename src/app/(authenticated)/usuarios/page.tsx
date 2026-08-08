import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { UserManagement } from "@/modules/users/components/user-management";
import * as UserStyles from "@/modules/users/components/user-management.styles";
import { getUserManagementData } from "@/modules/users/services/user-management.service";

export default async function UsersPage() {
  const context = await requireAccessContext(PERMISSIONS.usersView);
  let data;

  try {
    data = await getUserManagementData();
  } catch (error) {
    console.error("[users-page] Unable to render user management", error);
    return <AppShell authContext={context} title="Usuários" subtitle="Acessos, convites e permissões">
      <PageHeader title="Usuários e permissões" subtitle="Controle quem pode acessar a igreja e quais dados cada pessoa pode visualizar ou alterar." badge="Segurança" />
      <UserStyles.Card>
        <UserStyles.CardBody>
          <UserStyles.Alert>
            Não foi possível carregar os usuários agora. Atualize a página e tente novamente.
          </UserStyles.Alert>
        </UserStyles.CardBody>
      </UserStyles.Card>
    </AppShell>;
  }

  return <AppShell authContext={context} title="Usuários" subtitle="Acessos, convites e permissões">
    <PageHeader title="Usuários e permissões" subtitle="Controle quem pode acessar a igreja e quais dados cada pessoa pode visualizar ou alterar." badge="Segurança" />
    <UserManagement data={data}/>
  </AppShell>;
}
