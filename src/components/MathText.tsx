import React, { useMemo } from 'react';
import katex from 'katex';
import { formatScienceNotation } from '../utils/scienceNotation';

interface MathTextProps {
  text: string | null | undefined;
  className?: string;
  inline?: boolean;
}

/**
 * Helper to safely render a LaTeX string with KaTeX
 */
function renderKatexSafe(mathCode: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(mathCode.trim(), {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false
    });
  } catch (err) {
    console.warn("KaTeX render notice:", err);
    return null;
  }
}

/**
 * Helper to parse and render styled HTML/markdown tags (underline <u>, bold <b>, etc.)
 */
function renderFormattedChunk(raw: string, baseKey: string): React.ReactNode {
  if (!raw) return null;
  // If no HTML/markdown tags, return formatted science notation
  if (!/<(?:u|ins|b|strong|i|em|mark)>|__/.test(raw)) {
    return formatScienceNotation(raw);
  }

  // Split by supported inline tags: <u>...</u>, <ins>...</ins>, <b>...</b>, <strong>...</strong>, <i>...</i>, <em>...</em>, <mark>...</mark>, __...__
  const tagRegex = /(<u>[\s\S]*?<\/u>|<ins>[\s\S]*?<\/ins>|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|<i>[\s\S]*?<\/i>|<em>[\s\S]*?<\/em>|<mark>[\s\S]*?<\/mark>|__[\s\S]+?__)/gi;
  const segments = raw.split(tagRegex);

  return segments.map((seg, sIdx) => {
    if (!seg) return null;
    const key = `${baseKey}-seg-${sIdx}`;

    // Underline: <u> or <ins> or __
    if (/^<u>[\s\S]*?<\/u>$/i.test(seg)) {
      const inner = seg.replace(/^<u>|<\/u>$/gi, '');
      return (
        <u key={key} className="underline underline-offset-4 decoration-2 decoration-indigo-600 dark:decoration-indigo-400 font-semibold select-text px-0.5">
          {formatScienceNotation(inner)}
        </u>
      );
    }
    if (/^<ins>[\s\S]*?<\/ins>$/i.test(seg)) {
      const inner = seg.replace(/^<ins>|<\/ins>$/gi, '');
      return (
        <u key={key} className="underline underline-offset-4 decoration-2 decoration-indigo-600 dark:decoration-indigo-400 font-semibold select-text px-0.5">
          {formatScienceNotation(inner)}
        </u>
      );
    }
    if (/^__[\s\S]+?__$/.test(seg)) {
      const inner = seg.slice(2, -2);
      return (
        <u key={key} className="underline underline-offset-4 decoration-2 decoration-indigo-600 dark:decoration-indigo-400 font-semibold select-text px-0.5">
          {formatScienceNotation(inner)}
        </u>
      );
    }

    // Bold: <b> or <strong>
    if (/^<b>[\s\S]*?<\/b>$/i.test(seg)) {
      const inner = seg.replace(/^<b>|<\/b>$/gi, '');
      return <strong key={key} className="font-bold select-text">{formatScienceNotation(inner)}</strong>;
    }
    if (/^<strong>[\s\S]*?<\/strong>$/i.test(seg)) {
      const inner = seg.replace(/^<strong>|<\/strong>$/gi, '');
      return <strong key={key} className="font-bold select-text">{formatScienceNotation(inner)}</strong>;
    }

    // Italic: <i> or <em>
    if (/^<i>[\s\S]*?<\/i>$/i.test(seg)) {
      const inner = seg.replace(/^<i>|<\/i>$/gi, '');
      return <em key={key} className="italic select-text">{formatScienceNotation(inner)}</em>;
    }
    if (/^<em>[\s\S]*?<\/em>$/i.test(seg)) {
      const inner = seg.replace(/^<em>|<\/em>$/gi, '');
      return <em key={key} className="italic select-text">{formatScienceNotation(inner)}</em>;
    }

    // Highlight / Mark
    if (/^<mark>[\s\S]*?<\/mark>$/i.test(seg)) {
      const inner = seg.replace(/^<mark>|<\/mark>$/gi, '');
      return <mark key={key} className="bg-amber-100 text-amber-900 rounded px-1">{formatScienceNotation(inner)}</mark>;
    }

    return <React.Fragment key={key}>{formatScienceNotation(seg)}</React.Fragment>;
  });
}

/**
 * MathText renders text containing LaTeX expressions (e.g. $x^2 + 5x = 0$, $$\frac{-b \pm \sqrt{D}}{2a}$$, or \frac{a}{b})
 * as well as scientific chemical formulas, powers, and underlined/formatted words (e.g. <u>كلمة</u>)
 * seamlessly within Arabic or English text using KaTeX and styled HTML elements.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '', inline = false }) => {
  const content = text || '';

  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Fast check: if no math, science, or HTML formatting tags, return plain text
    const hasMathOrScience = /[$|\\]|(\b(sqrt|frac|times|pm|approx|leq|geq|neq|alpha|beta|theta|pi|int|sum|lim|sin|cos|tan)\b)|[\^_{}]|[²³ⁿ⁺⁻√∞≈≠≤≥±×÷°]|(?:->|-->|=>|⟶|→|⇄)|\b[A-Z][a-z]?(?:\^)?[\+\-][1-9]|\b[1-9][\+\-]|\b(SO4|CO3|NO3|PO4|OH|NH4|H2O|CO2|O2|H2|Fe3O4|Fe304)[\+\-]?/i.test(content);
    const hasHtmlOrFormatting = /<(?:u|ins|b|strong|i|em|mark)>|__/.test(content);

    if (!hasMathOrScience && !hasHtmlOrFormatting && !content.includes('$')) {
      return content;
    }

    // 1. Split text by explicit delimiters $$...$$, $...$, \[...\], \(...\)
    const delimiterRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([^\n]+?\\\))/g;
    const initialParts = content.split(delimiterRegex);

    const processedParts: React.ReactNode[] = [];

    initialParts.forEach((part, idx) => {
      if (!part) return;

      let isBlockMath = false;
      let mathCode = '';
      let isDelimitedMath = false;

      if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
        isDelimitedMath = true;
        isBlockMath = true;
        mathCode = part.slice(2, -2).trim();
      } else if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
        isDelimitedMath = true;
        isBlockMath = true;
        mathCode = part.slice(2, -2).trim();
      } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        isDelimitedMath = true;
        isBlockMath = false;
        mathCode = part.slice(1, -1).trim();
      } else if (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4) {
        isDelimitedMath = true;
        isBlockMath = false;
        mathCode = part.slice(2, -2).trim();
      }

      if (isDelimitedMath) {
        const html = renderKatexSafe(mathCode, isBlockMath && !inline);
        if (html) {
          if (isBlockMath && !inline) {
            processedParts.push(
              <div
                key={`delim-${idx}`}
                dir="ltr"
                className="my-2 py-1 px-2 overflow-x-auto text-center font-serif text-slate-900 bg-slate-50/80 rounded-lg border border-slate-100"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } else {
            processedParts.push(
              <span
                key={`delim-${idx}`}
                dir="ltr"
                className="inline-block px-1 select-text font-serif text-slate-900"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
        } else {
          processedParts.push(<span key={`delim-${idx}`} className="font-mono text-sm">{part}</span>);
        }
        return;
      }

      // 2. Plain text chunk: check for embedded un-delimited LaTeX commands like \frac{a}{b}, \sqrt{x}, etc.
      const unescapedLatexRegex = /(\\(?:frac\{[^{}]*\}\{[^{}]*\}|sqrt\{[^{}]*\}|sqrt\[[^{}]*\]\{[^{}]*\}|binom\{[^{}]*\}\{[^{}]*\}|int_[^{}]*\^[^{}]*|sum_[^{}]*\^[^{}]*|lim_[^{}]*|vec\{[^{}]*\}|bar\{[^{}]*\}|hat\{[^{}]*\}|text\{[^{}]*\}|(?:alpha|beta|gamma|delta|Delta|theta|lambda|pi|omega|Omega|sigma|Sigma|times|pm|div|approx|neq|leq|geq|infty|rightarrow|leftarrow)\b))/g;

      const subChunks = part.split(unescapedLatexRegex);

      subChunks.forEach((subChunk, subIdx) => {
        if (!subChunk) return;

        if (unescapedLatexRegex.test(subChunk)) {
          const html = renderKatexSafe(subChunk, false);
          if (html) {
            processedParts.push(
              <span
                key={`sub-${idx}-${subIdx}`}
                dir="ltr"
                className="inline-block px-0.5 select-text font-serif text-slate-900"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
            return;
          }
        }

        // Apply formatting (underlines <u>...</u>, bold <b>...</b>, and scientific notation)
        const renderedChunk = renderFormattedChunk(subChunk, `text-${idx}-${subIdx}`);
        processedParts.push(
          <span key={`text-${idx}-${subIdx}`}>
            {renderedChunk}
          </span>
        );
      });
    });

    return processedParts;
  }, [content, inline]);

  if (inline) {
    return <span className={`inline-block ${className}`}>{renderedElements}</span>;
  }

  return <div className={`inline ${className}`}>{renderedElements}</div>;
};

