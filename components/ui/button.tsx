"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // ── 브루탈리스트 계열 (nutunion 브랜드 DNA) ──────────────────────
        // 사용 가이드:
        //   brutalist          — 기본 경계 강조 버튼 (outline 대체)
        //   brutalist-primary  — 주 액션 (nu-pink 채움)
        //   brutalist-ink      — 강한 대비 (nu-ink 채움, 진지한 액션)
        //   brutalist-ghost    — 보조 액션 (투명, 호버 시만 차오름)
        //   brutalist-danger   — 파괴적 액션 (빨강 강조)
        brutalist:
          "rounded-none border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper active:translate-y-0 active:translate-x-0",
        "brutalist-primary":
          "rounded-none border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper font-mono-nu uppercase tracking-widest hover:bg-nu-ink active:translate-y-0 active:translate-x-0",
        "brutalist-ink":
          "rounded-none border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink active:translate-y-0 active:translate-x-0",
        "brutalist-ghost":
          "rounded-none border-[2.5px] border-nu-ink/30 bg-transparent text-nu-graphite font-mono-nu uppercase tracking-widest hover:border-nu-ink hover:text-nu-ink hover:bg-nu-ink/5 active:translate-y-0 active:translate-x-0",
        "brutalist-danger":
          "rounded-none border-[2.5px] border-red-600 bg-red-50 text-red-600 font-mono-nu uppercase tracking-widest hover:bg-red-600 hover:text-nu-paper active:translate-y-0 active:translate-x-0",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // 브루탈리스트 전용 사이즈 — 라벨 중심 sharp 비율
        "brutal-sm": "h-8 px-3 text-[10px]",
        "brutal-md": "h-10 px-4 text-[11px]",
        "brutal-lg": "h-12 px-6 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
