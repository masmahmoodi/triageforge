import { zodResolver } from "@hookform/resolvers/zod";
import type { ResolverOptions } from "react-hook-form";
import { describe, expect, it } from "vitest";

import {
  loginRequestSchema,
  registerRequestSchema
} from "@triageforge/contracts";

import webManifestRaw from "../package.json?raw";

type LoginValues = { email: string; password: string };

const resolverOptions = {
  criteriaMode: "firstError",
  fields: {},
  names: [],
  shouldUseNativeValidation: false
} as ResolverOptions<LoginValues>;

describe("@hookform/resolvers upgrade", () => {
  it("pins the patched v7 release in the web manifest", () => {
    const manifest = JSON.parse(webManifestRaw) as {
      dependencies: Record<string, string>;
    };

    expect(manifest.dependencies["@hookform/resolvers"]).toBe("^7.0.9");
  });

  it("still validates login credentials through the zod resolver", async () => {
    const resolver = zodResolver(loginRequestSchema);

    const result = await resolver(
      { email: "not-an-email", password: "" },
      undefined,
      resolverOptions
    );

    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
  });

  it("still returns parsed values for valid registration input", async () => {
    const resolver = zodResolver(registerRequestSchema);

    const result = await resolver(
      {
        email: "ada@example.com",
        name: "  Ada  ",
        password: "correct-horse-battery"
      },
      undefined,
      resolverOptions
    );

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({ name: "Ada" });
  });
});
