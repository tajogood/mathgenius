/** Each small square covers 1 cm²; its side is 1 cm. */
export type RectangleEdge='top'|'right'|'bottom'|'left';
export const RECTANGLE_EDGES:readonly RectangleEdge[]=['top','right','bottom','left'];
export const rectangleArea=(width:number,height:number)=>width*height;
export function rectangleEdgeLength(width:number,height:number,edge:RectangleEdge):number {
 return edge==='top'||edge==='bottom'?width:height;
}
export function rectanglePerimeter(width:number,height:number):number {
 return RECTANGLE_EDGES.reduce((total,edge)=>total+rectangleEdgeLength(width,height,edge),0);
}
export function selectedArea(width:number,rows:ReadOnlySet<number>):number {
 return width*rows.size;
}
export function selectedPerimeter(width:number,height:number,edges:ReadOnlySet<RectangleEdge>):number {
 return RECTANGLE_EDGES.reduce((total,edge)=>total+(edges.has(edge)?rectangleEdgeLength(width,height,edge):0),0);
}
