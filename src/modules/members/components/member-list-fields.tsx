import type { ChangeEventHandler, KeyboardEventHandler } from "react";
import { Loader2, Search, X } from "lucide-react";
import * as S from "./members.styles";

export function MemberIdentity({ name, code }: { name: string; code: string | null }) {
  const initials = name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <S.Person>
    <span aria-hidden="true">{initials}</span>
    <div><strong>{name}</strong><small>{code || "Sem código"}</small></div>
  </S.Person>;
}

type SearchProps = {
  label: string;
  placeholder: string;
  value: string;
  pending: boolean;
  maxLength?: number;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onClear: () => void;
};

export function MemberSearchField({ label, placeholder, value, pending, maxLength, onChange, onKeyDown, onClear }: SearchProps) {
  const length = value.trim().length;
  const short = length > 0 && length < 3;
  const searching = pending && length >= 3;
  return <S.SearchField>
    <S.Search>
      <Search aria-hidden="true" />
      <S.Control type="text" aria-label={label} placeholder={placeholder} value={value} maxLength={maxLength}
        $withInlineStatus={short || searching} $withClear={Boolean(value)} onChange={onChange} onKeyDown={onKeyDown} />
      {short && <S.SearchInlineStatus role="status">Mínimo de 3 caracteres</S.SearchInlineStatus>}
      {searching && <S.SearchInlineStatus role="status"><Loader2 aria-hidden="true" /> Buscando...</S.SearchInlineStatus>}
      {value && <S.ClearSearchButton type="button" onClick={onClear} title="Limpar pesquisa" aria-label="Limpar pesquisa"><X /></S.ClearSearchButton>}
    </S.Search>
  </S.SearchField>;
}
