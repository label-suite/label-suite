import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle, alertVariantValues } from "./alert";

describe("Alert", () => {
  it("declares exactly the info, success, warning and error variants", () => {
    expect([...alertVariantValues]).toEqual(["info", "success", "warning", "error"]);
  });

  it("renders every declared variant as an alert with its title and description", () => {
    for (const variant of alertVariantValues) {
      const { unmount } = render(
        <Alert variant={variant}>
          <AlertTitle>{`${variant} title`}</AlertTitle>
          <AlertDescription>{`${variant} description`}</AlertDescription>
        </Alert>,
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("data-variant", variant);
      expect(alert).toHaveTextContent(`${variant} title`);
      expect(alert).toHaveTextContent(`${variant} description`);
      unmount();
    }
  });

  it("is info when no variant is given", () => {
    render(<Alert>Note</Alert>);
    expect(screen.getByRole("alert")).toHaveAttribute("data-variant", "info");
  });
});
