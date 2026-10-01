import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDashboardSnapshot, getProjectChannelStatuses, getResonanceMetrics, getWritableProjectsForOwner, ingestManualVideo, recordReadingVisit, regenerateHumanizedDrafts, updateDraftReview, MAX_PROJECT_CHANNELS } from "./db";
import { generateDraft } from "./editorial";
import { extractYouTubeVideoId } from "./ingestion";
import { generateEditorialDraft } from "./llm-editorial";
import { getVideoDetails, searchRecentVideos, youtubeIntegrationStatus } from "./youtube";
import { TRPCError } from "@trpc/server";
import { getYouTubeConnectionStatus, youtubeOAuthConfigStatus } from "./youtube-oauth";
import { discoverWeeklyVideos, getAutomationSettings, getAutomationSettingsForChannel, prepareSavedWeeklyBatch, runAutomation, setAutomationScheduleTask, updateAutomationSettings } from "./automation";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { archiveChatConversation, createChatConversation, getChatHistory, listChatConversations, sendChatMessage } from "./chat-agent";
import { listEditorialMemories, proposeEditorialMemory, reviewEditorialMemory } from "./editorial-memory";
import { processPublicationOutbox, reconcilePublishedOutbox } from "./publication-outbox";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    snapshot: protectedProcedure.query(({ ctx }) => getDashboardSnapshot(ctx.user.id)),
    ingestManual: protectedProcedure
      .input(z.object({
        url: z.string().url(),
        title: z.string().max(500).optional(),
        channelName: z.string().max(255).optional(),
        publishedAt: z.coerce.date().optional(),
        viewCount: z.number().int().min(0).optional(),
        commentCount: z.number().int().min(0).optional(),
        projectChannelId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const needsLookup = input.publishedAt === undefined || input.viewCount === undefined || input.commentCount === undefined;
        if (!needsLookup || !youtubeIntegrationStatus().configured) return ingestManualVideo({ ...input, ownerOpenId: ctx.user.openId, createdBy: ctx.user.id });

        const videoId = extractYouTubeVideoId(input.url);
        if (!videoId) throw new TRPCError({ code: "BAD_REQUEST", message: "URL do YouTube inválida" });
        const candidate = (await getVideoDetails([videoId]))[0];
        if (!candidate) throw new TRPCError({ code: "BAD_REQUEST", message: "Vídeo não encontrado na API oficial do YouTube" });
        return ingestManualVideo({
          ownerOpenId: ctx.user.openId,
          createdBy: ctx.user.id,
          url: candidate.url,
          title: candidate.title,
          channelName: candidate.channelName,
          publishedAt: candidate.publishedAt,
          viewCount: candidate.viewCount,
          commentCount: candidate.commentCount,
          projectChannelId: input.projectChannelId,
        });
      }),
    editorialPreview: protectedProcedure
      .input(z.object({ videoTitle: z.string().min(1), videoTheme: z.string().min(1), commentText: z.string().optional(), link: z.string().url().optional() }))
      .mutation(({ input }) => generateDraft(input)),
    editorialAssist: protectedProcedure
      .input(z.object({ videoTitle: z.string().min(1), videoTheme: z.string().min(1), commentText: z.string().optional(), link: z.string().url().optional() }))
      .mutation(({ input }) => generateEditorialDraft(input)),
    integrationStatus: protectedProcedure.query(async ({ ctx }) => {
      let connection;
      try {
        connection = await getYouTubeConnectionStatus(ctx.user.openId);
      } catch (error) {
        if (!(error instanceof Error) || !/múltiplas conexões/i.test(error.message)) throw error;
        connection = { connected: false, reauthorizationRequired: false, channelId: null, channelName: null, requiresChannelSelection: true };
      }
      const [channels, projects] = await Promise.all([getProjectChannelStatuses(ctx.user.openId), getWritableProjectsForOwner(ctx.user.openId)]);
      return { youtube: { ...youtubeIntegrationStatus(), oauth: youtubeOAuthConfigStatus(), connection, channels, projects, maxProjectChannels: MAX_PROJECT_CHANNELS }, llm: { configured: Boolean(process.env.BUILT_IN_FORGE_API_KEY), enabled: process.env.AI_EDITORIAL_ENABLED === "1", provider: process.env.AI_EDITORIAL_PROVIDER === "external" ? "relaymodels" : "manus" } };
    }),
    automationSettings: protectedProcedure.input(z.object({ projectChannelId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getAutomationSettingsForChannel(ctx.user.openId, input?.projectChannelId)),
    updateAutomationSettings: protectedProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        autoPublish: z.boolean().optional(),
        minChannelIntervalDays: z.number().int().min(30).max(365).optional(),
        includeLink: z.boolean().optional(),
        searchQueries: z.array(z.string().min(2).max(120)).max(10).optional(),
        projectChannelId: z.number().int().positive().optional(),
      }))
      .mutation(({ ctx, input }) => updateAutomationSettings(ctx.user.openId, input, input.projectChannelId)),
    runAutomation: protectedProcedure.input(z.object({ projectChannelId: z.number().int().positive().optional() }).optional()).mutation(({ ctx, input }) => runAutomation({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, projectChannelId: input?.projectChannelId })),
    discoverWeekly: protectedProcedure.input(z.object({ projectChannelId: z.number().int().positive().optional() }).optional()).mutation(({ ctx, input }) => discoverWeeklyVideos(ctx.user.openId, input?.projectChannelId)),
    prepareSavedWeekly: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(30).optional(), projectChannelId: z.number().int().positive().optional() }).optional())
      .mutation(({ ctx, input }) => prepareSavedWeeklyBatch({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, projectChannelId: input?.projectChannelId, maxDrafts: input?.limit ?? 30 })),
    prepareDailyBatch: protectedProcedure.input(z.object({ projectChannelId: z.number().int().positive().optional() }).optional()).mutation(({ ctx, input }) => runAutomation({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, projectChannelId: input?.projectChannelId, force: true, maxDrafts: 30, autoPublishOverride: false })),
    regenerateHumanized: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(25).optional(), projectChannelId: z.number().int().positive().optional() }).optional())
      .mutation(({ ctx, input }) => regenerateHumanizedDrafts(ctx.user.openId, ctx.user.id, input?.limit ?? 25, input?.projectChannelId)),
    publishApproved: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(30).optional(), projectChannelId: z.number().int().positive().optional() }).optional())
      .mutation(({ ctx, input }) => processPublicationOutbox(ctx.user.openId, input?.limit ?? 30, input?.projectChannelId)),
    reconcilePublished: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(30).optional(), projectChannelId: z.number().int().positive().optional() }).optional())
      .mutation(({ ctx, input }) => reconcilePublishedOutbox(ctx.user.openId, input?.limit ?? 30, input?.projectChannelId)),
    scheduleAutomation: protectedProcedure
      .input(z.object({ cron: z.string().regex(/^\d+ \S+ \S+ \S+ \S+ \S+$/, "Use cron UTC com 6 campos"), projectChannelId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        const current = await getAutomationSettingsForChannel(ctx.user.openId, input.projectChannelId);
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        if (current.scheduleCronTaskUid) {
          await updateHeartbeatJob(current.scheduleCronTaskUid, { cron: input.cron, enable: true }, sessionToken);
          return updateAutomationSettings(ctx.user.openId, { enabled: true }, input.projectChannelId);
        }
        const job = await createHeartbeatJob({
          name: `youtube-automation-${ctx.user.id}-${input.projectChannelId ?? "legacy"}`,
          cron: input.cron,
          path: "/api/scheduled/youtube-automation",
          description: "Descoberta e publicação contextual do Cadena Invisible",
        }, sessionToken);
        await setAutomationScheduleTask(ctx.user.openId, job.taskUid, input.projectChannelId);
        const settings = await updateAutomationSettings(ctx.user.openId, { enabled: true }, input.projectChannelId);
        return { ...settings, nextExecutionAt: job.nextExecutionAt ?? null };
      }),
    pauseAutomation: protectedProcedure.input(z.object({ projectChannelId: z.number().int().positive().optional() }).optional()).mutation(async ({ ctx, input }) => {
      const current = await getAutomationSettingsForChannel(ctx.user.openId, input?.projectChannelId);
      if (!current.scheduleCronTaskUid) return current;
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: false }, sessionToken);
      return updateAutomationSettings(ctx.user.openId, { enabled: false }, input?.projectChannelId);
    }),
    discoverYouTube: protectedProcedure
      .input(z.object({ query: z.string().min(2).max(120), maxResults: z.number().int().min(1).max(25).optional() }))
      .mutation(({ input }) => searchRecentVideos(input)),
    reviewDraft: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(["approved", "discarded", "edited"]),
        text: z.string().max(5000).optional(),
        projectChannelId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await updateDraftReview({ ...input, ownerId: ctx.user.id });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível atualizar o rascunho";
          const code = message === "Rascunho não encontrado" ? "NOT_FOUND" : message.startsWith("Banco indisponível") ? "PRECONDITION_FAILED" : "BAD_REQUEST";
          throw new TRPCError({ code, message });
        }
      }),
  }),
  analytics: router({
    recordReadingVisit: publicProcedure
      .input(z.object({ visitToken: z.string().min(8).max(80), source: z.string().max(80).optional(), campaign: z.string().max(120).optional(), videoReference: z.string().max(200).optional(), secondsRead: z.number().int().min(0).max(86_400).optional(), completed: z.boolean().optional() }))
      .mutation(({ input }) => recordReadingVisit(input)),
    resonance: protectedProcedure.query(() => getResonanceMetrics()),
  }),
  chat: router({
    conversations: protectedProcedure.query(({ ctx }) => listChatConversations(ctx.user.openId)),
    createConversation: protectedProcedure
      .input(z.object({ title: z.string().max(180).optional() }).optional())
      .mutation(({ ctx, input }) => createChatConversation(ctx.user.openId, input?.title)),
    archiveConversation: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => archiveChatConversation(ctx.user.openId, input.conversationId)),
    history: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getChatHistory(ctx.user.openId, input?.conversationId)),
    send: protectedProcedure
      .input(z.object({
        conversationId: z.number().int().positive().optional(),
        text: z.string().max(2000).default(""),
        attachments: z.array(z.object({
          fileName: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(120),
          kind: z.enum(["image", "pdf", "audio"]),
          sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
          dataBase64: z.string().min(8).max(28_000_000),
        })).max(5).optional(),
      }))
      .mutation(({ ctx, input }) => sendChatMessage({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, conversationId: input.conversationId, text: input.text, attachments: input.attachments })),
  }),
  memory: router({
    list: protectedProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(({ ctx, input }) => listEditorialMemories(ctx.user.openId, input?.includeInactive === true)),
    propose: protectedProcedure
      .input(z.object({ title: z.string().min(4).max(180), content: z.string().min(12).max(1200), category: z.string().max(80).optional() }))
      .mutation(({ ctx, input }) => proposeEditorialMemory({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, ...input })),
    review: protectedProcedure
      .input(z.object({ memoryId: z.number().int().positive(), decision: z.enum(["approved", "rejected", "archived"]), note: z.string().max(500).optional() }))
      .mutation(({ ctx, input }) => reviewEditorialMemory({ ownerOpenId: ctx.user.openId, ownerId: ctx.user.id, ...input })),
  }),
});

export type AppRouter = typeof appRouter;
