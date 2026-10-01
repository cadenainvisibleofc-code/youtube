import type { Request, Response } from "express";
import { getAutomationSettingsByTaskUid, runAutomation } from "./automation";
import * as db from "./db";
import { sdk } from "./_core/sdk";

export async function handleYouTubeAutomation(req: Request, res: Response) {
  const context = { url: req.originalUrl, taskUid: undefined as string | undefined };
  try {
    const user = await sdk.authenticateRequest(req);
    context.taskUid = user.taskUid;
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const configured = await getAutomationSettingsByTaskUid(user.taskUid);
    if (!configured) return res.json({ ok: true, skipped: "orphan" });

    const owner = await db.getUserByOpenId(configured.ownerOpenId);
    if (!owner) return res.json({ ok: true, skipped: "owner-missing" });
    const result = await runAutomation({ ownerOpenId: configured.ownerOpenId, ownerId: owner.id, projectChannelId: configured.projectChannelId });
    return res.json({ ok: true, result });
  } catch (error) {
    console.error("[ScheduledAutomation] execution failed", error instanceof Error ? error.name : "unknown");
    return res.status(500).json({
      error: "Não foi possível concluir a execução agendada",
      timestamp: new Date().toISOString(),
    });
  }
}
