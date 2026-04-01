import Image from "next/image";
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
      <Image
        src="/logo.png"
        alt="एक झलक"
        width={427}
        height={144}
        priority={priority}
        className={cn(
          "block h-auto max-h-full w-auto max-w-full object-contain object-center",
          imageClassName,
        )}
      />
    </div>
  );
}
