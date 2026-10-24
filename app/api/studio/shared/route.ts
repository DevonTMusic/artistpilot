import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PROJECT_BYTES = 100 * 1024 * 1024;
const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validProjectId(value: FormDataEntryValue | string | null): value is string {
  return typeof value === "string" && PROJECT_ID_PATTERN.test(value);
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function signedInUser() {
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client, user: null };
  return { client, user };
}

async function readProjectMembership(projectId: string, userId: string) {
  const admin = supabaseAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select("id, owner_id, name, file_path, revision, lock_user_id, lock_expires_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Could not read shared project: ${error.message}`);
  if (!project) return null;
  if (project.owner_id !== userId) {
    const { data: member, error: memberError } = await admin
      .from("studio_project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw new Error(`Could not verify project access: ${memberError.message}`);
    if (!member) return null;
  }
  return project;
}

async function readUploadedFile(form: FormData): Promise<File | null> {
  const entry = form.get("file");
  if (typeof File === "undefined" || !(entry instanceof File)) return null;
  if (entry.size < 1 || entry.size > MAX_PROJECT_BYTES) {
    throw new Error("Shared project files must be between 1 byte and 100 MB.");
  }
  return entry;
}

export async function GET(request: Request) {
  const { user } = await signedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to access shared Studio projects." }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("id");
  const admin = supabaseAdmin();
  const manageProjectId = url.searchParams.get("manage");
  if (!projectId && !manageProjectId) {
    const { data: memberships, error: memberError } = await admin
      .from("studio_project_members")
      .select("project_id")
      .eq("user_id", user.id);
    if (memberError) return NextResponse.json({ error: "Could not list shared Studio projects." }, { status: 500 });
    const ids = [...new Set([...(memberships ?? []).map((member) => member.project_id)])];
    const { data: owned, error: ownedError } = await admin
      .from("studio_projects")
      .select("id")
      .eq("owner_id", user.id);
    if (ownedError) return NextResponse.json({ error: "Could not list Studio projects." }, { status: 500 });
    ids.push(...(owned ?? []).map((project) => project.id));
    if (ids.length === 0) return NextResponse.json({ projects: [] });
    const { data: projects, error } = await admin
      .from("studio_projects")
      .select("id, owner_id, name, revision, lock_user_id, lock_expires_at, updated_at")
      .in("id", [...new Set(ids)])
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Could not list Studio projects." }, { status: 500 });
    return NextResponse.json({
      projects: (projects ?? []).map((project) => ({
        ...project,
        isOwner: project.owner_id === user.id,
      })),
    });
  }
  if (manageProjectId) {
    if (!PROJECT_ID_PATTERN.test(manageProjectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { data: project, error: projectError } = await admin
      .from("studio_projects")
      .select("owner_id")
      .eq("id", manageProjectId)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: "Could not verify project ownership." }, { status: 500 });
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can manage collaborators." }, { status: 403 });
    const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
      admin.from("studio_project_members").select("user_id, role, added_at").eq("project_id", manageProjectId).order("added_at", { ascending: true }),
      admin.from("studio_project_invites").select("id, created_at, expires_at, revoked_at").eq("project_id", manageProjectId).order("created_at", { ascending: false }),
    ]);
    if (membersError || invitesError) {
      console.error("Could not read shared Studio collaborator details:", membersError ?? invitesError);
      return NextResponse.json({ error: "Could not load collaborator details." }, { status: 500 });
    }
    return NextResponse.json({ members: members ?? [], invites: invites ?? [] });
  }
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });

  let project;
  try {
    project = await readProjectMembership(projectId, user.id);
  } catch (error) {
    console.error("Shared Studio project access check failed:", error);
    return NextResponse.json({ error: "Could not verify shared project access." }, { status: 500 });
  }
  if (!project) return NextResponse.json({ error: "Shared project not found or access was revoked." }, { status: 404 });
  const { data: file, error } = await admin.storage.from("studio-shared").download(project.file_path);
  if (error || !file) {
    console.error("Could not download shared Studio project:", error);
    return NextResponse.json({ error: "Could not download the shared project file." }, { status: 502 });
  }
  return new Response(await file.arrayBuffer(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Studio-Project-Id": project.id,
      "X-Studio-Project-Name": encodeURIComponent(project.name),
      "X-Studio-Project-Revision": String(project.revision),
      "X-Studio-Project-Owner": project.owner_id,
      "X-Studio-Project-Is-Owner": String(project.owner_id === user.id),
      "X-Studio-Edit-Owner": project.lock_user_id ?? "",
      "X-Studio-Edit-Expires": project.lock_expires_at ?? "",
    },
  });
}

export async function POST(request: Request) {
  const { client, user } = await signedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to collaborate on Studio projects." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    console.error("Could not read shared Studio request:", error);
    return NextResponse.json({ error: "Invalid collaboration request." }, { status: 400 });
  }
  const action = form.get("action");
  const admin = supabaseAdmin();

  if (action === "create") {
    const { data: profile, error: profileError } = await admin.from("profiles").select("is_paid").eq("id", user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: "Could not verify Studio access." }, { status: 500 });
    if (!profile?.is_paid) return NextResponse.json({ error: "Shared Studio projects require an active Studio subscription." }, { status: 403 });
    const file = await readUploadedFile(form).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Invalid project file.";
      return NextResponse.json({ error: message }, { status: 413 });
    });
    if (!file || file instanceof NextResponse) {
      return file instanceof NextResponse ? file : NextResponse.json({ error: "Project file is required." }, { status: 400 });
    }
    const id = randomUUID();
    const filePath = `${id}/revision-1-${randomBytes(4).toString("hex")}.artistpilot`;
    const nameValue = form.get("name");
    const name = typeof nameValue === "string" ? nameValue.trim().slice(0, 120) : "Untitled Studio Project";
    const { error: uploadError } = await admin.storage.from("studio-shared").upload(filePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      console.error("Could not upload shared Studio project:", uploadError);
      return NextResponse.json({ error: "Could not upload the project file." }, { status: 502 });
    }
    const lockExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertError } = await admin.from("studio_projects").insert({
      id,
      owner_id: user.id,
      name: name || "Untitled Studio Project",
      file_path: filePath,
      revision: 1,
      lock_user_id: user.id,
      lock_expires_at: lockExpiresAt,
    });
    if (insertError) {
      await admin.storage.from("studio-shared").remove([filePath]);
      console.error("Could not create shared Studio project:", insertError);
      return NextResponse.json({ error: "Could not create the shared project." }, { status: 500 });
    }
    return NextResponse.json({ projectId: id, revision: 1, lockExpiresAt });
  }

  if (action === "invite") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { data: project, error } = await admin.from("studio_projects").select("owner_id").eq("id", projectId).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not verify project ownership." }, { status: 500 });
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can create invitations." }, { status: 403 });
    const token = randomBytes(32).toString("base64url");
    const { error: inviteError } = await admin.from("studio_project_invites").insert({
      project_id: projectId,
      token_hash: hashInviteToken(token),
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (inviteError) return NextResponse.json({ error: "Could not create the invitation link." }, { status: 500 });
    const origin = new URL(request.url).origin;
    return NextResponse.json({ inviteUrl: `${origin}/studio?invite=${encodeURIComponent(token)}` });
  }

  if (action === "revoke-invite" || action === "remove-member") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { data: project, error: projectError } = await admin
      .from("studio_projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: "Could not verify project ownership." }, { status: 500 });
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can manage collaborators." }, { status: 403 });

    if (action === "revoke-invite") {
      const inviteId = form.get("inviteId");
      if (!validProjectId(inviteId)) return NextResponse.json({ error: "Invalid invitation ID." }, { status: 400 });
      const { error } = await admin
        .from("studio_project_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("project_id", projectId)
        .is("revoked_at", null);
      if (error) return NextResponse.json({ error: "Could not revoke the invitation link." }, { status: 500 });
      return NextResponse.json({ revoked: true });
    }

    const memberId = form.get("userId");
    if (!validProjectId(memberId) || memberId === user.id) {
      return NextResponse.json({ error: "Invalid collaborator ID." }, { status: 400 });
    }
    const { error: lockError } = await admin
      .from("studio_projects")
      .update({ lock_user_id: null, lock_expires_at: null })
      .eq("id", projectId)
      .eq("lock_user_id", memberId);
    if (lockError) return NextResponse.json({ error: "Could not release the removed collaborator's edit lock." }, { status: 500 });
    const { error } = await admin
      .from("studio_project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", memberId);
    if (error) return NextResponse.json({ error: "Could not remove the collaborator." }, { status: 500 });
    return NextResponse.json({ removed: true });
  }

  if (action === "accept") {
    const token = form.get("token");
    if (typeof token !== "string" || token.length < 32 || token.length > 100) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
    }
    const { data: invite, error } = await admin
      .from("studio_project_invites")
      .select("id, project_id, expires_at, revoked_at")
      .eq("token_hash", hashInviteToken(token))
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Could not validate the invitation link." }, { status: 500 });
    if (!invite || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This invitation link has expired or was revoked." }, { status: 410 });
    }
    const { data: project, error: projectError } = await admin.from("studio_projects").select("owner_id").eq("id", invite.project_id).maybeSingle();
    if (projectError || !project) return NextResponse.json({ error: "The shared project is no longer available." }, { status: 404 });
    if (project.owner_id === user.id) return NextResponse.json({ projectId: invite.project_id });
    const { error: memberError } = await admin.from("studio_project_members").upsert(
      { project_id: invite.project_id, user_id: user.id, role: "editor" },
      { onConflict: "project_id,user_id", ignoreDuplicates: true }
    );
    if (memberError) return NextResponse.json({ error: "Could not accept the invitation." }, { status: 500 });
    return NextResponse.json({ projectId: invite.project_id });
  }

  if (action === "claim" || action === "release") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { data, error } = action === "claim"
      ? await client.rpc("claim_studio_project_edit", { p_project_id: projectId })
      : await client.rpc("release_studio_project_edit", { p_project_id: projectId });
    if (error) {
      console.error(`Could not ${action} shared Studio edit lease:`, error);
      return NextResponse.json({ error: "Could not update the project's edit lock." }, { status: 500 });
    }
    return NextResponse.json({ result: data });
  }

  if (action === "save") {
    const projectId = form.get("projectId");
    const expectedRevisionText = form.get("expectedRevision");
    if (!validProjectId(projectId) || typeof expectedRevisionText !== "string" || !/^\d+$/.test(expectedRevisionText)) {
      return NextResponse.json({ error: "Invalid project save request." }, { status: 400 });
    }
    const file = await readUploadedFile(form).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Invalid project file.";
      return NextResponse.json({ error: message }, { status: 413 });
    });
    if (!file || file instanceof NextResponse) {
      return file instanceof NextResponse ? file : NextResponse.json({ error: "Project file is required." }, { status: 400 });
    }
    const expectedRevision = Number(expectedRevisionText);
    const project = await readProjectMembership(projectId, user.id);
    if (!project) return NextResponse.json({ error: "Shared project not found or access was revoked." }, { status: 404 });
    if (project.revision !== expectedRevision || project.lock_user_id !== user.id ||
      !project.lock_expires_at || new Date(project.lock_expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "The edit lock or project revision changed. Reload before saving." }, { status: 409 });
    }
    const filePath = `${projectId}/revision-${expectedRevision + 1}-${randomBytes(4).toString("hex")}.artistpilot`;
    const { error: uploadError } = await admin.storage.from("studio-shared").upload(filePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: "application/octet-stream",
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: "Could not upload the latest project revision." }, { status: 502 });
    const nameValue = form.get("name");
    const name = typeof nameValue === "string" ? nameValue.slice(0, 120) : project.name;
    const { data: revision, error: saveError } = await client.rpc("save_studio_project_revision", {
      p_project_id: projectId,
      p_file_path: filePath,
      p_expected_revision: expectedRevision,
      p_name: name,
    });
    if (saveError) {
      await admin.storage.from("studio-shared").remove([filePath]);
      return NextResponse.json({ error: "The edit lock or project revision changed. Reload before saving." }, { status: 409 });
    }
    return NextResponse.json({ revision });
  }

  return NextResponse.json({ error: "Unknown collaboration action." }, { status: 400 });
}
