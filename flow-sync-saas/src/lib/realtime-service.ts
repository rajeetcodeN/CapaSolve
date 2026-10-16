import { supabase } from "./supabase";
import { logger } from "./error-tracking";

export type RealtimeUpdateCallback = (payload: {
  table: string;
  eventType: string;
  newRecord: Record<string, unknown>;
  oldRecord: Record<string, unknown>;
}) => void;


/**
 * Real-Time Shop Floor Synchronization Service
 * Listens to PostgreSQL replication changes over WebSockets for live status updates
 */
export function subscribeToFloorUpdates(
  orgId: string,
  onUpdate: RealtimeUpdateCallback,
): () => void {
  if (!orgId) {
    logger.warn("Cannot subscribe to realtime updates without an orgId");
    return () => {};
  }

  const channelName = `org-floor-sync-${orgId}`;

  try {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_data",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          logger.info("Realtime schedule_data update received", {
            table: "schedule_data",
            eventType: payload.eventType,
          });
          onUpdate({
            table: "schedule_data",
            eventType: payload.eventType,
            newRecord: payload.new,
            oldRecord: payload.old,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "execution_logs",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          logger.info("Realtime execution_log received", { table: "execution_logs" });
          onUpdate({
            table: "execution_logs",
            eventType: payload.eventType,
            newRecord: payload.new,
            oldRecord: payload.old,
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info(`Realtime WebSocket channel active: ${channelName}`);
        } else if (status === "CHANNEL_ERROR") {
          logger.warn(`Realtime channel error for: ${channelName}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    logger.error("Failed to initialize Supabase Realtime channel", err as Error);
    return () => {};
  }
}
