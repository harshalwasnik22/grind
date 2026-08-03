import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { getMyGroup } from "@/lib/groups";
import { Panel } from "@/components/ui/panel";
import { CreateGroupForm } from "@/components/create-group-form";
import { JoinGroupForm } from "@/components/join-group-form";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  const { user } = await requirePlayer();
  const existing = await getMyGroup(user.id);
  if (existing) redirect("/group");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="pixel-title text-2xl text-gold">Join the Grind</h1>
        <p className="mt-3 text-lg text-muted">
          Start a squad and invite your friends, or join one with a code.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Create a Squad">
          <p className="mb-4 text-base text-muted">
            You&apos;ll be the owner. Share the invite code to bring friends in.
          </p>
          <CreateGroupForm />
        </Panel>

        <Panel title="Join a Squad">
          <p className="mb-4 text-base text-muted">
            Got a 6-character invite code from a friend? Drop it here.
          </p>
          <JoinGroupForm />
        </Panel>
      </div>
    </main>
  );
}
