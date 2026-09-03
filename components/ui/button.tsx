import Link from "next/link";
import type { ComponentProps } from "react";
type Props = ComponentProps<typeof Link> & { variant?: "dark" | "light" | "lime"; className?: string };
export function Button({variant="dark",className="",...props}: Props) { const colors={dark:"bg-ink text-white hover:bg-ink/90",light:"bg-white text-ink border border-ink/10 hover:bg-mist",lime:"bg-lime text-ink hover:bg-lime/80"}; return <Link {...props} className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${colors[variant]} ${className}`} />; }
