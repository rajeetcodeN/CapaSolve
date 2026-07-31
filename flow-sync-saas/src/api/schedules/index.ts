import { authenticateRequest } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request, ["ADMIN", "DEVELOPER", "GUEST"]);
    if (auth.error || !auth.ctx) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: schedules, error } = await supabase
      .from("schedules")
      .select("id, name, created_at, updated_at, created_by")
      .eq("org_id", auth.ctx.orgId)
      .order("updated_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, schedules }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request, ["ADMIN", "DEVELOPER"]);
    if (auth.error || !auth.ctx) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { name = "New Production Schedule", data = {} } = body;

    const { data: newSchedule, error: schedErr } = await supabase
      .from("schedules")
      .insert({
        org_id: auth.ctx.orgId,
        name,
        created_by: auth.ctx.userId === "system-api-key" ? null : auth.ctx.userId,
      })
      .select("id, name, created_at, updated_at")
      .single();

    if (schedErr || !newSchedule) {
      return new Response(JSON.stringify({ error: schedErr?.message || "Failed to create schedule" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    await supabase.from("schedule_data").insert({
      schedule_id: newSchedule.id,
      data,
    });

    return new Response(JSON.stringify({ success: true, schedule: newSchedule }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
