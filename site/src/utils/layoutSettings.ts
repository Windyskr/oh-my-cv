export type LayoutFieldDefinition = {
  selector: string;
  property: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  fallback: number;
  extra?: string;
};

export const layoutFields = {
  headingRuleGap: {
    selector: "h2",
    property: "padding-bottom",
    label: "toolbar.heading_spacing.rule_gap",
    min: 0,
    max: 50,
    step: 0.1,
    unit: "px",
    fallback: 2
  },
  headingContentGap: {
    selector: "h2",
    property: "margin-bottom",
    label: "toolbar.heading_spacing.content_gap",
    min: 0,
    max: 50,
    step: 0.1,
    unit: "px",
    fallback: 3
  },
  headingFontSize: {
    selector: "h2",
    property: "font-size",
    label: "toolbar.layout.heading_font_size",
    min: 8,
    max: 32,
    step: 0.1,
    unit: "px",
    fallback: 15
  },
  headingRuleWidth: {
    selector: "h2",
    property: "border-bottom-width",
    label: "toolbar.layout.rule_width",
    min: 0,
    max: 5,
    step: 0.1,
    unit: "px",
    fallback: 1.5
  },
  nameFontSize: {
    selector: ".resume-header h1",
    property: "font-size",
    label: "toolbar.layout.name_font_size",
    min: 12,
    max: 48,
    step: 0.1,
    unit: "px",
    fallback: 26
  },
  contactFontSize: {
    selector: ".resume-header-item",
    property: "font-size",
    label: "toolbar.layout.contact_font_size",
    min: 8,
    max: 24,
    step: 0.1,
    unit: "px",
    fallback: 14
  },
  headerTopGap: {
    selector: ".resume-header",
    property: "padding-top",
    label: "toolbar.layout.header_top_gap",
    min: 0,
    max: 200,
    step: 0.1,
    unit: "px",
    fallback: 28
  },
  headerMinHeight: {
    selector: ".resume-header",
    property: "min-height",
    label: "toolbar.layout.header_min_height",
    min: 0,
    max: 300,
    step: 0.1,
    unit: "px",
    fallback: 88
  },
  nameContactGap: {
    selector: ".resume-header h1",
    property: "margin-bottom",
    label: "toolbar.layout.name_contact_gap",
    min: 0,
    max: 50,
    step: 0.1,
    unit: "px",
    fallback: 4
  },
  headerSectionGap: {
    selector: ".resume-header + h2",
    property: "margin-top",
    label: "toolbar.layout.header_section_gap",
    min: 0,
    max: 50,
    step: 0.1,
    unit: "px",
    fallback: 1
  },
  paragraphAfterGap: {
    selector: "p",
    property: "margin-bottom",
    label: "toolbar.layout.paragraph_after_gap",
    min: 0,
    max: 30,
    step: 0.1,
    unit: "px",
    fallback: 3
  },
  listItemGap: {
    selector: "li",
    property: "margin-bottom",
    label: "toolbar.layout.list_item_gap",
    min: 0,
    max: 30,
    step: 0.1,
    unit: "px",
    fallback: 3
  },
  listIndent: {
    selector: "ul, ol",
    property: "padding-left",
    label: "toolbar.layout.list_indent",
    min: 0,
    max: 60,
    step: 0.1,
    unit: "px",
    fallback: 15.6
  },
  entryGap: {
    selector: "dl",
    property: "margin-bottom",
    label: "toolbar.layout.entry_gap",
    min: 0,
    max: 30,
    step: 0.1,
    unit: "px",
    fallback: 2
  },
  entryLineHeight: {
    selector: "dl",
    property: "line-height",
    label: "toolbar.layout.entry_line_height",
    min: 1,
    max: 3,
    step: 0.01,
    unit: "×",
    fallback: 1.3
  },
  photoWidth: {
    selector: ".resume-photo",
    property: "width",
    label: "toolbar.layout.width",
    min: 20,
    max: 200,
    step: 0.1,
    unit: "px",
    fallback: 80
  },
  photoHeight: {
    selector: ".resume-photo",
    property: "height",
    label: "toolbar.layout.height",
    min: 20,
    max: 280,
    step: 0.1,
    unit: "px",
    fallback: 112
  },
  logoWidth: {
    selector: ".university-logo",
    property: "width",
    label: "toolbar.layout.width",
    min: 20,
    max: 300,
    step: 0.1,
    unit: "px",
    fallback: 150,
    extra: "height: auto;"
  }
} as const satisfies Record<string, LayoutFieldDefinition>;

export type LayoutFieldKey = keyof typeof layoutFields;
export const layoutFieldKeys = Object.keys(layoutFields) as LayoutFieldKey[];
export const imageOffsetKeys = [
  "photoOffsetX",
  "photoOffsetY",
  "logoOffsetX",
  "logoOffsetY"
] as const;
export type OptionalLayoutKey = LayoutFieldKey | (typeof imageOffsetKeys)[number];
export type OptionalLayoutStyles = Partial<Record<OptionalLayoutKey, number>>;
export const optionalLayoutKeys: OptionalLayoutKey[] = [
  ...layoutFieldKeys,
  ...imageOffsetKeys
];

export const withOptionalLayoutStyles = <T extends object>(
  styles: T
): T & OptionalLayoutStyles => ({
  ...styles,
  ...Object.fromEntries(
    optionalLayoutKeys.map((key) => [key, (styles as OptionalLayoutStyles)[key]])
  )
});

export const validOptionalLayoutStyles = (styles: OptionalLayoutStyles) =>
  optionalLayoutKeys.every((key) => {
    const value = styles[key];
    const bounds =
      key in layoutFields ? layoutFields[key as LayoutFieldKey] : { min: -200, max: 200 };
    return (
      value === undefined ||
      (typeof value === "number" &&
        Number.isFinite(value) &&
        value >= bounds.min &&
        value <= bounds.max)
    );
  });

export const layoutStyleCss = (selector: string, styles: OptionalLayoutStyles) =>
  layoutFieldKeys
    .map((key) => {
      const value = styles[key];
      if (value === undefined) return "";
      const field: LayoutFieldDefinition = layoutFields[key];
      const targets = field.selector
        .split(",")
        .map(
          (target) =>
            `${selector} [data-scope="vue-smart-pages"][data-part="page"] ${target.trim()}`
        )
        .join(",");
      return `${targets} { ${field.property}: ${value}${field.unit === "×" ? "" : field.unit}; ${field.extra || ""} }`;
    })
    .join("");

export const measureLayoutField = (root: HTMLElement | null, key: LayoutFieldKey) => {
  const field = layoutFields[key];
  const element = root?.querySelector(field.selector);
  if (!element) return field.fallback;
  const computed = getComputedStyle(element);
  let value = parseFloat(computed.getPropertyValue(field.property));
  if (field.property === "line-height") value /= parseFloat(computed.fontSize);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : field.fallback;
};
