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

    const { data: profile, error: profileErr } = await supabase
      .from("capacity_profiles")
      .select("*")
      .eq("org_id", auth.ctx.orgId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let overrides: any[] = [];
    if (profile) {
      const { data: overData, error: overErr } = await supabase
        .from("daily_capacity_overrides")
        .select("*")
        .eq("profile_id", profile.id);

      if (!overErr && overData) {
        overrides = overData;
      }
    }

    return new Response(JSON.stringify({ success: true, profile, overrides }), {
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
    const {
      profileId,
      date,
      setterCapacityPct,
      operatorCapacityPct,
      isHoliday = false,
      note = "",
    } = body;

    if (!profileId || !date) {
      return new Response(JSON.stringify({ error: "Missing required fields: profileId, date" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: override, error } = await supabase
      .from("daily_capacity_overrides")
      .upsert(
        {
          profile_id: profileId,
          date,
          setter_capacity_pct: setterCapacityPct,
          operator_capacity_pct: operatorCapacityPct,
          is_holiday: isHoliday,
          note,
        },
        { onConflict: "profile_id,date" },
      )
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, override }), {
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
