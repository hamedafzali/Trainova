// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Segmented } from "./Segmented";

const OPTIONS = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
  { key: "c", label: "Gamma" },
] as const;

afterEach(cleanup);

describe("Segmented", () => {
  it("is a radio group with one tab stop on the selected option", () => {
    render(<Segmented label="Pick" options={OPTIONS} value="b" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Pick" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("puts the tab stop on the first option when nothing is selected", () => {
    render(<Segmented label="Pick" options={OPTIONS} value={null} onChange={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("arrow keys select and focus the next option, wrapping around", () => {
    const onChange = vi.fn();
    render(<Segmented label="Pick" options={OPTIONS} value="c" onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.keyDown(radios[2], { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(radios[0], { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("calls onChange on click, also for the selected option", () => {
    const onChange = vi.fn();
    render(<Segmented label="Pick" options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Alpha" }));
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
