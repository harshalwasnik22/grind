import { CATEGORIES, UNITS, DAY_LABELS, ALL_DAYS } from "@/lib/habit-meta";

type Props = {
  defaultName?: string;
  defaultCategory?: string;
  defaultUnit?: string;
  defaultTarget?: number;
  defaultBaseXp?: number;
  defaultDays?: number[];
};

const inputClass =
  "w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none";

/** Shared field set for creating/editing a habit (uncontrolled). */
export function HabitFields({
  defaultName = "",
  defaultCategory = "dsa",
  defaultUnit = "problems",
  defaultTarget,
  defaultBaseXp = 100,
  defaultDays = ALL_DAYS,
}: Props) {
  const daySet = new Set(defaultDays);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Quest name
        </span>
        <div className="pixel-inset mt-1 px-3 py-2">
          <input
            name="name"
            defaultValue={defaultName}
            required
            maxLength={60}
            placeholder="Solve DSA problems"
            className={inputClass}
          />
        </div>
      </label>

      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Category
        </span>
        <div className="pixel-inset mt-1 px-3 py-2">
          <select
            name="category"
            defaultValue={defaultCategory}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-surface">
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-1 block">
          <span className="pixel-title text-[0.5rem] uppercase text-muted">
            Target
          </span>
          <div className="pixel-inset mt-1 px-3 py-2">
            <input
              name="daily_target"
              type="number"
              min={0}
              step="any"
              defaultValue={defaultTarget}
              required
              placeholder="2"
              className={inputClass}
            />
          </div>
        </label>

        <label className="col-span-2 block">
          <span className="pixel-title text-[0.5rem] uppercase text-muted">
            Unit
          </span>
          <div className="pixel-inset mt-1 px-3 py-2">
            <input
              name="unit"
              defaultValue={defaultUnit}
              list="unit-options"
              maxLength={20}
              placeholder="problems"
              className={inputClass}
            />
            <datalist id="unit-options">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block">
          <span className="pixel-title text-[0.5rem] uppercase text-muted">
            XP at target
          </span>
          <div className="pixel-inset mt-1 w-28 px-3 py-2">
            <input
              name="base_xp"
              type="number"
              min={1}
              step={10}
              defaultValue={defaultBaseXp}
              className={inputClass}
            />
          </div>
        </label>

        <div>
          <span className="pixel-title text-[0.5rem] uppercase text-muted">
            Days
          </span>
          <div className="mt-1 flex gap-1">
            {DAY_LABELS.map((d, i) => (
              <label key={i} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="days"
                  value={i}
                  defaultChecked={daySet.has(i)}
                  className="peer sr-only"
                />
                <span className="grid h-8 w-8 place-items-center border-2 border-muted/40 text-sm text-muted peer-checked:border-xp peer-checked:bg-xp/15 peer-checked:text-xp">
                  {d}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
