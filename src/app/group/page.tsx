import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { getMyGroup, getGroupWager } from "@/lib/groups";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { SignOutButton } from "@/components/sign-out-button";
import { WagerForm } from "@/components/wager-form";
import {
  leaveGroupAction,
  rotateInviteCodeAction,
} from "@/app/groups/actions";

export const dynamic = "force-dynamic";

export default async function GroupPage() {
  const { user } = await requirePlayer();
  const data = await getMyGroup(user.id);
  if (!data) redirect("/groups/new");

  const { group, myRole, members } = data;
  const isOwner = myRole === "owner";
  const wager = await getGroupWager(group.id, group.active_season_id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="pixel-title text-xl text-gold">{group.name}</h1>
          <p className="mt-2 text-base text-muted">
            {members.length} {members.length === 1 ? "player" : "players"} · your
            squad
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <PixelButton size="sm">Dashboard</PixelButton>
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* Invite */}
      <Panel title="Invite Code" className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="pixel-title text-xl tracking-widest text-info">
            {group.invite_code}
          </span>
          <CopyInviteButton code={group.invite_code} />
          {isOwner && (
            <form action={rotateInviteCodeAction}>
              <input type="hidden" name="group_id" value={group.id} />
              <PixelButton size="sm" type="submit">
                New Code
              </PixelButton>
            </form>
          )}
        </div>
        <p className="mt-3 text-base text-muted">
          Share this code so friends can join your squad.
          {isOwner && " Rotating it invalidates the old one."}
        </p>
      </Panel>

      {/* Weekly wager */}
      <Panel title="Weekly Wager" className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {wager ? (
            <>
              <PixelBadge tone="magenta">stake</PixelBadge>
              <span className="text-lg text-fg">{wager.stake}</span>
            </>
          ) : (
            <span className="text-base text-muted">
              No wager set for this season yet.
            </span>
          )}
        </div>
        <p className="mb-4 text-base text-muted">
          When the season closes, the <span className="text-hp">lowest scorer</span>{" "}
          owes the stake. A tie for last means nobody pays.
        </p>
        {isOwner ? (
          <WagerForm groupId={group.id} currentStake={wager?.stake ?? null} />
        ) : (
          <p className="text-base text-muted">
            Only the squad owner can set the wager.
          </p>
        )}
      </Panel>

      {/* Roster */}
      <Panel title="Roster">
        <ol className="space-y-2">
          {members.map((m) => {
            const name = m.profiles?.display_name ?? "New Player";
            const isYou = m.user_id === user.id;
            return (
              <li
                key={m.user_id}
                className="pixel-inset flex items-center gap-3 px-3 py-2"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center border-[3px] border-line bg-surface-2 text-sm text-gold">
                  {m.profiles?.current_level ?? 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="pixel-title text-[0.6rem] text-fg">
                      {name}
                    </span>
                    {isYou && <PixelBadge tone="info">you</PixelBadge>}
                    {m.role === "owner" && (
                      <PixelBadge tone="gold">owner</PixelBadge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted">
                    <span>{m.profiles?.total_xp ?? 0} XP</span>
                    <span className="text-magenta">
                      🔥 {m.profiles?.current_streak ?? 0}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5">
          <form action={leaveGroupAction}>
            <input type="hidden" name="group_id" value={group.id} />
            <PixelButton size="sm" variant="danger" type="submit">
              Leave Squad
            </PixelButton>
          </form>
        </div>
      </Panel>
    </main>
  );
}
