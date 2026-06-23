"use client";

import React from "react";
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "@/styles/global-styles";
import { StyledComponentsRegistry } from "@/styles/styled-components-registry";
import { theme } from "@/styles/theme";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        {children}
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
