from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new))


replace_exact(
    "app/resolutions/page.tsx",
    'import { Reso, SessionUser, shortenedDel } from "@/db/types";',
    'import { Reso, SessionUser, shortenedDel } from "@/db/types";\nimport type { Json } from "@/db/supabase-database.types";',
)
replace_exact(
    "app/resolutions/page.tsx",
    '''const parseResoContent = (raw?: string | object | null) => {
  if (!raw) return undefined;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return undefined;
''',
    '''const parseResoContent = (raw?: Json): Record<string, unknown> | undefined => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return undefined;
''',
)
replace_exact(
    "app/speechrepo/page.tsx",
    'delegateID: speechIds.find((row) => row.speechID === speech.speechID)?.delegateID ?? speech.delegateID ?? "",',
    'delegateID: speechIds.find((row) => row.speechID === speech.speechID)?.delegateID ?? "",',
)
