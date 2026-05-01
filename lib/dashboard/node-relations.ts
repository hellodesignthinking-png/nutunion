import type { MindMapData, NodeKind } from "./mindmap-types";

export interface Relation {
  /** 마인드맵 노드 id — drawer 의 jump 핸들러에 사용 */
  nodeId: string;
  /** 연관 종류 — chip 색상/아이콘 결정 */
  kind: NodeKind;
  /** 표시 텍스트 */
  label: string;
  /** 부제 (예: 역할, D-Day, 파일 유형) */
  sub?: string;
}

export interface RelationGroup {
  /** UI 섹션 제목 — "이 너트의 위키 탭 3개" 같은 헤더 */
  title: string;
  items: Relation[];
}

/**
 * 노드 ID 와 마인드맵 데이터로 그 entity 의 모든 연결점을 계산.
 *
 * - 너트 → 그 너트의 탭, 와셔, 일정, 협업 볼트(공유 와셔)
 * - 볼트 → 담당자, 와셔, 파일, 이슈, 협업 너트(공유 와셔)
 * - 와셔 → 공유 너트, 공유 볼트
 * - 탭 → 소속 너트
 * - 일정 → 소속 너트
 * - 이슈 → 소속 볼트
 * - 파일 → 소속 볼트
 *
 * 결과는 그룹별로 묶어 반환 — drawer 가 그대로 섹션으로 렌더.
 */
export function computeRelations(nodeId: string, data: MindMapData): RelationGroup[] {
  if (!nodeId) return [];

  // ── 너트 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("nut-")) {
    const nutId = nodeId.slice("nut-".length);
    const nut = data.nuts.find((n) => n.id === nutId);
    if (!nut) return [];
    const topics = data.topics.filter((t) => t.groupId === nutId);
    const washers = data.washers.filter((w) => w.nutIds.includes(nutId));
    const schedule = data.schedule.filter((s) => s.groupId === nutId);
    // 협업 볼트 — 같은 와셔를 공유하는 볼트들
    const collabBoltIds = new Set<string>();
    for (const w of washers) for (const b of w.boltIds) collabBoltIds.add(b);
    const collabBolts = data.bolts.filter((b) => collabBoltIds.has(b.id));

    const groups: RelationGroup[] = [];
    if (topics.length > 0) {
      groups.push({
        title: `위키 탭 ${topics.length}`,
        items: topics.map((t) => ({
          nodeId: `topic-${t.id}`,
          kind: "topic",
          label: t.name,
          sub: "지식",
        })),
      });
    }
    if (washers.length > 0) {
      groups.push({
        title: `같은 너트의 동료 ${washers.length}`,
        items: washers.map((w) => ({
          nodeId: `washer-${w.id}`,
          kind: "washer",
          label: w.nickname,
          sub: `${w.nutIds.length}너트 · ${w.boltIds.length}볼트`,
        })),
      });
    }
    if (schedule.length > 0) {
      groups.push({
        title: `이 너트의 일정 ${schedule.length}`,
        items: schedule.map((s) => ({
          nodeId: `sched-${s.id}`,
          kind: "schedule",
          label: s.title,
          sub: new Date(s.at).toLocaleString("ko", {
            month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
          }),
        })),
      });
    }
    if (collabBolts.length > 0) {
      groups.push({
        title: `협업 볼트 ${collabBolts.length}`,
        items: collabBolts.map((b) => ({
          nodeId: `bolt-${b.id}`,
          kind: "bolt",
          label: b.title,
          sub: b.status,
        })),
      });
    }
    return groups;
  }

  // ── 볼트 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("bolt-")) {
    const boltId = nodeId.slice("bolt-".length);
    const bolt = data.bolts.find((b) => b.id === boltId);
    if (!bolt) return [];
    const washers = data.washers.filter((w) => w.boltIds.includes(boltId));
    const files = data.files.filter((f) => f.projectId === boltId);
    const issues = data.issues.filter((i) => i.projectId === boltId);
    // 협업 너트 — 같은 와셔를 공유하는 너트들
    const collabNutIds = new Set<string>();
    for (const w of washers) for (const n of w.nutIds) collabNutIds.add(n);
    const collabNuts = data.nuts.filter((n) => collabNutIds.has(n.id));

    const groups: RelationGroup[] = [];
    if (washers.length > 0) {
      groups.push({
        title: `이 볼트의 동료 ${washers.length}`,
        items: washers.map((w) => ({
          nodeId: `washer-${w.id}`,
          kind: "washer",
          label: w.nickname,
        })),
      });
    }
    if (issues.length > 0) {
      groups.push({
        title: `미해결 이슈 ${issues.length}`,
        items: issues.map((i) => ({
          nodeId: `issue-${i.id}`,
          kind: "issue",
          label: i.title,
          sub: i.kind === "overdue_task" ? "마감 지남" : "멘션",
        })),
      });
    }
    if (files.length > 0) {
      groups.push({
        title: `첨부 파일 ${files.length}`,
        items: files.map((f) => ({
          nodeId: `file-${f.id}`,
          kind: "file",
          label: f.name,
          sub: f.fileType || undefined,
        })),
      });
    }
    if (collabNuts.length > 0) {
      groups.push({
        title: `이 볼트와 닿는 너트 ${collabNuts.length}`,
        items: collabNuts.map((n) => ({
          nodeId: `nut-${n.id}`,
          kind: "nut",
          label: n.name,
          sub: n.role,
        })),
      });
    }
    return groups;
  }

  // ── 와셔 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("washer-")) {
    const washerId = nodeId.slice("washer-".length);
    const washer = data.washers.find((w) => w.id === washerId);
    if (!washer) return [];
    const sharedNuts = data.nuts.filter((n) => washer.nutIds.includes(n.id));
    const sharedBolts = data.bolts.filter((b) => washer.boltIds.includes(b.id));
    const groups: RelationGroup[] = [];
    if (sharedNuts.length > 0) {
      groups.push({
        title: `함께 있는 너트 ${sharedNuts.length}`,
        items: sharedNuts.map((n) => ({
          nodeId: `nut-${n.id}`,
          kind: "nut",
          label: n.name,
          sub: n.role,
        })),
      });
    }
    if (sharedBolts.length > 0) {
      groups.push({
        title: `함께 일하는 볼트 ${sharedBolts.length}`,
        items: sharedBolts.map((b) => ({
          nodeId: `bolt-${b.id}`,
          kind: "bolt",
          label: b.title,
          sub: b.status,
        })),
      });
    }
    return groups;
  }

  // ── 위키 탭 ─────────────────────────────────────────────────────
  if (nodeId.startsWith("topic-")) {
    const topicId = nodeId.slice("topic-".length);
    const topic = data.topics.find((t) => t.id === topicId);
    if (!topic) return [];
    const parent = data.nuts.find((n) => n.id === topic.groupId);
    if (!parent) return [];
    return [{
      title: "소속 너트",
      items: [{ nodeId: `nut-${parent.id}`, kind: "nut", label: parent.name, sub: parent.role }],
    }];
  }

  // ── 일정 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("sched-")) {
    const sid = nodeId.slice("sched-".length);
    const sched = data.schedule.find((s) => s.id === sid);
    if (!sched?.groupId) return [];
    const parent = data.nuts.find((n) => n.id === sched.groupId);
    if (!parent) return [];
    return [{
      title: "소속 너트",
      items: [{ nodeId: `nut-${parent.id}`, kind: "nut", label: parent.name, sub: parent.role }],
    }];
  }

  // ── 이슈 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("issue-")) {
    const iid = nodeId.slice("issue-".length);
    const issue = data.issues.find((i) => i.id === iid);
    if (!issue?.projectId) return [];
    const parent = data.bolts.find((b) => b.id === issue.projectId);
    if (!parent) return [];
    return [{
      title: "소속 볼트",
      items: [{ nodeId: `bolt-${parent.id}`, kind: "bolt", label: parent.title, sub: parent.status }],
    }];
  }

  // ── 파일 ────────────────────────────────────────────────────────
  if (nodeId.startsWith("file-")) {
    const fid = nodeId.slice("file-".length);
    const file = data.files.find((f) => f.id === fid);
    if (!file?.projectId) return [];
    const parent = data.bolts.find((b) => b.id === file.projectId);
    if (!parent) return [];
    return [{
      title: "소속 볼트",
      items: [{ nodeId: `bolt-${parent.id}`, kind: "bolt", label: parent.title, sub: parent.status }],
    }];
  }

  return [];
}
