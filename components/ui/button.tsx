"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent hover:bg-primary/90 ",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80  aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-white border-transparent hover:bg-destructive/90 focus-visible:ring-destructive/30",
        link: "text-primary border-transparent underline-offset-4 hover:underline shadow-none",
      },
      size: {
        // 44px is the Apple HIG / Material minimum tap target. `default`,
        // `sm` and `icon`/`icon-sm` are the sizes actually rendered on a
        // mobile-reachable surface (masthead utilities, sheet close), so
        // they hold the line at 44px even though the visual footprint used
        // to look smaller. `xs`/`icon-xs`/`lg`/`icon-lg` are unused today —
        // kept below 44px deliberately for a future dense/desktop-only
        // context, not for anything a thumb has to hit.
        default: "h-11 gap-1.5 px-3.5",
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1.5 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4",
        icon: "size-11",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-11 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
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
