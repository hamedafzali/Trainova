// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useStore } from "@/lib/store";
import { ExerciseCoachSheet } from "./ExerciseCoachSheet";

const st = () => useStore.getState();

let session: string;
let bench: string;
beforeEach(() => {
  st().resetUserData();
  session = st().startSession(null).id!;
  bench = st().exercises.find((e) => e.primaryMuscle && (e.type === "weight_reps" || !e.type))!.id;
  st().addSet(session, bench);
  st().addSet(session, bench);
});
afterEach(cleanup);

describe("ExerciseCoachSheet", () => {
  it("shows the rule-based reading without an account", () => {
    render(<ExerciseCoachSheet open sessionId={session} exerciseId={bench} onClose={() => {}} />);
    expect(screen.getByRole("dialog").textContent).toContain(st().exerciseById(bench)!.name);
    expect(screen.getByTestId("coach-reading").textContent).toContain("Rule-based reading");
    expect(screen.queryByLabelText("Ask about this exercise")).toBeNull();
  });

  it("swaps the open sets and reports the new exercise", () => {
    const onSwapped = vi.fn();
    const onClose = vi.fn();
    render(<ExerciseCoachSheet open sessionId={session} exerciseId={bench} onClose={onClose} onSwapped={onSwapped} />);
    const [first] = screen.getAllByRole("button", { name: /^Swap to / });
    fireEvent.click(first);
    const to = onSwapped.mock.calls[0][0] as string;
    expect(to).not.toBe(bench);
    expect(st().setsForSession(session).every((x) => x.exerciseId === to)).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
