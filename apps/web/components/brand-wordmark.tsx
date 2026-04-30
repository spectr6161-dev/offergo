import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  href?: string;
  size?: "sm" | "md";
  className?: string;
};

export function BrandWordmark({
  href,
  size = "md",
  className,
}: BrandWordmarkProps) {
  const content = (
    <>
      <span className="relative z-10 origin-left -skew-x-[10deg] font-['Space_Grotesk','Segoe_UI',sans-serif] font-semibold italic tracking-[-0.08em] text-current">
        offer
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex origin-left -skew-x-[15deg] items-center justify-center overflow-hidden rounded-[7px] bg-[#2f80ff]",
          "before:absolute before:inset-0 before:bg-[linear-gradient(115deg,rgba(255,255,255,0.16)_0,rgba(255,255,255,0.16)_18%,transparent_18.5%_100%)]",
          size === "sm" ? "ml-[0.15rem] px-[0.64rem] py-[0.4rem]" : "ml-[0.18rem] px-[0.8rem] py-[0.5rem]",
        )}
      >
        <span className="relative z-10 skew-x-[15deg] font-['Space_Grotesk','Segoe_UI',sans-serif] font-extrabold tracking-[-0.06em] text-white uppercase">
          GO
        </span>
      </span>
    </>
  );

  const rootClassName = cn(
    "inline-flex w-fit items-center whitespace-nowrap leading-none no-underline",
    size === "sm"
      ? "text-[1.16rem] [&_[aria-hidden=true]>span]:text-[0.95rem]"
      : "text-[1.52rem] [&_[aria-hidden=true]>span]:text-[1.2rem]",
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label="offerGO" className={rootClassName}>
        {content}
      </Link>
    );
  }

  return (
    <span aria-label="offerGO" className={rootClassName}>
      {content}
    </span>
  );
}
