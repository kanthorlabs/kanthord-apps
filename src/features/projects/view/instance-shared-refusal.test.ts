import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";

vi.mock("@/api/resources/projects");

import { instanceSharedRefusalOf } from "./instance-shared-refusal";

const REFUSAL = new ApiError(
  "conflict",
  "Another live binding lists this container instance.",
  409,
  "project.bindings.worker.instance_shared",
  { instance: "builder-1", listed_by: { project_id: "project_2", binding: "build-main" } },
);

describe("instanceSharedRefusalOf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the project that readProject answers", async () => {
    vi.mocked(readProject).mockResolvedValue({ id: "project_2", name: "apps" } as Project);

    await expect(instanceSharedRefusalOf(REFUSAL)).resolves.toBe(
      "builder-1 already serves build-main of apps. A container instance serves one binding.",
    );
    expect(readProject).toHaveBeenCalledWith("project_2");
  });

  it("names another project when readProject rejects", async () => {
    vi.mocked(readProject).mockRejectedValue(new ApiError("not_found", "No project.", 404));

    await expect(instanceSharedRefusalOf(REFUSAL)).resolves.toBe(
      "builder-1 already serves build-main of another project. A container instance serves one binding.",
    );
  });

  it("keeps the text of the daemon when the details miss the listing binding", async () => {
    const bare = new ApiError("conflict", "Daemon text.", 409, REFUSAL.detail, {
      binding: "build-main",
    });

    await expect(instanceSharedRefusalOf(bare)).resolves.toBe("Daemon text.");
    expect(readProject).not.toHaveBeenCalled();
  });
});
