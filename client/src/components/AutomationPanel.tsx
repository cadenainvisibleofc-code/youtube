import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useSelectedChannelId } from "./ChannelPanel";
import { Clock3, ListChecks, Pause, Play, RefreshCw, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function summarizeReasons(reasons: string[]) {
  const counts = new Map<string, number>();
  for (const reason of reasons) {
    const label = reason.split(" — ")[0].replace(/^inelegível: /, "").trim();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => `${label} (${count})`).join("; ");
}

export function AutomationPanel({ onChanged }: { onChanged: () => void }) {
  const selectedChannelId = useSelectedChannelId();
  const channelInput = selectedChannelId ? { projectChannelId: selectedChannelId } : undefined;
	const settings = trpc.dashboard.automationSettings.useQuery(channelInput, { staleTime: 30_000 });
	const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [cooldownDays, setCooldownDays] = useState(30);
	  const [includeLink, setIncludeLink] = useState(true);
  const [queries, setQueries] = useState("");
  const [cron, setCron] = useState("0 0 12 * * *");

	useEffect(() => {
		if (!settings.data) return;
			setEnabled(settings.data.enabled);
			setDailyLimit(settings.data.dailyLimit);
			setCooldownDays(settings.data.minChannelIntervalDays);
		setIncludeLink(settings.data.includeLink);
    setQueries(settings.data.searchQueries.join("\n"));
  }, [settings.data]);

  const save = trpc.dashboard.updateAutomationSettings.useMutation({
		onSuccess: result => {
				setEnabled(result.enabled);
				setDailyLimit(result.dailyLimit);
				setCooldownDays(result.minChannelIntervalDays);
			setIncludeLink(result.includeLink);
      setQueries(result.searchQueries.join("\n"));
      toast.success("Configuração de automação salva.");
      utils.dashboard.automationSettings.invalidate();
    },
    onError: error => toast.error(`Não foi possível salvar: ${error.message}`),
  });
  const run = trpc.dashboard.runAutomation.useMutation({
    onSuccess: result => {
      onChanged();
      toast.success(`Execução concluída: ${result.published} publicados, ${result.drafted} rascunhos e ${result.blocked} bloqueados.`);
    },
    onError: error => toast.error(`Automação não executada: ${error.message}`),
  });
  const prepareDailyBatch = trpc.dashboard.prepareDailyBatch.useMutation({
    onSuccess: result => {
      onChanged();
      toast.success(`Rodada preparada: ${result.drafted} canais na fila, ${result.blocked} bloqueados e ${result.skipped} ignorados. ${result.skipped ? `Principais motivos: ${summarizeReasons(result.reasons)}` : ""}`);
    },
    onError: error => toast.error(`Não foi possível preparar a rodada: ${error.message}`),
  });
  const discoverWeekly = trpc.dashboard.discoverWeekly.useMutation({
    onSuccess: result => { onChanged(); toast.success(`Garimpo semanal concluído: ${result.saved} vídeos salvos, ${result.eligible} elegíveis em ${result.queries} buscas.`); },
    onError: error => toast.error(`Não foi possível garimpar a semana: ${error.message}`),
  });
  const prepareSavedWeekly = trpc.dashboard.prepareSavedWeekly.useMutation({
    onSuccess: result => { onChanged(); toast.success(`Semana preparada a partir do acervo: ${result.drafted} rascunhos, ${result.blocked} bloqueados e ${result.skipped} ignorados.`); },
    onError: error => toast.error(`Não foi possível preparar o acervo: ${error.message}`),
  });
  const regenerateHumanized = trpc.dashboard.regenerateHumanized.useMutation({
    onSuccess: result => {
      onChanged();
      toast.success(`${result.regenerated} rascunho(s) regenerado(s) com contexto humano; ${result.skipped} ficou(ram) para revisão manual.`);
    },
    onError: error => toast.error(`Não foi possível regenerar os rascunhos: ${error.message}`),
  });
  const publishApproved = trpc.dashboard.publishApproved.useMutation({
    onSuccess: result => { onChanged(); toast.success(`${result.published} publicação(ões) processada(s); ${result.uncertain} ficou(ram) em verificação.`); },
    onError: error => toast.error(`Publicações aprovadas não processadas: ${error.message}`),
  });
  const reconcilePublished = trpc.dashboard.reconcilePublished.useMutation({
    onSuccess: result => { onChanged(); toast.success(`${result.verified} publicação(ões) verificadas; ${result.replies} resposta(s), ${result.likes} curtida(s) e ${result.mentions} menção(ões) observadas.`); },
    onError: error => toast.error(`Não foi possível verificar as publicações: ${error.message}`),
  });
  const schedule = trpc.dashboard.scheduleAutomation.useMutation({
    onSuccess: () => { toast.success("Agendamento ativado."); settings.refetch(); },
    onError: error => toast.error(`Agendamento não ativado: ${error.message}`),
  });
  const pause = trpc.dashboard.pauseAutomation.useMutation({
    onSuccess: () => { setEnabled(false); toast.success("Automação pausada."); settings.refetch(); },
    onError: error => toast.error(`Não foi possível pausar: ${error.message}`),
  });

  if (settings.isLoading) return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]"><CardContent className="p-5 text-sm text-muted-foreground">Carregando controles de automação…</CardContent></Card>;
  if (settings.error) return <Card className="border-amber-200 bg-amber-50"><CardContent className="p-5 text-sm text-amber-900">Os controles de automação ainda não estão disponíveis.</CardContent></Card>;

  return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]"><CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700"><Clock3 className="h-4 w-4" /> Automação controlada</div><CardTitle className="text-lg">Descobrir, escrever e agir com critérios</CardTitle><p className="mt-1 text-sm text-muted-foreground">Garimpe a semana uma vez, salve os vídeos e depois prepare a fila sem repetir a mesma conversa.</p></div><Badge variant="outline" className="border-slate-200 text-slate-600">revisão humana obrigatória</Badge></div></CardHeader><CardContent className="space-y-4 p-5 pt-2">{selectedChannelId ? <p className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs text-teal-900">Automação vinculada ao canal selecionado #{selectedChannelId}.</p> : <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">Modo legado: selecione um canal acima para separar configuração, intervalo e fila.</p>}{settings.data?.pausedReason && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Automação pausada automaticamente:</strong> {settings.data.lastError ?? "foi detectado um limite do YouTube"}. Revise a cota e salve as regras para retomar.</div>}<div className="grid gap-3 md:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border border-[#edf0ed] p-3 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="mt-1 accent-teal-700" /><span><strong className="block">Executar descoberta automaticamente</strong><span className="text-xs text-muted-foreground">Busca vídeos elegíveis e cria rascunhos na fila.</span></span></label><p className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-900">A automação prepara rascunhos e nunca publica sem aprovação humana. A publicação manual de itens aprovados permanece disponível na fila.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="block text-sm"><span className="mb-1 block font-medium">Limite diário deste canal</span><Input type="number" min={1} max={150} value={dailyLimit} onChange={event => setDailyLimit(Number(event.target.value))} /><span className="text-xs text-muted-foreground">Padrão 30, até 150 no projeto, sempre com revisão humana.</span></label><label className="block text-sm"><span className="mb-1 block font-medium">Cooldown contextual em dias</span><Input type="number" min={0} max={365} value={cooldownDays} onChange={event => setCooldownDays(Number(event.target.value))} /><span className="text-xs text-muted-foreground">Aplica-se ao mesmo vídeo ou thread, não ao canal inteiro.</span></label></div><label className="flex items-start gap-3 rounded-xl border border-[#edf0ed] p-3 text-sm"><input type="checkbox" checked={includeLink} onChange={event => setIncludeLink(event.target.checked)} className="mt-1 accent-teal-700" /><span><strong className="block">Permitir link oficial quando contextual</strong><span className="text-xs text-muted-foreground">Cada link ainda precisa ser oficial, contextual e de baixo risco.</span></span></label><label className="block text-sm"><span className="mb-1 block font-medium">Pesquisas e subtemas, uma por linha</span><Textarea value={queries} onChange={event => setQueries(event.target.value)} rows={4} placeholder="recomeço e pertencimento&#10;luto e reconciliação&#10;esperança prática" /></label><div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate({ ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}), enabled, dailyLimit, minChannelIntervalDays: cooldownDays, includeLink, searchQueries: queries.split("\n").map(value => value.trim()).filter(Boolean) })} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar regras"}</Button><Button variant="outline" onClick={() => discoverWeekly.mutate(selectedChannelId ? { projectChannelId: selectedChannelId } : undefined)} disabled={discoverWeekly.isPending}><Search className="mr-2 h-4 w-4" />{discoverWeekly.isPending ? "Garimpando a semana…" : "Garimpar semana"}</Button><Button onClick={() => prepareSavedWeekly.mutate({ limit: dailyLimit, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })} disabled={prepareSavedWeekly.isPending}><ListChecks className="mr-2 h-4 w-4" />{prepareSavedWeekly.isPending ? "Preparando acervo…" : "Preparar do acervo"}</Button><Button onClick={() => prepareDailyBatch.mutate(selectedChannelId ? { projectChannelId: selectedChannelId } : undefined)} disabled={prepareDailyBatch.isPending}><ListChecks className="mr-2 h-4 w-4" />{prepareDailyBatch.isPending ? `Buscando até ${dailyLimit} itens…` : "Preparar nova busca"}</Button><Button variant="outline" onClick={() => regenerateHumanized.mutate({ limit: 25, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })} disabled={regenerateHumanized.isPending}><Sparkles className="mr-2 h-4 w-4" />{regenerateHumanized.isPending ? "Regenerando…" : "Regenerar voz humanizada"}</Button><Button variant="outline" onClick={() => publishApproved.mutate({ limit: 30, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })} disabled={publishApproved.isPending}><Play className="mr-2 h-4 w-4" />{publishApproved.isPending ? "Publicando aprovados…" : "Publicar aprovados"}</Button><Button variant="outline" onClick={() => reconcilePublished.mutate({ limit: 30, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })} disabled={reconcilePublished.isPending}><RefreshCw className="mr-2 h-4 w-4" />{reconcilePublished.isPending ? "Verificando…" : "Verificar YouTube"}</Button><Button variant="outline" onClick={() => run.mutate(selectedChannelId ? { projectChannelId: selectedChannelId } : undefined)} disabled={run.isPending || !enabled}>{run.isPending ? "Executando…" : <><Play className="mr-2 h-4 w-4" />Executar agora</>}</Button>{settings.data?.scheduleCronTaskUid ? <Button variant="outline" onClick={() => pause.mutate(selectedChannelId ? { projectChannelId: selectedChannelId } : undefined)} disabled={pause.isPending}><Pause className="mr-2 h-4 w-4" />Pausar agendamento</Button> : <><Input className="w-[170px]" value={cron} onChange={event => setCron(event.target.value)} aria-label="Cron UTC" /><Button variant="outline" onClick={() => schedule.mutate({ cron, ...(selectedChannelId ? { projectChannelId: selectedChannelId } : {}) })} disabled={schedule.isPending}><Clock3 className="mr-2 h-4 w-4" />Agendar</Button></>}</div><p className="text-xs leading-5 text-muted-foreground">A regeneração mantém os vídeos validados, troca a evidência por contexto conversacional ou pela tensão do vídeo e descarta CTAs promocionais como gancho. Ela só altera rascunhos em revisão para o estado editado; não publica.</p></CardContent></Card>;
}
