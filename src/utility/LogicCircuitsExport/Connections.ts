import type { Node } from './Nodes.ts'

/*
Connections in the .lc file format link two nodes together.
They are defined in the fourth line of the .lc file in the following format:
  [{<sourceNodeIndex>,<targetNodeIndex>} ; ... ]

For example [{0,1}] defines a connection from the node with the ID 0 to the node with the ID 1.
 */
export class Connection{
  from:Node;
  to:Node;

  /**
   * Creates a Connection between two nodes and adds it to the fileConnections list of the source node's element
   * @param from
   * @param to
   */
  constructor(from:Node, to:Node) {
    this.from = from;
    this.to = to;
    from.fileConnections.push(this);
  }

  /**
   * Converts the Connection instance to its string representation in the .lc file format.
   * @returns {string} {<sourceNodeIndex>,<targetNodeIndex>}
   */
  toString():string{
      return '{'+this.from.getID()+','+this.to.getID()+'}';
  }
}
