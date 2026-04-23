import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

/**
 * Google Chat API Integration
 *
 * GET — List spaces (chat rooms) the user has access to
 * POST — Send a message to a specific space
 */

// GET: List chat spaces or messages in a space
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const oauth2Client = await getGoogleClient(userId);
    const chat = google.chat({ version: "v1", auth: oauth2Client });

    const spaceId = request.nextUrl.searchParams.get("spaceId");

    if (spaceId) {
      // Get messages from a specific space
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "25");
      const res = await chat.spaces.messages.list({
        parent: spaceId,
        pageSize: Math.min(limit, 50),
        orderBy: "createTime desc",
      });

      type ChatMsg = { name?: string; text?: string; sender?: { displayName?: string; type?: string }; createTime?: string; thread?: { name?: string } };
      const messages = ((res.data.messages || []) as ChatMsg[]).map((msg) => ({
        id: msg.name,
        text: msg.text || "",
        sender: msg.sender?.displayName || "Unknown",
        senderType: msg.sender?.type || "HUMAN",
        createTime: msg.createTime,
        threadId: msg.thread?.name || null,
      }));

      return NextResponse.json({ messages });
    } else {
      // List spaces
      const res = await chat.spaces.list({
        pageSize: 50,
      });

      type ChatSpace = { name?: string; displayName?: string; type?: string; spaceType?: string; singleUserBotDm?: boolean };
      const spaces = ((res.data.spaces || []) as ChatSpace[]).map((space) => ({
        id: space.name,
        displayName: space.displayName || "Untitled Space",
        type: space.type, // ROOM, DM, etc.
        spaceType: space.spaceType,
        singleUserBotDm: space.singleUserBotDm || false,
      }));

      return NextResponse.json({ spaces });
    }
  } catch (error: unknown) {
    const errObj = error as { message?: string; code?: number; response?: { data?: { error?: { message?: string; code?: number } } } };
    if (errObj.message === "GOOGLE_NOT_CONNECTED" || errObj.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 계정을 연결해주세요" }, { status: 401 });
    }
    console.error("Google Chat API error:", errObj);
    const detail = errObj?.response?.data?.error?.message || errObj?.message || "알 수 없는 오류";
    const code = errObj?.response?.data?.error?.code || errObj?.code || 500;
    return NextResponse.json({
      error: "Google Chat API 오류",
      detail,
      code,
      hint: detail.includes("not been used") || detail.includes("disabled")
        ? "Google Cloud Console에서 Google Chat API를 활성화해야 합니다"
        : detail.includes("scope") || detail.includes("permission") || detail.includes("insufficient")
        ? "Google 계정을 연결 해제 후 다시 연결해주세요 (Chat 권한 필요)"
        : undefined
    }, { status: 500 });
  }
}

// POST: Send a message to a chat space
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { spaceId, text, threadId } = body;

    if (!spaceId || !text) {
      return NextResponse.json({ error: "spaceId와 text가 필요합니다" }, { status: 400 });
    }

    const oauth2Client = await getGoogleClient(userId);
    const chat = google.chat({ version: "v1", auth: oauth2Client });

    const messageBody: { text: string; thread?: { name: string } } = { text };
    if (threadId) {
      messageBody.thread = { name: threadId };
    }

    const res = await chat.spaces.messages.create({
      parent: spaceId,
      requestBody: messageBody,
    });

    return NextResponse.json({
      id: res.data.name,
      text: res.data.text,
      createTime: res.data.createTime,
    });
  } catch (error: unknown) {
    const errObj = error as { message?: string; code?: number; response?: { data?: { error?: { message?: string; code?: number } } } };
    if (errObj.message === "GOOGLE_NOT_CONNECTED" || errObj.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 계정을 연결해주세요" }, { status: 401 });
    }
    console.error("Google Chat send error:", error);
    return NextResponse.json({ error: "메시지 전송 실패" }, { status: 500 });
  }
}
