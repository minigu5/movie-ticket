import type { MovieSettings } from "@/lib/db-types";
import { formatKstDeadline } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { ClockIcon, PinIcon } from "@/components/icons";

export function MovieHero({ movie }: { movie: MovieSettings }) {
  return (
    <section className="w-full max-w-3xl mx-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elev-1)] overflow-hidden">
      <div className="grid grid-cols-[110px_1fr] md:grid-cols-[200px_1fr] gap-0">
        <div className="relative aspect-[2/3] bg-[var(--color-bg-base)] border-r border-[var(--color-border-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={movie.poster_url}
            alt={`${movie.title} 포스터`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="p-4 md:p-7 flex flex-col gap-2.5 md:gap-3">
          <div className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-accent-soft)] font-medium">
            이달의 명작 상영작
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[18px] md:text-[26px] font-semibold tracking-tight text-[var(--color-text-primary)] text-balance leading-tight">
              {movie.title}
            </h2>
            <Badge tone="muted">{movie.age_rating || "전체관람가"}</Badge>
          </div>
          <div className="flex flex-col gap-1 md:gap-1.5 text-[12.5px] md:text-[13.5px] text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <PinIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span>{movie.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span>{movie.date_string}</span>
            </div>
          </div>
          <div className="mt-2 pt-3 border-t border-[var(--color-border-subtle)]">
            <Badge tone="rose">예매 마감 {formatKstDeadline(movie.deadline_date)}</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
