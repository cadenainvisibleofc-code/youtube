import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, CircleAlert, Radio, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "cadena-invisible:selected-project-channel";
const CHANNEL_EVENT = "cadena-invisible:channel-selected";

export function readSelectedChannelId() {
  if (typeof window === "undefined") return undefined;
  const value = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function resolveChannelProjectId(input: { selectedProjectId?: number; manageableProjectId?: number; firstChannelProjectId?: number; writableProjectIds: number[] }) {
  return input.selectedProjectId ?? input.manageableProjectId ?? input.firstChannelProjectId ?? (input.writableProjectIds.length === 1 ? input.writableProjectIds[0] : undefined);
}

export function selectChannel(id: number | undefined) {
  if (typeof window === "undefined") return;
  if (id === undefined) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, String(id));
  window.dispatchEvent(new CustomEvent(CHANNEL_EVENT, { detail: id }));
}

export function useSelectedChannelId() {
  const [selectedChannelId, setSelectedChannelId] = useState<number | undefined>(() => readSelectedChannelId());
  useEffect(() => {
    const onChange = (event: Event) => setSelectedChannelId((event as CustomEvent<number | undefined>).detail);
    const onStorage = () => setSelectedChannelId(readSelectedChannelId());
    window.addEventListener(CHANNEL_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(CHANNEL_EVENT, onChange); window.removeEventListener("storage", onStorage); };
  }, []);
  return selectedChannelId;
}

export function ChannelPanel() {
  const integrations = trpc.dashboard.integrationStatus.useQuery(undefined, { staleTime: 30_000 });
  const selectedChannelId = useSelectedChannelId();
  const channels = integrations.data?.youtube.channels ?? [];
  const legacyConnection = integrations.data?.youtube.connection;
  const selected = useMemo(() => channels.find(channel => channel.id === selectedChannelId && channel.canManage && !["paused", "revoked"].includes(channel.status)), [channels, selectedChannelId]);
  const projects = integrations.data?.youtube.projects ?? [];
  const projectId = resolveChannelProjectId({
    selectedProjectId: selected?.projectId,
    manageableProjectId: channels.find(channel => channel.canManage && !["paused", "revoked"].includes(channel.status))?.projectId,
    firstChannelProjectId: channels[0]?.projectId,
    writableProjectIds: projects.map(candidate => candidate.id),
  });
  const project = projects.find(candidate => candidate.id === projectId) ?? (projectId ? { id: projectId } : undefined);
  const projectChannels = project ? channels.filter(channel => channel.projectId === project.id && channel.status !== "revoked") : [];
  const canManageProject = Boolean(project && projects.some(candidate => candidate.id === project.id));
  const maxProjectChannels = integrations.data?.youtube.maxProjectChannels ?? 5;
  const createProject = trpc.dashboard.createProject.useMutation({ onSuccess: () => { toast.success("Projeto criado. Agora você pode adicionar canais."); integrations.refetch(); }, onError: error => toast.error(error.message) });
  const organizeLegacy = trpc.dashboard.organizeLegacyConnection.useMutation({ onSuccess: result => { toast.success(result ? "Canal conectado organizado no projeto." : "Nenhuma conexão legada encontrada."); integrations.refetch(); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    if (selectedChannelId !== undefined && integrations.data && channels.length > 0 && !selected) selectChannel(undefined);
  }, [channels, integrations.data, selected, selectedChannelId]);
  const oauthConfigured = Boolean(integrations.data?.youtube.oauth.configured);
  const oauthMissing = integrations.data?.youtube.oauth.missing ?? [];
  const oauthOrigin = integrations.data?.youtube.oauth.productionOrigin;
  const startOAuth = (channelId: number) => {
    selectChannel(channelId);
    const base = oauthOrigin && oauthOrigin !== window.location.origin ? oauthOrigin : window.location.origin;
    window.location.assign(`${base}/api/youtube/oauth/start?projectChannelId=${channelId}`);
  };
  const startNewAccountOAuth = () => {
    if (!project || !canManageProject || projectChannels.length >= maxProjectChannels) return;
    const base = oauthOrigin && oauthOrigin !== window.location.origin ? oauthOrigin : window.location.origin;
    window.location.assign(`${base}/api/youtube/oauth/start?addAccount=1&projectId=${project.id}`);
  };
  const startProjectSetup = () => {
    if (legacyConnection?.connected && channels.length === 0) organizeLegacy.mutate({ name: "Cadena Invisible" });
    else createProject.mutate({ name: "Cadena Invisible" });
  };
  const projectSetupPending = createProject.isPending || organizeLegacy.isPending;

  if (integrations.isLoading) return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]"><CardContent className="p-5 text-sm text-muted-foreground">Carregando canais do projeto…</CardContent></Card>;
  if (integrations.isError || !integrations.data) return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]"><CardContent className="space-y-3 p-5 text-sm text-red-800"><p>Não foi possível carregar os canais e o estado do OAuth.</p><Button variant="outline" size="sm" onClick={() => integrations.refetch()}>Tentar novamente</Button></CardContent></Card>;

  return <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]">
    <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700"><Radio className="h-4 w-4" /> Canais do projeto</div><CardTitle className="text-lg">Escolha onde a fila deve operar</CardTitle><p className="mt-1 text-sm text-muted-foreground">O canal selecionado é carregado no OAuth, na automação e na outbox. Uma conta Google pode trazer vários canais.</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => integrations.refetch()} aria-label="Atualizar canais"><RefreshCw className="h-4 w-4" /></Button>{project ? <Button variant="outline" size="sm" disabled={!canManageProject || !oauthConfigured || projectChannels.length >= maxProjectChannels} title={!canManageProject ? "Somente owner ou editor pode adicionar canais" : !oauthConfigured ? `OAuth indisponível: ${oauthMissing.join(", ") || "configuração incompleta"}` : "A autorização pode adicionar todos os canais acessíveis desta conta Google"} onClick={startNewAccountOAuth}>{projectChannels.length >= maxProjectChannels ? `${maxProjectChannels}/${maxProjectChannels} canais` : !canManageProject ? "Sem permissão" : !oauthConfigured ? "OAuth indisponível" : "Adicionar canais"}</Button> : <Button variant="outline" size="sm" disabled={!oauthConfigured || projectSetupPending} onClick={startProjectSetup}>{projectSetupPending ? "Organizando…" : legacyConnection?.connected && channels.length === 0 ? "Organizar canal conectado" : "Criar projeto para adicionar canais"}</Button>}</div></div></CardHeader>
    <CardContent className="space-y-3 p-5 pt-2">
      {channels.length === 0 ? <div className="rounded-xl border border-dashed border-[#cdd9d3] p-4 text-sm text-muted-foreground">{legacyConnection?.connected ? "Há um canal conectado fora de um projeto. Use “Organizar canal conectado” para colocá-lo no projeto sem perder a conexão." : "Nenhum perfil de canal foi criado ainda. Crie um projeto e depois adicione um ou vários canais da mesma conta Google."}</div> : <>
        <label className="block text-sm"><span className="mb-1 block font-medium">Canal ativo</span><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selected?.id ?? ""} onChange={event => selectChannel(event.target.value ? Number(event.target.value) : undefined)}><option value="">Modo legado / nenhum canal selecionado</option>{channels.filter(channel => channel.canManage && !["paused", "revoked"].includes(channel.status)).map(channel => <option key={channel.id} value={channel.id}>{channel.channelName} · {channel.channelId}</option>)}</select></label>
        <div className="grid gap-2 md:grid-cols-2">{channels.map(channel => { const channelUnavailable = ["paused", "revoked"].includes(channel.status); return <div key={channel.id} className={`rounded-xl border p-3 ${channel.id === selected?.id ? "border-teal-300 bg-teal-50/60" : "border-[#edf0ed]"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{channel.channelName}</p><p className="text-xs text-muted-foreground">{channel.channelId}</p></div><Badge variant="outline" className={channelUnavailable ? "border-slate-200 text-slate-600" : channel.connected ? "border-teal-200 text-teal-700" : channel.reauthorizationRequired ? "border-amber-200 text-amber-800" : "border-slate-200 text-slate-600"}>{channelUnavailable ? channel.status === "paused" ? "Pausado" : "Revogado" : channel.connected ? "Conectado" : channel.reauthorizationRequired ? "Reautorizar" : "Pendente"}</Badge></div><div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{channel.id === selected?.id ? <><Check className="mr-1 inline h-3.5 w-3.5 text-teal-700" />Selecionado</> : channelUnavailable ? "Indisponível para seleção" : channel.canManage ? "Disponível para seleção" : "Somente leitura"}</span>{oauthConfigured && channel.canManage && !channelUnavailable && <Button size="sm" variant="outline" aria-label={`${channel.reauthorizationRequired ? "Reconectar" : "Conectar"} canal ${channel.channelName}`} onClick={() => startOAuth(channel.id)}>{channel.reauthorizationRequired ? "Reconectar" : "Conectar"}</Button>}</div></div>; })}</div>
      </>}
      {selected && <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs leading-5 text-teal-900"><Check className="mt-0.5 h-4 w-4 shrink-0" /> Todas as ações da automação desta tela serão direcionadas para <strong>{selected.channelName}</strong>.</p>}
      {channels.length > 0 && !project && <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Você pode visualizar este canal, mas somente membros <strong>owner</strong> ou <strong>editor</strong> do projeto podem adicionar outras contas.</p>}
      {!oauthConfigured && channels.length > 0 && <p className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> OAuth ainda não está configurado nesta instância{oauthMissing.length ? `: ${oauthMissing.join(", ")}` : "."}</p>}
    </CardContent>
  </Card>;
}
