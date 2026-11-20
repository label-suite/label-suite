import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("renders its header, content and footer in order", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Actions</CardFooter>
      </Card>,
    );
    const card = screen.getByTestId("card");

    expect(card).toHaveTextContent(/^Card titleDescriptionBodyActions$/);
    expect(card.querySelector('[data-slot="card-header"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="card-content"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="card-footer"]')).not.toBeNull();
  });
});
