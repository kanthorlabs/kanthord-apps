import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { createProject, readProject, renameProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { useProject } from "@/features/projects/project-context";
import { asApiError, useResource } from "@/hooks/use-resource";
import { projectNameError } from "@/lib/project-name";

export type ProjectFormMode = "create" | "edit";

export interface ProjectFormState {
  readonly mode: ProjectFormMode;
  readonly current: Project | null;
  readonly loading: boolean;
  readonly loadError: ApiError | null;
  readonly reloadCurrent: () => void;
  readonly name: string;
  readonly nameError: string | null;
  readonly submitError: ApiError | null;
  readonly submitting: boolean;
  readonly setName: (name: string) => void;
  readonly submit: () => void;
  readonly cancelPath: string;
}

const NO_PROJECT = Promise.resolve(null);

export function useProjectForm(projectId: string | null): ProjectFormState {
  const navigate = useNavigate();
  const { reload: reloadProjects } = useProject();
  const existing = useResource(
    () => (projectId === null ? NO_PROJECT : readProject(projectId)),
    [projectId],
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = existing.data;
  const name = draft ?? current?.name ?? "";

  const setName = useCallback((next: string) => {
    setDraft(next);
    setNameError(null);
  }, []);

  const submit = useCallback(() => {
    if (submitting) return;
    const invalid = projectNameError(name);
    setNameError(invalid);
    if (invalid !== null) return;
    setSubmitting(true);
    setSubmitError(null);
    const write = projectId === null ? createProject(name) : renameProject(projectId, name);
    write.then(
      (project) => {
        setSubmitting(false);
        reloadProjects();
        void navigate(`/projects/${encodeURIComponent(project.id)}`);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setSubmitError(asApiError(cause));
      },
    );
  }, [submitting, name, projectId, reloadProjects, navigate]);

  return {
    mode: projectId === null ? "create" : "edit",
    current,
    loading: existing.loading,
    loadError: existing.error,
    reloadCurrent: existing.reload,
    name,
    nameError,
    submitError,
    submitting,
    setName,
    submit,
    cancelPath: projectId === null ? "/projects" : `/projects/${encodeURIComponent(projectId)}`,
  };
}
