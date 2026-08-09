import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { AuthProvider } from "../src/auth/AuthProvider";
import { AppShell } from "../src/components/AppShell";
import { LoginPage } from "../src/pages/LoginPage";

describe("logout navigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the login page immediately after logout succeeds", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(new Response(JSON.stringify({
        data: {
          user: {
            id: "93fdf904-6e30-4a85-8a53-cf165d852b2a",
            email: "user@example.com",
            name: "Test User",
            createdAt: "2026-08-08T00:00:00.000Z"
          },
          csrfToken: "csrf-token"
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    const router = createMemoryRouter([
      {
        path: "/",
        element: <AppShell />,
        children: [{ index: true, element: <div>Dashboard content</div> }]
      },
      { path: "/login", element: <LoginPage /> }
    ], { initialEntries: ["/"] });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Log out"));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });
});
