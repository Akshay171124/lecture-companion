from __future__ import annotations

import re
from typing import Iterable, Tuple


MARKER_RE = re.compile(r"^---\s+(page|slide)\s+(\d+)\s+---\s*$", re.IGNORECASE)


def split_by_markers(extracted_text: str) -> list[Tuple[str | None, str]]:
    """
    Returns list of (page_ref, text_block).
    page_ref like "page 3" or "slide 12".
    If no markers exist, returns [(None, full_text)].
    """
    lines = extracted_text.splitlines()
    blocks: list[Tuple[str | None, list[str]]] = []

    current_ref: str | None = None
    current_lines: list[str] = []

    found_any_marker = False

    for line in lines:
        m = MARKER_RE.match(line.strip())
        if m:
            found_any_marker = True
            # flush previous
            if current_lines:
                blocks.append((current_ref, current_lines))
                current_lines = []
            current_ref = f"{m.group(1).lower()} {m.group(2)}"
            continue
        current_lines.append(line)

    if current_lines:
        blocks.append((current_ref, current_lines))

    if not found_any_marker:
        return [(None, extracted_text)]

    # convert to text blocks
    out: list[Tuple[str | None, str]] = []
    for ref, ls in blocks:
        text = "\n".join(ls).strip()
        if text:
            out.append((ref, text))
    return out if out else [(None, extracted_text)]


def chunk_text(text: str, max_chars: int = 1400, overlap: int = 150) -> list[str]:
    """
    Simple char-based chunker that keeps chunks readable.
    max_chars ~ 1400 gives decent size for later LLM prompts.
    """
    t = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not t:
        return []

    chunks: list[str] = []
    i = 0
    n = len(t)

    while i < n:
        end = min(i + max_chars, n)
        chunk = t[i:end].strip()

        # try to cut on a paragraph boundary if possible
        if end < n:
            cut = chunk.rfind("\n\n")
            if cut >= max_chars * 0.6:
                chunk = chunk[:cut].strip()
                end = i + cut

        if chunk:
            chunks.append(chunk)

        if end >= n:
            break

        i = max(end - overlap, end)

    return chunks


def make_chunks(extracted_text: str) -> list[Tuple[str | None, str]]:
    """
    Returns list of (page_ref, chunk_text)
    """
    blocks = split_by_markers(extracted_text)
    out: list[Tuple[str | None, str]] = []
    for ref, block in blocks:
        for c in chunk_text(block):
            out.append((ref, c))
    return out
