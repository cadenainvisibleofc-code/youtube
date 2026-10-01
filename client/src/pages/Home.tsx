import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { normalizeDashboardPath } from "@/lib/dashboard-route";
import { DiscoveryPanel } from "@/components/DiscoveryPanel";
import { AutomationPanel } from "@/components/AutomationPanel";
import { ChannelPanel } from "@/components/ChannelPanel";
import { useSelectedChannelId } from "@/components/ChannelPanel";
import { EditorialLibrary } from "@/components/EditorialLibrary";
import { ArrowUpRight, Check, ExternalLink, Flag, Heart, Link2, MessageCircle, RefreshCw, ShieldAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Draft = {
  id: number;
  title: string;
  channelName: string;
  videoUrl: string;
  type: "A_video" | "B_reply" | "C_link";
  text: string;
  containsLink: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  relevanceScore: number;
  status: string;
  quote: string;
  recommendation: string;
};

const typeLabels = { A_video: "Comentário no vídeo", B_reply: "Resposta específica", C_link: "Convite com link" };
const typeColors = { A_video: "bg-teal-50 text-teal-700 border-teal-200", B_reply: "bg-violet-50 text-violet-700 border-violet-200", C_link: "bg-amber-50 text-amber-700 border-amber-200" };

export default function Home() {
  const [location] = useLocation();
  const currentPath = normalizeDashboardPath(location);
  const snapshot = trpc.dashboard.snapshot.useQuery(undefined, { staleTime: 30_000 });
  const integrations = trpc.dashboard.integrationStatus.useQuery(undefined, { staleTime: 60_000 });
  const selectedChannelId = useSelectedChannelId();
  const review = trpc.dashboard.reviewDraft.useMutation({
    onSuccess: result => {
      setSelectedId(null);
      snapshot.refetch();
      toast.success(result.status === "approved" ? "Rascunho aprovado para a fila." : result.status === "discarded" ? "Rascunho descartado." : "Edição salva.");
    },
    onError: error => toast.error(`Não foi possível salvar a revisão: ${error.message}`),
  });
  const [importMessage, setImportMessage] = useState("");
  const ingest = trpc.dashboard.ingestManual.useMutation({
    onSuccess: result => {
      setImportUrl("");
      setImportMessage(result.eligibility.eligible ? "Vídeo elegível e rascunho criado na fila de revisão." : `Vídeo registrado, mas não elegível: ${result.eligibility.reasons.join(" · ")}`);
      snapshot.refetch();
    },
    onError: error => setImportMessage(error.message),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const youtubeStatus = params.get("youtube");
    const youtubeReason = params.get("reason");
    if (youtubeStatus === "connected") {
      toast.success("Canal YouTube conectado.");
      integrations.refetch();
    } else if (youtubeStatus === "error") {
      toast.error(youtubeReason ? `Não foi possível conectar o YouTube: ${youtubeReason}` : "O Google recusou a conexão. Confirme o usuário de teste e o redirect URI no OAuth.");
    }
    if (youtubeStatus) window.history.replaceState({}, "", window.location.pathname);
  }, [integrations]);

  const drafts = (snapshot.data?.drafts ?? []) as Draft[];
  const selected = useMemo(() => drafts.find(item => item.id === selectedId) ?? null, [drafts, selectedId]);
  const isQueue = currentPath === "/fila";
  const isMetrics = currentPath === "/metricas";
  const isRules = currentPath === "/regras";

  const openReview = (draft: Draft) => {
    setSelectedId(draft.id);
    setEditedText(draft.text);
  };

  const mutateReview = (status: "approved" | "discarded" | "edited") => {
    if (!selected) return;
    if (status === "discarded" && !window.confirm("Descartar este rascunho? Esta decisão será registrada na fila.")) return;
    review.mutate({ id: selected.id, status, ...(status !== "discarded" ? { text: editedText } : {}) });
  };

  if (snapshot.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Carregando o painel…</div>;
  }

  if (snapshot.error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p>Não foi possível carregar o painel.</p><Button className="mt-4" variant="outline" onClick={() => snapshot.refetch()}>Tentar novamente</Button></div>;
  }

  const metrics = snapshot.data?.metrics ?? { analyzed: 0, candidates: 0, pending: 0, published: 0, replies: 0, mentions: 0, likes: 0, verified: 0, removed: 0 };
  const youtubeProductionOrigin = integrations.data?.youtube.oauth.productionOrigin;
  const youtubeOAuthUsesProduction = Boolean(youtubeProductionOrigin && youtubeProductionOrigin !== window.location.origin);
  const youtubeOAuthStartBase = youtubeOAuthUsesProduction
    ? `${youtubeProductionOrigin}/api/youtube/oauth/start`
    : "/api/youtube/oauth/start";
  const youtubeOAuthStartUrl = selectedChannelId ? `${youtubeOAuthStartBase}?projectChannelId=${selectedChannelId}` : youtubeOAuthStartBase;
  const youtubeConnectLabel = integrations.data?.youtube.connection.reauthorizationRequired ? "Reconectar canal" : youtubeOAuthUsesProduction ? "Conectar no publicado" : "Conectar canal";

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#24312d]">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700"><Sparkles className="h-4 w-4" /> Painel de ressonância</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Acolher antes de alcançar.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63716d]">Uma fila editorial para encontrar conversas relevantes, escrever com cuidado e manter a corrente humana — sem publicar em massa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto"><Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">Automação controlada</Badge><Badge variant="outline" className={integrations.data?.youtube.configured ? "border-teal-200 text-teal-700" : "border-slate-200 text-slate-600"}>{integrations.data?.youtube.configured ? "YouTube API configurada" : "YouTube aguardando chave"}</Badge>{integrations.data?.youtube.oauth.configured && !integrations.data.youtube.connection.connected && <Button variant="outline" size="sm" onClick={() => window.location.assign(youtubeOAuthStartUrl)}>{youtubeConnectLabel}</Button>}{integrations.data?.youtube.connection.connected && <Badge variant="outline" className="border-violet-200 text-violet-700">Canal: {integrations.data.youtube.connection.channelName}</Badge>}<Button variant="outline" size="sm" onClick={() => setShowImport(value => !value)}><Link2 className="mr-2 h-4 w-4" />Adicionar link</Button><Button variant="outline" size="sm" disabled={snapshot.isFetching} onClick={async () => { const result = await snapshot.refetch(); if (result.error) toast.error("Não foi possível atualizar o painel."); else toast.success("Painel atualizado."); }}><RefreshCw className="mr-2 h-4 w-4" />{snapshot.isFetching ? "Atualizando…" : "Atualizar"}</Button></div>
          {integrations.data?.youtube.oauth.configured && !integrations.data.youtube.oauth.redirectUriValid && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Callback OAuth inválido. Cadastre no Google Cloud: <code>{integrations.data.youtube.oauth.redirectUri ?? "URL ausente"}</code></p>}
        </header>

        {showImport && <Card className="border-teal-100 bg-teal-50/60 shadow-none"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-teal-900">Importar candidato manualmente</p><p className="mt-1 text-xs text-teal-800/75">A descoberta manual só cria uma entrada na fila; a publicação automática é controlada separadamente.</p>{!selectedChannelId && <p className="mt-2 text-xs font-medium text-amber-800">Selecione um canal acima antes de importar para manter a fila isolada.</p>}{importMessage && <p className="mt-2 text-xs font-medium text-teal-900" role="status">{importMessage}</p>}</div><div className="flex w-full gap-2 sm:max-w-xl"><Input value={importUrl} onChange={event => setImportUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="bg-white" /><Button disabled={!importUrl || !selectedChannelId || ingest.isPending} onClick={() => ingest.mutate({ url: importUrl, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })}>{ingest.isPending ? "Conferindo…" : "Salvar"}</Button></div></CardContent></Card>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <Metric label="Analisados" value={metrics.analyzed} icon={<Flag />} />
          <Metric label="Candidatos" value={metrics.candidates} icon={<Sparkles />} accent="teal" />
          <Metric label="Aguardando" value={metrics.pending} icon={<MessageCircle />} accent="violet" />
          <Metric label="Publicados" value={metrics.published} icon={<Check />} accent="amber" />
          <Metric label="Respostas" value={metrics.replies} icon={<MessageCircle />} accent="blue" />
          <Metric label="Menções espontâneas" value={metrics.mentions} icon={<ArrowUpRight />} accent="rose" />
          <Metric label="Curtidas observadas" value={metrics.likes} icon={<Heart />} accent="pink" />
        </section>

        <ChannelPanel />
        <AutomationPanel onChanged={() => snapshot.refetch()} />

        {!isQueue && !isMetrics && !isRules && <DiscoveryPanel projectChannelId={selectedChannelId} onImported={() => snapshot.refetch()} />}

        {isRules ? <RulesPanel /> : isMetrics ? <MetricsPanel metrics={metrics} /> : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]">
              <CardHeader className="border-b border-[#edf0ed] pb-4"><div className="flex items-center justify-between gap-4"><div><CardTitle className="text-lg">{isQueue ? "Fila de revisão" : "O que pede atenção agora"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{isQueue ? "Cada rascunho tem contexto, risco e evidência para uma decisão rápida." : "Amostra demonstrativa do primeiro marco. A automação real usa limites e regras do painel."}</p></div><Badge variant="outline" className="hidden sm:inline-flex">{snapshot.data?.mode === "demo" ? "dados demonstrativos" : "banco conectado"}</Badge></div></CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6">
                {drafts.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cdd9d3] p-6 text-sm text-muted-foreground">Ainda não há rascunhos nesta fila. Use a descoberta oficial ou adicione uma URL para iniciar a triagem.</div> : drafts.map(draft => <DraftRow key={draft.id} draft={draft} onReview={() => openReview(draft)} />)}
              </CardContent>
            </Card>
            <Guardrails />
          </div>
        )}

        {selected && <ReviewPanel draft={selected} text={editedText} setText={setEditedText} onClose={() => setSelectedId(null)} onApprove={() => mutateReview("approved")} onDiscard={() => mutateReview("discarded")} onSave={() => mutateReview("edited")} pending={review.isPending} />}
      </div>
    </div>
  );
}

function Metric({ label, value, icon, accent = "slate" }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  const colors: Record<string, string> = { slate: "bg-slate-50 text-slate-600", teal: "bg-teal-50 text-teal-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", rose: "bg-rose-50 text-rose-700", pink: "bg-pink-50 text-pink-700" };
  return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className={`rounded-xl p-2 ${colors[accent]}`}>{icon}</span></div><div className="mt-3 text-2xl font-semibold">{value}</div></CardContent></Card>;
}

 function DraftRow({ draft, onReview }: { draft: Draft; onReview: () => void }) {
  return <div className="group rounded-2xl border border-[#edf0ed] p-4 transition hover:border-teal-200 hover:bg-teal-50/20"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={typeColors[draft.type]}>{typeLabels[draft.type]}</Badge><Badge variant="outline" className="border-slate-200 text-slate-600">Risco {draft.riskLevel === "low" ? "baixo" : draft.riskLevel}</Badge><span className="text-xs font-medium text-teal-700">{draft.relevanceScore}/100 relevância</span></div><h3 className="line-clamp-1 text-sm font-semibold">{draft.title}</h3><p className="mt-1 text-xs text-muted-foreground">{draft.channelName} · <a className="inline-flex items-center gap-1 hover:text-teal-700" href={draft.videoUrl} target="_blank" rel="noreferrer">abrir vídeo <ExternalLink className="h-3 w-3" /></a></p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#53635e]">{draft.text}</p></div><div className="flex shrink-0 items-center gap-2"><Button size="sm" variant="outline" onClick={onReview}>Revisar</Button><Button size="sm" variant="ghost" asChild><a href={draft.videoUrl} target="_blank" rel="noreferrer" aria-label="Abrir vídeo"><ExternalLink className="h-4 w-4" /></a></Button></div></div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#f0f2ef] pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> {draft.type === "B_reply" ? "Comentário-fonte" : "Contexto do vídeo"}: {draft.quote}</span><span className="inline-flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> {draft.recommendation}</span>{draft.containsLink && <span className="inline-flex items-center gap-1 text-amber-700"><Link2 className="h-3.5 w-3.5" /> link requer revisão</span>}</div></div>;
}

function Guardrails() {
  return <Card className="h-fit border-0 bg-[#203b36] text-white shadow-[0_14px_45px_rgba(32,59,54,0.18)]"><CardHeader><div className="flex items-center gap-2 text-teal-200"><ShieldAlert className="h-5 w-5" /><CardTitle className="text-base text-white">Guardrails ativos</CardTitle></div><p className="text-sm leading-6 text-teal-100/70">O sistema protege a qualidade antes de aumentar o alcance.</p></CardHeader><CardContent className="space-y-3 text-sm">{["Validação editorial obrigatória", "Sem limite diário artificial", "Vídeo principal é a evidência padrão", "Resposta só com exposição pessoal real", "1 interação por canal a cada 30 dias", "Link somente o oficial e contextual", "Crise e pedido urgente bloqueiam promoção", "Deduplicação global antes de publicar"].map(item => <div className="flex items-start gap-3" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" /><span className="text-teal-50/85">{item}</span></div>)}<div className="mt-5 rounded-xl border border-teal-200/20 bg-white/10 p-3 text-xs leading-5 text-teal-50/70">A automação prepara rascunhos para revisão; toda publicação externa exige aprovação humana explícita.</div></CardContent></Card>;
}

function ReviewPanel({ draft, text, setText, onClose, onApprove, onDiscard, onSave, pending }: { draft: Draft; text: string; setText: (value: string) => void; onClose: () => void; onApprove: () => void; onDiscard: () => void; onSave: () => void; pending: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#12211d]/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><Badge variant="outline" className={typeColors[draft.type]}>{typeLabels[draft.type]}</Badge><h2 className="mt-3 text-xl font-semibold">Revisar acolhimento</h2><p className="mt-1 text-sm text-muted-foreground">{draft.channelName} · risco {draft.riskLevel}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></Button></div><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[#f7f8f5] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Evidência usada</p><p className="mt-2 text-sm leading-6 text-[#53635e]">{draft.quote}</p></div><div className="rounded-2xl bg-[#fff8e7] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Decisão sugerida</p><p className="mt-2 text-sm leading-6 text-[#6a582f]">{draft.recommendation}. O comentário precisa continuar útil mesmo sem clique.</p></div></div><div className="mt-5"><label className="text-sm font-medium" htmlFor="draft-text">Mensagem</label><Textarea id="draft-text" value={text} onChange={event => setText(event.target.value)} className="mt-2 min-h-36 resize-y leading-6" /></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={onDiscard} disabled={pending} className="text-red-700 hover:bg-red-50 hover:text-red-800"><X className="mr-2 h-4 w-4" />Descartar</Button><div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={onSave} disabled={pending}>Salvar edição</Button><Button onClick={onApprove} disabled={pending} className="bg-teal-700 text-white hover:bg-teal-800"><Check className="mr-2 h-4 w-4" />Aprovar para fila</Button></div></div></div></div>;
}

function MetricsPanel({ metrics }: { metrics: { analyzed: number; candidates: number; pending: number; published: number; replies: number; mentions: number; likes: number; verified: number; removed: number } }) {
  const resonance = trpc.analytics.resonance.useQuery();
  const data = resonance.data ?? { visits: 0, completed: 0, averageSeconds: 0, sources: {} };
  return <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]"><CardHeader><CardTitle>Ressonância observada</CardTitle><p className="text-sm text-muted-foreground">A métrica principal é a qualidade da conversa e o retorno à leitura, não o volume bruto.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-teal-50 p-4"><p className="text-xs text-teal-700">Visitas à leitura</p><p className="mt-2 text-3xl font-semibold text-teal-900">{data.visits}</p></div><div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs text-violet-700">Leituras com permanência</p><p className="mt-2 text-3xl font-semibold text-violet-900">{data.completed}</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs text-amber-700">Tempo médio</p><p className="mt-2 text-3xl font-semibold text-amber-900">{Math.round(data.averageSeconds / 60)} min</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs text-blue-700">Respostas no YouTube</p><p className="mt-2 text-2xl font-semibold text-blue-900">{metrics.replies}</p></div><div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-4"><p className="text-xs text-pink-700">Curtidas observadas</p><p className="mt-2 text-2xl font-semibold text-pink-900">{metrics.likes}</p></div><div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-xs text-rose-700">Menções espontâneas</p><p className="mt-2 text-2xl font-semibold text-rose-900">{metrics.mentions}</p></div></div><div className="mt-6 rounded-2xl border border-dashed border-[#cdd9d3] p-5 text-sm leading-6 text-muted-foreground">Os indicadores do YouTube vêm dos eventos de publicação e reconciliação persistidos por comentário. A atribuição da leitura usa apenas um identificador técnico anônimo, origem, campanha e referência do vídeo.</div></CardContent></Card><Guardrails /></div>;
}

function RulesPanel() {
  return <EditorialLibrary />;
}

function Rule({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-[#edf0ed] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-teal-700" />{title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
