"use strict";

// Static audit of how the SDK writes into cells. Every `.setValue(<argument>)` whose argument can
// carry text from the API or from another cell must go through safeText(); the only exceptions are
// text that starts with fixed words, numbers/dates/JSON the SDK produces itself, and the link
// formulas, which are built on purpose with every received part escaped by formulaText().

const PRODUCED_BY_THE_SDK = /^(stringToCurrency|formatToLocalDatetime|parseInt|parseFloat|Number|JSON\.stringify)$|^Math\.\w+$/;

// Replaces comments with spaces (keeping line breaks and offsets) without touching strings.
function blankComments(code) {
  let result = "";
  let quote = null;
  for (let index = 0; index < code.length; index++) {
    const char = code[index];
    const next = code[index + 1];
    if (quote) {
      result += char;
      if (char === "\\") {
        result += code[++index] || "";
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === "/" && next === "/") {
      while (index < code.length && code[index] !== "\n") {
        result += " ";
        index++;
      }
      index--;
    } else if (char === "/" && next === "*") {
      const end = code.indexOf("*/", index + 2);
      const stop = end === -1 ? code.length : end + 2;
      result += code.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop - 1;
    } else {
      if (char === '"' || char === "'" || char === "`") quote = char;
      result += char;
    }
  }
  return result;
}

// Index right after the parenthesis that closes the one opened just before `start`.
function closingParenthesis(text, start) {
  let depth = 1;
  let quote = null;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")" && --depth === 0) {
      return index;
    }
  }
  return -1;
}

function findSetValueCalls(code) {
  const scanned = blankComments(code);
  const calls = [];
  const pattern = /\.setValue\s*\(/g;
  let match;
  while ((match = pattern.exec(scanned)) !== null) {
    const start = match.index + match[0].length;
    const end = closingParenthesis(scanned, start);
    calls.push({start, end, argument: code.slice(start, end)});
  }
  return calls;
}

// `name(...)` and nothing else: the call that opens the expression is also the one that closes it.
function singleCall(text) {
  const match = text.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/);
  if (!match) return null;
  return closingParenthesis(text, match[0].length) === text.length - 1 ? match[1] : null;
}

// Splits at the operators that are not inside parentheses or strings.
function splitOnOperators(text) {
  const terms = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (depth === 0 && index > start && "*/+-".includes(char)) {
      terms.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  terms.push(text.slice(start).trim());
  return terms;
}

// Numbers and calls that produce numbers or dates, combined with arithmetic.
function isNumericExpression(text) {
  return splitOnOperators(text).every(term => /^\d+(\.\d+)?$/.test(term) || PRODUCED_BY_THE_SDK.test(singleCall(term) || ""));
}

// Arguments the SDK computes itself, as numbers or as fixed text: they cannot carry text from outside.
const COMPUTED_BY_THE_SDK = new Set([
  "sdkViewChargeEvent.js: nominalAmount", "sdkViewChargeEvent.js: deltaAmount", "sdkViewChargeEvent.js: fine", "sdkViewChargeEvent.js: interest",
  "utilsBase.js: headers[i]",
  'sdkViewStatement.js: getTransactionType(transact["source"].split("/")[0])',
  'sdkViewStatement.js: sign*stringToCurrency(transact["amount"])',
]);

function isSafeByForm(argument, file = "") {
  const text = argument.trim();
  if (text === "null" || text === "true" || text === "false" || text === '""' || text === "''" || /^-?\d+(\.\d+)?$/.test(text)) return true;
  if (isNumericExpression(text)) return true;
  if (COMPUTED_BY_THE_SDK.has(`${file}: ${text}`)) return true;
  if (/^pdfLink$/.test(text)) return true;
  // Fixed text that opens the value: what follows cannot start a formula, unless the text itself
  // is empty or starts like one, and it must be a concatenation (not a condition or anything else).
  const literal = text.match(/^(["'])((?:\\.|(?!\1).)*)\1\s*(\+|$)/);
  return Boolean(literal) && literal[2] !== "" && !/^[=+\-@]/.test(literal[2]);
}

function isWrapped(argument) {
  const text = argument.trim();
  return singleCall(text) === "safeText";
}

// Calls whose argument still needs safeText().
function unprotectedCalls(code, file = "") {
  return findSetValueCalls(code).filter(({argument}) => !isWrapped(argument) && !isSafeByForm(argument, file));
}

// Ways of writing into cells that this audit does not understand: a new one must be reviewed.
function unauditedWrites(code) {
  const scanned = blankComments(code);
  const found = [];
  for (const match of scanned.matchAll(/\.(setValues|setFormula|setFormulas|setNote|setNotes|setRichTextValue|setRichTextValues|appendRow|insertSheet|copyTo)\s*\(/g)) {
    found.push(match[0]);
  }
  for (const match of scanned.matchAll(/\bsetValue\b(?!\s*\()|\.setValue\s*\(/g)) {
    // `.setValue(` is audited above; any other mention (alias, bind, ["setValue"]) is not.
    if (!match[0].startsWith(".")) found.push(match[0]);
  }
  return found;
}

// Every `pdfLink = <expression>` formula must be made of fixed text, the hostname of the
// environment, and parts escaped with formulaText().
function unescapedLinkFormulas(code) {
  const problems = [];
  for (const match of blankComments(code).matchAll(/\bpdfLink\s*=\s*([^;\n]+);/g)) {
    const parts = match[1].split(/\s\+\s|\+(?=\s*["'])|(?<=["'])\s*\+/).map(part => part.trim()).filter(Boolean);
    for (const part of parts) {
      const fixed = /^(["'])(?:\\.|(?!\1).)*\1$/.test(part);
      if (!fixed && part !== "hostname" && !/^formulaText\(.*\)$/.test(part)) problems.push(part);
    }
  }
  return problems;
}

// Statements that build a request URL out of a variable without pathSegment()/queryValue(): the
// statement mentions a fetch call (or a path/url variable), a literal that starts like a path, and
// something added to it (concatenation or a template placeholder). Link formulas are checked apart.
function unprotectedUrlBuilders(code) {
  const problems = [];
  for (const statement of blankComments(code).split(/;|\n\s*\n/)) {
    const text = statement.trim().replace(/\s+/g, " ");
    const buildsAnUrl = /\b(fetch|fetchBuffer|maskFetch)\(|\b(path|url|endpoint)\s*=[^=]/.test(text);
    const startsAPath = /["'`]\/[A-Za-z$-]/.test(text);
    const addsAValue = /["'`]\s*\+|\+\s*["'`(]|\$\{|\.concat\(/.test(text);
    if (buildsAnUrl && startsAPath && addsAValue && !text.includes("HYPERLINK") && !/pathSegment\(|queryValue\(/.test(text)) problems.push(text);
  }
  return problems;
}

module.exports = {blankComments, isSafeByForm, unprotectedCalls, unauditedWrites, unescapedLinkFormulas, unprotectedUrlBuilders};
