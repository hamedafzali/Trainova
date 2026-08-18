// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SEED_SESSION_ID } from "@/lib/seed";
import SessionPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: SEED_SESSION_ID }),
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("SessionPage", () => {
  it("survives the hydration transition without a hooks-order violation", async () => {
    // useHydrated() renders `false` on the first pass (showing the
    // skeleton), then flips to `true` inside a useEffect once
    // useStore.persist.rehydrate() resolves, forcing a second render with
    // the real session. Every hook on this component — including
    // useDialogA11y — must be called on both renders in the same order.
    // A hook called after an early `if (!hydrated) return` / `if (!session)
    // return` only runs on the second render, which makes React throw
    // "Rendered more hooks than during the previous render" right here.
    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Full Body A");
    });
  });
});
