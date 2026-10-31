import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("keeps 64 px from the top below the md breakpoint above the phone width", async () => {
    const toaster = (await showToast(700)) as HTMLElement;

    expect(toaster).toHaveAttribute("data-y-position", "top");
    expect(toaster.style.getPropertyValue("--offset-top")).toBe("64px");
  });

  it("shows a toast at the top right on a desktop, 64 px down", async () => {
    const toaster = (await showToast(1280)) as HTMLElement;

    expect(toaster).toHaveAttribute("data-y-position", "top");
    expect(toaster).toHaveAttribute("data-x-position", "right");
    expect(toaster.style.getPropertyValue("--offset-top")).toBe("64px");
  });

  it("lets a tap on the body of a toast pass through below 700 px", async () => {
    vi.stubGlobal("innerWidth", 390);
    render(<AppToaster />);
    act(() => {
      toast("Saved.", { action: { label: "Retry", onClick: vi.fn() } });
    });

    const body = (await screen.findByText("Saved.")).closest("[data-sonner-toast]");

    expect(body).toHaveClass("cn-toast", "max-[699px]:pointer-events-none");
  });

  it("keeps the Retry action of a toast tappable and runs it", async () => {
    vi.stubGlobal("innerWidth", 390);
    const retry = vi.fn();
    render(<AppToaster />);
    act(() => {
      toast("Saved.", { action: { label: "Retry", onClick: retry } });
    });

    const action = await screen.findByRole("button", { name: "Retry" });
    await userEvent.setup().click(action);

    expect(action).toHaveClass("pointer-events-auto");
    expect(retry).toHaveBeenCalledOnce();
  });
});
