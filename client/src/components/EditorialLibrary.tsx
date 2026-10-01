import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ALLOWED_READING_URL } from "../../../shared/const";
import { EDITORIAL_NICHES, type EditorialMessage, type EditorialNiche } from "../../../shared/editorial-library";
import { Check, Clipboard, Copy, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const centralRules = [
  { title: "Acolhimento antes do link", text: "A mensagem precisa continuar útil mesmo sem clique. O link oficial é exceção, em bloco separado e somente em baixo risco." },
  { title: "Âncora antes de abstração", text: "Comece por uma frase, imagem, pergunta ou tensão real do vídeo ou comentário. Não escreva uma reflexão que serviria para qualquer nicho." },
  { title: "Humanizar sem inventar", text: "Não diga que sabe exatamente o que a pessoa sente. Use primeira pessoa apenas quando a experiência for verdadeira e revisada." },
  { title: "Crise não é oportunidade", text: "Suicídio, autolesão, violência, abuso, risco físico, menores e pedidos urgentes não recebem a leitura como resposta principal." },
  { title: "Sem pressão ou promessa", text: "Não usar culpa, vergonha, urgência, diagnóstico, cura, salvação, venda, preço, pagamento ou insistência." },
  { title: "Revisão humana", text: "Os modelos são ponto de partida. Adaptar a abertura ao contexto real, conferir risco e descartar quando não houver evidência suficiente." },
];

function renderMessage(text: string) {
  const parts = text.split("{{LECTURA}}");
  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && <a className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2" href={ALLOWED_READING_URL} target="_blank" rel="noreferrer">Cadena Invisible — Lectura</a>}
    </span>
  ));
}

function MessageCard({ message }: { message: EditorialMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = message.text.replace("{{LECTURA}}", ALLOWED_READING_URL);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Mensagem copiada para adaptação.");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <article className="rounded-2xl border border-[#eadfca] bg-[#fffdfa] p-4 shadow-[0_4px_16px_rgba(45,70,60,0.04)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><Badge className="border-0 bg-[#f3dfaa] text-[#6b5520] hover:bg-[#f3dfaa]">{message.label}</Badge><p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[#a27620]">Uso contextual</p></div><Button variant="outline" size="sm" onClick={copy} className="shrink-0 border-[#e6dcc8] bg-white">{copied ? <Check className="mr-2 h-4 w-4 text-teal-700" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copiada" : "Copiar"}</Button></div><blockquote className="mt-3 border-l-2 border-[#c99735] pl-4 text-sm leading-7 text-[#333a47]">{renderMessage(message.text)}</blockquote><p className="mt-4 rounded-xl bg-[#f7f4ec] px-3 py-2 text-xs leading-5 text-[#6d7180]"><strong className="text-[#5f5338]">Nota de revisão:</strong> {message.note}</p></article>;
}

function NicheSection({ niche }: { niche: EditorialNiche }) {
  return <section className="scroll-mt-6" id={`nicho-${niche.id}`}><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#c99735]" /><h3 className="text-xl font-semibold text-[#24312d]">{niche.title}</h3></div><p className="mt-1 max-w-3xl text-sm leading-6 text-[#63716d]">{niche.description}</p></div><Badge variant="outline" className="w-fit border-teal-200 bg-teal-50 text-teal-700">{niche.messages.length} modelos prontos</Badge></div><div className="mb-4 rounded-xl border-l-4 border-[#c99735] bg-[#fff8ed] px-4 py-3 text-sm leading-6 text-[#5d5033]"><strong>Regra deste nicho:</strong> {niche.rule}</div><div className="grid gap-4 xl:grid-cols-3">{niche.messages.map(message => <MessageCard key={message.label} message={message} />)}</div></section>;
}

export function EditorialLibrary() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("all");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return EDITORIAL_NICHES.filter(niche => selectedId === "all" || niche.id === selectedId).filter(niche => !term || `${niche.title} ${niche.description} ${niche.rule} ${niche.messages.map(message => `${message.text} ${message.note}`).join(" ")}`.toLocaleLowerCase().includes(term));
  }, [query, selectedId]);

  return <div className="space-y-6"><Card className="overflow-hidden border-0 bg-[#203b36] text-white shadow-[0_14px_45px_rgba(32,59,54,0.18)]"><CardHeader><div className="flex items-center gap-2 text-teal-200"><ShieldAlert className="h-5 w-5" /><CardTitle className="text-white">Núcleo editorial da Cadena Invisible</CardTitle></div><p className="max-w-3xl text-sm leading-6 text-teal-50/75">Regras organizadas e modelos prontos para a IA aprender por nicho. Cada mensagem é uma base de revisão, nunca um texto para copiar sem conferir o contexto real.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{centralRules.map(rule => <div className="rounded-xl border border-teal-100/15 bg-white/10 p-4" key={rule.title}><div className="flex items-start gap-2 text-sm font-semibold text-teal-50"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />{rule.title}</div><p className="mt-2 text-xs leading-5 text-teal-50/70">{rule.text}</p></div>)}</div></CardContent></Card>
    <Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]"><CardContent className="space-y-4 p-4 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Biblioteca por nicho</p><h2 className="mt-1 text-2xl font-semibold">Mensagens prontas para modelar</h2><p className="mt-1 text-sm text-muted-foreground">{EDITORIAL_NICHES.length} nichos · {EDITORIAL_NICHES.length * 5} variações em espanhol · link oficial contextual.</p></div><div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nicho, regra ou frase…" className="pl-9" /></div></div><div className="flex gap-2 overflow-x-auto pb-1"><Button size="sm" variant={selectedId === "all" ? "default" : "outline"} onClick={() => setSelectedId("all")} className="shrink-0">Todos</Button>{EDITORIAL_NICHES.map(niche => <Button key={niche.id} size="sm" variant={selectedId === niche.id ? "default" : "outline"} onClick={() => setSelectedId(niche.id)} className="shrink-0">{niche.title}</Button>)}</div></CardContent></Card>
    {filtered.length ? filtered.map(niche => <NicheSection key={niche.id} niche={niche} />) : <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground"><Clipboard className="h-8 w-8" /><p>Nenhum nicho ou mensagem encontrado.</p><Button variant="outline" onClick={() => { setQuery(""); setSelectedId("all"); }}>Limpar filtros</Button></CardContent></Card>}
  </div>;
}
