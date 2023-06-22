//		svg-plotter-1.js   2023-05-13   usp

import * as svgtools from "/inc/svg-1.js" ;
import * as domhelper from "/inc/dom-helper-1.js" ;

const createError = function ( fn, message ) {
	return new Error ( `svg-plotter:${fn}(): ${message}` );
	}
export class Plotter {
	constructor(svgElement) {
			// Store a reference to the SVG element
		this.svgElement = svgElement;
			// Retrieve viewbox properties
		this.viewbox = { 
			xMin : svgElement.viewBox.baseVal.x ,
			xMax : svgElement.viewBox.baseVal.width + svgElement.viewBox.baseVal.x ,
			yMin : svgElement.viewBox.baseVal.y ,
			yMax : svgElement.viewBox.baseVal.height + svgElement.viewBox.baseVal.y
			} ;
			// Axis object associative array
		this.axes = { } ;
			// Axis container group element
		if ( ! ( this.axesGroupElement = this.svgElement.querySelector( "#axes" ))) {
			this.axesGroupElement = this.svgElement.appendChild ( 
			domhelper.setAttributes ( 
			document.createElementNS( svgtools.svgNameSpace, "g" ), {
			stroke : "black" , fill : "none"
			} ) ) ; }
		if ( ! this.axesGroupElement.hasAttribute( "stroke" )) this.axesGroupElement.setAttribute( "stroke", "black" );
		}
	createAxis( name, vmin, vmax, options ) {
		////	name = Axis name
		////	options = Construction parameters and line attributes
		////	tickmarkOptions = data for createTickmarks()
		const axis = this.axes[ name ] = { } ;
		let slope, offset, angle;
			// Reference point R1 is optional
		if ( ! options.R1 ) options.R1 = { x : 0 , y : 0 } ;
			// Calculate angle and two references points
		if ( options.angle !== undefined ) {
				// Angle plus reference point method
			angle = options.angle ;
			axis.angle = angle / 180 * Math.PI ;
			slope = - Math.tan( axis.angle );  // negative because angle is user space
			offset = options.R1.y - options.R1.x * slope ;
			}
		else {
				// Two-reference points method
			const deltaX = options.R2.x - options.R1.x ;
			const deltaY = options.R2.y - options.R1.y ;
				// Check points
			if ( deltaX === deltaY === 0 ) throw createError( "calculateCoordinates", "invalid reference points" );
				// Calculate slope and y axis intersection point
			slope = deltaY / deltaX ;
			offset = options.R1.y / slope * options.R1.x ;
				// Devlop slope to full user space angle in degree
			angle = ((deltaX < 0 ? 180 : 360) - (Math.atan( slope ) / Math.PI * 180)) % 360 ;
			axis.angle = angle / 180 * Math.PI ;
			}		
			// Calculate intersection points with viewbox borders.
			// A point in a corner might be added twice. This is not a problem, only the first two points will be used.
		const intersectionPoints = [ ] ;
			// Right viewbox border
		let y = slope * this.viewbox.xMax + offset ;
		if ( ! ( y < this.viewbox.yMin || y > this.viewbox.yMax )) intersectionPoints.push( { x : this.viewbox.xMax , y : y } );
			// Left viewbox border
		y = slope * this.viewbox.yMin + offset ;
		if ( ! ( y < this.viewbox.yMin || y > this.viewbox.yMax )) intersectionPoints.push( { x : this.viewbox.xMin , y : y } );
			// Upper viewbox border
		let x = ( this.viewbox.yMin - offset ) / slope ;
		if ( ! ( x < this.viewbox.xMin || x > this.viewbox.xMax )) intersectionPoints.push( { x : x , y : this.viewbox.yMin } );
			// Lower viewbox border
		x = ( this.viewbox.yMax - offset ) / slope ;
		if ( ! ( x < this.viewbox.xMin || x > this.viewbox.xMax )) intersectionPoints.push( { x : x , y : this.viewbox.yMax } );
			// Order intersection points like reference points.
		if ( angle >= 45 && angle <= 135 ) {
			if ( intersectionPoints[ 0 ].y < intersectionPoints[ 1 ].y ) domhelper.swap( intersectionPoints, 0, 1 );
			}
		else if ( angle >= 135 && angle <= 225 ) {
			if ( intersectionPoints[ 0 ].x < intersectionPoints[ 1 ].x ) domhelper.swap( intersectionPoints, 0, 1 );
			}
		else if ( angle >= 225 && angle <= 315 ) {
			if ( intersectionPoints[ 0 ].y > intersectionPoints[ 1 ].y ) domhelper.swap( intersectionPoints, 0, 1 );
			}
		else if ( angle >= 225 && angle <= 360 || angle >= 0 && angle <= 45 ) {
			if ( intersectionPoints[ 0 ].x > intersectionPoints[ 1 ].x ) domhelper.swap( intersectionPoints, 0, 1 );
			}
		else throw createError( "calculateCoordinates", "Angle out of range" );
			// Create axis group element
		const axisGroupElement = svgtools.createElement("g", { name: name } ) ;
		this.axesGroupElement.appendChild( axisGroupElement );

			// Create the axis line element
		const line = axis.line = document.createElementNS( svgtools.svgNameSpace, "line" );
		options.lineAttributes.x1 =  intersectionPoints[ 0 ].x ;
		options.lineAttributes.y1 = intersectionPoints[ 0 ].y ;
		options.lineAttributes.x2 = intersectionPoints[ 1 ].x ;
		options.lineAttributes.y2 = intersectionPoints[ 1 ].y ;
		options.lineAttributes.fill = "none" ;
		options.lineAttributes["marker-end"] = "url(#arrowHead)" ;
		domhelper.setAttributes( line, options.lineAttributes ) ;
		axisGroupElement.appendChild( line );
			// Store additional properties
		axis.vmax = vmax ;
		axis.vmin = vmin ;
		axis.length = Math.sqrt( (options.lineAttributes.x2 - options.lineAttributes.x1)**2 +  (options.lineAttributes.y2 - options.lineAttributes.y1)**2 );
		axis.scalingFactor = axis.length / (axis.vmax - axis.vmin) ;
		axis.sinx = Math.sin( axis.angle );
		axis.cosx = Math.cos( axis.angle );
			// Create tickmarks
		if ( options.tickmarks ) {
			if ( ! options.tickmarks.lineAttributes ) options.tickmarks.lineAttributes = { } ;
			if ( options.tickmarks.lineAttributes.stroke === undefined && options.lineAttributes.stroke !== undefined ) options.tickmarks.lineAttributes.stroke = options.lineAttributes.stroke ;
			this.createTickmarks( axis, axisGroupElement, options.tickmarks );
			}
			// Return a plotter reference for chaining
		return this ;
		}
	createTickmarks ( axis, axisGroupElement, options ) {
		// axis : axis object reference
		// options : Additional parameters with the following members:
		// distance : Distance between tickmars in real-world coordinates
		// length, length1, length2 : Overall, right and left hand side length of tickmarks in pixels
		// marginStart, marginEnd : Areas near the axis ends are spared out
		// toggleValue : Enables exchange of lenght1 and length2 at the toggleValue point. Useful for half-side tickmarks.
		// labelDistance1, labelDistance2 : determines the position of tickmark labels above and below the tickmark lines
		// textAttributes : Attribute object for the label text.

			// Create the tickmark group object
		const tickmarksGroupElement = svgtools.createElement( "g", options.lineAttributes );
		tickmarksGroupElement.setAttribute( "name" , "tickmarks" );
		axisGroupElement.appendChild( tickmarksGroupElement );
		let labelsGroupElement;
			// Setup tickmark length parameters.
		if ( options.length === options.length1 === options.length2 === undefined ) options.length1 = options.length2 = 6 ;
		else if ( options.length ) options.length1 = options.length2 = options.length / 2 ;
		if ( options.length1 === undefined ) options.length1 = 0;
		if ( options.length2 === undefined ) options.length2 = 0;
			// Toggle tickmark length
		const toggle = options.toggleValue !== undefined ;
			// labelDistance
		const labels = options.labelDistance1 !== undefined || options.labelDistance2 !== undefined ;
		if ( labels ) {
			if ( options.labelDistance1 === undefined ) options.labelDistance1 = options.labelDistance2 ;
			if ( options.labelDistance2 === undefined ) options.labelDistance2 = options.labelDistance1 ;
			labelsGroupElement = svgtools.createElement( "g", options.labelAttributes );
			labelsGroupElement.setAttribute( "name" , "labels" );
			axisGroupElement.appendChild( labelsGroupElement );
			}
			// Setup tickmark margin parameters (pixels)
		if ( options.marginStart === undefined ) options.marginStart = 10 ;
		if ( options.marginEnd === undefined ) options.marginEnd = 20 ;
			// Convert to function space units
		const marginStart = options.marginStart / axis.scalingFactor ;
		const marginEnd = options.marginEnd /axis.scalingFactor ;
			// Label spareout range
		if ( options.spareMin === undefined ) options.spareMin = 0;
		if ( options.spareMax === undefined ) options.spareMax = 0;
			// Lowest possible tickmark value
		let v = Math.trunc( axis.vmin / options.distance ) * options.distance ;
		while ( v < axis.vmax ) {
				// Obey margins
			if ( v >= axis.vmin + marginStart && v <= axis.vmax - marginEnd ) {
					// Calculate center point.
				const cx = axis.line.x1.baseVal.value + (v - axis.vmin) * axis.scalingFactor * axis.cosx ;
					// Attention here: user space axis is bottom up! Therefore the minus.
				const cy = +axis.line.y1.baseVal.value - (v - axis.vmin) * axis.scalingFactor * axis.sinx ;

					// Calculate tickmark line end points
				const p1x = cx - options.length1 * axis.sinx ;
				const p1y = cy - options.length1 * axis.cosx ;
				const p2x = cx + options.length2 * axis.sinx ;
				const p2y = cy + options.length2 * axis.cosx
					// Create the line
				const line = svgtools.line( p1x, p1y, p2x, p2y, options.lineAttributes );
				tickmarksGroupElement.appendChild( line );

					// Tickmark label
				if ( labels && ( v < ( options.spareMin - 1e-6 )  || v > ( options.spareMax + 1e-6 ))) {
					const x = cx + options.labelDistance1 * axis.sinx ;
					const y = cy - options.labelDistance1 * axis.cosx ;
					const text = svgtools.text( x, y, v.toFixed( 2 ) );
					labelsGroupElement.appendChild( text );
					}
				}

				// next tickmark
			const oldv = v ;
			v += options.distance;
			if ( toggle && oldv <= options.toggleValue && v > options.toggleValue ) {
					// Swap tickmark lengths
				let t = options.length1 ;
				options.length1 = options.length2 ;
				options.length2 = t ;
					// Swap label distances
				t = options.labelDistance1 ;
				options.labelDistance1 = options.labelDistance2 ;
				options.labelDistance2 = t ;
				} ;
			}
		}
	}