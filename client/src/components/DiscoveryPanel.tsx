import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, ExternalLink, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DiscoveryPanel({ onImported, projectChannelId }: { onImported: () => void; projectChannelId?: number }) {
  const [query, setQuery] = useState("soledad y propósito");
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const discovery = trpc.dashboard.discoverYouTube.useMutation({
    onError: error => toast.error(`Busca não concluída: ${error.message}`),
  });
  const ingest = trpc.dashboard.ingestManual.useMutation({
    onSuccess: result => {
      setImportedIds(previous => previous.includes(result.videoId) ? previous : [...previous, result.videoId]);
      onImported();
      toast.success(result.eligibility.eligible ? "Vídeo adicionado à fila de revisão." : "Vídeo registrado, mas fora dos critérios.");
    },
    onError: error => toast.error(`Importação não concluída: ${error.message}`),
  });

  const candidates = discovery.data ?? [];

  return <Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]">
    <CardHeader className="border-b border-[#edf0ed] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700"><Search className="h-4 w-4" /> Descoberta oficial</div>
          <CardTitle className="text-lg">Encontrar conversas recentes</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Busca somente leitura. Além dos vídeos já fortes, a triagem sinaliza oportunidades emergentes com engajamento proporcional.</p>
        </div>
        <div className="flex w-full gap-2 sm:max-w-md"><Input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && query.trim().length >= 2) discovery.mutate({ query: query.trim(), maxResults: 10 }); }} placeholder="ex.: ansiedad, propósito, fe" /><Button disabled={query.trim().length < 2 || discovery.isPending} onClick={() => discovery.mutate({ query: query.trim(), maxResults: 10 })}><Search className="mr-2 h-4 w-4" />{discovery.isPending ? "Buscando…" : "Buscar"}</Button></div>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 p-4 sm:p-6">
      {discovery.error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Não foi possível consultar o YouTube. Verifique a chave e tente novamente.</div>}
      {!discovery.isPending && candidates.length === 0 && !discovery.error && <div className="rounded-2xl border border-dashed border-[#cdd9d3] p-6 text-sm text-muted-foreground">Digite um tema para começar a busca. A descoberta manual só alimenta a triagem; a rotina automática tem controles e limites separados.</div>}
      {candidates.map(candidate => {
        const imported = importedIds.includes(candidate.videoId);
        return <div key={candidate.videoId} className="flex flex-col gap-3 rounded-2xl border border-[#edf0ed] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={candidate.eligibility.eligible ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-600"}>{candidate.eligibility.eligible ? "Elegível" : "Fora do critério"}</Badge>{candidate.eligibility.emergingOpportunity && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Oportunidade emergente · {candidate.eligibility.opportunityScore}</Badge>}<span className="text-xs text-muted-foreground">{candidate.viewCount.toLocaleString("pt-BR")} views · {candidate.commentCount.toLocaleString("pt-BR")} comentários</span></div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{candidate.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{candidate.channelName} · {candidate.eligibility.ageDays} dias</p>
            {candidate.eligibility.reasons.length > 0 && <p className="mt-2 text-xs text-amber-700">{candidate.eligibility.reasons.join(" · ")}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2"><Button size="sm" variant="ghost" asChild><a href={candidate.url} target="_blank" rel="noreferrer" aria-label="Abrir vídeo"><ExternalLink className="h-4 w-4" /></a></Button><Button size="sm" disabled={!candidate.eligibility.eligible || imported || ingest.isPending} onClick={() => ingest.mutate({ url: candidate.url, title: candidate.title, channelName: candidate.channelName, publishedAt: candidate.publishedAt, viewCount: candidate.viewCount, commentCount: candidate.commentCount, ...(projectChannelId ? { projectChannelId } : {}) })}>{imported ? <><Check className="mr-2 h-4 w-4" />Na triagem</> : <><Sparkles className="mr-2 h-4 w-4" />Adicionar à triagem</>}</Button></div>
        </div>;
      })}
    </CardContent>
  </Card>;
}
