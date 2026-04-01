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
      {/* mix-blend-multiply hides the white background on light shells;
          mix-blend-screen inverts it on dark shells — one file, both themes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="एक झलक"
        width={427}
        height={144}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "block h-auto max-h-full w-auto max-w-full object-contain object-center mix-blend-multiply dark:mix-blend-screen",
          imageClassName,
        )}
      />
    </div>
  );
}
