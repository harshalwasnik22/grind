import { redirect } from "next/navigation";
import { getCurrent } from "@/lib/current-user";
import { Panel } from "@/components/ui/panel";
import { OnboardingForm } from "@/components/onboarding-form";

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (Array.isArray(supported) && supported.length > 0) return supported;
  } catch {
    /* fall through */
  }
  return FALLBACK_TIMEZONES;
}

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user, profile } = await getCurrent();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="pixel-title text-2xl text-gold">New Challenger</h1>
          <p className="mt-3 text-lg text-muted">
            Set up your player before you join the grind.
          </p>
        </header>

        <Panel title="Create Your Player">
          <OnboardingForm
            defaultName={profile?.display_name ?? ""}
            defaultUsername={profile?.username ?? ""}
            defaultTimezone={profile?.timezone ?? "UTC"}
            timezones={getTimezones()}
          />
        </Panel>
      </div>
    </main>
  );
}
