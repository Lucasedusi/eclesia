"use client";
import {ThemeProvider} from "styled-components";
import {ModalPortalProvider} from "@/components/ui/modal-portal";
import {financeTheme} from "@/styles/finance-theme";
import {FinanceStyles} from "./finance-shell.styles";
export function FinanceThemeProvider({children}:{children:React.ReactNode}){
 return <ThemeProvider theme={financeTheme}><FinanceStyles/><ModalPortalProvider id="finance-modal-root">{children}</ModalPortalProvider></ThemeProvider>;
}
