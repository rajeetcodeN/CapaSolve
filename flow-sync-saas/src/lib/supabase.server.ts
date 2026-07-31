import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerConfig } from "./config.server";

import { supabase } from "./supabase";

export const saveStateToSupabase = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgId: z.string(), stateJson: z.string(), token: z.string() }))
  .handler(async ({ data: { orgId, stateJson, token } }) => {
    try {
      // 1. Verify user authentication token
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return { success: false, error: "Authentication failed: Invalid session token." };
      }

      // 2. Verify organization membership and role permissions (Requires ADMIN or DEVELOPER to save)
      const { data: membership, error: memError } = await supabase
        .from("organization_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memError || !membership) {
        return { success: false, error: "Access Denied: You are not a member of this organization." };
      }

      if (membership.role !== "ADMIN" && membership.role !== "DEVELOPER") {
        return { success: false, error: "Access Denied: Insufficient permissions to modify schedules." };
      }

      const config = getServerConfig();
      if (!config.supabaseAnonKey) {
        return { success: false, error: "Configuration Error: SUPABASE_ANON_KEY is missing." };
      }

      const url = `https://${config.supabaseProjectId}.storage.supabase.co/storage/v1/object/${config.supabaseBucketName}/${orgId}/scheduler-state.json`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.supabaseAnonKey}`,
          "apikey": config.supabaseAnonKey,
          "x-upsert": "true",
          "Content-Type": "application/json",
        },
        body: stateJson,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Supabase Save API Error:", response.status, errorText);
        return { success: false, error: `Supabase returned ${response.status}: ${errorText}` };
      }

      return { success: true };
    } catch (error: any) {
      console.error("Failed to save state to Supabase:", error);
      return { success: false, error: error.message || "Unknown server error" };
    }
  });

export const loadStateFromSupabase = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgId: z.string(), token: z.string() }))
  .handler(async ({ data: { orgId, token } }) => {
    try {
      // 1. Verify user authentication token
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return { success: false, error: "Authentication failed: Invalid session token." };
      }

      // 2. Verify organization membership (Any role GUEST, DEVELOPER, ADMIN can load)
      const { data: membership, error: memError } = await supabase
        .from("organization_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memError || !membership) {
        return { success: false, error: "Access Denied: You are not a member of this organization." };
      }

      const config = getServerConfig();
      if (!config.supabaseAnonKey) {
        return { success: false, error: "Configuration Error: SUPABASE_ANON_KEY is missing." };
      }

      const url = `https://${config.supabaseProjectId}.storage.supabase.co/storage/v1/object/${config.supabaseBucketName}/${orgId}/scheduler-state.json`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.supabaseAnonKey}`,
          "apikey": config.supabaseAnonKey,
        },
      });

      if (response.status === 404) {
        // Return success with null data to indicate no saved state yet
        return { success: true, data: null };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Supabase Load API Error:", response.status, errorText);
        return { success: false, error: `Supabase returned ${response.status}: ${errorText}` };
      }

      const data = await response.text();
      return { success: true, data };
    } catch (error: any) {
      console.error("Failed to load state from Supabase:", error);
      return { success: false, error: error.message || "Unknown server error" };
    }
  });
