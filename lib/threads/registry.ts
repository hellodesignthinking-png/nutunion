import type { ComponentType } from "react";

export type ThreadScope = "nut" | "bolt";
export type ThreadCategory =
  | "communication" | "project" | "finance" | "space_ops"
  | "platform_ops" | "growth" | "custom" | "integration" | "ai";

export interface ThreadInstallation {
  id: string;
  thread_id: string;
  target_type: ThreadScope;
  target_id: string;
  position: number;
  config: Record<string, any>;
  is_enabled: boolean;
  installed_by: string;
  installed_at: string;
  thread?: ThreadMeta;
}

export interface ThreadMeta {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: ThreadCategory;
  scope: ThreadScope[];
  schema: any;
  config_schema: any | null;
  is_core: boolean;
  version: string;
}

export interface ThreadProps {
  installation: ThreadInstallation;
  config: Record<string, any>;
  canEdit: boolean;
  currentUserId: string;
}

export interface ThreadConfigProps {
  installation: ThreadInstallation;
  onConfigChange: (next: Record<string, any>) => void;
}

export interface ThreadDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: ThreadCategory;
  scope: ThreadScope[];
  schema: any;
  configSchema?: any;
  Component: ComponentType<ThreadProps>;
  ConfigComponent?: ComponentType<ThreadConfigProps>;
  isCore?: boolean;
  version?: string;
  onInstall?: (ctx: { installation: ThreadInstallation }) => Promise<void>;
  onUninstall?: (ctx: { installation: ThreadInstallation }) => Promise<void>;
}

class ThreadRegistry {
  private defs = new Map<string, ThreadDefinition>();

  register(def: ThreadDefinition) {
    if (this.defs.has(def.slug)) {
      // 개발 중 HMR 중복 등록은 흔함 — 경고만 남기고 덮어쓴다
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[ThreadRegistry] duplicate registration: ${def.slug} (overwritten)`);
      }
    }
    this.defs.set(def.slug, def);
  }

  get(slug: string): ThreadDefinition | undefined {
    return this.defs.get(slug);
  }

  forScope(scope: ThreadScope): ThreadDefinition[] {
    return Array.from(this.defs.values()).filter((d) => d.scope.includes(scope));
  }

  all(): ThreadDefinition[] {
    return Array.from(this.defs.values());
  }
}

export const registry = new ThreadRegistry();
