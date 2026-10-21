/**
 * @jest-environment node
 *
 * Source-driven synthetic DOM for the category admin template. This is not an
 * authenticated end-to-end test and never loads its external picker scripts.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const templatePath = path.join(__dirname, '../../templates/calendar/default/admin/submit_category.html.twig');
const source = () => fs.readFileSync(templatePath, 'utf8');

function newControl(markup) {
    const tag = markup.match(/<input\b[^>]*\bname="newcolor"[^>]*>/);
    if (!tag) throw new Error('newcolor control missing from shipped template');
    return tag[0];
}

function pickerLink(markup, target) {
    const links = [...markup.matchAll(/<a\b[^>]*\bonClick="[^"]+"[^>]*>/g)].map((match) => match[0]);
    const link = links.find((tag) => tag.includes(`'${target}'`));
    if (!link) throw new Error(`picker link missing for ${target}`);
    return link;
}

function mountNewForm(dom) {
    dom.window.document.body.innerHTML = `<form method="post">${newControl(source())}</form>`;
    return dom.window.document.querySelector('input[name="newcolor"]');
}

describe('category colour native input from the shipped Twig source', () => {
    let dom;

    afterEach(() => {
        if (dom) {
            dom.window.close();
            dom = undefined;
        }
    });

    test('rejects the old CSS variable value because native colour inputs sanitize it to black', () => {
        dom = new JSDOM('');
        const old = dom.window.document.createElement('input');
        old.type = 'color';
        old.value = 'var(--white)';
        expect(old.value).toBe('#000000');

        const input = mountNewForm(dom);
        expect(input.getAttribute('value')).toBe('#ffffff');
        expect(input.value).toBe('#ffffff');
    });

    test('native FormData preserves untouched, changed and reset newcolor values', () => {
        dom = new JSDOM('');
        const input = mountNewForm(dom);
        const form = input.form;
        const { FormData } = dom.window;
        expect(new FormData(form).get('newcolor')).toBe('#ffffff');
        input.value = '#12abef';
        expect(new FormData(form).get('newcolor')).toBe('#12abef');
        form.reset();
        expect(new FormData(form).get('newcolor')).toBe('#ffffff');
    });

    test('both translated captions have source labels associated with their actual control IDs', () => {
        const markup = source();
        expect(markup).toMatch(/<label\b[^>]*\bfor=['"]newcolor['"][^>]*>\s*\{\{ _PC_CAT_COLOR\|text \}\}\s*:?\s*<\/label>/);
        expect(markup).toMatch(/<label\b[^>]*\bfor=['"]color\[\{\{ cat\.id(?:\|attr)? \}\}\]['"][^>]*>\s*\{\{ _PC_CAT_COLOR\|text \}\}\s*:?\s*<\/label>/);
    });

    test('the actual inline pick and pickColor callbacks still target new and existing controls', () => {
        const markup = source();
        const script = markup.match(/<script>\s*([\s\S]*?)<\/script>/);
        if (!script) throw new Error('inline picker script missing');
        const existingInput = markup.match(/<input\b[^>]*\bname="color\[\]"[^>]*>/);
        if (!existingInput) throw new Error('existing colour control missing');
        const existingTag = existingInput[0].replace(/\{\{ cat\.id \}\}/g, '42').replace(/\{\{ cat\.color\|attr \}\}/g, '#12abEF');
        const existingLink = pickerLink(markup, 'color[{{ cat.id|attr }}]').replace(/\{\{ cat\.id\|attr \}\}/g, '42');
        const html = `<form>${newControl(markup)}${existingTag}${pickerLink(markup, 'newcolor')}${existingLink}</form>`;
        // jsdom compiles the real onClick attributes only with runScripts enabled.
        // This fixture contains no external scripts or HTTP endpoints.
        dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.invalid/' });
        const shows = [];
        dom.window.ColorPicker = class {
            show(anchor) { shows.push(anchor); }
        };
        const inlineScript = dom.window.document.createElement('script');
        inlineScript.textContent = script[1];
        dom.window.document.body.appendChild(inlineScript);

        for (const [target, color] of [['newcolor', '#ffffff'], ['color[42]', '#12abEF']]) {
            const link = [...dom.window.document.querySelectorAll('a')].find((a) => a.getAttribute('onclick').includes(`'${target}'`));
            expect(link).toBeDefined();
            link.click();
            expect(shows.at(-1)).toBe('pick');
            dom.window.pickColor(color);
            expect(dom.window.document.getElementById(target).value).toBe(color.toLowerCase());
        }
    });
});
