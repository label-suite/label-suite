/**
 * The gallery's 無權限與找不到 section (design D8): the shared BlockedScreen
 * once per sample, with fixed sample text and identifiers. Kept apart from
 * dev-gallery-page.tsx so that page stays under its size ceiling
 * (eslint.config.js NAMED_EXEMPTIONS). The samples keep focus where it is
 * and use level-two titles, since the page has its own level-one title.
 */
import { Trans, useTranslation } from "react-i18next";

import { BlockedIdentifier, BlockedScreen } from "@/components/blocked-screen";

import { GallerySection } from "./gallery-section";
import {
  blockedLongIdentifier,
  blockedSampleIdentifier,
  blockedSampleValues,
  galleryItem,
  type BlockedSample,
} from "./variant-catalog";

const NAMESPACE = "devGallery";

/** Where every sample's one way back leads. */
const BACK_TO = "/dashboard/dashboard";

/** Props of {@link BlockedSampleItem}. */
interface BlockedSampleItemProps {
  /** Which sample to show. */
  sample: BlockedSample;
}

/** One sample: the denied screen, or the not-found screen with a short or long identifier. */
function BlockedSampleItem({ sample }: BlockedSampleItemProps) {
  const { t } = useTranslation(NAMESPACE);
  const kind = sample === "denied" ? "denied" : "notFound";
  const identifier = sample === "longIdentifier" ? blockedLongIdentifier : blockedSampleIdentifier;

  return (
    <div data-gallery-item={galleryItem("blocked-screen", "kind", sample)} className="min-w-0">
      <BlockedScreen
        kind={kind}
        title={t(`blocked.${kind}.title`)}
        description={
          <Trans
            t={t}
            i18nKey={`blocked.${kind}.description`}
            components={{ identifier: <BlockedIdentifier value={identifier} /> }}
          />
        }
        backTo={BACK_TO}
        backLabel={t("blocked.back")}
        headingLevel={2}
        focusOnMount={false}
      />
    </div>
  );
}

/** The 無權限與找不到 section; its count comes from the declared samples. */
export function BlockedSection() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <GallerySection
      id="blocked"
      title={t("sections.blocked")}
      meta={t("count.samples", { n: blockedSampleValues.length })}
    >
      {blockedSampleValues.map((sample) => (
        <BlockedSampleItem key={sample} sample={sample} />
      ))}
    </GallerySection>
  );
}
