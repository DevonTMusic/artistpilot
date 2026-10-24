import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { supabaseStorageAdmin } from "@/lib/supabase/storage";

export const runtime = "nodejs";

const MAX_PROJECT_BYTES = 25 * 1024 * 1024;
const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validProjectId(value: FormDataEntryValue | string | null): value is string {
  return typeof value === "string" && PROJECT_ID_PATTERN.test(value);
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function signedInUser() {
  return (await getCurrentSession())?.user ?? null;
}

async function readProjectMembership(projectId: string, userId: string) {
  const { rows: [project] } = await query<{
    id: string;
    owner_id: string;
    name: string;
    file_path: string;
    revision: number;
    lock_user_id: string | null;
    lock_expires_at: string | null;
    updated_at: string;
  }>(
    `select p.id, p.owner_id, p.name, p.file_path, p.revision, p.lock_user_id, p.lock_expires_at, p.updated_at
     from studio_projects p
     where p.id = $1 and (p.owner_id = $2 or exists (
       select 1 from studio_project_members m where m.project_id = p.id and m.user_id = $2
     ))`,
    [projectId, userId],
  );
  return project ?? null;
}

async function readUploadedFile(form: FormData): Promise<File | null> {
  const entry = form.get("file");
  if (typeof File === "undefined" || !(entry instanceof File)) return null;
  if (entry.size < 1 || entry.size > MAX_PROJECT_BYTES) {
    throw new Error("Shared project files must be between 1 byte and 25 MB.");
  }
  return entry;
}

export async function GET(request: Request) {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to access shared Studio projects." }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("id");
  const manageProjectId = url.searchParams.get("manage");
  const storage = supabaseStorageAdmin().storage;

  try {
    if (!projectId && !manageProjectId) {
      const { rows: projects } = await query<{
        id: string; owner_id: string; name: string; revision: number;
        lock_user_id: string | null; lock_expires_at: string | null; updated_at: string;
      }>(
        `select distinct p.id, p.owner_id, p.name, p.revision, p.lock_user_id, p.lock_expires_at, p.updated_at
         from studio_projects p
         left join studio_project_members m on m.project_id = p.id
         where p.owner_id = $1 or m.user_id = $1
         order by p.updated_at desc`,
        [user.id],
      );
      return NextResponse.json({
        projects: projects.map((project) => ({ ...project, isOwner: project.owner_id === user.id })),
      });
    }

    if (manageProjectId) {
      if (!PROJECT_ID_PATTERN.test(manageProjectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
      const { rows: [project] } = await query<{ owner_id: string }>(
        "select owner_id from studio_projects where id = $1",
        [manageProjectId],
      );
      if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can manage collaborators." }, { status: 403 });
      const [members, invites] = await Promise.all([
        query("select user_id, role, added_at from studio_project_members where project_id = $1 order by added_at asc", [manageProjectId]),
        query("select id, created_at, expires_at, revoked_at from studio_project_invites where project_id = $1 order by created_at desc", [manageProjectId]),
      ]);
      return NextResponse.json({ members: members.rows, invites: invites.rows });
    }

    if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const project = await readProjectMembership(projectId, user.id);
    if (!project) return NextResponse.json({ error: "Shared project not found or access was revoked." }, { status: 404 });
    const { data: file, error } = await storage.from("studio-shared").download(project.file_path);
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
  } catch (error) {
    console.error("Could not read shared Studio project data:", error);
    return NextResponse.json({ error: "Could not load shared Studio project data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to collaborate on Studio projects." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    console.error("Could not read shared Studio request:", error);
    return NextResponse.json({ error: "Invalid collaboration request." }, { status: 400 });
  }
  const action = form.get("action");
  const storage = supabaseStorageAdmin().storage;

  if (action === "create") {
    try {
      const { rows: [profile] } = await query<{ is_paid: boolean }>("select is_paid from profiles where id = $1", [user.id]);
      if (!profile?.is_paid) return NextResponse.json({ error: "Shared Studio projects require an active Studio subscription." }, { status: 403 });
    } catch (error) {
      console.error("Could not verify Studio access:", error);
      return NextResponse.json({ error: "Could not verify Studio access." }, { status: 500 });
    }
    let file: File | null;
    try {
      file = await readUploadedFile(form);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid project file." }, { status: 413 });
    }
    if (!file) return NextResponse.json({ error: "Project file is required." }, { status: 400 });

    const id = randomUUID();
    const filePath = `${id}/revision-1-${randomBytes(4).toString("hex")}.artistpilot`;
    const nameValue = form.get("name");
    const name = typeof nameValue === "string" ? nameValue.trim().slice(0, 120) : "Untitled Studio Project";
    const { error: uploadError } = await storage.from("studio-shared").upload(filePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      console.error("Could not upload shared Studio project:", uploadError);
      return NextResponse.json({ error: "Could not upload the project file." }, { status: 502 });
    }
    try {
      const lockExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await query(
        `insert into studio_projects (id, owner_id, name, file_path, revision, lock_user_id, lock_expires_at)
         values ($1, $2, $3, $4, 1, $2, $5)`,
        [id, user.id, name || "Untitled Studio Project", filePath, lockExpiresAt],
      );
      return NextResponse.json({ projectId: id, revision: 1, lockExpiresAt });
    } catch (error) {
      await storage.from("studio-shared").remove([filePath]);
      console.error("Could not create shared Studio project:", error);
      return NextResponse.json({ error: "Could not create the shared project." }, { status: 500 });
    }
  }

  if (action === "invite") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { rows: [project] } = await query<{ owner_id: string }>("select owner_id from studio_projects where id = $1", [projectId]);
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can create invitations." }, { status: 403 });
    const token = randomBytes(32).toString("base64url");
    try {
      await query(
        "insert into studio_project_invites (project_id, token_hash, created_by, expires_at) values ($1, $2, $3, now() + interval '7 days')",
        [projectId, hashInviteToken(token), user.id],
      );
      return NextResponse.json({ inviteUrl: `${new URL(request.url).origin}/studio?invite=${encodeURIComponent(token)}` });
    } catch (error) {
      console.error("Could not create shared Studio invitation:", error);
      return NextResponse.json({ error: "Could not create the invitation link." }, { status: 500 });
    }
  }

  if (action === "revoke-invite" || action === "remove-member") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const { rows: [project] } = await query<{ owner_id: string }>("select owner_id from studio_projects where id = $1", [projectId]);
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: "Only the project owner can manage collaborators." }, { status: 403 });
    try {
      if (action === "revoke-invite") {
        const inviteId = form.get("inviteId");
        if (!validProjectId(inviteId)) return NextResponse.json({ error: "Invalid invitation ID." }, { status: 400 });
        await query(
          "update studio_project_invites set revoked_at = now() where id = $1 and project_id = $2 and revoked_at is null",
          [inviteId, projectId],
        );
        return NextResponse.json({ revoked: true });
      }
      const memberId = form.get("userId");
      if (typeof memberId !== "string" || memberId.length > 128 || memberId === user.id) {
        return NextResponse.json({ error: "Invalid collaborator ID." }, { status: 400 });
      }
      await query(
        "update studio_projects set lock_user_id = null, lock_expires_at = null where id = $1 and lock_user_id = $2",
        [projectId, memberId],
      );
      await query("delete from studio_project_members where project_id = $1 and user_id = $2", [projectId, memberId]);
      return NextResponse.json({ removed: true });
    } catch (error) {
      console.error("Could not update shared Studio collaborators:", error);
      return NextResponse.json({ error: "Could not update project collaborators." }, { status: 500 });
    }
  }

  if (action === "accept") {
    const token = form.get("token");
    if (typeof token !== "string" || token.length < 32 || token.length > 100) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
    }
    try {
      const { rows: [invite] } = await query<{ id: string; project_id: string; expires_at: string; revoked_at: string | null }>(
        "select id, project_id, expires_at, revoked_at from studio_project_invites where token_hash = $1",
        [hashInviteToken(token)],
      );
      if (!invite || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "This invitation link has expired or was revoked." }, { status: 410 });
      }
      const { rows: [project] } = await query<{ owner_id: string }>("select owner_id from studio_projects where id = $1", [invite.project_id]);
      if (!project) return NextResponse.json({ error: "The shared project is no longer available." }, { status: 404 });
      if (project.owner_id !== user.id) {
        await query(
          `insert into studio_project_members (project_id, user_id, role) values ($1, $2, 'editor')
           on conflict (project_id, user_id) do nothing`,
          [invite.project_id, user.id],
        );
      }
      return NextResponse.json({ projectId: invite.project_id });
    } catch (error) {
      console.error("Could not accept shared Studio invitation:", error);
      return NextResponse.json({ error: "Could not accept the invitation." }, { status: 500 });
    }
  }

  if (action === "claim" || action === "release") {
    const projectId = form.get("projectId");
    if (!validProjectId(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    try {
      const { rows: [result] } = action === "claim"
        ? await query("select claim_studio_project_edit($1, $2) as result", [projectId, user.id])
        : await query("select release_studio_project_edit($1, $2) as result", [projectId, user.id]);
      return NextResponse.json({ result: result?.result });
    } catch (error) {
      console.error(`Could not ${action} shared Studio edit lease:`, error);
      return NextResponse.json({ error: "Could not update the project's edit lock." }, { status: 500 });
    }
  }

  if (action === "save") {
    const projectId = form.get("projectId");
    const expectedRevisionText = form.get("expectedRevision");
    if (!validProjectId(projectId) || typeof expectedRevisionText !== "string" || !/^\d+$/.test(expectedRevisionText)) {
      return NextResponse.json({ error: "Invalid project save request." }, { status: 400 });
    }
    let file: File | null;
    try {
      file = await readUploadedFile(form);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid project file." }, { status: 413 });
    }
    if (!file) return NextResponse.json({ error: "Project file is required." }, { status: 400 });
    const expectedRevision = Number(expectedRevisionText);
    try {
      const project = await readProjectMembership(projectId, user.id);
      if (!project) return NextResponse.json({ error: "Shared project not found or access was revoked." }, { status: 404 });
      if (project.revision !== expectedRevision || project.lock_user_id !== user.id ||
        !project.lock_expires_at || new Date(project.lock_expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "The edit lock or project revision changed. Reload before saving." }, { status: 409 });
      }
      const filePath = `${projectId}/revision-${expectedRevision + 1}-${randomBytes(4).toString("hex")}.artistpilot`;
      const { error: uploadError } = await storage.from("studio-shared").upload(filePath, new Uint8Array(await file.arrayBuffer()), {
        contentType: "application/octet-stream",
        upsert: false,
      });
      if (uploadError) {
        console.error("Could not upload shared Studio revision:", uploadError);
        return NextResponse.json({ error: "Could not upload the latest project revision." }, { status: 502 });
      }
      const nameValue = form.get("name");
      const name = typeof nameValue === "string" ? nameValue.slice(0, 120) : project.name;
      let revision: number;
      try {
        const result = await query<{ revision: number }>(
          "select save_studio_project_revision($1, $2, $3, $4, $5) as revision",
          [projectId, filePath, expectedRevision, name, user.id],
        );
        revision = result.rows[0].revision;
      } catch (error) {
        await storage.from("studio-shared").remove([filePath]);
        if (error instanceof Error && error.message.includes("edit_lease_or_revision_conflict")) {
          return NextResponse.json({ error: "The edit lock or project revision changed. Reload before saving." }, { status: 409 });
        }
        throw error;
      }
      const { error: cleanupError } = await storage.from("studio-shared").remove([project.file_path]);
      if (cleanupError) console.error("Could not remove the previous shared Studio revision:", cleanupError);
      return NextResponse.json({ revision });
    } catch (error) {
      console.error("Could not save shared Studio project revision:", error);
      return NextResponse.json({ error: "Could not save the shared project revision." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown collaboration action." }, { status: 400 });
}
