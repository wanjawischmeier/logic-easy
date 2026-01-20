/*
Text in .lc files has the following format:
[{<x>,<y>,<fontSize>,<unknown-default:0>,<text>,<elemID/null>}]

- x and y are the position of the Text on the Logic Circuit canvas.
  If the elemID is not null, x and y are the offsets from the target elements position.

- fontSize is the fontsize, default is 12

- unknown is an unknown parameter, usually 0

- text is the actual text content.

- elemID is the ID of the target element this text is associated with, or null if it's standalone text
 */
export class Text {
  content: string;
  xPOS: number
  yPOS: number;
  fontSize: number;
  elementID: number | null;
  unknown: number;

  /**
   * Creates a new Text instance and adds it to the provided fileTexts array.
   * @param xPOS
   * @param yPOS
   * @param fontSize
   * @param content
   * @param elementID
   * @param fileTexts
   * @param unknown
   */
  constructor(xPOS: number, yPOS: number, fontSize: number = 12, content: string, elementID: number | null = null, fileTexts:Text[] , unknown: number = 0) {
    this.xPOS = xPOS
    this.yPOS = yPOS
    this.fontSize = fontSize
    this.content = content
    this.elementID = elementID
    this.unknown = unknown

    fileTexts.push(this);

  }

  /**
   * Converts the Text instance to its string representation in the .lc file format.
   * @returns {string} {<x>,<y>,<fontSize>,<unknown-default:0>,<text>,<elemID/null>}
   *
   */
  toString():string {
    return '{' + this.xPOS + ',' + this.yPOS + ',' + this.fontSize + ',' + this.unknown + ',' + this.content.replace('/', '') + (this.elementID !== null ? ','+this.elementID : '') + '}';
  }

}
