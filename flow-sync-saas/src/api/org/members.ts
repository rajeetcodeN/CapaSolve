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

    const { data: members, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, created_at, profiles(full_name, avatar_url, job_title)")
      .eq("org_id", auth.ctx.orgId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, members }), {
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
    const auth = await authenticateRequest(request, ["ADMIN"]);
    if (auth.error || !auth.ctx) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { email, role = "DEVELOPER" } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing required parameter: email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = "inv_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        org_id: auth.ctx.orgId,
        email,
        role,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        inviteLink: `https://capasolve.com/signup?invite=${token}`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
