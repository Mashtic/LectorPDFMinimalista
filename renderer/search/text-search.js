export function createSearchState() {
  return {
    query: "",
    matches: [],
    activeIndex: -1,
  };
}

export function buildPageIndex(textContent) {
  let pageText = "";
  const itemOffsets = [];
  let itemIndex = 0;

  for (const item of textContent.items) {
    if (item.str === undefined) continue;

    const start = pageText.length;
    pageText += item.str;
    itemOffsets.push({ itemIndex, start, end: pageText.length });
    itemIndex += 1;

    if (item.hasEOL) pageText += " ";
  }

  return { pageText, itemOffsets };
}


export function findMatchesInPage(pageIndex, query) {
  const { pageText, itemOffsets } = pageIndex;
  if (!query) return [];

  const haystack = pageText.toLowerCase();
  const needle = query.toLowerCase();
  const matches = [];

  let fromIndex = 0;
  let index = haystack.indexOf(needle, fromIndex);

  while (index !== -1) {
    const end = index + needle.length;
    matches.push({ start: index, end, segments: mapToSegments(index, end, itemOffsets) });
    fromIndex = end;
    index = haystack.indexOf(needle, fromIndex);
  }

  return matches;
}

function mapToSegments(start, end, itemOffsets) {
  return itemOffsets
    .filter((entry) => entry.start < end && entry.end > start)
    .map((entry) => ({
      itemIndex: entry.itemIndex,
      startInItem: Math.max(0, start - entry.start),
      endInItem: Math.min(entry.end, end) - entry.start,
    }));
}
