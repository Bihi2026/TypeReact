import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CircleHelp,
  MessagesSquare,
  PenSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRUST_CHIPS = [
  { label: "Real people", icon: Users },
  { label: "Real discussions", icon: MessagesSquare },
  { label: "Verified information", icon: BadgeCheck },
  { label: "Real change", icon: ShieldCheck },
] as const;

const CTA_CARDS = [
  {
    href: "/create",
    label: "Write a Reaction",
    hint: "Respond with sourced evidence",
    icon: PenSquare,
    tileClass: "bg-primary text-primary-foreground",
  },
  // {
  //   href: "/explore",
  //   label: "Ask a Question",
  //   hint: "Find open discussions",
  //   icon: CircleHelp,
  //   tileClass: "bg-sky-600 text-white",
  // },
  {
    href: "/learn",
    label: "Learn More",
    hint: "How TypeReact works",
    icon: BookOpen,
    tileClass: "bg-zinc-900 text-white dark:bg-zinc-800",
  },
] as const;

export function HomeHero() {
  return (
    <section className="relative overflow-x-clip">
      <div className="relative isolate min-h-[20rem] overflow-hidden bg-[#1a1520] text-white sm:min-h-[26rem]">
        <Image
          src="/home-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%] sm:object-[center_35%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/55 sm:bg-gradient-to-r sm:from-black/70 sm:via-black/35 sm:to-black/10"
          aria-hidden
        />
        <div
          className="absolute inset-0 hidden bg-gradient-to-t from-black/45 via-transparent to-black/15 sm:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-28 sm:pt-20 lg:pb-32 lg:pt-24">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 sm:mb-5 sm:text-xs">
            <span className="h-px w-8 bg-primary" aria-hidden />
            The public square
          </p>
          <h1 className="max-w-3xl text-[1.85rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">Evidence.</span>
            <span className="block">Discussion.</span>
            <span className="relative inline-block pb-1 text-primary">
              Accountability.
              <span
                className="absolute bottom-0 left-0 h-1 w-16 rounded-full bg-primary/80 sm:w-24"
                aria-hidden
              />
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm text-white/80 sm:mt-5 sm:text-lg">
            A public square for sourced arguments. Real people examine claims,
            debate the record, and hold power to the evidence.
          </p>
          <ul className="mt-4 flex max-w-full flex-wrap items-center rounded-2xl border border-white/20 bg-white/10 px-1 py-1 text-[11px] font-medium text-white/95 shadow-sm backdrop-blur-md sm:mt-7 sm:text-xs">
            {TRUST_CHIPS.map(({ label, icon: Icon }, index) => (
              <li
                key={label}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3",
                  index > 0 && "border-l border-white/20"
                )}
              >
                <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-7 grid max-w-6xl grid-cols-1 gap-2 px-4 pb-5 sm:-mt-14 sm:grid-cols-3 sm:gap-3 sm:px-6 sm:pb-6">
        {CTA_CARDS.map((cta) => {
          const Icon = cta.icon;
          return (
            <Link
              key={cta.href}
              href={cta.href}
              className="group flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:min-h-16 sm:px-5 sm:py-4"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  cta.tileClass
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight sm:text-base">
                  {cta.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground sm:text-xs">
                  {cta.hint}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
