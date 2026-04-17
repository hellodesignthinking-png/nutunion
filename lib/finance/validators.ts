// Finance 입력 검증 — Zod 스키마 + 특수 보안 체크
//
// 사용 패턴 (API 라우트 내):
//   const parsed = TransactionCreateSchema.safeParse(body);
//   if (!parsed.success) {
//     return NextResponse.json(
//       { error: "입력값 오류", details: parsed.error.flatten() },
//       { status: 400 }
//     );
//   }
//   const { date, amount, ... } = parsed.data;

import { z } from "zod";

// ============================================================
// 공통 primitives
// ============================================================

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식");
export const YearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 형식");

// 트리밍된 비공백 문자열
export const NonEmptyString = (max: number, label = "값") =>
  z.string().trim().min(1, `${label} 는 공백일 수 없습니다`).max(max, `${label} 는 ${max}자 이하`);

// 옵셔널 문자열 (빈 문자열은 null 취급)
export const OptionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(max).nullable()
  );

// ============================================================
// data: URL 검증 — SVG/HTML/스크립트 차단 (XSS 방지)
// ============================================================

const ALLOWED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const ALLOWED_DOC_MIMES = ["application/pdf"];

/** data: URL 을 허용 목록 기반으로 검증. svg+xml, text/html 등 스크립트 실행 가능 포맷 차단. */
export function validateDataUrl(
  url: string,
  opts: { allowPdf?: boolean; maxBase64Length: number }
): { ok: true } | { ok: false; error: string } {
  if (!url.startsWith("data:")) return { ok: true };  // http(s) URL 은 여기서 검증 안 함

  if (url.length > opts.maxBase64Length) {
    return { ok: false, error: `파일이 너무 큽니다 (최대 ${Math.round(opts.maxBase64Length / 1024)}KB)` };
  }

  const match = url.match(/^data:([^;,]+)(;base64)?,/);
  if (!match) return { ok: false, error: "잘못된 data URL 형식" };

  const mime = match[1].toLowerCase().trim();
  const allowedMimes = opts.allowPdf
    ? [...ALLOWED_IMAGE_MIMES, ...ALLOWED_DOC_MIMES]
    : ALLOWED_IMAGE_MIMES;

  if (!allowedMimes.includes(mime)) {
    return { ok: false, error: `허용되지 않는 파일 형식: ${mime}` };
  }

  // 반드시 base64 인코딩 (raw text 포맷 차단)
  if (!match[2]) {
    return { ok: false, error: "base64 인코딩된 파일만 허용됩니다" };
  }

  return { ok: true };
}

// ============================================================
// Transaction
// ============================================================

const TX_TYPES = ["수입", "지출", "이체", "기타"] as const;

export const TransactionCreateSchema = z.object({
  date: DateSchema,
  company: NonEmptyString(50, "법인"),
  type: z.enum(TX_TYPES).optional(),
  description: NonEmptyString(200, "내용"),
  amount: z.number().finite().refine((v) => v !== 0, "금액은 0 이 될 수 없습니다"),
  category: OptionalString(50),
  memo: OptionalString(1000),
  receipt_type: OptionalString(50),
  vendor_name: OptionalString(100),
  payment_method: OptionalString(50),
  force_duplicate: z.boolean().optional(),
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial().refine(
  (data) => data.amount === undefined || data.amount !== 0,
  "금액은 0 이 될 수 없습니다"
);

// ============================================================
// Employee
// ============================================================

const EMPLOYMENT_TYPES = ["정규직", "계약직", "인턴", "알바"] as const;
const EMPLOYEE_STATUS = ["재직", "휴직", "퇴직"] as const;

export const EmployeeCreateSchema = z.object({
  name: NonEmptyString(50, "이름"),
  company: NonEmptyString(50, "법인"),
  position: OptionalString(50),
  department: OptionalString(50),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional(),
  email: z.string().email("이메일 형식 오류").optional().nullable().or(z.literal("")),
  phone: OptionalString(20),
  annual_salary: z.number().int().nonnegative().optional(),
  hourly_wage: z.number().int().nonnegative().optional(),
  weekly_days: z.number().int().min(1).max(7).optional(),
  daily_hours: z.number().min(0.5).max(24).optional(),
  work_days: OptionalString(50),
  bank_name: OptionalString(50),
  bank_account: OptionalString(50),
  join_date: DateSchema.optional(),
}).refine(
  (data) => {
    if (data.employment_type === "알바") {
      return !!data.hourly_wage;
    }
    return true;
  },
  { message: "알바는 시급 필수", path: ["hourly_wage"] }
);

export const EmployeeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  company: z.string().trim().min(1).max(50).optional(),
  position: OptionalString(50),
  department: OptionalString(50),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional(),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  email: z.string().email().or(z.literal("")).nullable().optional(),
  phone: OptionalString(20),
  join_date: DateSchema.optional(),
  end_date: DateSchema.optional().nullable(),
  annual_salary: z.number().int().nonnegative().optional().nullable(),
  annual_leave_total: z.number().int().nonnegative().optional(),
  annual_leave_used: z.number().int().nonnegative().optional(),
  hourly_wage: z.number().int().nonnegative().optional().nullable(),
  weekly_days: z.number().int().min(1).max(7).optional().nullable(),
  daily_hours: z.number().min(0.5).max(24).optional().nullable(),
  work_days: OptionalString(50),
  work_start_time: OptionalString(10),
  work_end_time: OptionalString(10),
  bank_name: OptionalString(50),
  bank_account: OptionalString(50),
  memo: OptionalString(1000),
});

// ============================================================
// Approval
// ============================================================

export const ApprovalCreateSchema = z.object({
  title: NonEmptyString(200, "제목"),
  doc_type: NonEmptyString(50, "문서 유형"),
  content: OptionalString(10000),
  amount: z.number().int().optional().nullable(),
  company: OptionalString(50),
  attachments: z.unknown().optional(),
});

export const ApprovalActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  reject_reason: z.string().max(500).optional(),
});

// ============================================================
// Payroll
// ============================================================

export const PayrollUpsertSchema = z.object({
  employee_id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  year_month: YearMonthSchema,
  overtime_hours: z.number().nonnegative().optional(),
  bonus_pay: z.number().nonnegative().optional(),
  annual_leave_pay: z.number().nonnegative().optional(),
  other_pay: z.number().nonnegative().optional(),
  memo: OptionalString(1000),
  paid_date: DateSchema.optional().nullable(),
});

// ============================================================
// Contract
// ============================================================

export const ContractActionSchema = z.object({
  action: z.enum(["send", "sign", "cancel"]),
  signature_image: z.string().optional(),
});

// ============================================================
// Marketing
// ============================================================

const MARKETING_TYPES = ["blog", "sns", "newsletter", "ad", "press", "campaign"] as const;
const ENTITY_TYPES = ["bolt", "company"] as const;

export const MarketingRequestSchema = z.object({
  contentType: z.enum(MARKETING_TYPES),
  topic: NonEmptyString(500, "주제"),
  tone: OptionalString(50),
  target: OptionalString(100),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

// ============================================================
// 헬퍼
// ============================================================

/** Zod 에러를 사용자 친화 메시지로 변환 */
export function formatZodError(error: z.ZodError): { error: string; details: Record<string, string[]> } {
  const flat = error.flatten();
  const firstField = Object.entries(flat.fieldErrors)[0];
  const msg = firstField
    ? `${firstField[0]}: ${(firstField[1] as string[])[0]}`
    : flat.formErrors[0] || "입력값이 올바르지 않습니다";
  return {
    error: msg,
    details: flat.fieldErrors as Record<string, string[]>,
  };
}

/** safeParse 결과 타입 헬퍼 (Zod v4 호환) */
export type SafeParseResult<T> = z.ZodSafeParseResult<T>;
