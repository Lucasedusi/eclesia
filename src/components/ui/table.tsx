"use client";

import { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ArrowDown, Check, MoreVertical, Search } from "lucide-react";
import * as S from "./table.styles";

type TableRootProps = HTMLAttributes<HTMLDivElement> & {
  toolbar?: ReactNode;
};

export function TableRoot({ toolbar, children, ...props }: TableRootProps) {
  return (
    <S.TableRoot {...props}>
      {toolbar}
      <S.ScrollArea>{children}</S.ScrollArea>
    </S.TableRoot>
  );
}

type TableToolbarProps = HTMLAttributes<HTMLDivElement> & {
  searchPlaceholder?: string;
  actions?: ReactNode;
};

export function TableToolbar({
  searchPlaceholder = "Buscar",
  actions,
  ...props
}: TableToolbarProps) {
  return (
    <S.TableToolbar {...props}>
      <S.SearchWrapper>
        <S.SearchIcon aria-hidden="true">
          <Search />
        </S.SearchIcon>
        <S.SearchInput type="search" placeholder={searchPlaceholder} />
      </S.SearchWrapper>

      {actions && <S.ToolbarActions>{actions}</S.ToolbarActions>}
    </S.TableToolbar>
  );
}

export function Table({ children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <S.TableElement {...props}>{children}</S.TableElement>;
}

export function TableHeader({
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <S.TableHeader {...props}>{children}</S.TableHeader>;
}

export function TableBody({
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <S.TableBody {...props}>{children}</S.TableBody>;
}

export function TableRow({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <S.TableRow {...props}>{children}</S.TableRow>;
}

export function TableHead({
  children,
  sortable = false,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { sortable?: boolean }) {
  return (
    <S.TableHead {...props}>
      <S.TableHeadContent>
        {children}
        {sortable && <ArrowDown />}
      </S.TableHeadContent>
    </S.TableHead>
  );
}

export function TableCell({
  children,
  strong = false,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { strong?: boolean }) {
  return (
    <S.TableCell $strong={strong} {...props}>
      {children}
    </S.TableCell>
  );
}

export function TableCheckbox({ checked = false }: { checked?: boolean }) {
  return (
    <S.TableCheckbox $checked={checked} aria-hidden="true">
      <Check />
    </S.TableCheckbox>
  );
}

export function TableActions() {
  return (
    <S.ActionButton type="button" aria-label="Abrir ações">
      <MoreVertical />
    </S.ActionButton>
  );
}
