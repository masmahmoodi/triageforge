import {
  render,
  screen
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { Button } from "../src/components/Button";

describe("Button", () => {
  it("calls the click handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Apply</Button>);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
