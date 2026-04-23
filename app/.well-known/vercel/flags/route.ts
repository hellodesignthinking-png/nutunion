import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "@/lib/flags";

/**
 * Vercel Flags Discovery Endpoint — Flags Explorer 가 이 경로를 호출해
 * 코드에 선언된 플래그 목록을 자동 수집합니다.
 * 배포 후 Vercel Dashboard → Flags 탭에서 자동으로 인지됨.
 */
export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags));
