/*
 * Dependency-free source helpers for tests/js/custom-button-popup.test.js.
 *
 * Pure functions only: no filesystem, process, network or package access. The
 * CSS reader is deliberately small; it understands the subset the planned
 * route-local stylesheet may use (comments, @media blocks, rules, declarations
 * with !important) and reports anything it cannot balance instead of guessing.
 */

'use strict';

const count = (text, part) => (part === '' ? 0 : text.split(part).length - 1);

// Replace block comments with spaces of equal length, keeping newlines and offsets.
const blankComments = text => text.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));

// Split on a separator character outside quotes, parentheses and brackets.
function splitTopLevel(text, separator) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '(' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === ']') {
            depth--;
        } else if (ch === separator && depth === 0) {
            parts.push(text.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(text.slice(start));
    return parts;
}

// Index of the brace closing the block opened at `open`, or -1 when unbalanced.
function matchingBrace(text, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function parseDeclarations(body) {
    return splitTopLevel(body, ';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const colon = part.indexOf(':');
            const prop = part.slice(0, colon).trim().toLowerCase();
            let value = part.slice(colon + 1).trim();
            const important = /!\s*important$/i.test(value);
            if (important) value = value.replace(/\s*!\s*important$/i, '');
            return { prop, value, important, malformed: colon <= 0 };
        });
}

/**
 * Parse CSS into { rules, atRules, topLevel, errors }. Each rule carries its
 * selectors, declarations and the chain of enclosing at-rules.
 */
function parseCss(source) {
    const rules = [];
    const atRules = [];
    const topLevel = [];
    const errors = [];

    const walk = (text, parents, depth) => {
        let i = 0;
        while (i < text.length) {
            const rest = text.slice(i);
            const lead = rest.search(/\S/);
            if (lead === -1) return;
            i += lead;
            const brace = text.indexOf('{', i);
            const semi = text.indexOf(';', i);
            if (semi !== -1 && (brace === -1 || semi < brace)) {
                const statement = text.slice(i, semi).trim();
                if (statement.startsWith('@')) {
                    const [, name = '', params = ''] = /^@([\w-]+)\s*([\s\S]*)$/.exec(statement) || [];
                    const node = { type: 'atrule', name: name.toLowerCase(), params: params.trim(), parents, block: false };
                    atRules.push(node);
                    if (depth === 0) topLevel.push(node);
                } else {
                    errors.push(`stray statement: ${statement}`);
                }
                i = semi + 1;
                continue;
            }
            if (brace === -1) {
                errors.push(`trailing text: ${text.slice(i).trim()}`);
                return;
            }
            const close = matchingBrace(text, brace);
            if (close === -1) {
                errors.push('unbalanced braces');
                return;
            }
            const prelude = text.slice(i, brace).trim();
            const body = text.slice(brace + 1, close);
            if (prelude.startsWith('@')) {
                const [, name = '', params = ''] = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude) || [];
                const node = { type: 'atrule', name: name.toLowerCase(), params: params.trim().replace(/\s+/g, ' '), parents, block: true };
                atRules.push(node);
                if (depth === 0) topLevel.push(node);
                walk(body, [...parents, node], depth + 1);
            } else {
                const selectors = splitTopLevel(prelude, ',').map(sel => sel.trim().replace(/\s+/g, ' '));
                const decls = parseDeclarations(body);
                if (body.includes('{')) errors.push(`nested rule inside ${prelude}`);
                for (const decl of decls) if (decl.malformed) errors.push(`malformed declaration in ${prelude}`);
                const node = { type: 'rule', selectors, decls, parents };
                rules.push(node);
                if (depth === 0) topLevel.push(node);
            }
            i = close + 1;
        }
    };

    walk(blankComments(source), [], 0);
    return { rules, atRules, topLevel, errors };
}

// Declarations by selector: { selector: { prop: 'value[ !important]' } }, later rules win.
function declarationMap(parsed) {
    const map = {};
    for (const rule of parsed.rules) {
        for (const selector of rule.selectors) {
            map[selector] = map[selector] || {};
            for (const decl of rule.decls) map[selector][decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`;
        }
    }
    return map;
}

/**
 * Selector specificity [ids, classes/attributes/pseudo-classes, types/pseudo-elements].
 * :not()/:is()/:has() take their most specific argument, :where() counts zero.
 */
function specificity(selector) {
    const total = [0, 0, 0];
    const add = value => value.forEach((part, index) => { total[index] += part; });
    const greater = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
    let text = selector.replace(/"[^"]*"|'[^']*'/g, '""');
    // Functional pseudo-classes, innermost first.
    for (;;) {
        const match = /:(not|is|has|where)\(([^()]*)\)/i.exec(text);
        if (!match) break;
        if (match[1].toLowerCase() !== 'where') {
            const best = splitTopLevel(match[2], ',').map(arg => specificity(arg.trim())).sort(greater).reverse()[0];
            if (best) add(best);
        }
        text = text.slice(0, match.index) + text.slice(match.index + match[0].length);
    }
    total[0] += count(text.replace(/\[[^\]]*\]/g, ''), '#');
    total[1] += (text.match(/\[[^\]]*\]/g) || []).length;
    text = text.replace(/\[[^\]]*\]/g, '');
    total[1] += (text.match(/\.[\w-]+/g) || []).length;
    total[2] += (text.match(/::[\w-]+/g) || []).length;
    total[1] += (text.replace(/::[\w-]+/g, '').match(/:[\w-]+/g) || []).length;
    total[2] += (text.replace(/[.#:][\w-]+/g, ' ').match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
    return total;
}

const compareSpecificity = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);

const FONT_PROPS = /^(?:font(?:-[\w-]+)?|line-height|letter-spacing|text-transform|word-spacing)$/;
const TOKEN_ONLY_PROPS = ['color', 'background-color', 'border-color'];

/**
 * Stylesheet invariants for the planned custom-button sheet. Returns a list of
 * human-readable violations; an empty list means the sheet complies.
 */
function stylesheetViolations(source, { scope, importantAllowlist, tokens }) {
    const violations = [];
    const parsed = parseCss(source);
    violations.push(...parsed.errors);

    // One top-level screen-only @media block, nothing else at the top level.
    const top = parsed.topLevel;
    if (top.length !== 1 || top[0].type !== 'atrule' || top[0].name !== 'media' || top[0].params !== 'screen') {
        violations.push('sheet must be exactly one top-level @media screen block');
    }
    for (const atRule of parsed.atRules) {
        if (atRule.name !== 'media') violations.push(`unexpected @${atRule.name}`);
        if (/\bprint\b/.test(atRule.params)) violations.push('print media rule');
        if (/\(\s*[\w-]*width\s*[<>=]|[<>=]=?\s*[\w-]*width\s*\)|\(\s*\d[\w.]*\s*[<>]/.test(atRule.params)) {
            violations.push(`range media syntax: ${atRule.params}`);
        }
    }

    const allowed = new Set(importantAllowlist.map(([selector, prop]) => `${selector}|${prop}`));
    for (const rule of parsed.rules) {
        const inScreen = rule.parents.length > 0 && rule.parents[0].name === 'media' && rule.parents[0].params === 'screen';
        if (!inScreen) violations.push(`rule outside @media screen: ${rule.selectors.join(', ')}`);

        const focusVisible = rule.selectors.filter(sel => sel.includes(':focus-visible'));
        if (focusVisible.length && focusVisible.length !== rule.selectors.length) {
            violations.push(`:focus-visible shares a selector list: ${rule.selectors.join(', ')}`);
        }

        for (const selector of rule.selectors) {
            if (selector !== scope && !selector.startsWith(`${scope} `)) violations.push(`unscoped selector: ${selector}`);
            if (/\):not\(/.test(selector)) violations.push(`chained :not() instead of complex :not(): ${selector}`);
            if (/:focus(?!-visible)/.test(selector) && selector.includes(':focus-visible')) {
                violations.push(`:focus and :focus-visible mixed: ${selector}`);
            }
            if (/(?:^|\s)\.text(?:[\s.:[]|$)|\.table-responsive/.test(selector)) violations.push(`targets theme/overflow wrapper: ${selector}`);
        }

        const props = new Set(rule.decls.map(decl => decl.prop));
        if (props.has('color') !== props.has('background-color')) {
            violations.push(`unpaired ink/paper: ${rule.selectors.join(', ')}`);
        }
        for (const decl of rule.decls) {
            const where = `${rule.selectors.join(', ')} { ${decl.prop} }`;
            if (FONT_PROPS.test(decl.prop)) violations.push(`font change: ${where}`);
            if (decl.prop === 'background') violations.push(`background shorthand: ${where}`);
            if (/^(?:display|visibility|overflow(?:-[xy])?|position|min-width|max-width|width|height|flex[\w-]*)$/.test(decl.prop)) {
                violations.push(`layout/overflow change: ${where}`);
            }
            if (/^outline(?:-style|-width)?$/.test(decl.prop) && /^(?:none|0(?:px)?)(?:\s|$)/.test(decl.value)) violations.push(`outline removed: ${where}`);
            if (decl.prop === 'outline' && !/^\d+px solid var\(--oe-wb-[\w-]+\)$/.test(decl.value)) violations.push(`outline not a token ring: ${where}`);
            if (/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black|red|blue|gray|grey)\b/i.test(decl.value)) violations.push(`literal colour: ${where}`);
            if (/url\(|@import/i.test(decl.value)) violations.push(`external resource: ${where}`);
            for (const [, token] of decl.value.matchAll(/var\((--[\w-]+)/g)) {
                if (!tokens.includes(token)) violations.push(`unknown token ${token}: ${where}`);
            }
            if (TOKEN_ONLY_PROPS.includes(decl.prop) && !/^var\(--oe-wb-[\w-]+\)$/.test(decl.value)) {
                violations.push(`paint not a palette token: ${where}`);
            }
            if (decl.important) {
                for (const selector of rule.selectors) {
                    if (!allowed.has(`${selector}|${decl.prop}`)) violations.push(`unexpected !important: ${selector} { ${decl.prop} }`);
                }
            }
        }
    }
    return violations;
}

// Two-space nesting: @media at column 0, selectors at 2, declarations at 4.
function indentationViolations(source) {
    const violations = [];
    blankComments(source).split('\n').forEach((line, index) => {
        if (line.trim() === '') return;
        if (/\t/.test(line)) violations.push(`tab on line ${index + 1}`);
        const indent = line.length - line.trimStart().length;
        const text = line.trim();
        let expected;
        if (text.startsWith('@media')) expected = 0;
        else if (text === '}') expected = indent === 0 ? 0 : 2;
        else if (/^[\w-]+\s*:\s.*;$/.test(text) && !/[{,]$/.test(text)) expected = 4;
        else expected = 2;
        if (indent !== expected) violations.push(`line ${index + 1} indented ${indent}, expected ${expected}`);
    });
    return violations;
}

/**
 * Undo [original, planned] edits on a source. Returns null when any planned
 * text is missing or ambiguous, so callers assert rather than catch.
 */
function restore(text, edits) {
    let restored = text;
    for (const [original, planned] of edits) {
        if (count(restored, planned) !== 1) return null;
        restored = restored.replace(planned, () => original);
    }
    return restored;
}

// Apply [original, planned] edits; null when an original is missing or ambiguous.
function apply(text, edits) {
    let applied = text;
    for (const [original, planned] of edits) {
        if (count(applied, original) !== 1) return null;
        applied = applied.replace(original, () => planned);
    }
    return applied;
}

const PHP_BLOCK = /<\?php[\s\S]*?\?>/g;
const CONTROL_KEYS = ['name', 'type', 'value', 'readonly', 'style', 'size', 'id', 'method', 'action', 'onsubmit', 'title'];

// Every form/input with its contract attributes; PHP blocks kept verbatim so escaping is compared too.
function controls(source) {
    const markup = source.slice(source.indexOf('<html>'));
    const placeholders = [];
    const flat = markup.replace(PHP_BLOCK, block => `\u0000${placeholders.push(block) - 1}\u0000`);
    const unflatten = value => value.replace(/\u0000(\d+)\u0000/g, (_, n) => placeholders[Number(n)]);
    return [...flat.matchAll(/<(form|input|select|textarea|button)\b([^>]*)>/g)].map(([, tag, attrs]) => {
        const control = { tag };
        for (const [, key, double, single] of attrs.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
            if (CONTROL_KEYS.includes(key.toLowerCase())) control[key.toLowerCase()] = unflatten(double ?? single ?? '');
        }
        return control;
    });
}

module.exports = {
    count,
    parseCss,
    declarationMap,
    specificity,
    compareSpecificity,
    stylesheetViolations,
    indentationViolations,
    restore,
    apply,
    controls,
};
