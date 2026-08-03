"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, Copy, MailPlus, Save, ShieldCheck, UserCheck, Users } from "lucide-react";
import { ACCESS_ROLES, ACCESS_SCOPES, INITIAL_ACTION_STATE, ROLE_LABELS, SCOPE_LABELS, type AccessScope } from "@/modules/auth/types/auth.types";
import type { InvitationItem, PermissionOption, ScopeOption, UserAccessItem, UserManagementData } from "../services/user-management.service";
import { cancelInvitationAction, inviteUserAction, resendInvitationAction, setPermissionOverrideAction, updateAccessAction } from "../actions/user-management.actions";
import * as S from "./user-management.styles";

const statusLabels = { ACTIVE: "Ativo", INACTIVE: "Inativo", BLOCKED: "Bloqueado" } as const;

function getInitials(name: string) { return name.split(" ").filter(Boolean).slice(0,2).map((part)=>part[0]).join("").toUpperCase() || "US"; }
function scopeOptions(scope: AccessScope, data: Pick<UserManagementData,"regions"|"congregations"|"ministries">): ScopeOption[] {
  if (scope === "REGION") return data.regions;
  if (scope === "CONGREGATION") return data.congregations;
  if (scope === "MINISTRY") return data.ministries;
  return [];
}

const ADMIN_ONLY_PERMISSIONS = new Set([
  "regions.manage",
  "congregations.manage",
  "positions.manage",
  "congregation_documents.view",
  "congregation_documents.manage",
]);

function PermissionEditor({ access, permissions }: { access: UserAccessItem; permissions: PermissionOption[] }) {
  const availablePermissions = permissions.filter(
    (permission) => access.role === "ADMIN" || !ADMIN_ONLY_PERMISSIONS.has(permission.key),
  );
  const [state, action, pending] = useActionState(setPermissionOverrideAction, INITIAL_ACTION_STATE);
  return <S.PermissionBox>
    <h3>Permissões personalizadas</h3><p>O papel define as permissões herdadas. Use exceções apenas quando necessário.</p>
    <S.OverrideChips>{Object.entries(access.overrides).map(([key,effect])=><span key={key} data-effect={effect}>{effect === "ALLOW" ? "Permitido" : "Negado"}: {key}</span>)}</S.OverrideChips>
    {state.status !== "idle" ? <S.Alert $success={state.status === "success"}>{state.message}</S.Alert> : null}
    <form action={action}>
      <input type="hidden" name="accessId" value={access.id} />
      <S.FormGrid>
        <S.Field><span>Permissão</span><S.Select name="permission" defaultValue="">{availablePermissions.map((permission)=><option key={permission.key} value={permission.key}>{permission.module} · {permission.name}</option>)}</S.Select></S.Field>
        <S.Field><span>Comportamento</span><S.Select name="effect" defaultValue="INHERIT"><option value="INHERIT">Usar regra do papel</option><option value="ALLOW">Permitir individualmente</option><option value="DENY">Negar individualmente</option></S.Select></S.Field>
        <S.Field><span>&nbsp;</span><S.Button type="submit" disabled={pending}>{pending ? <S.Spinner /> : <ShieldCheck size={15}/>} Aplicar permissão</S.Button></S.Field>
      </S.FormGrid>
    </form>
  </S.PermissionBox>;
}

function AccessEditor({ access, data }: { access: UserAccessItem; data: UserManagementData }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<AccessScope>(access.scope);
  const [state, action, pending] = useActionState(updateAccessAction, INITIAL_ACTION_STATE);
  const targetId = access.regionId ?? access.congregationId ?? access.ministryId ?? "";
  return <S.AccessCard>
    <S.AccessSummary>
      <S.Person><S.Avatar>{getInitials(access.name)}</S.Avatar><S.PersonMeta><strong>{access.name}</strong><small>{access.email}</small></S.PersonMeta></S.Person>
      <S.Meta><span>Papel</span><strong>{ROLE_LABELS[access.role]}</strong></S.Meta>
      <S.Meta><span>Escopo</span><strong>{access.targetName}</strong></S.Meta>
      <div style={{display:"flex",alignItems:"center",gap:8}}><S.Badge $status={access.status}>{statusLabels[access.status]}</S.Badge><S.ExpandButton type="button" onClick={()=>setOpen((value)=>!value)} aria-label="Editar acesso">{open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</S.ExpandButton></div>
    </S.AccessSummary>
    {open ? <S.Editor>
      {state.status !== "idle" ? <S.Alert $success={state.status === "success"}>{state.message}</S.Alert> : null}
      <form action={action}>
        <input type="hidden" name="accessId" value={access.id}/>
        <S.FormGrid>
          <S.Field><span>Papel de acesso</span><S.Select name="role" defaultValue={access.role}>{ACCESS_ROLES.map((role)=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</S.Select></S.Field>
          <S.Field><span>Escopo</span><S.Select name="scope" value={scope} onChange={(event)=>setScope(event.target.value as AccessScope)}>{ACCESS_SCOPES.map((item)=><option key={item} value={item}>{SCOPE_LABELS[item]}</option>)}</S.Select></S.Field>
          <S.Field><span>Situação</span><S.Select name="status" defaultValue={access.status}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="BLOCKED">Bloqueado</option></S.Select></S.Field>
          {scope !== "CHURCH" ? <S.Field><span>Alvo do escopo</span><S.Select name="targetId" defaultValue={scope===access.scope?targetId:""}><option value="">Selecione</option>{scopeOptions(scope,data).map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}</S.Select></S.Field> : <input type="hidden" name="targetId" value=""/>}
          <S.Field style={{gridColumn:"1 / -1"}}><span>Observação administrativa</span><S.Textarea name="notes" defaultValue={access.notes ?? ""}/></S.Field>
        </S.FormGrid>
        <S.FormFooter><S.Button type="submit" disabled={pending}>{pending?<S.Spinner/>:<Save size={15}/>} {pending?"Salvando...":"Salvar alterações"}</S.Button></S.FormFooter>
      </form>
      <PermissionEditor access={access} permissions={data.permissions}/>
    </S.Editor> : null}
  </S.AccessCard>;
}

function InvitationForm({ data }: { data: UserManagementData }) {
  const [scope,setScope] = useState<AccessScope>("CONGREGATION");
  const [state,action,pending] = useActionState(inviteUserAction,INITIAL_ACTION_STATE);
  function copyLink(){ if(state.meta?.invitationPath) void navigator.clipboard.writeText(`${window.location.origin}${state.meta.invitationPath}`); }
  return <S.InviteForm action={action}>
    {state.status !== "idle" ? <S.Alert $success={state.status === "success"}>{state.message}{state.meta?.invitationPath?<S.CopyRow><input readOnly value={state.meta.invitationPath}/><S.Button type="button" $secondary onClick={copyLink}><Copy size={14}/></S.Button></S.CopyRow>:null}</S.Alert>:null}
    <S.InviteField><span>Nome completo</span><S.Control name="name" placeholder="Nome do usuário" required/></S.InviteField>
    <S.InviteField><span>E-mail</span><S.Control name="email" type="email" placeholder="usuario@igreja.com.br" required/></S.InviteField>
    <S.InviteField><span>Papel</span><S.Select name="role" defaultValue="SECRETARY">{ACCESS_ROLES.map((role)=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</S.Select></S.InviteField>
    <S.InviteField><span>Escopo</span><S.Select name="scope" value={scope} onChange={(event)=>setScope(event.target.value as AccessScope)}>{ACCESS_SCOPES.map((item)=><option key={item} value={item}>{SCOPE_LABELS[item]}</option>)}</S.Select></S.InviteField>
    {scope !== "CHURCH" ? <S.InviteField><span>Regional, congregação ou ministério</span><S.Select name="targetId" defaultValue="" required><option value="">Selecione</option>{scopeOptions(scope,data).map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}</S.Select></S.InviteField> : <input type="hidden" name="targetId" value=""/>}
    <S.InviteField><span>Observação administrativa</span><S.Textarea name="notes" placeholder="Opcional"/></S.InviteField>
    <S.Button type="submit" disabled={pending}>{pending?<S.Spinner/>:<MailPlus size={16}/>} {pending?"Enviando...":"Enviar convite"}</S.Button>
  </S.InviteForm>;
}

function PendingInvitations({ invitations }: { invitations: InvitationItem[] }) {
  return <S.PendingList>{invitations.length ? invitations.map((invitation)=><S.Pending key={invitation.id}><strong>{invitation.name}</strong><small>{invitation.email} · {ROLE_LABELS[invitation.role]} · {invitation.targetName}</small><div className="actions"><form action={resendInvitationAction}><input type="hidden" name="invitationId" value={invitation.id}/><button type="submit">Reenviar</button></form><form action={cancelInvitationAction}><input type="hidden" name="invitationId" value={invitation.id}/><button type="submit">Cancelar</button></form></div></S.Pending>):<S.Empty>Nenhum convite pendente.</S.Empty>}</S.PendingList>;
}

export function UserManagement({ data }: { data: UserManagementData }) {
  const [query,setQuery] = useState("");
  const [role,setRole] = useState("");
  const [status,setStatus] = useState("");
  const filtered = useMemo(()=>data.accesses.filter((access)=>{
    const matchesText = `${access.name} ${access.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (!role || access.role===role) && (!status || access.status===status);
  }),[data.accesses,query,role,status]);
  return <S.Layout>
    <S.Stats>
      <S.Stat><span><Users size={20}/></span><div><strong>{data.accesses.length}</strong><small>acessos cadastrados</small></div></S.Stat>
      <S.Stat><span><UserCheck size={20}/></span><div><strong>{data.accesses.filter((item)=>item.status==="ACTIVE").length}</strong><small>acessos ativos</small></div></S.Stat>
      <S.Stat><span><Clock3 size={20}/></span><div><strong>{data.invitations.length}</strong><small>convites pendentes</small></div></S.Stat>
    </S.Stats>
    <S.Grid>
      <S.Card><S.CardHeader><div><h2>Usuários e acessos</h2><p>Gerencie papel, escopo, situação e permissões individuais.</p></div></S.CardHeader><S.CardBody>
        <S.Toolbar><S.Control type="search" placeholder="Buscar nome ou e-mail" value={query} onChange={(e)=>setQuery(e.target.value)}/><S.Select value={role} onChange={(e)=>setRole(e.target.value)}><option value="">Todos os papéis</option>{ACCESS_ROLES.map((item)=><option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</S.Select><S.Select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Todas as situações</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="BLOCKED">Bloqueado</option></S.Select></S.Toolbar>
        <S.AccessList>{filtered.length?filtered.map((access)=><AccessEditor key={access.id} access={access} data={data}/>):<S.Empty>Nenhum usuário encontrado com estes filtros.</S.Empty>}</S.AccessList>
      </S.CardBody></S.Card>
      <div style={{display:"grid",gap:20}}>
        <S.Card><S.CardHeader><div><h2>Convidar usuário</h2><p>O link seguro expira automaticamente em sete dias.</p></div></S.CardHeader><S.CardBody><InvitationForm data={data}/></S.CardBody></S.Card>
        <S.Card><S.CardHeader><div><h2>Convites pendentes</h2><p>Reenvie ou cancele convites ainda não aceitos.</p></div></S.CardHeader><S.CardBody><PendingInvitations invitations={data.invitations}/></S.CardBody></S.Card>
      </div>
    </S.Grid>
  </S.Layout>;
}
