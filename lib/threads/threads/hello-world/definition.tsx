"use client";
import { registry, type ThreadProps } from "@/lib/threads/registry";

function HelloWorldComponent({ installation, config }: ThreadProps) {
  return (
    <div className="border-[3px] border-nu-ink p-6 bg-nu-cream/30 shadow-[4px_4px_0_0_#0D0F14]">
      <h3 className="font-head text-xl font-extrabold text-nu-ink">👋 Hello World Thread</h3>
      <p className="text-sm text-nu-muted mt-2">
        이 Thread 는 Thread Registry 가 정상 작동하는지 확인하기 위한 데모입니다.
      </p>
      <div className="mt-3 text-xs text-nu-ink/60 font-mono">
        Installation: {installation.id.slice(0, 8)} · Target: {installation.target_type}/{installation.target_id.slice(0, 8)}
      </div>
      {config?.message && (
        <div className="mt-3 p-3 border-[2px] border-nu-pink bg-nu-pink/10">
          Config message: {String(config.message)}
        </div>
      )}
    </div>
  );
}

registry.register({
  slug: "hello-world",
  name: "👋 Hello World",
  description: "Registry 데모 Thread. 테스트용.",
  icon: "👋",
  category: "custom",
  scope: ["nut", "bolt"],
  schema: { type: "object", properties: {} },
  configSchema: { type: "object", properties: { message: { type: "string" } } },
  Component: HelloWorldComponent,
  isCore: false,
  version: "0.1.0",
});
