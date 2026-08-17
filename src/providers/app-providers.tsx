"use client";

import React from "react";
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "@/styles/global-styles";
import { StyledComponentsRegistry } from "@/styles/styled-components-registry";
import { theme } from "@/styles/theme";
import { NavigationFeedbackProvider } from "@/components/navigation/navigation-feedback";
import { ModalPortalProvider } from "@/components/ui/modal-portal";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <ModalPortalProvider>
          <NavigationFeedbackProvider>{children}</NavigationFeedbackProvider>
        </ModalPortalProvider>
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
