var DepGraph = require('dependency-graph').DepGraph;
var graph = new DepGraph();

graph.addNode('car');
graph.addNode('wheel');
graph.addNode('windows');
graph.addNode('frame');
graph.addNode('steel');
graph.addNode('plane');

graph.addDependency('car', 'windows');
graph.addDependency('car', 'frame');
graph.addDependency('car', 'wheel');
graph.addDependency('frame', 'steel');
graph.addDependency('plane', 'frame');
graph.addDependency('plane', 'windows');

graph.setNodeData('car', {'manuID': 123});

var dep;
dep = graph.dependenciesOf('car');
console.log(dep);

dep = graph.dependenciesOf('frame');
console.log(dep);

dep = graph.dependenciesOf('plane');
console.log(dep);

var makeorder = graph.overallOrder();
console.log(makeorder);

var id = graph.getNodeData('car');
console.log(id);
