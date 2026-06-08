import { ACT_TYPE_LABELS, DAY_NAMES, type ActType } from "@/lib/types";

export type ProgramRow = {
  id: string;
  title: string;
  description?: string | null;
  performerName?: string | null;
  actType: string;
  recurrence: string;
  dayOfWeek?: number | null;
  specificDate?: Date | string | null;
  startTime: string;
  endTime?: string | null;
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function VenueProgramSchedule({ programs }: { programs: ProgramRow[] }) {
  const weekly = programs.filter((p) => p.recurrence === "WEEKLY");
  const oneOff = programs.filter((p) => p.recurrence === "ONE_OFF");

  if (programs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No regular programming listed yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {weekly.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-semibold">Weekly nights</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Live music &amp; DJ nights — walk in, no ticket required unless noted.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {weekly.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
        </section>
      )}

      {oneOff.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-semibold">Special nights</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {oneOff.map((p) => (
              <ProgramCard key={p.id} program={p} showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProgramCard({ program, showDate }: { program: ProgramRow; showDate?: boolean }) {
  const act = ACT_TYPE_LABELS[program.actType as ActType] ?? program.actType;
  const day =
    showDate && program.specificDate
      ? new Date(program.specificDate).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : program.dayOfWeek != null
      ? DAY_NAMES[program.dayOfWeek]
      : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{program.title}</p>
          {program.performerName && (
            <p className="text-sm text-muted-foreground">{program.performerName}</p>
          )}
        </div>
        {day && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {day}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {act} · {formatTime(program.startTime)}
        {program.endTime ? ` – ${formatTime(program.endTime)}` : ""}
      </p>
      {program.description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
      )}
    </div>
  );
}
