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

    const { data: groups, error: groupErr } = await supabase
      .from("machine_groups")
      .select("id, code, name, created_at")
      .eq("org_id", auth.ctx.orgId)
      .order("code");

    if (groupErr) {
      return new Response(JSON.stringify({ error: groupErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: machines, error: machErr } = await supabase
      .from("machines")
      .select("id, machine_group_id, code, name, is_active, created_at")
      .eq("org_id", auth.ctx.orgId)
      .order("code");

    if (machErr) {
      return new Response(JSON.stringify({ error: machErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, machineGroups: groups, machines }), {
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
    const { machineGroupId, code, name, isActive = true } = body;

    if (!machineGroupId || !code || !name) {
      return new Response(JSON.stringify({ error: "Missing required fields: machineGroupId, code, name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: machine, error } = await supabase
      .from("machines")
      .insert({
        org_id: auth.ctx.orgId,
        machine_group_id: machineGroupId,
        code,
        name,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, machine }), {
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
