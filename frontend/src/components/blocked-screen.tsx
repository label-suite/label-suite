/**
 * The shared full-page "not found" and "denied" screen (spec 07-03; design
 * D1, D2, D4-D6). A page draws it in place of its content area once a read is
 * classified as denied or notFound. It has no text, destination or data of
 * its own: the page passes the translated title and description, the one way
 * back, and the identifier through {@link BlockedIdentifier}.
 */
import { useEffect, useId, useRef } from "react";
import type * as React from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Props of {@link BlockedScreen}. There is no `children`: exactly one way back. */
export interface BlockedScreenProps {
  /** Which of the two screens this is; drawn as `data-kind`. Both look the same. */
  kind: "notFound" | "denied";
  /** The translated title; one sentence that does not carry the identifier. */
  title: string;
  /** The translated description; holds a {@link BlockedIdentifier} when there is one. */
  description: React.ReactNode;
  /** The in-app path of the one way back. */
  backTo: string;
  /** The way back's label; it names the destination and is the link's accessible name. */
  backLabel: string;
  /** Heading level; 2 when the page keeps its own level-one header. Defaults to 1. */
  headingLevel?: 1 | 2;
  /** Move focus to the title on mount. Defaults to true. */
  focusOnMount?: boolean;
}

/** The full-page not-found or denied screen that replaces a page's content area. */
export function BlockedScreen({
  kind,
  title,
  description,
  backTo,
  backLabel,
  headingLevel = 1,
  focusOnMount = true,
}: BlockedScreenProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const Heading = headingLevel === 2 ? "h2" : "h1";

  useEffect(() => {
    if (focusOnMount) {
      headingRef.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <section aria-labelledby={headingId} data-kind={kind}>
      <Card className="gap-(--space-md) px-(--space-lg)">
        <Heading
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-(length:--text-body) font-bold text-foreground outline-none"
        >
          {title}
        </Heading>
        <p className="text-(length:--text-caption) text-muted-foreground">{description}</p>
        <div>
          <Button asChild variant="default" size="sm">
            <Link to={backTo}>{backLabel}</Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}

/** Props of {@link BlockedIdentifier}. */
export interface BlockedIdentifierProps {
  /** The identifier exactly as the user brought it in the URL; rendered as plain text. */
  value: string;
}

/**
 * The identifier inside a description: plain text in a bidirectional isolate,
 * wrapping at any character and never truncated (design D4).
 */
export function BlockedIdentifier({ value }: BlockedIdentifierProps) {
  return (
    <bdi data-slot="blocked-identifier" className="[overflow-wrap:anywhere]">
      {value}
    </bdi>
  );
}
