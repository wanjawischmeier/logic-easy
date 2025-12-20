import { Connection } from './Connections.ts'
/**
 * A node can be either a FreeConnector or an ElementConnector
 */
export type Node = FreeConnector | ElementConnector | Connector;

/**
 To create connections in Logic Circuit, two components are needed: Nodes and Connections

 Node represent the connection points, they can either be free floating points (FreeConnector) or the ones that are directly attached to an Element (ElementConnector).

 These nodes are defined in the third line of the .lc file in two different formats:
  - FreeConnector: {<xPOS>,<yPOS>}
  - ElementConnector: {<elementID><'i'/'o'><portID>}
      - elementID: the ID of the element this connector belongs to
      - 'i' or 'o': whether this connector is an input ('i') or output ('o')
      - portID: the specific port number on the element (starting from 0)

 The defined nodes in the file can look like this:
  [{0o0};
  {400,160}]
  {0o0} is an ElementConnector for element with ID 0, output port 0
  {400,160} is a FreeConnector at position (400,160)

Connections link these nodes together, they are defined in the fourth line of the .lc file in the following format:
  [{<sourceNodeIndex>,<targetNodeIndex>} ; ... ]

  For example [{0,1}] defines a connection from the node with the ID 0 to the node with the ID 1.

Targets of nodes can be added for each node, out of these targets connections are automatically generated
 */
export class Connector{
  targets:Node[]
  nodeID:number;

  fileNodes:Node[];
  fileConnections:Connection[];

  /**
   *
   * @param fileNodes
   * @param fileConnections
   */
  constructor(fileNodes:Node[], fileConnections:Connection[]) {
    this.fileNodes = fileNodes;
    this.fileConnections = fileConnections;

    this.targets = [];
    this.fileNodes.push(this)
    this.nodeID = this.fileNodes.length-1 //get index in nodes list
  }

  /**
   * adds target node, used to automatically generate connections between nodes
   * @param target
   */
  addTarget(target:Node){
    this.targets.push(target);
    new Connection(this, target);
  }

  /**
   * @return ID of the node
   * can be referenced in connections
   */
  getID():number{
    return this.nodeID;
  }
}


export class FreeConnector extends Connector{
  xPOS:number|null;
  yPOS:number|null;

  /**
   * @param xPOS (free on canvas)
   * @param yPOS (free on canvas)
   * @param fileNodes
   * @param fileConnections
   */
  constructor(xPOS:number, yPOS:number, fileNodes:Node[], fileConnections:Connection[]) {
    super(fileNodes, fileConnections);
    this.xPOS = xPOS;
    this.yPOS = yPOS;
  }


  /**
   * Converts FreeConnector Node to .lc file format {<xPOS>,<yPOS>}
   * @return string {<yPOS>,<yPOS>}
   */
  toString():string{
    return '{'+this.xPOS+','+this.yPOS+'}'
  }
}

export class ElementConnector extends Connector{
  elementID:number; // elementID is position of the element in .lc file element array
  output:( 'i' | 'o'); // 'i' for input, 'o' for output
  portID:number; // portID is the specific port number on the element (starting from 0)

  /**
   * @param elementID
   * @param portID
   * @param output
   * @param fileNodes
   * @param fileConnections
   */
  constructor(elementID:number, portID:number, output:boolean, fileNodes:Node[], fileConnections:Connection[]) {
    super(fileNodes, fileConnections);
    this.elementID = elementID;
    this.output = output ? 'o' : 'i';
    this.portID = portID;
  }

  /**
   * converts ElementConnector node to .lc file Format {<elementID>,<type(i/o)>,<portID>}
   * @return string {<elementID><'i'/'o'><portID>}
   */
  toString(){
    return '{'+this.elementID+this.output+this.portID+'}'
  }
}

