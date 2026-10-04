import { theme } from "./theme";
export const financeTheme = {
 ...theme,
 colors: { ...theme.colors,
  brand:{primary:"#087F5B",primaryHover:"#076747",primarySoft:"#EAF5EF"},
  text:{...theme.colors.text,title:"#18352C",body:"#344D43",muted:"#6D7F76"},
  surface:{background:"#F5F7F6",card:"#FFFFFF",soft:"#F5F7F6",muted:"#EDF2EF"},
  border:{default:"#E3EAE6",soft:"#EDF2EF",strong:"#C5D7CD"},
  state:{...theme.colors.state,danger:"#B5474D",dangerHover:"#983A40",dangerSoft:"#FBEFF0",info:"#087F5B",infoSoft:"#EAF5EF"},
 },
 shadows:{...theme.shadows,focus:"0 0 0 3px rgba(8,127,91,.14)"},
};
