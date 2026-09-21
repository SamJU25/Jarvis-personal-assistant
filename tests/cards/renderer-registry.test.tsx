import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RendererRegistry } from "@/components/cards/renderer-registry";
import { sampleScenarios } from "@/lib/mock/scenarios";

const cards = sampleScenarios.flatMap((scenario) => scenario.cards);

describe("RendererRegistry", () => {
  it.each(cards.map((card) => [card.type, card] as const))("renders the %s semantic card", (_, card) => {
    const { unmount } = render(<RendererRegistry card={card} />);
    expect(screen.getByText(card.label)).toBeInTheDocument();
    unmount();
  });
});
