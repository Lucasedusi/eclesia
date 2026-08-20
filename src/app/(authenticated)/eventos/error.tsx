"use client";
import { Button } from "@/components/ui/button";
export default function EventsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="app-empty-state" role="alert"><h2>Não foi possível carregar Eventos</h2><p>Tente novamente. Se o problema continuar, informe o suporte.</p><Button onClick={reset}>Tentar novamente</Button></div>; }
