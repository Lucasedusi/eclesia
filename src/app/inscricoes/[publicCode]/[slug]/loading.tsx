import { LoaderCircle } from "lucide-react";
import * as S from "@/modules/events/components/events.styles";

export default function PublicRegistrationLoading() {
  return <S.PublicLoading><div role="status" aria-label="Carregando evento"><LoaderCircle aria-hidden="true" /><span className="sr-only">Carregando evento</span></div></S.PublicLoading>;
}
