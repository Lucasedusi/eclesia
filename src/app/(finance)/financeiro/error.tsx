"use client";
import Link from "next/link";
import {Button} from "@/components/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="card stack"><h1>Não foi possível abrir o financeiro</h1><p>Confira seu acesso à congregação selecionada e tente novamente.</p><Button onClick={reset}>Tentar novamente</Button><Link href="/">Voltar ao sistema</Link></div>;}
