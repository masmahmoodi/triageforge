import { describe, expect, it } from "vitest";

import { ArchiveArrowUp, ArchiveArrowUpIcon } from "lucide-react";

describe("lucide-react icon exports", () => {
  it("exposes the renamed archive-arrow-up icon", () => {
    expect(ArchiveArrowUp).toBeDefined();
    expect(ArchiveArrowUpIcon).toBe(ArchiveArrowUp);
  });
});
