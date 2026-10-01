import { ArrowLeft, BookOpen, Heart, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { parseReadingAttribution } from "@/lib/reading-attribution";
import { trpc } from "@/lib/trpc";

export default function ReadingPage() {
  const [location] = useLocation();
  const attribution = useMemo(() => parseReadingAttribution(typeof window === "undefined" ? "" : window.location.search), [location]);
  const recordVisit = trpc.analytics.recordReadingVisit.useMutation();
  const visitToken = useRef<string>(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `visit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [secondsRead, setSecondsRead] = useState(0);

  useEffect(() => {
    document.title = "Cadena Invisible — Leitura";
    recordVisit.mutate({ visitToken: visitToken.current, source: attribution.source, campaign: attribution.campaign, videoReference: attribution.video });
    const timer = window.setInterval(() => setSecondsRead(value => value + 15), 15_000);
    return () => window.clearInterval(timer);
  }, [attribution.campaign, attribution.source, attribution.video]);

  useEffect(() => {
    if (secondsRead > 0 && secondsRead % 15 === 0) {
      recordVisit.mutate({ visitToken: visitToken.current, source: attribution.source, campaign: attribution.campaign, videoReference: attribution.video, secondsRead, completed: secondsRead >= 180 });
    }
  }, [secondsRead, attribution.campaign, attribution.source, attribution.video]);

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#24312d] sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/" className="inline-flex items-center gap-2 text-sm text-teal-800 hover:text-teal-950"><ArrowLeft className="h-4 w-4" />Voltar ao painel</Link><div className="mt-16 max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700"><Sparkles className="h-4 w-4" />Cadena Invisible</div><h1 className="mt-5 font-serif text-4xl leading-tight sm:text-6xl">Algumas perguntas precisam de espaço, não de pressa.</h1><p className="mt-6 text-lg leading-8 text-[#63716d]">Esta é uma leitura breve sobre desconexão, cansaço emocional e o que acontece quando tentamos continuar sem nomear o que sentimos.</p></div><article className="mt-12 rounded-3xl bg-white p-6 shadow-[0_14px_45px_rgba(45,70,60,0.08)] sm:p-10"><div className="flex items-center gap-3 text-teal-800"><BookOpen className="h-5 w-5" /><span className="text-sm font-semibold">Leitura 01 · Desconexão e cansaço emocional</span></div><div className="mt-8 space-y-5 text-[17px] leading-8 text-[#53635e]"><p>Nem sempre o silêncio significa falta de sentimento. Às vezes ele é a forma que encontramos para continuar quando ainda não sabemos como explicar o que aconteceu.</p><p>Talvez a pergunta não seja “como volto a ser quem eu era?”, mas “o que em mim está pedindo para ser escutado sem julgamento?”.</p><p>Se esta leitura encontrou algo que você vinha tentando dizer, não precisa responder agora. Guardar a pergunta com cuidado também pode ser um começo.</p></div><div className="mt-9 flex items-start gap-3 rounded-2xl bg-teal-50 p-4 text-sm leading-6 text-teal-900"><Heart className="mt-1 h-4 w-4 shrink-0" /><p>Você chegou por <strong>{attribution.source}</strong>. Este registro serve apenas para entender de onde as conversas estão vindo; você pode continuar no seu ritmo.</p></div></article><p className="mt-5 text-xs text-muted-foreground">Referência da conversa: {attribution.video}. Nenhum dado pessoal é necessário para continuar.</p></div></main>;
}
