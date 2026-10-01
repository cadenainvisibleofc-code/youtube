import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Archive, Bot, Check, FileImage, FileText, Loader2, MessageSquarePlus, Mic, Paperclip, Send, ShieldCheck, Square, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AttachmentView = { id?: number; fileName: string; mimeType: string; kind: "image" | "pdf" | "audio"; storageUrl?: string; transcript?: string | null };
type ChatItem = { role: "user" | "assistant" | "tool"; content: string; toolName?: string | null; createdAt?: Date | string; attachments?: AttachmentView[] };
type DraftAttachment = { file: File; kind: "image" | "pdf" | "audio" };

const examples = [
  "Busque vídeos sobre inteligência emocional e prepare os melhores na fila de revisão.",
  "Analise este arquivo e diga se há uma oportunidade editorial segura.",
  "Execute a rotina controlada com as configurações atuais.",
  "Mostre os rascunhos que estão aguardando revisão.",
];

function kindForFile(file: File): DraftAttachment["kind"] | null {
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm", "audio/x-m4a"].includes(file.type)) return "audio";
  return null;
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...Array.from(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))));
  return btoa(binary);
}

function AttachmentIcon({ kind }: { kind: DraftAttachment["kind"] }) {
  if (kind === "image") return <FileImage className="h-4 w-4" />;
  if (kind === "pdf") return <FileText className="h-4 w-4" />;
  return <Mic className="h-4 w-4" />;
}

export default function Chat() {
  const conversationsQuery = trpc.chat.conversations.useQuery();
  const [conversationId, setConversationId] = useState<number | undefined>();
  const historyQuery = trpc.chat.history.useQuery(conversationId ? { conversationId } : undefined);
  const send = trpc.chat.send.useMutation();
  const createConversation = trpc.chat.createConversation.useMutation();
  const archiveConversation = trpc.chat.archiveConversation.useMutation();
  const memoryQuery = trpc.memory.list.useQuery({ includeInactive: true });
  const reviewMemory = trpc.memory.review.useMutation();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (historyQuery.data) {
      setConversationId(historyQuery.data.conversation.id);
      setItems(historyQuery.data.messages as ChatItem[]);
    }
  }, [historyQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, send.isPending]);

  const selectConversation = (id: number) => {
    setConversationId(id);
    setItems([]);
  };

  const newConversation = async () => {
    try {
      const created = await createConversation.mutateAsync({});
      setConversationId(created.id);
      setItems([]);
      await conversationsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir uma conversa");
    }
  };

  const archiveCurrent = async () => {
    if (!conversationId) return;
    try {
      await archiveConversation.mutateAsync({ conversationId });
      setConversationId(undefined);
      setItems([]);
      await conversationsQuery.refetch();
      await historyQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível arquivar a conversa");
    }
  };

  const reviewLearning = async (memoryId: number, decision: "approved" | "rejected" | "archived") => {
    try {
      await reviewMemory.mutateAsync({ memoryId, decision });
      await memoryQuery.refetch();
      toast.success(decision === "approved" ? "Aprendizado aprovado e ativo no contexto do chat" : "Aprendizado retirado do contexto ativo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível revisar o aprendizado");
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const next: DraftAttachment[] = [];
    for (const file of Array.from(files)) {
      const kind = kindForFile(file);
      if (!kind) { toast.error(`${file.name}: formato não suportado`); continue; }
      const max = kind === "audio" ? 16 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > max) { toast.error(`${file.name}: excede o limite de ${kind === "audio" ? "16 MB" : "20 MB"}`); continue; }
      next.push({ file, kind });
    }
    setAttachments(previous => [...previous, ...next].slice(0, 5));
  };

  const startRecording = async () => {
    setMediaError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMediaError("Seu navegador não oferece gravação de áudio."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 16 * 1024 * 1024) { toast.error("A gravação excede 16 MB"); return; }
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        setAttachments(previous => [...previous, { file: new File([blob], `gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type: blob.type }), kind: "audio" as const }].slice(0, 5));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMediaError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if ((!value && !attachments.length) || send.isPending) return;
    const drafts = attachments;
    setItems(previous => [...previous, { role: "user", content: value || "[Anexo enviado para análise]", attachments: drafts.map(item => ({ fileName: item.file.name, mimeType: item.file.type, kind: item.kind })) }]);
    setText("");
    setAttachments([]);
    try {
      const encoded = await Promise.all(drafts.map(async item => ({ fileName: item.file.name, mimeType: item.file.type, kind: item.kind as DraftAttachment["kind"], sizeBytes: item.file.size, dataBase64: await fileToBase64(item.file) })));
      const result = await send.mutateAsync({ conversationId, text: value, attachments: encoded });
      setConversationId(result.conversation.id);
      setItems(result.messages as ChatItem[]);
      await conversationsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível executar o comando");
    }
  };

  return <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col gap-4">
    <div className="flex flex-col gap-3 rounded-3xl bg-[#173b38] p-6 text-white shadow-[0_20px_55px_rgba(23,59,56,0.18)] sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-200"><Bot className="h-4 w-4" /> Assistente operacional</div><h1 className="text-3xl font-semibold tracking-tight">Converse com o seu painel.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/80">Digite, envie uma imagem ou PDF, ou grave um áudio. Cada conversa fica salva separadamente e o backend mantém todas as regras de segurança.</p></div>
      <Badge className="w-fit border border-teal-200/30 bg-white/10 text-teal-50"><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Ferramentas controladas</Badge>
    </div>

    <div className="grid min-h-[680px] gap-4 lg:grid-cols-[230px_1fr]">
      <div className="space-y-4">
        <Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]"><CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm">Conversas</CardTitle><Button size="icon" variant="outline" onClick={() => void newConversation()} disabled={createConversation.isPending} aria-label="Nova conversa"><MessageSquarePlus className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-2 px-3 pb-4">{conversationsQuery.data?.length ? conversationsQuery.data.map(conversation => <button type="button" key={conversation.id} onClick={() => selectConversation(conversation.id)} className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${conversation.id === conversationId ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50"}`}><span className="block truncate font-medium">{conversation.title}</span><span className="mt-1 block text-[10px] text-slate-400">{new Date(conversation.updatedAt).toLocaleDateString()}</span></button>) : <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">Sua primeira conversa será criada automaticamente.</p>}</CardContent></Card>
        <Card className="border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm">Memória editorial</CardTitle><Badge variant="outline" className="text-[10px]">{memoryQuery.data?.filter(memory => memory.status === "proposed").length ?? 0} pendentes</Badge></div></CardHeader><CardContent className="px-3 pb-4"><p className="mb-3 text-[11px] leading-4 text-muted-foreground">O núcleo fundador é protegido. Só aprendizados aprovados entram no contexto.</p><div className="max-h-72 space-y-2 overflow-y-auto">{memoryQuery.data?.map(memory => <div key={memory.id} className="rounded-xl border border-[#e1ebe4] p-2 text-[11px]"><div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-700">{memory.title}</span><Badge variant="outline" className="shrink-0 text-[9px]">{memory.status === "core" ? "núcleo" : memory.status}</Badge></div><p className="mt-1 line-clamp-3 leading-4 text-slate-500">{memory.content}</p>{memory.status === "proposed" && !memory.locked && <div className="mt-2 flex gap-1"><Button type="button" size="sm" className="h-7 px-2 text-[10px]" onClick={() => void reviewLearning(memory.id, "approved")} disabled={reviewMemory.isPending}><Check className="mr-1 h-3 w-3" />Aprovar</Button><Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => void reviewLearning(memory.id, "rejected")} disabled={reviewMemory.isPending}>Rejeitar</Button></div>}</div>)}</div></CardContent></Card>
      </div>

      <Card className="flex min-h-[680px] flex-col border-0 bg-white shadow-[0_14px_45px_rgba(45,70,60,0.08)]"><CardHeader className="flex-row items-center justify-between border-b border-[#edf0ed] pb-4"><div><CardTitle className="text-lg">{historyQuery.data?.conversation.title ?? "Nova conversa"}</CardTitle><p className="text-sm text-muted-foreground">Texto, imagem, PDF e áudio podem ser usados no mesmo comando.</p></div><Button variant="ghost" size="icon" onClick={() => void archiveCurrent()} disabled={!conversationId || archiveConversation.isPending} aria-label="Arquivar conversa"><Archive className="h-4 w-4" /></Button></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-[#f7faf8] p-3 sm:p-5">
            {items.length === 0 && !historyQuery.isLoading && <div className="mx-auto max-w-xl py-12 text-center"><Bot className="mx-auto h-10 w-10 text-teal-700" /><h2 className="mt-4 font-semibold">O que você quer que o painel faça?</h2><p className="mt-2 text-sm text-muted-foreground">Escreva como escreveria para uma pessoa ou envie um material para análise.</p><div className="mt-6 grid gap-2 text-left sm:grid-cols-2">{examples.map(example => <button type="button" key={example} onClick={() => setText(example)} className="rounded-xl border border-[#dce8e1] bg-white p-3 text-left text-xs leading-5 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50">{example}</button>)}</div></div>}
            {historyQuery.isLoading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…</div>}
            {items.map((item, index) => <div key={`${item.createdAt ?? "now"}-${index}`} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`flex max-w-[90%] gap-3 ${item.role === "user" ? "flex-row-reverse" : ""}`}><div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.role === "user" ? "bg-slate-100 text-slate-700" : "bg-teal-100 text-teal-800"}`}>{item.role === "user" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div><div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "bg-[#173b38] text-white" : item.role === "tool" ? "border border-amber-200 bg-amber-50 text-amber-950" : "border border-[#e1ebe4] bg-white text-slate-800"}`}>{item.role === "tool" && <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">execução · {item.toolName ?? "ferramenta"}</div>}{item.content}{item.attachments?.length ? <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map(attachment => <div key={`${attachment.id ?? attachment.fileName}`} className="flex items-center gap-2 rounded-lg border border-current/10 bg-black/5 px-2 py-1 text-xs"><AttachmentIcon kind={attachment.kind} />{attachment.fileName}</div>)}</div> : null}</div></div></div>)}
            {send.isPending && <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando e executando o comando…</div>}
            <div ref={bottomRef} />
          </div>
          {attachments.length > 0 && <div className="flex flex-wrap gap-2 rounded-xl border border-teal-100 bg-teal-50/50 p-2">{attachments.map((attachment, index) => <div key={`${attachment.file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs text-teal-900"><AttachmentIcon kind={attachment.kind} /> <span className="max-w-40 truncate">{attachment.file.name}</span><button type="button" onClick={() => setAttachments(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${attachment.file.name}`}><X className="h-3 w-3" /></button></div>)}</div>}
          {mediaError && <p className="text-xs text-amber-700">{mediaError}</p>}
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="flex flex-1 items-end gap-2"><Textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(event); } }} placeholder="Ex.: analise este material e encontre uma oportunidade segura…" maxLength={2000} className="min-h-14 resize-none" aria-label="Comando para o assistente" /><input id="chat-file-input" type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,audio/x-m4a" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><Button type="button" variant="outline" size="icon" className="h-14 w-12 shrink-0" onClick={() => document.getElementById("chat-file-input")?.click()} aria-label="Anexar imagem, PDF ou áudio"><Paperclip className="h-4 w-4" /></Button><Button type="button" variant={recording ? "destructive" : "outline"} size="icon" className="h-14 w-12 shrink-0" onClick={recording ? stopRecording : () => void startRecording()} aria-label={recording ? "Parar gravação" : "Gravar áudio"}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button></div><Button type="submit" disabled={(!text.trim() && !attachments.length) || send.isPending} className="h-14 sm:w-32"><Send className="mr-2 h-4 w-4" /> Executar</Button></form>
          <p className="text-xs text-muted-foreground">Enter executa · Shift + Enter quebra linha · imagem/PDF até 20 MB · áudio até 16 MB · o assistente não recebe acesso a Secrets nem a código arbitrário.</p>
        </CardContent>
      </Card>
    </div>
  </div>;
}
