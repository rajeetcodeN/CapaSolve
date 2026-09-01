import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gantt")({
  beforeLoad: () => {
    throw redirect({ to: "/status" });
  },
  component: () => null,
});
