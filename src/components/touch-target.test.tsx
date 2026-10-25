import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import { TouchTarget } from "./touch-target";

describe("TouchTarget", () => {
  it("gives a wrapped Button the minimum height of compact width and none on large width", () => {
    render(
      <TouchTarget>
        <Button>Save</Button>
      </TouchTarget>,
    );

    const wrapper = screen.getByRole("button", { name: "Save" }).parentElement;
    expect(wrapper).toHaveClass("[&>*]:min-h-11", "lg:[&>*]:min-h-0");
  });
});
