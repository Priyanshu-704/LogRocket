const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CHAR_TO_INT: Record<string, number> = {};

for (let i = 0; i < CHARS.length; i++) {
  CHAR_TO_INT[CHARS[i]] = i;
}

function decodeVLQSegment(str: string): number[] {
  const result: number[] = [];
  let shift = 0;
  let value = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const integer = CHAR_TO_INT[char];
    if (integer === undefined) {
      throw new Error(`Invalid VLQ character: ${char}`);
    }
    
    const hasContinuationBit = integer & 32;
    value += (integer & 31) << shift;
    
    if (hasContinuationBit) {
      shift += 5;
    } else {
      const shouldNegate = value & 1;
      value >>>= 1;
      result.push(shouldNegate ? -value : value);
      
      value = 0;
      shift = 0;
    }
  }
  
  return result;
}

export interface OriginalPosition {
  source: string | null;
  line: number | null;
  column: number | null;
  name: string | null;
  sourceContent: string | null;
}

/**
 * Maps a generated line & column number back to its original source path and position.
 */
export function findOriginalPosition(
  rawMapJson: string,
  minifiedLine: number,
  minifiedColumn: number
): OriginalPosition | null {
  try {
    const map = JSON.parse(rawMapJson);
    const mappings = map.mappings;
    const sources = map.sources || [];
    const names = map.names || [];
    const sourcesContent = map.sourcesContent || [];

    const lines = mappings.split(';');
    const targetLineIdx = minifiedLine - 1; // Convert 1-based line to 0-based
    if (targetLineIdx < 0 || targetLineIdx >= lines.length) {
      return null;
    }

    let sourceIdx = 0;
    let originalLine = 0;
    let originalColumn = 0;
    let nameIdx = 0;

    for (let lineIdx = 0; lineIdx <= targetLineIdx; lineIdx++) {
      const lineStr = lines[lineIdx];
      const segments = lineStr.split(',');
      let generatedColumn = 0;

      const isTargetLine = lineIdx === targetLineIdx;
      let matchedSegment: {
        sourceIdx: number;
        originalLine: number;
        originalColumn: number;
        nameIdx: number;
      } | null = null;

      for (const segmentStr of segments) {
        if (!segmentStr) continue;
        const decoded = decodeVLQSegment(segmentStr);
        if (decoded.length < 4) {
          generatedColumn += decoded[0];
          continue;
        }

        generatedColumn += decoded[0];
        sourceIdx += decoded[1];
        originalLine += decoded[2];
        originalColumn += decoded[3];
        if (decoded.length === 5) {
          nameIdx += decoded[4];
        }

        if (isTargetLine) {
          if (generatedColumn <= minifiedColumn) {
            matchedSegment = {
              sourceIdx,
              originalLine,
              originalColumn,
              nameIdx
            };
          } else {
            break;
          }
        }
      }

      if (isTargetLine && matchedSegment) {
        const sourceFile = sources[matchedSegment.sourceIdx] || null;
        const sourceContent = sourcesContent[matchedSegment.sourceIdx] || null;
        return {
          source: sourceFile,
          line: matchedSegment.originalLine + 1, // Convert 0-based to 1-based
          column: matchedSegment.originalColumn + 1, // Convert 0-based to 1-based
          name: names[matchedSegment.nameIdx] || null,
          sourceContent
        };
      }
    }
  } catch (e) {
    console.error('[SourceMapParser] Failed to parse mapping:', e);
  }
  return null;
}
