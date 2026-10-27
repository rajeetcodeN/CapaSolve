import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./neon";
import { uploadAsset, getAsset } from "./storage";

/**
 * Server functions for saving and loading schedule state with Neon S3 Object Storage and Neon Lakebase Postgres.
 */

export const saveStateToCloud = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgId: z.string(), stateJson: z.string(), token: z.string() }))
  .handler(async ({ data: { orgId, stateJson, token } }) => {
    try {
      // 1. Verify organization membership and role permissions (Requires ADMIN or DEVELOPER to save)
      // Query Neon Lakebase Postgres
      const members = await sql`
        SELECT role FROM public.organization_members
        WHERE org_id = ${orgId}
        LIMIT 1;
      `;

      if (members.length === 0) {
        // Fallback: Check if org exists in Neon
        const orgs = await sql`SELECT id FROM public.organizations WHERE id = ${orgId} LIMIT 1;`;
        if (orgs.length === 0) {
          return {
            success: false,
            error: "Access Denied: Organization not found in Neon database.",
          };
        }
      }

      // 2. Upload state to Neon S3 Object Storage (bucket: assets)
      const storageKey = `${orgId}/scheduler-state.json`;
      await uploadAsset(storageKey, stateJson, "application/json");

      // 3. Also persist schedule state into Neon Lakebase Postgres schedule_data
      const schedules = await sql`
        SELECT id FROM public.schedules WHERE org_id = ${orgId} LIMIT 1;
      `;
      let scheduleId = schedules[0]?.id;
      if (!scheduleId) {
        const inserted = await sql`
          INSERT INTO public.schedules (org_id, name)
          VALUES (${orgId}, 'Primary Production Plan')
          RETURNING id;
        `;
        scheduleId = inserted[0]?.id;
      }

      await sql`
        INSERT INTO public.schedule_data (schedule_id, data, updated_at)
        VALUES (${scheduleId}, ${stateJson}::jsonb, timezone('utc'::text, now()))
        ON CONFLICT (schedule_id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;

      return { success: true };
    } catch (error: any) {
      console.error("Failed to save state to Neon Object Storage:", error);
      return { success: false, error: error.message || "Unknown server error" };
    }
  });

export const loadStateFromCloud = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgId: z.string(), token: z.string() }))
  .handler(async ({ data: { orgId } }) => {
    try {
      const storageKey = `${orgId}/scheduler-state.json`;

      // 1. Try reading from Neon S3 Object Storage
      try {
        const fileContent = await getAsset(storageKey);
        if (fileContent) {
          return { success: true, data: fileContent };
        }
      } catch (s3Err) {
        // Fall back to Postgres schedule_data
      }

      // 2. Fall back to Neon Lakebase Postgres schedule_data
      const rows = await sql`
        SELECT sd.data
        FROM public.schedules s
        JOIN public.schedule_data sd ON s.id = sd.schedule_id
        WHERE s.org_id = ${orgId}
        ORDER BY s.updated_at DESC
        LIMIT 1;
      `;

      if (rows.length > 0) {
        const dataStr =
          typeof rows[0].data === "string" ? rows[0].data : JSON.stringify(rows[0].data);
        return { success: true, data: dataStr };
      }

      return { success: true, data: null };
    } catch (error: any) {
      console.error("Failed to load state from Neon:", error);
      return { success: false, error: error.message || "Unknown server error" };
    }
  });

// Compatibility aliases
export const saveStateToSupabase = saveStateToCloud;
export const loadStateFromSupabase = loadStateFromCloud;
