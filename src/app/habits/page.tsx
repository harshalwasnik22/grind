import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { getMyGroup } from "@/lib/groups";
import { getMyHabits, getTemplates } from "@/lib/habits";
import { categoryMeta, DAY_LABELS } from "@/lib/habit-meta";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { HabitCreateForm } from "@/components/habit-create-form";
import { HabitEditForm } from "@/components/habit-edit-form";
import { TemplatePicker } from "@/components/template-picker";
import { archiveHabit } from "@/app/habits/actions";

export const dynamic = "force-dynamic";

function scheduleLabel(days: number[]): string {
  if (days.length >= 7) return "Daily";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

export default async function HabitsPage() {
  const { user } = await requirePlayer();
  const group = await getMyGroup(user.id);
  if (!group) redirect("/groups/new");

  const [habits, templates] = await Promise.all([
    getMyHabits(user.id),
    getTemplates(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="pixel-title text-xl text-gold">Your Quests</h1>
          <p className="mt-2 text-base text-muted">
            Customize what you grind on and how much XP it&apos;s worth.
          </p>
        </div>
        <Link href="/">
          <PixelButton size="sm">Dashboard</PixelButton>
        </Link>
      </header>

      {/* Current habits */}
      <Panel title={`Active Quests · ${habits.length}`} className="mb-6">
        {habits.length === 0 ? (
          <p className="text-lg text-muted">
            No quests yet. Add some starter quests below, or create your own.
          </p>
        ) : (
          <ul className="space-y-2">
            {habits.map((h) => {
              const meta = categoryMeta(h.category);
              return (
                <li key={h.id} className="pixel-inset px-3 py-2">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span aria-hidden className="text-xl">
                        {meta.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg text-fg">
                          {h.name}
                        </span>
                        <span className="text-sm text-muted">
                          {h.daily_target} {h.unit} · +{h.base_xp}xp ·{" "}
                          {scheduleLabel(h.schedule)}
                        </span>
                      </span>
                      <PixelBadge tone={meta.color}>{meta.label}</PixelBadge>
                      <span className="pixel-title text-[0.5rem] text-info">
                        EDIT ▾
                      </span>
                    </summary>

                    <div className="mt-4 border-t-[3px] border-line/20 pt-4">
                      <HabitEditForm habit={h} />
                      <div className="mt-3">
                        <form action={archiveHabit}>
                          <input type="hidden" name="id" value={h.id} />
                          <PixelButton
                            size="sm"
                            variant="danger"
                            type="submit"
                          >
                            Archive Quest
                          </PixelButton>
                        </form>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Starter templates */}
        <Panel title="Starter Quests">
          <p className="mb-3 text-base text-muted">
            Quick-add popular quests. You can tweak them after.
          </p>
          <TemplatePicker templates={templates} />
        </Panel>

        {/* Custom habit */}
        <Panel title="Create a Custom Quest">
          <HabitCreateForm />
        </Panel>
      </div>
    </main>
  );
}
