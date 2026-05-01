import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { google } from "googleapis";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

/**
 * Google Tasks API
 * GET  — list task lists or tasks in a list
 * POST — create a task
 * PATCH — update a task (status, title, etc.)
 */

export const GET = withRouteLog("google.tasks.get", async (request: NextRequest) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const oauth2Client = await getGoogleClient(userId);
    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    const listId = request.nextUrl.searchParams.get("listId");

    if (listId) {
      // Get tasks in a specific list
      const showCompleted = request.nextUrl.searchParams.get("showCompleted") !== "false";
      const res = await tasks.tasks.list({
        tasklist: listId,
        maxResults: 100,
        showCompleted,
        showHidden: false,
      });

      const items = ((res.data.items || []) as Array<{ id?: string; title?: string; notes?: string; status?: string; due?: string; completed?: string; updated?: string; parent?: string; position?: string; links?: unknown[] }>).map((t) => ({
        id: t.id,
        title: t.title || "",
        notes: t.notes || "",
        status: t.status, // "needsAction" or "completed"
        due: t.due || null,
        completed: t.completed || null,
        updated: t.updated,
        parent: t.parent || null,
        position: t.position,
        links: t.links || [],
      }));

      return NextResponse.json({ tasks: items });
    } else {
      // List task lists
      const res = await tasks.tasklists.list({ maxResults: 20 });
      const lists = ((res.data.items || []) as Array<{ id?: string; title?: string; updated?: string }>).map((l) => ({
        id: l.id,
        title: l.title || "My Tasks",
        updated: l.updated,
      }));
      return NextResponse.json({ taskLists: lists });
    }
  } catch (error: unknown) {
    log.error(error, "google.tasks.failed");
    const errObj = error as { message?: string; code?: number; response?: { data?: { error?: { message?: string } } } };
    const msg = errObj?.message ?? "";
    const detail = errObj?.response?.data?.error?.message || msg || "Unknown";
    const isAuthIssue =
      msg === "GOOGLE_NOT_CONNECTED" ||
      msg === "GOOGLE_TOKEN_EXPIRED" ||
      msg === "GOOGLE_TOKEN_REFRESH_FAILED" ||
      errObj?.code === 401 ||
      /invalid_grant|token|unauthorized|scope/i.test(detail);
    if (isAuthIssue) {
      return NextResponse.json({ error: "Google 계정을 다시 연결해주세요", detail, reconnect: true, tasks: [], taskLists: [] }, { status: 200 });
    }
    console.error("Google Tasks API error:", detail);
    // API 에러를 200 + 빈 목록으로 반환 — 대시보드 위젯 폭발 방지
    return NextResponse.json({ error: "Google Tasks API 오류", detail, tasks: [], taskLists: [] }, { status: 200 });
  }
});

export const POST = withRouteLog("google.tasks.post", async (request: NextRequest) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { listId, title, notes, due } = body;

    if (!title) {
      return NextResponse.json({ error: "title은 필수입니다" }, { status: 400 });
    }

    const oauth2Client = await getGoogleClient(userId);
    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    const taskBody: { title: string; status: string; notes?: string; due?: string } = { title, status: "needsAction" };
    if (notes) taskBody.notes = notes;
    if (due) taskBody.due = new Date(due).toISOString();

    const res = await tasks.tasks.insert({
      tasklist: listId || "@default",
      requestBody: taskBody,
    });

    return NextResponse.json({
      id: res.data.id,
      title: res.data.title,
      status: res.data.status,
      due: res.data.due,
    });
  } catch (error: unknown) {
    log.error(error, "google.tasks.failed");
    const errMsg = error instanceof Error ? error.message : "";
    const errResp = (error as { response?: { data?: { error?: { message?: string } } }; code?: number })?.response?.data?.error?.message;
    const errCode = (error as { code?: number })?.code;
    if (errMsg === "GOOGLE_NOT_CONNECTED" || errMsg === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 계정을 연결해주세요" }, { status: 401 });
    }
    const detail = errResp || errMsg || "Unknown";
    void errCode;
    console.error("Google Tasks create error:", detail);
    return NextResponse.json({ error: "할일 생성 실패", detail }, { status: 500 });
  }
});

export const PATCH = withRouteLog("google.tasks.patch", async (request: NextRequest) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { listId, taskId, title, notes, status, due } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId는 필수입니다" }, { status: 400 });
    }

    const oauth2Client = await getGoogleClient(userId);
    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    const updates: { title?: string; notes?: string; status?: string; due?: string | null } = {};
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (due !== undefined) updates.due = due ? new Date(due).toISOString() : null;

    const res = await tasks.tasks.patch({
      tasklist: listId || "@default",
      task: taskId,
      requestBody: updates,
    });

    return NextResponse.json({
      id: res.data.id,
      title: res.data.title,
      status: res.data.status,
      due: res.data.due,
    });
  } catch (error: unknown) {
    log.error(error, "google.tasks.failed");
    const errMsg = error instanceof Error ? error.message : "";
    const errResp = (error as { response?: { data?: { error?: { message?: string } } }; code?: number })?.response?.data?.error?.message;
    const errCode = (error as { code?: number })?.code;
    if (errMsg === "GOOGLE_NOT_CONNECTED" || errMsg === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 계정을 연결해주세요" }, { status: 401 });
    }
    const detail = errResp || errMsg || "Unknown";
    void errCode;
    console.error("Google Tasks update error:", detail);
    return NextResponse.json({ error: "할일 수정 실패", detail }, { status: 500 });
  }
});
