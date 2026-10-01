import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Check, Link2, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function GuardianMissionPanel() {
  const integrations = trpc.dashboard.integrationStatus.useQuery(undefined, { staleTime: 30_000 });
  const missions = trpc.dashboard.guardianMissions.useQuery(undefined, { staleTime: 15_000 });
  const utils = trpc.useUtils();
  const [videoId, setVideoId] = useState("");
  const [sourceCommentId, setSourceCommentId] = useState("");
  const [sourceCommentText, setSourceCommentText] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const prepare = trpc.dashboard.prepareGuardianMission.useMutation({
    onSuccess: result => {
      toast.success(result.reducedForSafety ? `Missão criada com ${result.selectedGuardianCount} guardião por segurança editorial.` : `Missão criada com ${result.selectedGuardianCount} guardiões.`);
      setVideoId("");
      setSourceCommentId("");
      setSourceCommentText("");
      void utils.dashboard.guardianMissions.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const approve = trpc.dashboard.approveGuardianMission.useMutation({
    onSuccess: result => {
      toast.success(`${result.approvedAssignments} assignments aprovados para a outbox humana.`);
      void utils.dashboard.guardianMissions.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const channels = (integrations.data?.youtube.channels ?? []).filter(channel => channel.canManage && !["paused", "revoked"].includes(channel.status));
  const toggleChannel = (id: number) => setSelectedChannels(current => current.includes(id) ? current.filter(value => value !== id) : current.length >= 5 ? current : [...current, id]);

  return <Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]">
    <CardHeader className="border-b border-[#edf0ed] pb-4">
      <div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-violet-700" /> Missão sincronizada de guardiões</CardTitle><p className="mt-1 text-sm text-muted-foreground">Escolha de 1 a 5 canais. O sistema cria papéis distintos e só libera o conjunto após revisão humana.</p></div><Badge variant="outline" className="border-violet-200 text-violet-700">1–5 canais</Badge></div>
    </CardHeader>
    <CardContent className="space-y-4 p-4 sm:p-6">
      <div className="grid gap-3 md:grid-cols-3"><div><label className="text-xs font-medium" htmlFor="guardian-video-id">ID numérico do vídeo registrado</label><Input id="guardian-video-id" inputMode="numeric" value={videoId} onChange={event => setVideoId(event.target.value.replace(/\D/g, ""))} placeholder="Ex.: 42" className="mt-1" /></div><div><label className="text-xs font-medium" htmlFor="guardian-comment-id">ID do comentário-fonte (opcional)</label><Input id="guardian-comment-id" value={sourceCommentId} onChange={event => setSourceCommentId(event.target.value)} placeholder="YouTube comment ID" className="mt-1" /></div><div><label className="text-xs font-medium">Canais escolhidos</label><p className="mt-2 text-sm text-violet-700">{selectedChannels.length}/5 guardiões</p></div></div>
      <div className="flex flex-wrap gap-2">{channels.map(channel => <button type="button" key={channel.id} onClick={() => toggleChannel(channel.id)} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${selectedChannels.includes(channel.id) ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"}`}><span className="block font-medium">{channel.channelName}</span><span className="mt-1 block opacity-70">{selectedChannels.includes(channel.id) ? "Selecionado" : "Selecionar"}</span></button>)}</div>
      <div><label className="text-xs font-medium" htmlFor="guardian-source-comment">Comentário-fonte e sensação reconhecida</label><Textarea id="guardian-source-comment" value={sourceCommentText} onChange={event => setSourceCommentText(event.target.value)} placeholder="Cole o comentário que merece acolhimento. Para dois ou mais guardiões, este contexto é obrigatório." className="mt-1 min-h-20" /></div>
      <div className="flex flex-wrap items-center gap-2"><Button type="button" onClick={() => prepare.mutate({ videoId: Number(videoId), projectChannelIds: selectedChannels, sourceCommentId: sourceCommentId || undefined, sourceCommentText: sourceCommentText || undefined })} disabled={prepare.isPending || !videoId || selectedChannels.length < 1 || (selectedChannels.length > 1 && !sourceCommentText.trim())}>{prepare.isPending ? "Preparando…" : "Preparar missão"}</Button><span className="text-xs text-muted-foreground">O segundo guardião recebe o papel de leitura; os demais não usam link.</span></div>
      {missions.data && missions.data.length > 0 && <div className="space-y-3 border-t border-[#edf0ed] pt-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-teal-700" /> Missões aguardando revisão conjunta</div>{missions.data.slice(-5).reverse().map(mission => <div key={mission.id} className="rounded-2xl border border-[#edf0ed] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">#{mission.id} · {mission.videoTitle}</p><p className="text-xs text-muted-foreground">{mission.selectedGuardianCount} guardião(ões) selecionado(s) · {mission.status}</p></div>{mission.status === "review" && <Button size="sm" onClick={() => approve.mutate({ missionId: mission.id })} disabled={approve.isPending}><Check className="mr-1 h-3 w-3" />Aprovar conjunto</Button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{mission.assignments.map(item => <div key={item.assignment.id} className="rounded-xl bg-[#f7f8f5] p-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.channelName}</span>{item.assignment.containsLink ? <Link2 className="h-3.5 w-3.5 text-amber-700" /> : <span className="text-slate-400">sem link</span>}</div><p className="mt-1 text-violet-700">papel: {item.assignment.role}</p><p className="mt-1 line-clamp-3 leading-4 text-slate-600">{item.draft.text}</p></div>)}</div></div>)}</div>}
    </CardContent>
  </Card>;
}
