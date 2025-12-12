import { Element } from './Elements.ts'
import { Connection } from './Connections.ts'
import { FreeConnector, type Node } from './Nodes.ts'
import { Text } from './Text.ts'

export class LCFile{

  firstLine:string = '';

  elements:Element[];
  nodes:Node[]
  connections:Connection[];
  texts:Text[];

  /**
   * Creates a new Logic Circuit File instance
   * @param firstLine - The first line of the .lc file, default is '[0.8.12,0,0,0.6,1]'
   * The format of the first line is [<version>,<xPos>,<yPos>,<gridSize>,<>]
   */
  constructor(firstLine:string = '[0.8.12,0,0,0.6,1]') {
    this.firstLine = firstLine;
    this.elements = [];
    this.nodes = [];
    this.connections = [];
    this.texts = [];
  }

  /**
   * Creates a generic element of the specified type at the specified position for this .lc doc
   * @param elementType (see Element class for types)
   * @param xPOS
   * @param yPOS
   * @param rotation (0 = no rotation, 1 = 90 degrees clockwise, 2 = 180 degrees, 3 = 270 degrees)
   * @param inPorts (string representing the input ports, e.g. 'nn' for two normal inputs, 'ni' for one normal and one inverted input)
   * @param outPorts (same format as in ports)
   */
  createElement(elementType:number, xPOS:number, yPOS:number, rotation:number, inPorts:string, outPorts:string):Element{
     return new Element(elementType, xPOS, yPOS, rotation, inPorts, outPorts, this.elements, this.nodes, this.connections, this.texts);
  }

  /**
   * Creates a button element with one output at the specified position for this .lc doc
   * @param xPOS
   * @param yPOS
   * @param rotation
   */
  createButton(xPOS:number, yPOS:number, rotation:number):Element{
      return new Element(2, xPOS, yPOS, rotation, '', '1n', this.elements, this.nodes, this.connections, this.texts);
  }

  /**
   * Creates a lamp element with one input at the specified position for this .lc doc
   * @param xPOS
   * @param yPOS
   * @param rotation (0 = no rotation, 1 = 90 degrees clockwise, 2 = 180 degrees, 3 = 270 degrees)
   */
  createLamp(xPOS:number, yPOS:number, rotation:number):Element{
      return new Element(8, xPOS, yPOS, rotation, '1n', '', this.elements, this.nodes, this.connections, this.texts);
  }

  /**
   * Creates an AND gate element at the specified position for this .lc doc
   * @param xPOS
   * @param yPOS
   * @param rotation (0 = no rotation, 1 = 90 degrees clockwise, 2 = 180 degrees, 3 = 270 degrees)
   * @param inputs (for each input either: n => normal, i => inverted)
   * @param outputs (same format as inputs)
   */
  createAndGate(xPOS:number, yPOS:number, rotation:number, inputs:string = 'nn', outputs:string = 'n'):Element{
      return new Element(0, xPOS, yPOS, rotation, inputs, outputs, this.elements, this.nodes, this.connections, this.texts);
  }

  /**
   * Creates an OR gate element at the specified position for this .lc doc
   * @param xPOS
   * @param yPOS
   * @param rotation (0 = no rotation, 1 = 90 degrees clockwise, 2 = 180 degrees, 3 = 270 degrees)
   * @param inputs (for each input either: n => normal, i => inverted)
   * @param outputs (same format as inputs)
   */
  createORGate(xPOS:number, yPOS:number, rotation:number, inputs:string = 'nn', outputs:string = 'n'):Element{
      return new Element(1, xPOS, yPOS, rotation, inputs, outputs, this.elements, this.nodes, this.connections, this.texts);
  }

  /**
   * Creates a free floating connector node at the specified position for this .lc doc
   * @param xPOS
   * @param yPOS
   */
  createNode(xPOS:number, yPOS:number):Node{
      return new FreeConnector(xPOS, yPOS, this.nodes, this.connections);
  }

  //some "best distance between"/size constants
  static readonly OR_SIZE = 90;
  static readonly AND_SIZE = this.OR_SIZE;
  static readonly BUTTON_SIZE = 40;
  static readonly LAMP_SIZE = this.BUTTON_SIZE;

  /**
   * Converts the entire LCFile instance to its string representation in the .lc file format.
   * @return string - The string representation of the LCFile in .lc format.
   */
  toString():string{
    // elements
    const secondLine:string = '[' + this.elements.map(e => e.toString()).join(';') + ']'

    // free floating and element connectors, the nodes
    const thirdLine:string = '[' + this.nodes.map(n => n.toString()).join(';') + ']'

    // the connections between nodes
    const fourthLine:string = '[' + this.connections.map(n => n.toString()).join(';') + ']'

    // the text elements
    const fifthLine: string = '['+this.texts.map(e => e.toString()).join(';') + ']'

    //?
    const sixthhLine:string = '[]'

    // \r\n (Windows format) is required for Logic Circuits to properly read the file
    return this.firstLine + '\r\n' + secondLine + '\r\n' + thirdLine + '\r\n' + fourthLine + '\r\n' + fifthLine + '\r\n' + sixthhLine;
  }

}
