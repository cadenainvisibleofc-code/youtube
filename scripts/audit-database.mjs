import pg from "pg";

const plannedChecks = [
  "row_counts",
  "nullable_project_channel_ids",
  "orphan_foreign_keys",
  "duplicate_project_members",
  "duplicate_project_channels",
  "duplicate_channel_scoped_settings",
  "duplicate_publications_by_draft",
  "duplicate_publication_outbox_keys",
  "channel_scope_mismatches",
  "draft_outbox_state_mismatches",
  "destructive_cascade_impact_counts",
];

// Probe every table read by the audit before attempting any data query.
const requiredApplicationTables = [
  "users",
  "videos",
  "projects",
  "projectMembers",
  "projectChannels",
  "channelProfiles",
  "youtubeConnections",
  "automationSettings",
  "commentObservations",
  "drafts",
  "publications",
  "editorialFeedback",
  "videoMetricSnapshots",
  "readingVisits",
  "chainEvents",
  "chatConversations",
  "chatMessages",
  "chatAttachments",
  "rulesets",
  "publicationOutbox",
  "publicationEngagementEvents",
  "editorialMemories",
  "editorialMemoryEvents",
];

function emit(value) {
  console.log(JSON.stringify(value, null, 2));
}

const databaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  emit({
    mode: "dry-run",
    status: "blocked_missing_database_url",
    applied: false,
    migrationsApplied: false,
    plannedChecks,
    message: "Auditoria não executada contra dados: SUPABASE_DATABASE_URL/DATABASE_URL não está configurada neste ambiente.",
  });
  process.exit(2);
}

const connection = new pg.Client({ connectionString: databaseUrl });
const result = {
  mode: "dry-run",
  status: "completed",
  applied: false,
  migrationsApplied: false,
  checks: {},
};

async function rows(name, sql, params = []) {
  const { rows: data } = await connection.query(sql, params);
  result.checks[name] = data;
}

try {
  await connection.connect();
  // Enforced by PostgreSQL for the schema probe and *all* data queries.
  await connection.query("BEGIN READ ONLY");
  result.readOnlyMode = "transaction_read_only";
  const { rows: existingTableRows } = await connection.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const existingTables = existingTableRows.map(row => row.table_name);
  const missingApplicationTables = requiredApplicationTables.filter(table => !existingTables.includes(table));
  if (missingApplicationTables.length > 0) {
    result.status = "blocked_missing_application_schema";
    result.checks.schema = {
      existingTables,
      requiredApplicationTables,
      missingApplicationTables,
      message: "Banco provisionado, mas o schema PostgreSQL da aplicação ainda não foi aplicado; nenhuma auditoria de dados foi inferida.",
    };
    await connection.query("ROLLBACK");
    emit(result);
    process.exitCode = 2;
  } else {
    // Actual counts, not PostgreSQL planner estimates; restrict names to our schema whitelist.
    result.checks.row_counts = [];
    for (const table of requiredApplicationTables) {
      const identifier = table.replaceAll('"', '""');
      const { rows: counted } = await connection.query(`SELECT count(*)::text AS table_rows FROM "${identifier}"`);
      result.checks.row_counts.push({ table_name: table, table_rows: counted[0].table_rows });
    }

  await rows("nullable_project_channel_ids", `
    SELECT 'youtubeConnections' AS table_name, COUNT(*) AS null_count FROM "youtubeConnections" WHERE "projectChannelId" IS NULL
    UNION ALL SELECT 'automationSettings', COUNT(*) FROM "automationSettings" WHERE "projectChannelId" IS NULL
    UNION ALL SELECT 'drafts', COUNT(*) FROM drafts WHERE "projectChannelId" IS NULL
    UNION ALL SELECT 'publications', COUNT(*) FROM publications WHERE "projectChannelId" IS NULL
    UNION ALL SELECT 'publicationOutbox', COUNT(*) FROM "publicationOutbox" WHERE "projectChannelId" IS NULL
  `);

  await rows("orphan_foreign_keys", `
    SELECT 'projectMembers.projectId -> projects.id' AS relation, COUNT(*) AS orphan_count
      FROM "projectMembers" pm LEFT JOIN projects p ON p.id = pm."projectId" WHERE p.id IS NULL
    UNION ALL SELECT 'projectChannels.projectId -> projects.id', COUNT(*)
      FROM "projectChannels" pc LEFT JOIN projects p ON p.id = pc."projectId" WHERE p.id IS NULL
    UNION ALL SELECT 'youtubeConnections.projectChannelId -> projectChannels.id', COUNT(*)
      FROM "youtubeConnections" yc LEFT JOIN "projectChannels" pc ON pc.id = yc."projectChannelId"
      WHERE yc."projectChannelId" IS NOT NULL AND pc.id IS NULL
    UNION ALL SELECT 'automationSettings.projectChannelId -> projectChannels.id', COUNT(*)
      FROM "automationSettings" s LEFT JOIN "projectChannels" pc ON pc.id = s."projectChannelId"
      WHERE s."projectChannelId" IS NOT NULL AND pc.id IS NULL
    UNION ALL SELECT 'drafts.videoId -> videos.id', COUNT(*)
      FROM drafts d LEFT JOIN videos v ON v.id = d."videoId" WHERE v.id IS NULL
    UNION ALL SELECT 'drafts.projectChannelId -> projectChannels.id', COUNT(*)
      FROM drafts d LEFT JOIN "projectChannels" pc ON pc.id = d."projectChannelId"
      WHERE d."projectChannelId" IS NOT NULL AND pc.id IS NULL
    UNION ALL SELECT 'drafts.createdBy -> users.id', COUNT(*)
      FROM drafts d LEFT JOIN users u ON u.id = d."createdBy"
      WHERE d."createdBy" IS NOT NULL AND u.id IS NULL
    UNION ALL SELECT 'publications.draftId -> drafts.id', COUNT(*)
      FROM publications p LEFT JOIN drafts d ON d.id = p."draftId" WHERE d.id IS NULL
    UNION ALL SELECT 'publications.videoId -> videos.id', COUNT(*)
      FROM publications p LEFT JOIN videos v ON v.id = p."videoId" WHERE v.id IS NULL
    UNION ALL SELECT 'publicationOutbox.draftId -> drafts.id', COUNT(*)
      FROM "publicationOutbox" o LEFT JOIN drafts d ON d.id = o."draftId" WHERE d.id IS NULL
    UNION ALL SELECT 'publicationOutbox.projectChannelId -> projectChannels.id', COUNT(*)
      FROM "publicationOutbox" o LEFT JOIN "projectChannels" pc ON pc.id = o."projectChannelId"
      WHERE o."projectChannelId" IS NOT NULL AND pc.id IS NULL
    UNION ALL SELECT 'editorialFeedback.draftId -> drafts.id', COUNT(*)
      FROM "editorialFeedback" ef LEFT JOIN drafts d ON d.id = ef."draftId" WHERE d.id IS NULL
    UNION ALL SELECT 'videoMetricSnapshots.videoId -> videos.id', COUNT(*)
      FROM "videoMetricSnapshots" ms LEFT JOIN videos v ON v.id = ms."videoId" WHERE v.id IS NULL
    UNION ALL SELECT 'chainEvents.publicationId -> publications.id', COUNT(*)
      FROM "chainEvents" ce LEFT JOIN publications p ON p.id = ce."publicationId"
      WHERE ce."publicationId" IS NOT NULL AND p.id IS NULL
    UNION ALL SELECT 'chatMessages.conversationId -> chatConversations.id', COUNT(*)
      FROM "chatMessages" cm LEFT JOIN "chatConversations" cc ON cc.id = cm."conversationId"
      WHERE cm."conversationId" IS NOT NULL AND cc.id IS NULL
    UNION ALL SELECT 'chatAttachments.messageId -> chatMessages.id', COUNT(*)
      FROM "chatAttachments" ca LEFT JOIN "chatMessages" cm ON cm.id = ca."messageId" WHERE cm.id IS NULL
    UNION ALL SELECT 'publicationEngagementEvents.publicationId -> publications.id', COUNT(*)
      FROM "publicationEngagementEvents" pe LEFT JOIN publications p ON p.id = pe."publicationId" WHERE p.id IS NULL
  `);

  await rows("duplicate_project_members", `
    SELECT "projectId", "openId", COUNT(*) AS duplicate_count
    FROM "projectMembers" GROUP BY "projectId", "openId" HAVING COUNT(*) > 1
  `);

  await rows("duplicate_project_channels", `
    SELECT "projectId", "channelId", COUNT(*) AS duplicate_count
    FROM "projectChannels" GROUP BY "projectId", "channelId" HAVING COUNT(*) > 1
  `);

  await rows("duplicate_channel_scoped_settings", `
    SELECT 'youtubeConnections' AS table_name, "projectChannelId", COUNT(*) AS duplicate_count
      FROM "youtubeConnections" WHERE "projectChannelId" IS NOT NULL GROUP BY "projectChannelId" HAVING COUNT(*) > 1
    UNION ALL SELECT 'automationSettings', "projectChannelId", COUNT(*)
      FROM "automationSettings" WHERE "projectChannelId" IS NOT NULL GROUP BY "projectChannelId" HAVING COUNT(*) > 1
  `);

  await rows("duplicate_publications_by_draft", `
    SELECT "draftId", COUNT(*) AS duplicate_count
    FROM publications GROUP BY "draftId" HAVING COUNT(*) > 1
  `);

  await rows("duplicate_publication_outbox_keys", `
    SELECT 'draftId' AS key_name, "draftId"::text AS key_value, COUNT(*) AS duplicate_count
      FROM "publicationOutbox" GROUP BY "draftId" HAVING COUNT(*) > 1
    UNION ALL SELECT 'idempotencyKey', "idempotencyKey", COUNT(*)
      FROM "publicationOutbox" GROUP BY "idempotencyKey" HAVING COUNT(*) > 1
  `);

  await rows("channel_scope_mismatches", `
    SELECT 'youtubeConnections.channelId != projectChannels.channelId' AS mismatch, COUNT(*) AS mismatch_count
      FROM "youtubeConnections" yc JOIN "projectChannels" pc ON pc.id = yc."projectChannelId"
      WHERE yc."projectChannelId" IS NOT NULL AND yc."channelId" <> pc."channelId"
    UNION ALL SELECT 'drafts.video.channelId != projectChannels.channelId', COUNT(*)
      FROM drafts d JOIN videos v ON v.id = d."videoId" JOIN "projectChannels" pc ON pc.id = d."projectChannelId"
      WHERE d."projectChannelId" IS NOT NULL AND v."channelId" <> pc."channelId"
    UNION ALL SELECT 'outbox.ownerOpenId != draft owner', COUNT(*)
      FROM "publicationOutbox" o JOIN drafts d ON d.id = o."draftId" JOIN users u ON u.id = d."createdBy"
      WHERE d."createdBy" IS NOT NULL AND o."ownerOpenId" <> u."openId"
    UNION ALL SELECT 'outbox.projectChannelId != draft.projectChannelId', COUNT(*)
      FROM "publicationOutbox" o JOIN drafts d ON d.id = o."draftId"
      WHERE COALESCE(o."projectChannelId", -1) <> COALESCE(d."projectChannelId", -1)
  `);

  await rows("draft_outbox_state_mismatches", `
    SELECT 'approved draft without pending/processing/succeeded outbox' AS mismatch, COUNT(*) AS mismatch_count
      FROM drafts d LEFT JOIN "publicationOutbox" o ON o."draftId" = d.id
      WHERE d.status = 'approved' AND (o.id IS NULL OR o.status NOT IN ('pending', 'processing', 'succeeded', 'uncertain', 'failed'))
    UNION ALL SELECT 'non-approved draft with active outbox', COUNT(*)
      FROM drafts d JOIN "publicationOutbox" o ON o."draftId" = d.id
      WHERE d.status NOT IN ('approved', 'publishing', 'published') AND o.status IN ('pending', 'processing')
    UNION ALL SELECT 'succeeded outbox without published draft', COUNT(*)
      FROM "publicationOutbox" o JOIN drafts d ON d.id = o."draftId"
      WHERE o.status = 'succeeded' AND d.status <> 'published'
  `);

  await rows("destructive_cascade_impact_counts", `
    SELECT 'chatAttachments -> chatMessages (CASCADE)' AS relation, COUNT(*) AS child_count FROM "chatAttachments"
    UNION ALL SELECT 'videoMetricSnapshots -> videos (CASCADE)', COUNT(*) FROM "videoMetricSnapshots"
  `);

    await connection.query("ROLLBACK");
    emit(result);
  }
} catch (error) {
  await connection.query("ROLLBACK").catch(() => undefined);
  emit({
    mode: "dry-run",
    status: "failed_read_only",
    applied: false,
    migrationsApplied: false,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await connection.end().catch(() => undefined);
}
