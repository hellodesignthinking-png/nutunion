/**
 * openOrCreateDm — 특정 유저와의 1:1 DM 방을 확보하고 room_id 를 반환.
 *
 * 서버 측에서 기존 방이 있으면 재사용, 없으면 RPC 로 생성.
 */
export async function openOrCreateDm(otherUserId: string): Promise<string> {
  const res = await fetch("/api/chat/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dm_target: otherUserId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.room_id) {
    throw new Error(data.error || "DM 방을 만들 수 없어요");
  }
  return data.room_id as string;
}
