import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CredentialBinding } from "@/api/types";
import { BindingList } from "./binding-list";

const SOURCE: CredentialBinding = {
  project_id: "prj-atlas",
  project_name: "atlas",
  binding_id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR1",
  name: "source",
};

const MIRROR: CredentialBinding = {
  project_id: "prj two",
  project_name: "beacon",
  binding_id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR2",
  name: "mirror",
};

function mount(bindings: readonly CredentialBinding[]) {
  return render(
    <MemoryRouter>
      <BindingList bindings={bindings} />
    </MemoryRouter>,
  );
}

describe("BindingList", () => {
  it("shows each binding with its name and its project name", () => {
    mount([SOURCE, MIRROR]);

    const items = within(screen.getByRole("list", { name: "Bindings" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("source")).toBeTruthy();
    expect(within(items[0]!).getByText("atlas")).toBeTruthy();
    expect(within(items[1]!).getByText("mirror")).toBeTruthy();
    expect(within(items[1]!).getByText("beacon")).toBeTruthy();
  });

  it("links each binding to the Bindings tab of its project", () => {
    mount([SOURCE, MIRROR]);

    expect(screen.getByRole("button", { name: "Bindings of atlas" })).toHaveAttribute(
      "href",
      "/projects/prj-atlas?tab=bindings",
    );
    expect(screen.getByRole("button", { name: "Bindings of beacon" })).toHaveAttribute(
      "href",
      "/projects/prj%20two?tab=bindings",
    );
  });

  it("states that no binding names the credential", () => {
    mount([]);

    expect(screen.getByText("No binding names this credential.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Bindings" })).toBeNull();
  });
});
