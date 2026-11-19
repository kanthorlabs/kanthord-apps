import { describe, expect, it } from "vitest";

import {
  currentVariantOf,
  INSTRUCTION_LINE,
  VALIDATION_FAILED,
  VARIANT_NAME_RULE,
  variantDraftFailureOf,
  variantFailureOf,
  variantInstructionValid,
  variantLabel,
  variantMissing,
  variantNameValid,
  variantPath,
  type VariantRefusal,
} from "./agent-variant";

describe("variantNameValid", () => {
  it("accepts 1 to 40 letters, digits, spaces, underscores and hyphens that start with a letter", () => {
    expect(variantNameValid("Software Architecture")).toBe(true);
    expect(variantNameValid("a")).toBe(true);
    expect(variantNameValid("Review_2-fast")).toBe(true);
    expect(variantNameValid("a".repeat(40))).toBe(true);
  });

  it("refuses a blank name, a name above 40 characters and a bad first or other character", () => {
    expect(variantNameValid("")).toBe(false);
    expect(variantNameValid("a".repeat(41))).toBe(false);
    expect(variantNameValid("1st")).toBe(false);
    expect(variantNameValid(" Name")).toBe(false);
    expect(variantNameValid("Name!")).toBe(false);
    expect(variantNameValid("Café")).toBe(false);
    expect(variantNameValid("a  b")).toBe(false);
    expect(variantNameValid("a ")).toBe(false);
  });
});

describe("variantDraftFailureOf", () => {
  it("answers null for a valid draft", () => {
    expect(variantDraftFailureOf("Software Architecture", "Text.")).toBeNull();
  });

  it("answers the name line for a bad name", () => {
    expect(variantDraftFailureOf("Café", "Text.")).toEqual({
      field: "name",
      line: { code: null, message: VARIANT_NAME_RULE },
    });
  });

  it("answers the instruction line for a blank instruction", () => {
    expect(variantDraftFailureOf("Software Architecture", "  ")).toEqual({
      field: "instruction",
      line: { code: VALIDATION_FAILED, message: INSTRUCTION_LINE },
    });
  });

  it("answers the name line when the name and the instruction are both bad", () => {
    expect(variantDraftFailureOf("a  b", "")?.field).toBe("name");
  });
});

describe("variantInstructionValid", () => {
  it("refuses a blank instruction and one above 32768 UTF-8 bytes", () => {
    expect(variantInstructionValid("Text.")).toBe(true);
    expect(variantInstructionValid("a".repeat(32768))).toBe(true);
    expect(variantInstructionValid("é".repeat(16384))).toBe(true);
    expect(variantInstructionValid("  \n")).toBe(false);
    expect(variantInstructionValid("a".repeat(32769))).toBe(false);
    expect(variantInstructionValid("é".repeat(16385))).toBe(false);
  });
});

describe("variantMissing", () => {
  it("accepts a not_found answer and a malformed variant id answer only", () => {
    expect(variantMissing({ detail: "agent.variant.not_found", details: null })).toBe(true);
    expect(
      variantMissing({
        detail: "gateway.request.validation_failed",
        details: [{ path: ["params", "variant_id"], code: "custom" }],
      }),
    ).toBe(true);
    expect(
      variantMissing({
        detail: "gateway.request.validation_failed",
        details: [{ path: ["body", "instruction"], code: "custom" }],
      }),
    ).toBe(false);
    expect(variantMissing({ detail: "", details: undefined })).toBe(false);
  });
});

describe("variantPath", () => {
  it("encodes each segment", () => {
    expect(variantPath("swe@1", "agent_variant_1")).toBe(
      "/agents/swe%401/variants/agent_variant_1",
    );
  });
});

function refusal(
  code: string,
  message: string,
  status: number,
  detail = "",
  details?: unknown,
): VariantRefusal {
  return { code, message, status, detail, details };
}

describe("variantFailureOf", () => {
  it("puts a name_taken answer under the name field with its code first", () => {
    const error = refusal("conflict", "The name is taken.", 409, "agent.variant.name_taken");

    expect(variantFailureOf(error)).toEqual({
      field: "name",
      line: { code: "agent.variant.name_taken", message: "The name is taken." },
    });
  });

  it("puts a name_invalid answer under the name field", () => {
    const error = refusal("malformed", "Bad name.", 400, "agent.variant.name_invalid");

    expect(variantFailureOf(error).field).toBe("name");
  });

  it("puts an instruction validation answer under the editor with the fixed line", () => {
    const error = refusal(
      "malformed",
      "Request validation failed.",
      400,
      "gateway.request.validation_failed",
      [{ path: ["body", "instruction"], code: "custom" }],
    );

    expect(variantFailureOf(error)).toEqual({
      field: "instruction",
      line: { code: "gateway.request.validation_failed", message: INSTRUCTION_LINE },
    });
  });

  it("keeps a validation answer for another path on the form", () => {
    const error = refusal(
      "malformed",
      "Request validation failed.",
      400,
      "gateway.request.validation_failed",
      [{ path: ["body", "agent_name"], code: "custom" }],
    );

    expect(variantFailureOf(error)).toEqual({
      field: "form",
      line: {
        code: "gateway.request.validation_failed",
        message: "Request validation failed.",
      },
    });
  });

  it("falls back to the error code when the answer names no engine code", () => {
    const error = refusal("unreachable", "The daemon did not answer.", 0);

    expect(variantFailureOf(error).line.code).toBe("unreachable");
  });
});

describe("currentVariantOf", () => {
  const row = {
    id: "agent_variant_1",
    agent_name: "swe@1",
    display_name: "Software Architecture",
    instruction: "Text.",
    revision: 3,
  };

  it("reads the current row of a revision conflict", () => {
    expect(currentVariantOf({ current: row })).toEqual(row);
  });

  it("answers null when the details hold no complete row", () => {
    expect(currentVariantOf(undefined)).toBeNull();
    expect(currentVariantOf({})).toBeNull();
    expect(currentVariantOf({ current: { ...row, revision: "3" } })).toBeNull();
  });
});

describe("variantLabel", () => {
  it("names the variant and the display name of its base", () => {
    expect(variantLabel({ display_name: "Software Architecture" }, { displayName: "SWE" })).toBe(
      "Software Architecture (variant of SWE)",
    );
  });
});
