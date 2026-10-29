"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

interface SharedProject {
  id: string;
  name: string;
  revision: number;
  isOwner: boolean;
  lock_user_id: string | null;
  lock_expires_at: string | null;
  updated_at: string;
}

interface SharedMember {
  user_id: string;
  role: string;
  added_at: string;
}

interface SharedInvite {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

interface CollaborationPanelProps {
  isOpen: boolean;
  projectId: string | null;
  projectName: string;
  revision: number;
  isOwner: boolean;
  hasEditLease: boolean;
  lockOwnerId: string | null;
  lockExpiresAt: string | null;
  onCreateShared: () => Promise<void>;
  onSaveShared: () => Promise<void>;
  onLoadProject: (projectId: string) => Promise<void>;
  onClaim: () => Promise<void>;
  onRelease: () => Promise<void>;
  onClose: () => void;
}

export function CollaborationPanel({
  isOpen,
  projectId,
  projectName,
  revision,
  isOwner,
  hasEditLease,
  lockOwnerId,
  lockExpiresAt,
  onCreateShared,
  onSaveShared,
  onLoadProject,
  onClaim,
  onRelease,
  onClose,
}: CollaborationPanelProps) {
  const { locale, t } = useLanguage();
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [members, setMembers] = useState<SharedMember[]>([]);
  const [invites, setInvites] = useState<SharedInvite[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const refreshProjects = async () => {
    setError("");
    const response = await fetch("/api/studio/shared", { cache: "no-store" });
    const result = await response.json() as { projects?: SharedProject[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? t("collab.listError"));
    setProjects(result.projects ?? []);
    if (projectId && isOwner) {
      const manageResponse = await fetch(`/api/studio/shared?manage=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const manageResult = await manageResponse.json() as { members?: SharedMember[]; invites?: SharedInvite[]; error?: string };
      if (!manageResponse.ok) throw new Error(manageResult.error ?? t("collab.manageError"));
      setMembers(manageResult.members ?? []);
      setInvites(manageResult.invites ?? []);
    } else {
      setMembers([]);
      setInvites([]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshProjects().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t("collab.loadError"));
    });
  }, [isOpen, projectId, isOwner]);

  if (!isOpen) return null;

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
      await refreshProjects();
      setStatus(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("collab.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async () => {
    if (!projectId) throw new Error(t("collab.shareFirst"));
    const form = new FormData();
    form.set("action", "invite");
    form.set("projectId", projectId);
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const result = await response.json() as { inviteUrl?: string; error?: string };
    if (!response.ok || !result.inviteUrl) throw new Error(result.error ?? t("collab.createInviteError"));
    setInviteUrl(result.inviteUrl);
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setStatus(t("collab.copied"));
    } catch {
      setStatus(t("collab.copyReady"));
    }
  };

  const manageCollaborator = async (
    action: "revoke-invite" | "remove-member",
    value: string
  ) => {
    if (!projectId) throw new Error(t("collab.openFirst"));
    const form = new FormData();
    form.set("action", action);
    form.set("projectId", projectId);
    form.set(action === "revoke-invite" ? "inviteId" : "userId", value);
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? t("collab.updateError"));
  };

  const currentOwnerId = isOwner || projects.find((project) => project.id === projectId)?.isOwner;
  const lockExpired = !lockExpiresAt || new Date(lockExpiresAt).getTime() <= Date.now();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-700 bg-[#15171d] p-4 shadow-2xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">{t("collab.title")}</h2>
            <p className="mt-1 text-[10px] text-zinc-400">{t("collab.help")}</p>
          </div>
          <button onClick={onClose} className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">{t("collab.close")}</button>
        </header>

        <div className="mb-4 rounded-lg border border-zinc-800 bg-[#101116] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{projectId ? projectName : t("collab.localOnly")}</p>
              {projectId ? (
                <p className="mt-1 text-[10px] text-zinc-500">
                  {t("collab.revision", { revision })} · {hasEditLease ? t("collab.holdLock") : lockOwnerId && !lockExpired ? t("collab.editing", { user: lockOwnerId.slice(0, 8) }) : t("collab.available")}
                  {lockExpiresAt && !lockExpired ? t("collab.lockExpires", { time: new Date(lockExpiresAt).toLocaleTimeString(locale) }) : ""}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-zinc-500">{t("collab.shareUpload")}</p>
              )}
            </div>
            <div className="flex gap-2">
              {!projectId ? (
                <button disabled={busy} onClick={() => void run(onCreateShared, t("collab.created"))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">{t("collab.share")}</button>
              ) : (
                <>
                  <button disabled={busy} onClick={() => void run(onSaveShared, t("collab.saved"))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">{hasEditLease ? t("collab.saveRevision") : t("collab.saveUnavailable")}</button>
                  {currentOwnerId && <button disabled={busy} onClick={() => void run(createInvite, t("collab.inviteReady"))} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{t("collab.invite")}</button>}
                  {hasEditLease
                    ? <button disabled={busy} onClick={() => void run(onRelease, t("collab.lockReleased"))} className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">{t("collab.releaseLock")}</button>
                    : <button disabled={busy} onClick={() => void run(onClaim, t("collab.lockAcquired"))} className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">{t("collab.takeLock")}</button>}
                </>
              )}
            </div>
          </div>
          {inviteUrl && (
            <div className="mt-3 flex gap-2">
              <input aria-label={t("collab.inviteLabel")} readOnly value={inviteUrl} className="min-w-0 flex-1 rounded border border-zinc-700 bg-black px-2 py-1.5 text-[10px] text-zinc-300" />
              <button onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="rounded bg-zinc-800 px-2 text-[10px] text-zinc-200 hover:bg-zinc-700">{t("collab.copy")}</button>
            </div>
          )}
        </div>

        {projectId && isOwner && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-[#101116] p-3">
              <h3 className="mb-2 text-[10px] font-bold tracking-wide text-zinc-400">{t("collab.collaborators")}</h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-zinc-300">{member.user_id.slice(0, 8)} · {member.role}</span>
                    <button disabled={busy} onClick={() => void run(() => manageCollaborator("remove-member", member.user_id), t("collab.removed"))} className="rounded bg-rose-950/60 px-2 py-1 text-rose-300 hover:bg-rose-900 disabled:opacity-50">{t("collab.remove")}</button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-[10px] text-zinc-500">{t("collab.noCollaborators")}</p>}
              </div>
            </section>
            <section className="rounded-lg border border-zinc-800 bg-[#101116] p-3">
              <h3 className="mb-2 text-[10px] font-bold tracking-wide text-zinc-400">{t("collab.invites")}</h3>
              <div className="space-y-2">
                {invites.map((invite) => {
                  const expired = new Date(invite.expires_at).getTime() <= Date.now();
                  const inactive = Boolean(invite.revoked_at) || expired;
                  return (
                    <div key={invite.id} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-zinc-400">{invite.revoked_at ? t("collab.revoked") : expired ? t("collab.expired") : t("collab.expires", { date: new Date(invite.expires_at).toLocaleDateString(locale) })}</span>
                      {!inactive && <button disabled={busy} onClick={() => void run(() => manageCollaborator("revoke-invite", invite.id), t("collab.revokedStatus"))} className="rounded bg-rose-950/60 px-2 py-1 text-rose-300 hover:bg-rose-900 disabled:opacity-50">{t("collab.revoke")}</button>}
                    </div>
                  );
                })}
                {invites.length === 0 && <p className="text-[10px] text-zinc-500">{t("collab.noInvites")}</p>}
              </div>
            </section>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold tracking-wide text-zinc-400">{t("collab.sharedWithYou")}</h3>
          <button disabled={busy} onClick={() => void refreshProjects().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("collab.refreshError")))} className="text-[10px] text-sky-300 hover:text-white">{t("collab.refresh")}</button>
        </div>
        <div className="space-y-2">
          {projects.map((project) => (
            <div key={project.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${project.id === projectId ? "border-sky-800 bg-sky-950/20" : "border-zinc-800 bg-[#101116]"}`}>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-200">{project.name}</p>
                <p className="mt-1 text-[9px] text-zinc-500">{t("collab.revision", { revision: project.revision })} · {project.isOwner ? t("collab.owner") : t("collab.member")} · {project.lock_user_id ? t("collab.editor", { user: project.lock_user_id.slice(0, 8) }) : t("collab.noEditor")}</p>
              </div>
              <button disabled={busy || project.id === projectId} onClick={() => void run(() => onLoadProject(project.id), t("collab.opened"))} className="rounded bg-zinc-800 px-3 py-1.5 text-[10px] text-zinc-200 hover:bg-zinc-700 disabled:opacity-40">{t("collab.open")}</button>
            </div>
          ))}
          {projects.length === 0 && <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-[10px] text-zinc-500">{t("collab.none")}</p>}
        </div>
        {(status || error) && <p role={error ? "alert" : "status"} className={`mt-3 rounded p-2 text-[10px] ${error ? "bg-rose-950/60 text-rose-300" : "bg-emerald-950/40 text-emerald-300"}`}>{error || status}</p>}
      </section>
    </div>
  );
}
