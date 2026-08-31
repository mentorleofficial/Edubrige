import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import RecommendedMentors from "@/components/dashboards/mentee/RecommendedMentors";

const navigate = vi.fn();
const writeText = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/badges/MentorExpertiseTags", () => ({
  default: () => <div />,
}));

const MENTOR = {
  user_id: "mentor-1",
  full_name: "Asha Menon",
  avatar_url: null,
  current_role: "Staff Engineer",
  expertise: ["React"],
  years_experience: 8,
};

describe("RecommendedMentors card links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("copies the mentor profile URL, not the booking URL", async () => {
    render(<RecommendedMentors mentors={[MENTOR] as never} />);

    fireEvent.click(screen.getByLabelText("Copy share link"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/mentors/mentor-1`);
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining("/book/"));
  });

  it("still routes to the booking page when the card is clicked", () => {
    render(<RecommendedMentors mentors={[MENTOR] as never} />);

    fireEvent.click(screen.getByText("Asha Menon"));

    expect(navigate).toHaveBeenCalledWith("/book/mentor-1");
  });

  it("routes to the booking page from the Book button without copying", () => {
    render(<RecommendedMentors mentors={[MENTOR] as never} />);

    fireEvent.click(screen.getByRole("button", { name: "Book" }));

    expect(navigate).toHaveBeenCalledWith("/book/mentor-1");
    expect(writeText).not.toHaveBeenCalled();
  });
});
