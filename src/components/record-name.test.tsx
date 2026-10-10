import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordName } from "./record-name";

describe("RecordName", () => {
  it("renders a record name as strong text inside prose", () => {
    render(
      <p>
        Archive <RecordName>openai-main</RecordName> now.
      </p>,
    );

    expect(screen.getByText("openai-main").tagName).toBe("STRONG");
  });
});
