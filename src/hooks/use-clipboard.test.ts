import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useClipboard } from "./use-clipboard";

const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const copiedText = "pi --session ~/session.jsonl";

function setClipboard(value: Partial<Clipboard> | undefined): void {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

function setExecCommand(result: boolean): ReturnType<typeof vi.fn> {
  const execCommand = vi.fn(() => {
    expect(document.querySelector("textarea")?.value).toBe(copiedText);
    return result;
  });
  Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  return execCommand;
}

describe("useClipboard", () => {
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("writes through the Clipboard API when the browser offers it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { result } = renderHook(() => useClipboard());

    await result.current(copiedText);

    expect(writeText).toHaveBeenCalledWith(copiedText);
  });

  it("copies through a selected field when the page is not a secure context", async () => {
    setClipboard(undefined);
    const execCommand = setExecCommand(true);
    const { result } = renderHook(() => useClipboard());

    await result.current(copiedText);

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("rejects when the browser refuses the copy outside a secure context", async () => {
    setClipboard(undefined);
    setExecCommand(false);
    const { result } = renderHook(() => useClipboard());

    await expect(result.current(copiedText)).rejects.toThrow("The browser refused the clipboard.");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
