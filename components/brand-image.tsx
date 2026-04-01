"use client";

import { cn } from "@/lib/utils";

interface BrandImageProps {
  containerClassName?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function BrandImage({
  containerClassName,
  imageClassName,
  priority = false,
}: BrandImageProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center overflow-visible px-3 py-2 sm:px-4 sm:py-3",
        containerClassName,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="एक झलक"
        width={427}
        height={144}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "block h-auto max-h-full w-auto max-w-full object-contain object-center",
          imageClassName,
        )}
      />
    </div>
  );
}
