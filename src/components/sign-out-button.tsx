import { signOut } from "@/app/auth/actions";
import { PixelButton } from "@/components/ui/pixel-button";

/** Sign-out control — posts to the `signOut` server action. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <PixelButton type="submit" size="sm" variant="danger">
        Log Out
      </PixelButton>
    </form>
  );
}
