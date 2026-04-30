/**
 * POST /api/genesis/provision
 * Genesis AI — plan → 실제 DB rows (group/project, wikis, tasks, members) + R2 폴더 스캐폴딩.
 *
 * Body: { kind, plan, target_id?, team_invites?, intent?, model_used? }
 *
 * 설계 원칙 (v2 — 퍼시스턴스 버그 수정):
 *  - 사용자 인증은 anon client 로 수행
 *  - 모든 쓰기(insert/upsert)는 service-role admin client 로 실행해 RLS 우회
 *  - 각 서브스텝을 per-step try/catch 로 감싸서 실패를 수집하되 best-effort 로 계속 진행
 *  - 응답에 created_ids + failures 포함해 어디서 문제가 났는지 즉시 확인
 *  - 프로비저닝 후 re-query 로 실제 존재 검증
 *  - migration 104 (genesis_plans) 미적용 → 감사 로그만 skip, 나머지는 정상 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/observability/logger";
import { getR2Client, getPublicUrl, isR2Configured } from "@/lib/storage/r2";
import { dispatchEvent } from "@/lib/automation/engine";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface GenesisPlan {
  title: string;
  summary: string;
  category: string;
  phases: Array<{
    name: string;
    goal: string;
    duration_days: number | null;
    wiki_pages: Array<{ title: string; outline: string }>;
    milestones: string[];
  }>;
  suggested_roles: Array<{ role_name: string; specialty_tags: string[]; why: string }>;
  resources_folders: string[];
  first_tasks: string[];
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

function outlineToMarkdown(outline: string): string {
  const body = outline.includes("-") || outline.includes("*")
    ? outline
    : outline.split("\n").map((l) => `- ${l}`).join("\n");
  return `${body}\n\n_(이 문서는 Genesis AI 가 생성한 초안입니다)_`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "folder";
}

async function putR2Text(key: string, body: string, contentType = "text/plain; charset=utf-8"): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return getPublicUrl(key);
  } catch (e) {
    log.warn("genesis.r2.put_failed", { key, err: String(e) });
    return null;
  }
}

type StepFailure = { step: string; error: string };

export async function POST(request: NextRequest) {
  // 1) 인증은 anon/쿠키 기반 client
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  // 2) 쓰기는 service-role admin client (RLS 우회)
  const admin = getAdminClient();
  if (!admin) {
    log.error(new Error("service-role key missing"), "genesis.provision.no_admin");
    return NextResponse.json(
      { error: "서버 구성 오류: SUPABASE_SERVICE_ROLE 이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  const kind: "group" | "project" = body?.kind === "project" ? "project" : "group";
  const plan: GenesisPlan | undefined = body?.plan;
  const teamInvites: string[] = Array.isArray(body?.team_invites) ? body.team_invites : [];
  let targetId: string | null = body?.target_id || null;

  if (!plan || !plan.title || !Array.isArray(plan.phases)) {
    return NextResponse.json({ error: "유효하지 않은 plan" }, { status: 400 });
  }

  // ── Plan 정규화 — AI/템플릿/임의 입력 모두에서 안전한 기본값 보장 ──
  plan.title = String(plan.title || "새 공간").slice(0, 100);
  plan.summary = String(plan.summary || "").slice(0, 1000);
  plan.category = String(plan.category || "general").slice(0, 50);
  plan.phases = (plan.phases || []).map((p) => ({
    name: String(p?.name || "단계").slice(0, 100),
    goal: String(p?.goal || "").slice(0, 500),
    duration_days: typeof p?.duration_days === "number" ? p.duration_days : null,
    wiki_pages: Array.isArray(p?.wiki_pages)
      ? p.wiki_pages
          .filter((w: any) => w && w.title)
          .map((w: any) => ({
            title: String(w.title).slice(0, 200),
            outline: String(w.outline || ""),
          }))
      : [],
    milestones: Array.isArray(p?.milestones)
      ? p.milestones.filter((m: any) => typeof m === "string" && m.trim()).map((m: string) => m.slice(0, 200))
      : [],
  }));
  plan.suggested_roles = Array.isArray(plan.suggested_roles)
    ? plan.suggested_roles
        .filter((r: any) => r && r.role_name)
        .map((r: any) => ({
          role_name: String(r.role_name).slice(0, 100),
          specialty_tags: Array.isArray(r.specialty_tags) ? r.specialty_tags.map((t: any) => String(t)) : [],
          why: String(r.why || "").slice(0, 300),
        }))
    : [];
  plan.resources_folders = Array.isArray(plan.resources_folders)
    ? plan.resources_folders.filter((f: any) => typeof f === "string" && f.trim()).map((f: string) => f.slice(0, 80))
    : [];
  plan.first_tasks = Array.isArray(plan.first_tasks)
    ? plan.first_tasks.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.slice(0, 200))
    : [];

  const summary = {
    wikis_created: 0,
    tasks_created: 0,
    milestones_created: 0,
    members_invited: 0,
    folders_scaffolded: 0,
    r2_attachments: 0,
    crm_notes_created: 0,
  };
  const createdIds = {
    group_id: null as string | null,
    project_id: null as string | null,
    wiki_topic_ids: [] as string[],
    wiki_page_ids: [] as string[],
    milestone_ids: [] as string[],
    task_ids: [] as string[],
    member_ids: [] as string[],
    resource_ids: [] as string[],
  };
  const failures: StepFailure[] = [];

  async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      const result = await fn();
      log.info("genesis.step.ok", { step: name, user_id: user!.id });
      return result;
    } catch (e: any) {
      const msg = e?.message || String(e);
      failures.push({ step: name, error: msg });
      log.warn("genesis.step.failed", { step: name, err: msg });
      return null;
    }
  }

  try {
    // ────────────────────────────────────────────────────────────
    // STEP 1: target 생성 (group 또는 project)
    // ────────────────────────────────────────────────────────────
    if (!targetId) {
      if (kind === "group") {
        const created = await step("group.insert", async () => {
          const { data, error } = await admin
            .from("groups")
            .insert({
              name: plan.title.slice(0, 80),
              description: plan.summary,
              category: plan.category || "culture",
              host_id: user.id,
              max_members: 20,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          return data!.id as string;
        });
        if (!created) {
          return NextResponse.json(
            { error: "너트 생성 실패", failures, created_ids: createdIds, summary },
            { status: 500 },
          );
        }
        targetId = created;
        createdIds.group_id = created;

        await step("group_members.host.insert", async () => {
          const { error } = await admin.from("group_members").insert({
            group_id: targetId,
            user_id: user.id,
            role: "host",
            status: "active",
          });
          if (error) throw new Error(error.message);
        });
      } else {
        const created = await step("project.insert", async () => {
          const payload: any = {
            title: plan.title.slice(0, 120),
            description: plan.summary,
            category: ["space", "culture", "platform", "vibe"].includes(plan.category)
              ? plan.category
              : "platform",
            status: "active",
            created_by: user.id,
          };
          let res = await admin.from("projects").insert(payload).select("id").single();
          if (res.error && /\btype\b/i.test(res.error.message || "")) {
            delete payload.type;
            res = await admin.from("projects").insert(payload).select("id").single();
          }
          if (res.error) throw new Error(res.error.message);
          return res.data!.id as string;
        });
        if (!created) {
          return NextResponse.json(
            { error: "볼트 생성 실패", failures, created_ids: createdIds, summary },
            { status: 500 },
          );
        }
        targetId = created;
        createdIds.project_id = created;

        await step("project_members.lead.insert", async () => {
          const { error } = await admin.from("project_members").insert({
            project_id: targetId,
            user_id: user.id,
            role: "lead",
          });
          if (error) throw new Error(error.message);
        });

        await step("automation.project.created", async () => {
          await dispatchEvent("project.created", {
            project_id: targetId,
            title: plan.title,
            description: plan.summary,
            creator_id: user.id,
          });
        });
      }
    } else {
      if (kind === "group") createdIds.group_id = targetId;
      else createdIds.project_id = targetId;
    }

    const scope = kind === "group" ? "groups" : "projects";

    // ────────────────────────────────────────────────────────────
    // STEP 2: phases → wiki_topics (group) / milestones (project)
    // ────────────────────────────────────────────────────────────
    if (kind === "group") {
      for (const phase of plan.phases) {
        const topicId = await step(`wiki_topic.insert[${phase.name}]`, async () => {
          const { data, error } = await admin
            .from("wiki_topics")
            .insert({
              group_id: targetId,
              name: phase.name,
              description: phase.goal,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          return data!.id as string;
        });
        if (!topicId) continue;
        createdIds.wiki_topic_ids.push(topicId);

        for (const page of phase.wiki_pages) {
          const outlineMd = outlineToMarkdown(page.outline);
          let fullContent = `# ${page.title}\n\n${outlineMd}`;
          if (fullContent.length > 5 * 1024) {
            const pageSlug = slugify(page.title);
            const r2Key = `resources/${scope}/${targetId}/_wiki_templates/${pageSlug}-${Date.now()}.md`;
            const publicUrl = await putR2Text(r2Key, fullContent, "text/markdown; charset=utf-8");
            if (publicUrl) {
              const shortOutline = outlineMd.split("\n").slice(0, 8).join("\n");
              fullContent = `# ${page.title}\n\n${shortOutline}\n\n📎 [원본 템플릿 (R2)](${publicUrl})\n\n_(전체 템플릿은 Cloudflare R2 에 저장되었습니다)_`;
              summary.r2_attachments++;
            }
          }
          const pageId = await step(`wiki_page.insert[${page.title}]`, async () => {
            const { data, error } = await admin.from("wiki_pages").insert({
              topic_id: topicId,
              title: page.title,
              content: fullContent,
              created_by: user.id,
              last_updated_by: user.id,
            }).select("id").single();
            if (error) throw new Error(error.message);
            return data!.id as string;
          });
          if (pageId) {
            summary.wikis_created++;
            createdIds.wiki_page_ids.push(pageId);
          }
        }
      }
    } else {
      let sortOrder = 0;
      for (const phase of plan.phases) {
        const msId = await step(`milestone.insert[${phase.name}]`, async () => {
          const { data, error } = await admin
            .from("project_milestones")
            .insert({
              project_id: targetId,
              title: phase.name,
              description: phase.goal,
              sort_order: sortOrder++,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          return data!.id as string;
        });
        if (!msId) continue;
        summary.milestones_created++;
        createdIds.milestone_ids.push(msId);

        let taskOrder = 0;
        for (const taskTitle of phase.milestones) {
          const taskId = await step(`project_task.insert[${taskTitle}]`, async () => {
            const { data, error } = await admin.from("project_tasks").insert({
              milestone_id: msId,
              project_id: targetId,
              title: taskTitle,
              sort_order: taskOrder++,
            }).select("id").single();
            if (error) throw new Error(error.message);
            return data!.id as string;
          });
          if (taskId) {
            summary.tasks_created++;
            createdIds.task_ids.push(taskId);
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // STEP 3: first_tasks
    // ────────────────────────────────────────────────────────────
    if (kind === "project") {
      let kickoffId: string | null = null;
      const existing = await step("kickoff.lookup", async () => {
        const { data } = await admin
          .from("project_milestones")
          .select("id")
          .eq("project_id", targetId)
          .ilike("title", "%Genesis%")
          .limit(1);
        return data;
      });
      if (existing && existing.length > 0) {
        kickoffId = existing[0].id;
      } else {
        kickoffId = await step("kickoff.insert", async () => {
          const { data, error } = await admin
            .from("project_milestones")
            .insert({
              project_id: targetId,
              title: "✨ Genesis Kickoff",
              description: "AI 가 제안한 즉시 착수 과제",
              sort_order: -1,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          return data!.id as string;
        });
        if (kickoffId) createdIds.milestone_ids.push(kickoffId);
      }
      if (kickoffId) {
        let taskOrder = 0;
        for (const t of plan.first_tasks) {
          const taskId = await step(`first_task.insert[${t}]`, async () => {
            const { data, error } = await admin.from("project_tasks").insert({
              milestone_id: kickoffId,
              project_id: targetId,
              title: t,
              sort_order: taskOrder++,
            }).select("id").single();
            if (error) throw new Error(error.message);
            return data!.id as string;
          });
          if (taskId) {
            summary.tasks_created++;
            createdIds.task_ids.push(taskId);
          }
        }
      }
    } else {
      // group 의 first_tasks → 개인 할 일로 기록 (personal_tasks 에는 group_id 컬럼이 없음)
      const groupLabel = plan.title;
      for (const t of plan.first_tasks) {
        const taskId = await step(`personal_task.insert[${t}]`, async () => {
          const description = `[너트: ${groupLabel}] ${t}`;
          let res = await admin.from("personal_tasks").insert({
            user_id: user.id,
            title: t,
            description,
          }).select("id").single();
          if (res.error && /does not exist|relation/i.test(res.error.message || "")) {
            res = await admin.from("personal_todos").insert({
              user_id: user.id,
              title: t,
              description,
            }).select("id").single();
          }
          if (res.error) throw new Error(res.error.message);
          return res.data!.id as string;
        });
        if (taskId) {
          summary.tasks_created++;
          createdIds.task_ids.push(taskId);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // STEP 4: resources_folders → R2 + DB row
    // ────────────────────────────────────────────────────────────
    if (Array.isArray(plan.resources_folders) && plan.resources_folders.length > 0) {
      for (const folderName of plan.resources_folders) {
        if (!folderName || typeof folderName !== "string") continue;
        const folderSlug = slugify(folderName);
        const r2Key = `resources/${scope}/${targetId}/${folderSlug}/.genesis-placeholder.txt`;
        const placeholderBody =
          `Genesis AI folder placeholder\n================================\n` +
          `Folder: ${folderName}\nScope: ${scope}\nTarget: ${targetId}\n` +
          `Created: ${new Date().toISOString()}\n\n` +
          `이 폴더는 Genesis AI 가 '${plan.title}' 공간 생성 시 스캐폴딩한 자료실 폴더입니다.\n`;

        const publicUrl = await putR2Text(r2Key, placeholderBody);
        if (!publicUrl) {
          log.warn("genesis.folder.skipped", { folderName, reason: "r2-unconfigured" });
          continue;
        }
        summary.folders_scaffolded++;

        const resId = await step(`folder.db_insert[${folderName}]`, async () => {
          if (kind === "group") {
            let res = await admin.from("file_attachments").insert({
              target_type: "group",
              target_id: targetId,
              uploaded_by: user.id,
              file_name: folderName,
              file_url: publicUrl,
              file_size: null,
              file_type: "folder-placeholder",
              storage_type: "r2",
              storage_key: r2Key,
            }).select("id").single();
            if (res.error && /check|invalid|constraint/i.test(res.error.message || "")) {
              res = await admin.from("file_attachments").insert({
                target_type: "group",
                target_id: targetId,
                uploaded_by: user.id,
                file_name: `📁 ${folderName}`,
                file_url: publicUrl,
                file_size: null,
                file_type: "url-link",
                storage_type: "r2",
                storage_key: r2Key,
              }).select("id").single();
            }
            if (res.error) throw new Error(res.error.message);
            return res.data!.id as string;
          } else {
            let res = await admin.from("project_resources").insert({
              project_id: targetId,
              name: folderName,
              url: publicUrl,
              type: "folder-placeholder",
              stage: "planning",
              description: `Genesis AI 자료실 폴더 (R2 prefix: ${folderSlug}/)`,
              uploaded_by: user.id,
            }).select("id").single();
            if (res.error && /check|invalid|constraint/i.test(res.error.message || "")) {
              res = await admin.from("project_resources").insert({
                project_id: targetId,
                name: `📁 ${folderName}`,
                url: publicUrl,
                type: "link",
                stage: "planning",
                description: `Genesis AI 자료실 폴더 (R2 prefix: ${folderSlug}/)`,
                uploaded_by: user.id,
              }).select("id").single();
            }
            if (res.error) throw new Error(res.error.message);
            return res.data!.id as string;
          }
        });
        if (resId) createdIds.resource_ids.push(resId);
      }
    }

    // ────────────────────────────────────────────────────────────
    // STEP 5: team invites + CRM linking
    // ────────────────────────────────────────────────────────────
    for (const inviteeId of teamInvites) {
      if (!inviteeId || inviteeId === user.id) continue;
      const roleInfo =
        plan.suggested_roles && plan.suggested_roles.length > 0
          ? plan.suggested_roles[teamInvites.indexOf(inviteeId) % plan.suggested_roles.length]
          : null;

      const ok = await step(`invite[${inviteeId}]`, async () => {
        if (kind === "group") {
          const { error } = await admin.from("group_members").upsert(
            { group_id: targetId, user_id: inviteeId, role: "member", status: "pending" },
            { onConflict: "group_id,user_id" },
          );
          if (error) throw new Error(error.message);
          await dispatchNotification({
            recipientId: inviteeId,
            eventType: "group_invite",
            title: "너트 초대",
            body: `"${plan.title}" 너트에 Genesis AI 가 초대했습니다!`,
            linkUrl: `/groups/${targetId}`,
            metadata: { group_id: targetId, source: "genesis" },
          });
        } else {
          // project_applications 의 status CHECK 는 invited 미허용 + 컬럼명은 applicant_id
          // → 곧바로 project_members 로 추가 (Genesis 직접 초대 의도)
          await admin.from("project_members").upsert(
            { project_id: targetId, user_id: inviteeId, role: "member" },
            { onConflict: "project_id,user_id" },
          );
          await dispatchNotification({
            recipientId: inviteeId,
            eventType: "project_invite",
            title: "볼트 초대",
            body: `"${plan.title}" 볼트에 Genesis AI 가 초대했습니다!`,
            linkUrl: `/projects/${targetId}`,
            metadata: { project_id: targetId, source: "genesis" },
          });
        }
        return true;
      });
      if (ok) {
        summary.members_invited++;
        createdIds.member_ids.push(inviteeId);
      }

      // CRM link — best-effort
      await step(`crm.link[${inviteeId}]`, async () => {
        const { data: existingPerson } = await admin
          .from("people")
          .select("id")
          .eq("owner_id", user.id)
          .eq("linked_profile_id", inviteeId)
          .maybeSingle();
        let personId: string | null = existingPerson?.id || null;
        if (!personId) {
          const { data: inviteeProfile } = await admin
            .from("profiles").select("nickname").eq("id", inviteeId).maybeSingle();
          const nickname = inviteeProfile?.nickname || "Genesis 초대 멤버";
          const { data: newPerson, error: pErr } = await admin.from("people").insert({
            owner_id: user.id,
            display_name: nickname,
            linked_profile_id: inviteeId,
            relationship: "crew",
            tags: ["genesis"],
          }).select("id").single();
          if (!pErr && newPerson) personId = newPerson.id;
        }
        if (personId) {
          const noteContent = roleInfo
            ? `Genesis 로 생성된 '${plan.title}' 에 '${roleInfo.role_name}' 역할로 초대됨 — ${roleInfo.why}`
            : `Genesis 로 생성된 '${plan.title}' 공간에 초대됨.`;
          const { error: noteErr } = await admin.from("person_context_notes").insert({
            person_id: personId,
            owner_id: user.id,
            note: noteContent,
            extracted_from: "manual",
          });
          if (!noteErr) summary.crm_notes_created++;
        }
      });
    }

    // ────────────────────────────────────────────────────────────
    // STEP 6: audit log (migration 104) — graceful skip
    // ────────────────────────────────────────────────────────────
    await step("genesis_plans.audit", async () => {
      const { error } = await admin.from("genesis_plans").insert({
        owner_id: user.id,
        target_kind: kind,
        target_id: targetId,
        intent: body?.intent || plan.summary || "",
        plan,
        model_used: body?.model_used || null,
      });
      if (error && /does not exist|relation/i.test(error.message || "")) {
        // migration 104 미적용 — 무시
        return;
      }
      if (error) throw new Error(error.message);
    });

    // ────────────────────────────────────────────────────────────
    // STEP 7: verify target actually exists (re-query)
    // ────────────────────────────────────────────────────────────
    const verified = await step("verify.target_exists", async () => {
      const table = kind === "group" ? "groups" : "projects";
      const { data, error } = await admin.from(table).select("id").eq("id", targetId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`${kind} ${targetId} 가 DB 에 존재하지 않습니다 (insert 후 re-query 실패)`);
      return data.id as string;
    });

    log.info("genesis.provision.done", {
      user_id: user.id,
      kind,
      target_id: targetId,
      verified: !!verified,
      failures_count: failures.length,
      ...summary,
    });

    return NextResponse.json({
      ok: failures.length === 0,
      [`${kind}_id`]: targetId,
      target_id: targetId,
      kind,
      verified: !!verified,
      summary,
      created_ids: createdIds,
      failures,
    });
  } catch (err: any) {
    log.error(err, "genesis.provision.fatal", { kind, target_id: targetId });
    return NextResponse.json(
      {
        error: err?.message || "Genesis 프로비저닝 실패",
        target_id: targetId,
        summary,
        created_ids: createdIds,
        failures,
      },
      { status: 500 },
    );
  }
}
