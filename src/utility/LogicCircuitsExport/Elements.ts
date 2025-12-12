import {ElementConnector} from './Nodes.ts';
import type {Node} from './Nodes.ts';
import {Text} from './Text.ts';
import type { Connection } from '@/utility/LogicCircuitsExport/Connections.ts'

/*
Elements in the .lc file have the following format:
[ {<elementType>,<xPOS>,<yPOS>,<rotation>,<input>,<output>} ; ... ]
- they are stored in the second line of the file
- elementType is a number representing the type of the element (e.g.
0 => AND Gate,
1 => OR gate,
2 => Button,
3 => NOR,
4 => NAND,
5 => XOR,
6 => XNOR,
7 => NaN,
8 => LAMP,
12 => CLA
13 => HALF ADDER,
14 => MUX,
15 => DEMUX LOW,
16 => DEMUX HIGH,

- xPOS and yPOS are coordinates on the logic circuit canvas, 0,0 is top left

- rotation is the rotation of the element
0 => normal,
1 => rotated right once
2 => rotated right twice
3 => rotated right thrice

- inputs/outputs are strings representing the number and type of inputs/outputs
(n => normal, i => inverted, sometimes (for lamps and buttons) there is a 1 in the front)
 */
export class Element{
  elementType: number;
  elementID: number;
  xPOS: number;
  yPOS: number;
  rotation: number;
  inPorts: string;
  outPorts: string;
  inNodes: Node[]; //connectors for input
  outNodes: Node[]; //connectors for output

  //lists with all elements, nodes, connections and texts in the .lc file where this element should belong to
  fileElements: Element[];
  fileNodes: Node[];
  fileConnections: Connection[];
  fileTexts: Text[];

  /**
   * Creates an Element and adds it to the fileElements list
   * @param elementType
   * @param xPOS
   * @param yPOS
   * @param rotation
   * @param inPorts
   * @param outPorts
   * @param fileElements - the list of all elements in the target .lc file
   * @param fileNodes - the list of all nodes in the target .lc file
   * @param fileConnections - the list of all connections in the target .lc file
   * @param fileTexts - the list of all texts in the target .lc file
   */
  constructor(elementType:number, xPOS:number, yPOS:number, rotation:number, inPorts:string, outPorts:string, fileElements:Element[], fileNodes:Node[], fileConnections:Connection[], fileTexts:Text[]) {
    this.elementType = elementType;
    this.xPOS = xPOS;
    this.yPOS = yPOS;
    this.rotation = rotation;
    this.inPorts = inPorts;
    this.outPorts = outPorts;

    this.fileElements = fileElements;
    this.fileNodes = fileNodes;
    this.fileConnections = fileConnections;
    this.fileTexts = fileTexts;

    this.fileElements.push(this); //add this element to the fileElement list for the target .lc file
    this.elementID = this.fileElements.length-1 //get index in elements list which is then used in the connector nodes

    //create in/output nodes
    this.inNodes = [];
    this.outNodes = [];

    //create connector node for each input, just 'n' and 'i' are ports, so everything else is removed out of the string first
    this.inPorts.replace(/[^ni]/g, '').split('').forEach((char:string, inPortIndex:number) => {
      if (char === 'n' || char==='i') this.inNodes.push(new ElementConnector(this.elementID, inPortIndex, false, this.fileNodes, this.fileConnections));
    })

    //create connector node for each output
    this.outPorts.replace(/[^ni]/g, '').split('').forEach((char:string, outPortIndex:number) => {
      if (char === 'n' || char==='i') this.outNodes.push(new ElementConnector(this.elementID, outPortIndex, true, this.fileNodes, this.fileConnections));
    })

  }

  /**
   * @returns {string} object in .lc element format
   * {<elementType>,<xPOS>,<yPOS>,<rotation>,<input>,<output>}
   */
  toString():string{
    return '{' + this.elementType + ',' + this.xPOS + ',' + this.yPOS + ','+this.rotation+',' + this.inPorts.replace('\'','') + ',' + this.outPorts.replace('\'','') + '}';
  }


  /**
   * Sets the X position of the element
   * @param xPOS {number} - The X position of the element
   */
  setPosX(xPOS:number){
    this.xPOS = xPOS;
  }

  /**
   * Sets the Y position of the element
   * @param yPOS {number} - The Y position of the element
   */
  setPosY(yPOS:number){
    this.yPOS = yPOS;
  }

  /**
   *
   * @param rotation {number} - The rotation of the element
   0 => normal,
   1 => rotated right once
   2 => rotated right twice
   3 => rotated right thrice
   */
  setRotation(rotation:number){
    this.rotation = rotation;
  }


  /**
   * set inPorts sets the input ports of the element
   * @param inPorts {string} - The input ports string
   * Should be in the format of {i,n}*, where |inPorts| is the number of ports
   * i => inverted input
   * n => normal input
   */
  setInPorts(inPorts:string){
    this.inPorts = inPorts;
  }

  /**
   * set outPorts sets the output ports of the element
   * @param outPorts {string} - The output ports string
   * Should be in the format of {i,n}*, where |outPorts| is the number of ports
   * i => inverted output
   * n => normal output
   */
  setOutPorts(outPorts:string){
    this.outPorts = outPorts;
  }

  /**
   * get outConnector nodes of the element as an array of Nodes
   * @returns {Node[]}
   */
  getOutConnectors():Node[]{
    return this.outNodes
  }

  /**
    get inConnector nodes of the element as an array of Nodes
   @returns {Node[]}
   */
  getInConnectors():Node[]{
    return this.inNodes
  }

  /**
  adds a Text Box and attaches it to the element

  @param {string} content - The text content to be displayed
  @param {number} position - The position of the text relative to the element
    0 => above
    1 => right
    2 => below
    3 => left
  @param {number} fontSize - The font size of the text, default is 12

  @returns {void}
   */
  addText(content:string, position:number, fontSize:number = 12){
    let xOffset = 0;
    let yOffset = 0;
    switch(position){
      case 0: //above
        xOffset = -25;
        yOffset = 25;
        break;
      case 1: //right
        xOffset = 60;
        yOffset = 10;
        break;
      case 2: //below
        xOffset = 10;
        yOffset = 70;
        break;
      case 3: //left
        xOffset = -50;
        yOffset = 10;
        break;
    }
    new Text(xOffset, yOffset, fontSize, content, this.elementID, this.fileTexts);
  }
}
