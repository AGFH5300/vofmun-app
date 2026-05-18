// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client"

import * as React from "react"
import { EditorContent, EditorContext, useEditor, Editor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Underline } from "@tiptap/extension-underline"

// --- Custom Extensions ---
import { Link } from "@/components/tiptap-extension/link-extension"
import { Selection } from "@/components/tiptap-extension/selection-extension"
import { TrailingNode } from "@/components/tiptap-extension/trailing-node-extension"
import { Spacing } from "@/components/tiptap-extension/spacing-extension"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockQuoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useMobile } from "@/hooks/use-mobile"
// Removed unused hook: useWindowSize
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Lib ---
// Removed unused import: MAX_FILE_SIZE

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"



const ClearFormattingButton = () => {
  const { editor } = React.useContext(EditorContext)
  if (!editor || !editor.isEditable) return null

  return (
    <Button
      type="button"
      data-style="ghost"
      tabIndex={-1}
      tooltip="Clear formatting"
      onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
    >
      <span className="tiptap-button-text">Clear</span>
    </Button>
  )
}

const SpacingDropdown = () => {
  const { editor } = React.useContext(EditorContext)
  const lineHeights = ["1.2", "1.35", "1.5", "1.75", "2"]
  const spacingValues = ["0", "0.35rem", "0.75rem", "1.25rem"]

  if (!editor || !editor.isEditable) return null

  const currentLineHeight = (editor.getAttributes("paragraph").lineHeight || editor.getAttributes("heading").lineHeight || "1.5").toString()
  const currentBefore = (editor.getAttributes("paragraph").spacingBefore || editor.getAttributes("heading").spacingBefore || "0").toString()
  const currentAfter = (editor.getAttributes("paragraph").spacingAfter || editor.getAttributes("heading").spacingAfter || "0").toString()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" data-style="ghost" tabIndex={-1} tooltip="Spacing">
          <span className="tiptap-button-text">Spacing</span>
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[200px] rounded-2xl border border-soft-ivory/80 bg-white/95 p-1 shadow-xl backdrop-blur-sm">
        <DropdownMenuGroup className="space-y-1">
          <div className="px-3 py-1 text-xs text-gray-500">Line height</div>
          {lineHeights.map((value) => (
            <DropdownMenuItem key={`lh-${value}`} asChild>
              <Button type="button" data-style="ghost" className="w-full justify-start gap-3 px-3 py-2 text-sm" data-active-state={currentLineHeight === value ? "on" : "off"} onClick={() => editor.chain().focus().setSpacing({ lineHeight: value }).run()}>
                {value}
              </Button>
            </DropdownMenuItem>
          ))}
          <div className="px-3 py-1 text-xs text-gray-500">Space before</div>
          {spacingValues.map((value) => (
            <DropdownMenuItem key={`sb-${value}`} asChild>
              <Button type="button" data-style="ghost" className="w-full justify-start gap-3 px-3 py-2 text-sm" data-active-state={currentBefore === value ? "on" : "off"} onClick={() => editor.chain().focus().setSpacing({ spacingBefore: value }).run()}>
                {value}
              </Button>
            </DropdownMenuItem>
          ))}
          <div className="px-3 py-1 text-xs text-gray-500">Space after</div>
          {spacingValues.map((value) => (
            <DropdownMenuItem key={`sa-${value}`} asChild>
              <Button type="button" data-style="ghost" className="w-full justify-start gap-3 px-3 py-2 text-sm" data-active-state={currentAfter === value ? "on" : "off"} onClick={() => editor.chain().focus().setSpacing({ spacingAfter: value }).run()}>
                {value}
              </Button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <BlockQuoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="underline" />
        <MarkButton type="strike" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="code" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <SpacingDropdown />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ClearFormattingButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

export interface SimpleEditorProps {
  content?: object
  className?: string
  placeholder?: string
}

export const SimpleEditor = React.forwardRef(function SimpleEditor({ content, className, placeholder }: SimpleEditorProps, ref: React.Ref<Editor | null>) {
    const isMobile = useMobile()
    const [mobileView, setMobileView] = React.useState<
      "main" | "highlighter" | "link"
    >("main")
    const toolbarRef = React.useRef<HTMLDivElement>(null)

    const extensions = React.useMemo(() => {
      const baseExtensions = [
        StarterKit,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Underline,
        Subscript,
        Superscript,
        Spacing,
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight.configure({ multicolor: true }),
        Typography,
        Selection,
        TrailingNode,
        Link.configure({ openOnClick: false }),
      ]

      if (placeholder) {
        baseExtensions.push(
          Placeholder.configure({
            placeholder,
            emptyEditorClass: "tiptap-editor-empty",
            showOnlyWhenEditable: true,
          })
        )
      }

      return baseExtensions
    }, [placeholder])

    const editor = useEditor({
      immediatelyRender: false,
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
          "aria-label": "Main content area, start typing to enter text.",
        },
      },
      extensions,
      content: content
    })

    React.useEffect(() => {
      if (editor && content) {
        editor.commands.setContent(content, false)
      }
    }, [content, editor])

    React.useImperativeHandle(ref, () => editor!, [editor])

    // Using useCursorVisibility without storing the result since we don't need the return value
    useCursorVisibility({
      editor,
      overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
    })

    React.useEffect(() => {
      if (!isMobile && mobileView !== "main") {
        setMobileView("main")
      }
    }, [isMobile, mobileView])

    return (
      <EditorContext.Provider value={{ editor }}>
        <div className={`editor-container ${className || ''}`}>
          <div className="content-wrapper">
              <Toolbar
                ref={toolbarRef}
                className="tiptap-toolbar speech-editor-toolbar"
                variant="fixed"
              >
                {mobileView === "main" ? (
                  <MainToolbarContent
                    onHighlighterClick={() => setMobileView("highlighter")}
                    onLinkClick={() => setMobileView("link")}
                    isMobile={isMobile}
                  />
                ) : (
                  <MobileToolbarContent
                    type={mobileView === "highlighter" ? "highlighter" : "link"}
                    onBack={() => setMobileView("main")}
                  />
                )}
              </Toolbar>

            <EditorContent
              editor={editor}
              role="presentation"
              className="simple-editor-content"
            />
          </div>
        </div>
      </EditorContext.Provider>
    )
  }
)
