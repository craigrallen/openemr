const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

test('mobile patient record preserves Bootstrap row gutters instead of overflowing from .8rem padding', () => {
    const css = postcss.parse(fs.readFileSync(path.join(__dirname, '../../interface/clinical-workspace/workspace.css'), 'utf8'));
    let rule;
    css.walkRules('body.oe-clinical-record.oe-clinical-workspace #container_div', (candidate) => {
        if (candidate.parent.type === 'atrule' && candidate.parent.params === 'screen and (width <= 640px)') rule = candidate;
    });
    expect(rule).toBeDefined();
    const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
    expect(declarations).toMatchObject({ 'padding-left': '15px', 'padding-right': '15px' });
    expect(declarations.overflow).toBeUndefined();
    expect(declarations['overflow-x']).toBeUndefined();
});
