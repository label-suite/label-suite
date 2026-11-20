import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./providers";

function Probe() {
  const client = useQueryClient();
  const { t } = useTranslation();
  const retry = String(client.getDefaultOptions().queries?.retry);
  return <p>{`${t("documentTitle", { page: "X" })} retry=${retry}`}</p>;
}

describe("AppProviders", () => {
  it("gives its children the query client and the i18n instance", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByText("Label Suite — X retry=false")).toBeInTheDocument();
  });
});
