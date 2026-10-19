import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppToaster } from "./app-toaster";

async function showToast(width: number) {
  vi.stubGlobal("innerWidth", width);
  render(<AppToaster />);
  act(() => {
    toast("Saved.");
  });
  const message = await screen.findByText("Saved.");
  return message.closest("[data-sonner-toaster]");
}

describe("AppToaster", () => {
  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
    vi.unstubAllGlobals();
  });

  it("shows a toast at the top on a phone, away from the sheet footer", async () => {
    const toaster = await showToast(390);

    expect(toaster).toHaveAttribute("data-y-position", "top");
  });

  it("places a phone toast below the topbar and the sheet close button", async () => {
    const toaster = await showToast(390);

    expect((toaster as HTMLElement).style.getPropertyValue("--mobile-offset-top")).toBe("64px");
  });

  it("keeps a toast at the bottom right on a desktop", async () => {
    const toaster = await showToast(1280);

    expect(toaster).toHaveAttribute("data-y-position", "bottom");
    expect(toaster).toHaveAttribute("data-x-position", "right");
  });
});
