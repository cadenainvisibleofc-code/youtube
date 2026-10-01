import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, CircleAlert, Radio, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "cadena-invisible:selected-project-channel";
const CHANNEL_EVENT = "cadena-invisible:channel-selected";
export type ChannelScope = number | number[] | "all" | undefined;

export function readSelectedChannelId() {
  if (typeof window === "undefined") return undefined;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "all") return "all" as const;
  if (stored?.includes(",")) {
    const ids = stored
      .split(",")
      .map(Number)
      .filter(value => Number.isInteger(value) && value > 0);
    return ids.length ? ids : undefined;
  }
  const value = Number(stored);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function resolveChannelProjectId(input: {
  selectedProjectId?: number;
  manageableProjectId?: number;
  firstChannelProjectId?: number;
  writableProjectIds: number[];
}) {
  return (
    input.selectedProjectId ??
    input.manageableProjectId ??
    input.firstChannelProjectId ??
    (input.writableProjectIds.length === 1
      ? input.writableProjectIds[0]
      : undefined)
  );
}

export function selectChannel(id: ChannelScope) {
  if (typeof window === "undefined") return;
  if (id === undefined) window.localStorage.removeItem(STORAGE_KEY);
  else if (id === "all") window.localStorage.setItem(STORAGE_KEY, "all");
  else if (Array.isArray(id))
    window.localStorage.setItem(STORAGE_KEY, id.join(","));
  else window.localStorage.setItem(STORAGE_KEY, String(id));
  window.dispatchEvent(new CustomEvent(CHANNEL_EVENT, { detail: id }));
}

export function useSelectedChannelId() {
  const [selectedChannelId, setSelectedChannelId] = useState<ChannelScope>(() =>
    readSelectedChannelId()
  );
  useEffect(() => {
    const onChange = (event: Event) =>
      setSelectedChannelId((event as CustomEvent<ChannelScope>).detail);
    const onStorage = () => setSelectedChannelId(readSelectedChannelId());
    window.addEventListener(CHANNEL_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANNEL_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return selectedChannelId;
}

export function ChannelPanel() {
  const integrations = trpc.dashboard.integrationStatus.useQuery(undefined, {
    staleTime: 30_000,
  });
  const selectedChannelId = useSelectedChannelId();
  const channels = integrations.data?.youtube.channels ?? [];
  const selectableChannels = channels.filter(
    channel =>
      channel.canManage &&
      channel.connected &&
      !["paused", "revoked"].includes(channel.status)
  );
  const selectedIds =
    selectedChannelId === "all"
      ? selectableChannels.map(channel => channel.id)
      : Array.isArray(selectedChannelId)
        ? selectedChannelId
        : typeof selectedChannelId === "number"
          ? [selectedChannelId]
          : [];
  const legacyConnection = integrations.data?.youtube.connection;
  const selected = useMemo(
    () =>
      typeof selectedChannelId === "number"
        ? channels.find(
            channel =>
              channel.id === selectedChannelId &&
              channel.canManage &&
              !["paused", "revoked"].includes(channel.status)
          )
        : undefined,
    [channels, selectedChannelId]
  );
  const projects = integrations.data?.youtube.projects ?? [];
  const projectId = resolveChannelProjectId({
    selectedProjectId: selected?.projectId,
    manageableProjectId: channels.find(
      channel =>
        channel.canManage && !["paused", "revoked"].includes(channel.status)
    )?.projectId,
    firstChannelProjectId: channels[0]?.projectId,
    writableProjectIds: projects.map(candidate => candidate.id),
  });
  const project =
    projects.find(candidate => candidate.id === projectId) ??
    (projectId ? { id: projectId } : undefined);
  const projectChannels = project
    ? channels.filter(
        channel =>
          channel.projectId === project.id && channel.status !== "revoked"
      )
    : [];
  const canManageProject = Boolean(
    project && projects.some(candidate => candidate.id === project.id)
  );
  const maxProjectChannels = integrations.data?.youtube.maxProjectChannels ?? 5;
  const createProject = trpc.dashboard.createProject.useMutation({
    onSuccess: () => {
      toast.success("Projeto criado. Agora você pode adicionar canais.");
      integrations.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const organizeLegacy = trpc.dashboard.organizeLegacyConnection.useMutation({
    onSuccess: result => {
      toast.success(
        result
          ? "Canal conectado organizado no projeto."
          : "Nenhuma conexão legada encontrada."
      );
      integrations.refetch();
    },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    if (!integrations.data || channels.length === 0) return;
    if (Array.isArray(selectedChannelId)) {
      const valid = selectedChannelId.filter(id =>
        selectableChannels.some(channel => channel.id === id)
      );
      if (valid.length !== selectedChannelId.length)
        selectChannel(valid.length ? valid : undefined);
    } else if (typeof selectedChannelId === "number" && !selected)
      selectChannel(undefined);
  }, [
    channels,
    integrations.data,
    selectableChannels,
    selected,
    selectedChannelId,
  ]);
  const oauthConfigured = Boolean(integrations.data?.youtube.oauth.configured);
  const oauthMissing = integrations.data?.youtube.oauth.missing ?? [];
  const oauthOrigin = integrations.data?.youtube.oauth.productionOrigin;
  const startOAuth = (channelId: number) => {
    selectChannel(channelId);
    const base =
      oauthOrigin && oauthOrigin !== window.location.origin
        ? oauthOrigin
        : window.location.origin;
    window.location.assign(
      `${base}/api/youtube/oauth/start?projectChannelId=${channelId}`
    );
  };
  const startNewAccountOAuth = () => {
    if (
      !project ||
      !canManageProject ||
      projectChannels.length >= maxProjectChannels
    )
      return;
    const base =
      oauthOrigin && oauthOrigin !== window.location.origin
        ? oauthOrigin
        : window.location.origin;
    window.location.assign(
      `${base}/api/youtube/oauth/start?addAccount=1&projectId=${project.id}`
    );
  };
  const startProjectSetup = () => {
    if (legacyConnection?.connected && channels.length === 0)
      organizeLegacy.mutate({ name: "Cadena Invisible" });
    else createProject.mutate({ name: "Cadena Invisible" });
  };
  const projectSetupPending =
    createProject.isPending || organizeLegacy.isPending;

  if (integrations.isLoading)
    return (
      <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Carregando canais do projeto…
        </CardContent>
      </Card>
    );
  if (integrations.isError || !integrations.data)
    return (
      <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]">
        <CardContent className="space-y-3 p-5 text-sm text-red-800">
          <p>Não foi possível carregar os canais e o estado do OAuth.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => integrations.refetch()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card className="border-0 bg-white shadow-[0_8px_28px_rgba(45,70,60,0.06)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              <Radio className="h-4 w-4" /> Canais do projeto
            </div>
            <CardTitle className="text-lg">
              Escolha onde a fila deve operar
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              O canal selecionado é carregado no OAuth, na automação e na
              outbox. Uma conta Google pode trazer vários canais.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => integrations.refetch()}
              aria-label="Atualizar canais"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {project ? (
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !canManageProject ||
                  !oauthConfigured ||
                  projectChannels.length >= maxProjectChannels
                }
                title={
                  !canManageProject
                    ? "Somente owner ou editor pode adicionar canais"
                    : !oauthConfigured
                      ? `OAuth indisponível: ${oauthMissing.join(", ") || "configuração incompleta"}`
                      : "A autorização pode adicionar todos os canais acessíveis desta conta Google"
                }
                onClick={startNewAccountOAuth}
              >
                {projectChannels.length >= maxProjectChannels
                  ? `${maxProjectChannels}/${maxProjectChannels} canais`
                  : !canManageProject
                    ? "Sem permissão"
                    : !oauthConfigured
                      ? "OAuth indisponível"
                      : "Adicionar canais"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!oauthConfigured || projectSetupPending}
                onClick={startProjectSetup}
              >
                {projectSetupPending
                  ? "Organizando…"
                  : legacyConnection?.connected && channels.length === 0
                    ? "Organizar canal conectado"
                    : "Criar projeto para adicionar canais"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-2">
        {channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cdd9d3] p-4 text-sm text-muted-foreground">
            {legacyConnection?.connected
              ? "Há um canal conectado fora de um projeto. Use “Organizar canal conectado” para colocá-lo no projeto sem perder a conexão."
              : "Nenhum perfil de canal foi criado ainda. Crie um projeto e depois adicione um ou vários canais da mesma conta Google."}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#edf0ed] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Canais da operação</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escolha qualquer combinação: um, dois, três, quatro ou todos
                    os canais conectados.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      selectChannel(
                        selectableChannels.map(channel => channel.id)
                      )
                    }
                    disabled={!selectableChannels.length}
                  >
                    Selecionar todos
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => selectChannel(undefined)}
                    disabled={!selectedIds.length}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectableChannels.map(channel => (
                  <label
                    key={channel.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#edf0ed] px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(channel.id)}
                      onChange={() => {
                        const next = selectedIds.includes(channel.id)
                          ? selectedIds.filter(id => id !== channel.id)
                          : [...selectedIds, channel.id];
                        selectChannel(next.length ? next : undefined);
                      }}
                      className="accent-teal-700"
                    />
                    <span className="min-w-0 truncate">
                      {channel.channelName}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto border-teal-200 text-teal-700"
                    >
                      Conectado
                    </Badge>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedIds.length
                  ? `${selectedIds.length} canal(is) selecionado(s)`
                  : "Nenhum canal selecionado — modo legado"}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {channels.map(channel => {
                const channelUnavailable = ["paused", "revoked"].includes(
                  channel.status
                );
                return (
                  <div
                    key={channel.id}
                    className={`rounded-xl border p-3 ${selectedIds.includes(channel.id) ? "border-teal-300 bg-teal-50/60" : "border-[#edf0ed]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {channel.channelName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {channel.channelId}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          channelUnavailable
                            ? "border-slate-200 text-slate-600"
                            : channel.connected
                              ? "border-teal-200 text-teal-700"
                              : channel.reauthorizationRequired
                                ? "border-amber-200 text-amber-800"
                                : "border-slate-200 text-slate-600"
                        }
                      >
                        {channelUnavailable
                          ? channel.status === "paused"
                            ? "Pausado"
                            : "Revogado"
                          : channel.connected
                            ? "Conectado"
                            : channel.reauthorizationRequired
                              ? "Reautorizar"
                              : "Pendente"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {selectedIds.includes(channel.id) ? (
                          <>
                            <Check className="mr-1 inline h-3.5 w-3.5 text-teal-700" />
                            Selecionado
                          </>
                        ) : channelUnavailable ? (
                          "Indisponível para seleção"
                        ) : channel.canManage ? (
                          "Disponível para seleção"
                        ) : (
                          "Somente leitura"
                        )}
                      </span>
                      {oauthConfigured &&
                        channel.canManage &&
                        !channelUnavailable && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`${channel.reauthorizationRequired ? "Reconectar" : "Conectar"} canal ${channel.channelName}`}
                            onClick={() => startOAuth(channel.id)}
                          >
                            {channel.reauthorizationRequired
                              ? "Reconectar"
                              : "Conectar"}
                          </Button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {selected && (
          <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs leading-5 text-teal-900">
            <Check className="mt-0.5 h-4 w-4 shrink-0" /> As ações da automação
            desta tela serão direcionadas para{" "}
            <strong>{selected.channelName}</strong>.
          </p>
        )}
        {(selectedChannelId === "all" || Array.isArray(selectedChannelId)) &&
          selectedIds.length > 1 && (
            <p className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-xs leading-5 text-violet-900">
              <Check className="mt-0.5 h-4 w-4 shrink-0" /> Modo sincronizado
              ativo: as regras e ações serão executadas em cada canal
              disponível, com limite, cooldown, fila e auditoria separados. A
              aprovação humana continua obrigatória.
            </p>
          )}
        {channels.length > 0 && !project && (
          <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Você pode visualizar este canal, mas somente membros{" "}
            <strong>owner</strong> ou <strong>editor</strong> do projeto podem
            adicionar outras contas.
          </p>
        )}
        {!oauthConfigured && channels.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> OAuth ainda não
            está configurado nesta instância
            {oauthMissing.length ? `: ${oauthMissing.join(", ")}` : "."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
