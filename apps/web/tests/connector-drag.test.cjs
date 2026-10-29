const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual geometry functions and both UI snapshot expressions without React.
const source = readFileSync(require.resolve('../components/board/board-document-page.tsx'), 'utf8');
const ast = ts.createSourceFile('board.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && !n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)).map(n => n.getText(ast)).join('\n');
const snapshots = [];
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'connectorWaypoints') {
    snapshots.push(node.initializer.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;

for (const [index, snapshot] of snapshots.entries()) {
  test(`drag entry ${index}: resolves implicit routes and snapshots both endpoints`, () => {
    const nodes = [{ id: 'a', x: 0, y: 0, width: 100, height: 100 }, { id: 'b', x: 400, y: 100, width: 100, height: 100 }];
    const connector = { id: 'c', routingMode: 'orthogonal', from: { nodeId: 'a', anchor: 'right' }, to: { nodeId: 'b', anchor: 'left' }, waypoints: [] };
    const context = vm.createContext({ CONNECTOR_ENDPOINT_STUB: 24, board: { nodes, connectors: [connector] }, dragNodeIds: ['a', 'b'], dragConnectorIds: [], activeMultiSelectedNodes: nodes, activeMultiSelectedConnectors: [] });
    vm.runInContext(js, context);
    const baseline = vm.runInContext(`var baseline = ${snapshot}; baseline.c`, context);
    assert.ok(baseline.length > 0);
    const result = vm.runInContext(`adaptConnectorsForMovedNodes(board.connectors, board.nodes.map(n => ({...n, x: n.x + 20, y: n.y + 30})), ['a', 'b'], baseline, {x: 20, y: 30}, true)[0].waypoints`, context);
    result.forEach((point, i) => {
      assert.equal(point.x - baseline[i].x, 20);
      assert.equal(point.y - baseline[i].y, 30);
    });
    assert.equal(connector.waypoints.length, 0);
  });
  test(`drag entry ${index}: external connector does not accumulate total displacement`, () => {
    const nodes = [{ id: 'a', x: 0, y: 0, width: 100, height: 100 }, { id: 'b', x: 400, y: 100, width: 100, height: 100 }];
    const connector = { id: 'c', routingMode: 'orthogonal', from: { nodeId: 'a', anchor: 'right' }, to: { nodeId: 'b', anchor: 'left' }, waypoints: [{ x: 124, y: 50 }, { x: 250, y: 50 }, { x: 250, y: 150 }, { x: 376, y: 150 }] };
    const context = vm.createContext({ CONNECTOR_ENDPOINT_STUB: 24, board: { nodes, connectors: [connector] }, dragNodeIds: ['a'], dragConnectorIds: [], activeMultiSelectedNodes: [nodes[0]], activeMultiSelectedConnectors: [] });
    vm.runInContext(js, context);
    vm.runInContext(`var baseline = ${snapshot}; var current = board.connectors;`, context);
    for (const dx of [10, 20, 20, 0]) {
      context.dx = dx;
      const result = vm.runInContext(`current = adaptConnectorsForMovedNodes(current, board.nodes.map(n => n.id === 'a' ? {...n, x: dx} : n), ['a'], baseline, {x: dx, y: 0}, true); current[0].waypoints[0].x`, context);
      assert.equal(result, 124 + dx);
    }
  });
}
