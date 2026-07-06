import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StaffPerformanceTimeline from "./StaffPerformanceTimeline";

describe("StaffPerformanceTimeline", () => {
  it("uses the API at field for the event time", () => {
    const { container } = render(
      <StaffPerformanceTimeline
        timeline={[{
          at: "2026-04-11T10:30:00.000Z",
          score: 92,
          scoreDelta: 2,
          incidentId: "i1",
          eventType: "APPEAL_SCORE_REVERSED",
          note: "Phản hồi được chấp nhận",
        }]}
      />,
    );

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-04-11T10:30:00.000Z");
    expect(time).not.toHaveTextContent("Không rõ thời gian");
    expect(screen.getByText("Điểm: 92 (+2)")).toBeInTheDocument();
  });

  it("supports the legacy date field", () => {
    const { container } = render(
      <StaffPerformanceTimeline
        timeline={[{
          date: "2026-04-10T08:00:00.000Z",
          score: 90,
          scoreDelta: -2,
          incidentId: "i2",
        }]}
      />,
    );

    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-04-10T08:00:00.000Z",
    );
  });

  it("shows a safe fallback for an invalid timestamp", () => {
    render(
      <StaffPerformanceTimeline
        timeline={[{
          at: "invalid",
          score: 90,
          scoreDelta: 0,
          incidentId: "i3",
        }]}
      />,
    );

    expect(screen.getByText("Không rõ thời gian")).toBeInTheDocument();
  });
});
