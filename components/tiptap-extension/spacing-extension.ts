import { Extension } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spacing: {
      setSpacing: (attrs: {
        lineHeight?: string | null
        spacingBefore?: string | null
        spacingAfter?: string | null
      }) => ReturnType
      unsetSpacing: () => ReturnType
    }
  }
}

const normalizeSpacingValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const Spacing = Extension.create({
  name: "spacing",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => normalizeSpacingValue(element.style.lineHeight),
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
          spacingBefore: {
            default: null,
            parseHTML: (element) => normalizeSpacingValue(element.style.marginTop),
            renderHTML: (attributes) => {
              if (!attributes.spacingBefore) return {}
              return { style: `margin-top: ${attributes.spacingBefore}` }
            },
          },
          spacingAfter: {
            default: null,
            parseHTML: (element) => normalizeSpacingValue(element.style.marginBottom),
            renderHTML: (attributes) => {
              if (!attributes.spacingAfter) return {}
              return { style: `margin-bottom: ${attributes.spacingAfter}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setSpacing:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", attrs) || commands.updateAttributes("heading", attrs),
      unsetSpacing:
        () =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", {
            lineHeight: null,
            spacingBefore: null,
            spacingAfter: null,
          }) ||
          commands.updateAttributes("heading", {
            lineHeight: null,
            spacingBefore: null,
            spacingAfter: null,
          }),
    }
  },
})

export default Spacing
