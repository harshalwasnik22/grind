import { Panel } from "@/components/ui/panel";
import { LoginForm } from "@/components/login-form";

const errorMessages: Record<string, string> = {
  link: "That magic link was invalid or expired. Try again.",
  auth: "Something went wrong signing you in. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="pixel-title text-3xl text-gold">GRIND</h1>
          <p className="mt-3 text-lg text-muted">
            Sign in to level up your grind.
          </p>
        </header>

        <Panel title="Enter the Arena">
          {error && errorMessages[error] && (
            <p className="mb-4 border-[3px] border-hp bg-hp/10 p-3 text-base text-hp">
              ⚠ {errorMessages[error]}
            </p>
          )}
          <LoginForm next={next} />
          <p className="mt-5 text-center text-sm text-muted">
            No password needed — we&apos;ll email you a one-time magic link.
          </p>
        </Panel>
      </div>
    </main>
  );
}
