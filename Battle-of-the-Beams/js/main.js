// Author: Plan V of the Tally Ho Corner forum.


// Section: Declarations.

'use strict';


// Section: Constants.

let RADIO_FIELD_SIZE = 10;

// - According to Wikipedia, the Knickebein beam was a few tens of yards wide over the target.
// - We scale it to something that's noticable on our game world map.
// - 0.075 * Math.PI is good if you have a fine-grained radio field (e.g. RADIO_FIELD_SIZE = 30).
// - 0.1 * Math.PI is good for RADIO_FIELD_SIZE = 10, if you want to show a nice signal fall-off.
let KNICKEBEIN_DISPERSION_ANGLE_RADIANS = 0.1 * Math.PI;

// - 0.25 * Math.PI means that the pilot will try to intersect the centerline of the beam at a 45 degree angle.
let AIRCRAFT_CRUDE_HEADING_ADJUSTMENT_RADIANS = 0.3 * Math.PI;

// Aircraft drift is currently always perpendicular to the Knickenbein beam direction.
// -pi/2 is to the left. +pi/2 is to the right.
let AIRCRAFT_DRIFT_DIRECTION_RELATIVE_TO_BEAM_RADIANS = -1 * Math.PI / 2;
// Unit of measurement: fraction of the world per second.
let AIRCRAFT_DRIFT_VELOCITY = RADIO_FIELD_SIZE / 300;

let SVG_VIEWBOX_WIDTH = 1000;
let SVG_VIEWBOX_HEIGHT = 1000;

let WORLD_SVG_SCENE_X = .05 * SVG_VIEWBOX_WIDTH;
let WORLD_SVG_SCENE_Y = .09 * SVG_VIEWBOX_HEIGHT;
let WORLD_SVG_VIEWBOX_WIDTH = .9 * SVG_VIEWBOX_WIDTH;
let WORLD_SVG_VIEWBOX_HEIGHT = .9 * SVG_VIEWBOX_HEIGHT;

// The visual width of a radio field signal indicator. As a fraction of the picture/viewport.
let RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC = .2 * (1 / RADIO_FIELD_SIZE);

// The visual width of an oscilloscope. As a fraction of the picture/viewport.
// The fraction is to keep some room between the icons.
let OSCILLOSCOPE_WIDTH_VIEWFRAC = .75 * (1 / RADIO_FIELD_SIZE);

// The minimum visual height of an oscilloscope. Nice to be able to see that there is silence somewhere.
// We had this set to .1 , but now that we have a frame around the oscilloscope, it's probably best to disable this (0).
let OSCILLOSCOPE_MIN_HEIGHT = 0

//XXX We've decided that a time line does not have to extend beyond the oscilloscope. It's clear enough for our purposes, and would only distract too much.
//let OSCILLOSCOPE_TIME_LINE_HEIGHT_EXTRA_FRAC = .1
let OSCILLOSCOPE_TIME_LINE_HEIGHT_EXTRA_FRAC = 0


let COLOR_FOR_LEFT_RGB = [0xff, 0xe0, 0x60];
let COLOR_FOR_RIGHT_RGB = [0xff, 0xe0, 0x60];

let KNICKEBEIN_COLOR_FOR_LEFT_RGB = [0xa0, 0x40, 0x40];
let KNICKEBEIN_COLOR_FOR_RIGHT_RGB = [0xa0, 0x40, 0x40];

let COLOR_OSCILLOSCOPE_BAR_FOR_LEFT_RGB = [0xff, 0xe0, 0x60];
let COLOR_OSCILLOSCOPE_BAR_FOR_RIGHT_RGB = [0xff, 0xe0, 0x60];

let OSCILLOSCOPE_DIAL_BACKGROUND_COLOR_RGB = [0x70, 0x00, 0x00];

let OSCILLOSCOPE_FRAME_COLOR = '#404040';
let OSCILLOSCOPE_TIME_LINE_COLOR = '#606060';

let OSCILLOSCOPE_FADE = .4;


let COLOR_FOR_DIRECTION_FIELD = 'pink';


let WORLD_BACKGROUND_COLOR = '#123901';


// Calls to mind a laser pointer.
let KNICKEBEIN_PRIMARY_FRAME_COLOR = '#c00000';
let KNICKEBEIN_SECONDARY_FRAME_COLOR = '#808080';
let KNICKEBEIN_INACTIVE_FILL_COLOR = '#303030';
let KNICKEBEIN_COLOR_FOR_RADIO_INDICATOR_RGB = [0xff, 0x00, 0x00];


let COLOR_FOR_AIRCRAFT = '#ff2020';
let BOMBARDMENT_COLOR = 'orange';


let KNICKEBEIN_1_APPEAR_DELAY_SECS = 1.5;
let KNICKEBEIN_2_APPEAR_DELAY_SECS = KNICKEBEIN_1_APPEAR_DELAY_SECS + 1.5;
// A gradual rise of Knickebein power is a nice visual effect.
let KNICKEBEIN_ACTIVE_DELAY_SECS = KNICKEBEIN_2_APPEAR_DELAY_SECS + 1.;
let KNICKEBEIN_POWER_RAMP_SECS = 1.5;


// Section: General utilities.

function degreesFromRadians(radians) {
    return radians * 180 / Math.PI;
}


function normalizeAngleRadians(input) {
    return input - (2 * Math.PI * Math.floor((input + Math.PI) / (2 * Math.PI)));
}


function svgColorSpecFromRgbArray(rgbArray) {
    return '#' + rgbArray.map(x => x.toString(16).padStart(2, '0')).join('');
}


// Also handles negative numbers.
function modulo(x, n) {
    return ((x % n) + n) % n;
}


// Section: Drawing sine waves.

// This module is inline to avoid "Module source uri is not allowed in this document" when running from a local file, without a webserver.
// Module sineWave start.

function sineWaveSetup(svgDomElem) {
    var sinePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // These are magic Bezier control points to approximate the first quarter-period of a sine wave (starting at amplitude 0 and going down) quite nicely.
    // A Bezier curve is accurate enough for our purposes. It's simpler code and often faster rendering than a polyline approximation.)
    // https://stackoverflow.com/questions/13932704/how-to-draw-sine-waves-with-svg-js
    sinePath.setAttribute('d', 'M0,0 C0.512286623256592433,0.512286623256592433,1.002313685767898599,1,1.570796326794896619,1');
    // We leave sinePath.style.stroke unset. Otherwise, SVG <use> sites can't customize that.
    sinePath.style.fill = 'none';
    // When a SVG <use> site scales us, don't let the stroke scale along with it.
    sinePath.setAttribute('vector-effect', 'non-scaling-stroke');

    var sinePathDefG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    sinePathDefG.setAttribute('id', 'sinePathDef');
    sinePathDefG.appendChild(sinePath);

    var svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgDefs.appendChild(sinePathDefG);
    svgDomElem.appendChild(svgDefs);
}


function sineWaveDraw(svgDomElem, sceneX, sceneY, xScale, yScale, numSineWaves, styleStroke, styleOpacity) {
    if (yScale == 0)
        yScale = 0.01;

    // We construct a sine wave from "use" instances of our pre-defined quarter-period section of a sine wave, in various mirrored orientations.
    for (var i = 0; i < Math.round(numSineWaves * 4); i++) {
        var sinePathUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
        sinePathUse.setAttribute('href', '#' + 'sinePathDef');

        let xDir = ((i % 2) == 0) ? 1 : -1;
        let transformXScale = xDir * xScale;
        let xExtraTranslate = (xDir < 0) ? (Math.PI / 2) : 0;
        let yDir = ((i % 4) < 2) ? -1 : 1;
        let transformYScale = yDir * yScale;
        sinePathUse.setAttribute('transform', 'scale(' + transformXScale + ', ' + transformYScale + ') translate(' + (xDir * ((sceneX / xScale) + xExtraTranslate + (i * Math.PI / 2))) + ', ' + (yDir * sceneY / yScale) + ')');

        sinePathUse.style.stroke = styleStroke;
        if (styleOpacity != 1.0)
            sinePathUse.style.opacity = styleOpacity;

        svgDomElem.appendChild(sinePathUse);
    }
}

// Module sineWave end.


// Section: Radio field.

// A radio field has values of range -1.0 .. +1.0.
function createRadioField() {
    let radioField = new Array(RADIO_FIELD_SIZE);
    for (var i = 0; i < radioField.length; i++) {
        radioField[i] = new Array(RADIO_FIELD_SIZE);
    }
    return radioField;
}


function resetRadioField(radioField) {
    for (var x = 0; x < radioField.length; x++) {
        for (var y = 0; y < radioField[x].length; y++) {
            radioField[x][y] = 0.0;
        }
    }
}


// Section: Radio field waveform history.

class Waveform {
    // A PCM sample. A time series array of signal amplitude. For each time slot, a signal amplitude between 0.0 and 1.0.
    amplitudes;

    constructor(waveform_size) {
        this.amplitudes = new Array(waveform_size);
    }
}


function createRadioFieldWaveform(waveformSize) {
    let radioFieldWaveform = Array.from(    // This is a (functional-style) idiom to declare a 2D array of Waveform objects.
        Array(RADIO_FIELD_SIZE),
        () => Array.from(
            Array(RADIO_FIELD_SIZE),
            () => new Waveform(waveformSize)));
    return radioFieldWaveform;
}


function updateRadioFieldWaveform(radioFieldWaveform, radioField, knickebein) {
    for (var x = 0; x < radioField_1.length; x++) {
        for (var y = 0; y < radioField_1[x].length; y++) {
            let amplitudes = radioFieldWaveform[x][y].amplitudes;
            let amplitudes_idx = Math.floor(knickebein.timeWithinDotDashPatternFraction * amplitudes.length)
            amplitudes[amplitudes_idx] = radioField[x][y];
        }
    }
}


// Section: Knickebein.

// In the real Knickebein, the German pilots would try to equalize the amplitudes of the dots and the dashes, to get as close to the centerline of the beam as possible.
//
// This calculation is not at all physically plausible. Just a crude effect to serve the demonstration / the game.
function amplitudeBasedOnBeamCenterline(beamDiffAngleRadians) {
    // We only use half amplitude, to leave room for Aspirin spoof transmissions.
    let KNICKEBEIN_SIGNAL_STRENGTH_OVER_ENGLAND = 0.5;

    let OUTER_FADEOUT_START_ANGLE_RADIANS = .15 * Math.PI;
    let OUTER_FADEOUT_GONE_ANGLE_RADIANS = .23 * Math.PI;

    if (beamDiffAngleRadians >= OUTER_FADEOUT_GONE_ANGLE_RADIANS)
        return 0.01;
    else if (beamDiffAngleRadians >= OUTER_FADEOUT_START_ANGLE_RADIANS)
        return (1.0 - ((beamDiffAngleRadians - OUTER_FADEOUT_START_ANGLE_RADIANS) / (OUTER_FADEOUT_GONE_ANGLE_RADIANS - OUTER_FADEOUT_START_ANGLE_RADIANS))) * KNICKEBEIN_SIGNAL_STRENGTH_OVER_ENGLAND;
    else if (beamDiffAngleRadians >= 0)
        return KNICKEBEIN_SIGNAL_STRENGTH_OVER_ENGLAND;    // Full strength.
    else if (beamDiffAngleRadians < -KNICKEBEIN_DISPERSION_ANGLE_RADIANS)
        return 0.0;
    else
        return (1.0 + (beamDiffAngleRadians / KNICKEBEIN_DISPERSION_ANGLE_RADIANS)) * KNICKEBEIN_SIGNAL_STRENGTH_OVER_ENGLAND;
}


class Knickebein {
    // These coordinates don't *really* need to be integers. But the visuals are easier to understand if they are.
    // A Knickbein transmitter is considered to take up the whole radio grid cell. So e.g. when placing an icon, treat the transmitterPosX / Y as the lower left corner (in world coordinate system) of a complete cell, not as the exact place to put the icon.
    transmitterPosX;
    transmitterPosY;

    // 0 means east, pi/2 means north, -pi/2 means south, pi means west, etc.
    beamDirectionAngleRadians;

    // Our convention is that the dot starts at timestamp 0, followed by the dash.
    dotDurationSecs;
    dashDurationSecs;

    transmitterPowerFactor;

    // Updated by simulationStepCalculateRadioField().
    timeWithinDotDashPatternSecs;
    timeWithinDotDashPatternFraction;;
    isDot;
    isDash;

    constructor() {
        this.transmitterPowerFactor = 1.0;
    }

    simulationStepCalculateRadioField(timestampSecs) {
        //
        let dotDashPatternDurationSecs = this.dotDurationSecs + this.dashDurationSecs;
        this.timeWithinDotDashPatternSecs = modulo(timestampSecs, dotDashPatternDurationSecs);
        this.timeWithinDotDashPatternFraction = this.timeWithinDotDashPatternSecs / dotDashPatternDurationSecs;
        this.isDot = (this.timeWithinDotDashPatternSecs < this.dotDurationSecs);
        this.isDash = !this.isDot;

        //
        let mirrorMult = this.isDot ? -1 : 1;

        for (var x = 0; x < radioField_1.length; x++) {
            for (var y = 0; y < radioField_1[x].length; y++) {
                let transmitterToXyAngleRadians = Math.atan2(
                    (y - this.transmitterPosY),
                    (x - this.transmitterPosX));

                // The angle (in radians) between the beam centerline and the current xy spot.
                // Negative means that the current xy spot is left of the beam centerline, positive means right.
                let beamDiffAngleRadians = normalizeAngleRadians(this.beamDirectionAngleRadians - transmitterToXyAngleRadians);

                radioField_1[x][y] += amplitudeBasedOnBeamCenterline(mirrorMult * beamDiffAngleRadians) * this.transmitterPowerFactor;
            }
        }
    }
}


function nearTarget(radioFieldWaveform, secondaryKnickebein, x, y) {
    // This factor has been tweaked/fudged so that only 1 target icon appears in the default situation (at the actual target location), but so that it is as high as possible otherwise.
    let MAX_HEADING_ADJUSTMENT_THAT_WE_CONSIDER_CLOSE = .17 * Math.PI;
    let nearPrimaryBeam = Math.abs(Aircraft.pilotHeadingAdjustmentRadians(radioFieldWaveform[Math.floor(x)][Math.floor(y)].amplitudes)) < MAX_HEADING_ADJUSTMENT_THAT_WE_CONSIDER_CLOSE;

    // If we simulated the radio field of the secondary Knickebein, we could just use the same code as above. For now, just use standard vector math.
    // The '+ .5' is because the Knickebein transmitter is considered to take up the whole (be in the middle of) of the radio grid cell.
    let distanceToSecondaryBeam = Math.abs(
        (Math.sin(secondaryKnickebein.beamDirectionAngleRadians) * ((Math.floor(x) + .5) - (secondaryKnickebein.transmitterPosX + .5)))
        - (Math.cos(secondaryKnickebein.beamDirectionAngleRadians) * ((Math.floor(y) + .5) - (secondaryKnickebein.transmitterPosY + .5))));
    let nearSecondaryBeam = distanceToSecondaryBeam < .5;

    return nearPrimaryBeam && nearSecondaryBeam;
}


// Section: Aspirin.

// One of the British interference/misdirection radio transmitters.
class AspirinTransmitter {
    dotTransmission;
    dashTransmission;
    mainKnickebein;

    mostRecentTransmissionAmplitude;

    constructor() {
        this.dotTransmission = 0.0;
        this.dashTransmission = 0.0;
    }

    simulationStepCalculateRadioField(timestampSecs) {
        let amplitude = this.mainKnickebein.isDot ? this.dotTransmission : this.dashTransmission;
        this.mostRecentTransmissionAmplitude = amplitude;

        for (var x = 0; x < radioField_1.length; x++) {
            for (var y = 0; y < radioField_1[x].length; y++) {
                radioField_1[x][y] += amplitude;
            }
        }
    }
};


// Section: Aircraft.

class Aircraft {
    x;
    y;
    // Unit of measurement: fraction of the world per second.
    velocity;
    mainKnickebein;
    mainKnickebeinRadioFieldWaveform;
    secondaryKnickebein;

    // This is a "data recorder" for the benefit of rendering etc.
    mostRecentHeadingAdjustmentRadians;

    static pilotHeadingAdjustmentRadiansWithFallback(amplitudes) {
        let headingAdjustmentRadians = Aircraft.pilotHeadingAdjustmentRadians(amplitudes);
        return (headingAdjustmentRadians === undefined) ? 0.0 : headingAdjustmentRadians;
    }

    static pilotHeadingAdjustmentRadians(amplitudes) {
        return ((amplitudes[0] === undefined) || (amplitudes[amplitudes.length - 1] === undefined))
            ? undefined
            : Aircraft.pilotHeadingDeflection(amplitudes[0], amplitudes[amplitudes.length - 1]);    // This is a good-enough-for-now (over-)simplification.
    }

    static pilotHeadingDeflection(dotAmplitude, dashAmplitude) {
        let dotDashAmplitudeDifference = dashAmplitude - dotAmplitude;
        let dotDashMaxAmplitude = Math.max(dotAmplitude, dashAmplitude);
        let dotDashNormalizedDifference = (dotDashMaxAmplitude == 0) ? 0.0 : dotDashAmplitudeDifference / dotDashMaxAmplitude;
        // The cube root function in this calculation could be any function. Even 1:1 linear would be somewhat OK.
        // The drawback of linear is that it is quite slow to react. The aircraft can drift quite far off heading before the correction really starts to happen. So, a function with a sharper reaction for minor deviations is preferable. A root function like the cube root has a shape roughly like that, and it's easily available, so let's use that.
        let absoluteSteeringFactor = Math.abs(dotDashNormalizedDifference) ** (1 / 3);
        let steeringFactor = Math.sign(dotDashNormalizedDifference) * absoluteSteeringFactor;
        return steeringFactor * AIRCRAFT_CRUDE_HEADING_ADJUSTMENT_RADIANS;
    }

    static pilotNewDirectionRadians(knickebein, headingAdjustmentRadians) {
        return knickebein.beamDirectionAngleRadians + headingAdjustmentRadians;
    }

    simulationStep(deltaTSecs) {
        let amplitudes = this.mainKnickebeinRadioFieldWaveform[Math.floor(this.x)][Math.floor(this.y)].amplitudes;
        let headingAdjustmentRadians = Aircraft.pilotHeadingAdjustmentRadiansWithFallback(amplitudes);
        this.mostRecentHeadingAdjustmentRadians = headingAdjustmentRadians;
        let newDirectionRadians = Aircraft.pilotNewDirectionRadians(this.mainKnickebein, headingAdjustmentRadians);

        this.x += Math.cos(newDirectionRadians) * this.velocity * deltaTSecs;
        this.y += Math.sin(newDirectionRadians) * this.velocity * deltaTSecs;

        this.x += Math.cos(aircraftDriftDirectionRadians) * AIRCRAFT_DRIFT_VELOCITY * deltaTSecs;
        this.y += Math.sin(aircraftDriftDirectionRadians) * AIRCRAFT_DRIFT_VELOCITY * deltaTSecs;
    }
}


function initAircraft1Position() {
    // We currently toggle between only 2 entry points.
    if (mof_1_init_num == 0) {
        mof_1.x = .7 * RADIO_FIELD_SIZE;
        mof_1.y = 0 * RADIO_FIELD_SIZE;
    } else {
        mof_1.x = .999 * RADIO_FIELD_SIZE;
        mof_1.y = .5 * RADIO_FIELD_SIZE;
    }

    mof_1_init_num = 1 - mof_1_init_num;

    mof_1.haveDroppedLoad = false;
}


// Section: Drawing.

function sceneXFromSimX(simX) {
    return WORLD_SVG_SCENE_X + ((simX / RADIO_FIELD_SIZE) * WORLD_SVG_VIEWBOX_HEIGHT);
}

function sceneYFromSimY(simY) {
    return WORLD_SVG_SCENE_Y + ((1.0 - (simY / RADIO_FIELD_SIZE)) * WORLD_SVG_VIEWBOX_HEIGHT);
}


function drawBackground(gameWorldImage) {
    //
    var svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    gameWorldImage.appendChild(svgDefs);

    var clipDef = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clipDef.setAttribute("id", 'worldBackgroundClip');
    svgDefs.appendChild(clipDef);

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("x", WORLD_SVG_SCENE_X);
    shape.setAttribute("y", WORLD_SVG_SCENE_Y);
    shape.setAttribute("width", WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("height", WORLD_SVG_VIEWBOX_HEIGHT);
    clipDef.appendChild(shape);

    // Wrapper, to avoid the transform() interfering with the clip-path.
    var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
    wrapper.setAttribute("clip-path", 'url(#worldBackgroundClip)');
    gameWorldImage.appendChild(wrapper);

    //
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "image");
    shape.setAttribute("x", 0);
    shape.setAttribute("y", 0);
    shape.setAttribute("width", WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("height", WORLD_SVG_VIEWBOX_HEIGHT);
    shape.setAttribute("transform", 'scale(10) translate(-552.5, -529.5)');
    shape.setAttribute("href", 'images/map-Britain-1.svg');
    wrapper.appendChild(shape);
}


function drawKnickebeinTransmitter(gameWorldImage, timestampSecs, knickebein) {
    // Hackish code.
    let isSecondaryKnickebein = (timestampSecs === undefined);

    let frameColor = isSecondaryKnickebein ? KNICKEBEIN_SECONDARY_FRAME_COLOR : KNICKEBEIN_PRIMARY_FRAME_COLOR;
    let scaleFactor = .015 * WORLD_SVG_VIEWBOX_WIDTH;

    // Wrapper, to avoid the transform() interfering with the clip-path.
    var wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
    wrapper.setAttribute("clip-path", 'url(#worldBackgroundClip)');
    gameWorldImage.appendChild(wrapper);

    let transformSpec = 'translate(' + sceneXFromSimX(knickebein.transmitterPosX + .5) + ', ' + sceneYFromSimY(knickebein.transmitterPosY + .5) + ') rotate(' + degreesFromRadians(-knickebein.beamDirectionAngleRadians) + ') scale(' + scaleFactor + ')';

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    shape.setAttribute("points", '0,0 2,-1 2,0');
    shape.setAttribute("fill", (!isSecondaryKnickebein && knickebein.isDot) ? svgColorSpecFromRgbArray(KNICKEBEIN_COLOR_FOR_LEFT_RGB) : KNICKEBEIN_INACTIVE_FILL_COLOR);
    if (!isSecondaryKnickebein && knickebein.isDot)
        shape.setAttribute('fill-opacity', (knickebein.transmitterPowerFactor * 100) + '%');
    else
        shape.setAttribute('fill-opacity', '0%');
    shape.setAttribute('vector-effect', 'non-scaling-stroke');
    shape.style.stroke = frameColor;
    shape.setAttribute("transform", transformSpec);
    wrapper.appendChild(shape);

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    shape.setAttribute("points", '0,0 2,1 2,0');
    shape.setAttribute("fill", (!isSecondaryKnickebein && knickebein.isDash) ? svgColorSpecFromRgbArray(KNICKEBEIN_COLOR_FOR_RIGHT_RGB) : KNICKEBEIN_INACTIVE_FILL_COLOR);
    if (!isSecondaryKnickebein && knickebein.isDash)
        shape.setAttribute('fill-opacity', (knickebein.transmitterPowerFactor * 100) + '%');
    else
        shape.setAttribute('fill-opacity', '0%');
    shape.setAttribute('vector-effect', 'non-scaling-stroke');
    shape.style.stroke = frameColor;
    shape.setAttribute("transform", transformSpec);
    wrapper.appendChild(shape);

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    shape.setAttribute("points", '0,0 100,0');
    shape.setAttribute('vector-effect', 'non-scaling-stroke');
    shape.style.stroke = frameColor;
    shape.setAttribute("transform", transformSpec);
    wrapper.appendChild(shape);
}


function drawRadioFieldSignalIndicator(gameWorldImage, sceneXForSpot, sceneYForSpot, sceneObjWidth, radioFieldAmplitude, baseColorRgb, doFadeColor) {
    //
    // Somewhere between 1 and 3 looks good. Quarter fractions are allowed. 1 has the advantage of least clutter.
    let NUM_SINE_WAVES = 1;
    let SINE_WAVE_SCALE_X = sceneObjWidth / (NUM_SINE_WAVES * 2 * Math.PI) * WORLD_SVG_VIEWBOX_WIDTH;
    // The first literal factor is just a "looks good" arbitrary factor.
    let SINE_WAVE_SCALE_Y = (.23 * 2) * sceneObjWidth * WORLD_SVG_VIEWBOX_HEIGHT;

    // Draw round housing for the wave display.
    //XXX We've decided not to use this. The added clutter costs more than the visual benefit.
    if (false) {
        var RADIO_FIELD_INDICATOR_DIAL_BACKGROUND_COLOR_RGB = [0xff, 0xfa, 0xf0];    // 'floralwhite'.

        // In the radio field signal indicator, the frame. (Including a background for the dial.)
        var shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        shape.setAttribute("cx", sceneXForSpot + (RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH) / 2);
        shape.setAttribute("cy", sceneYForSpot);
        shape.setAttribute("r", (RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH) / 2);
        shape.setAttribute("fill", svgColorSpecFromRgbArray(RADIO_FIELD_INDICATOR_DIAL_BACKGROUND_COLOR_RGB));
        gameWorldImage.appendChild(shape);
    } else {
        // Black background.
        var RADIO_FIELD_INDICATOR_DIAL_BACKGROUND_COLOR_RGB = [0x00, 0x80, 0x00];
    }

    // In the radio field signal indicator, the sine signal.
    // It makes Knickbein easier to understand intuitively/visually if the radio field signal indicator disappears completely at locations where there's no significant radio signal.
    let COLOR_FADE_FACTOR_MAX = 0.99;    // 1.0 means "color fades away completely".
    // A purely linear fade would be:
    //     let colorFadeFactor = (1.0 - Math.min(radioFieldAmplitude, 1.0)) * COLOR_FADE_FACTOR_MAX;
    // But we let the Knickebein send at amplitude 0.5, and for understanding of Knickebein it's useful to give a bright color already at that signal level. The sacrifice is that the color won't get brighter if an Aspirin transmitter boosts the signal even further.
    let colorFadeFactor = doFadeColor
        ? (1.0 - Math.min(radioFieldAmplitude * 2.0, 1.0)) * COLOR_FADE_FACTOR_MAX
        : 0.0;

    sineWaveDraw(
        gameWorldImage,
        sceneXForSpot,
        sceneYForSpot,
        SINE_WAVE_SCALE_X,
        radioFieldAmplitude * SINE_WAVE_SCALE_Y,
        NUM_SINE_WAVES,
        svgColorSpecFromRgbArray(baseColorRgb),
        1.0 - colorFadeFactor);
}


function drawOscilloscope(gameWorldImage, timeWithinDotDashPatternFraction, sceneX, sceneY, oscilloscopeMaxHeight, amplitudes, knickebein, normalizeAmplitudes, drawCurrentTimeIndicator, backgroundColor) {
    // In the oscilloscope, the frame. (Including a background for the dial.)
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("x", sceneX);
    shape.setAttribute("y", sceneY);
    shape.setAttribute("width", OSCILLOSCOPE_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("height", oscilloscopeMaxHeight);
    if (backgroundColor === undefined)
        shape.setAttribute("fill-opacity", '0%');
    else
        shape.setAttribute("fill", backgroundColor);
    shape.setAttribute("stroke", OSCILLOSCOPE_FRAME_COLOR);
    gameWorldImage.appendChild(shape);

    // In the oscilloscope, the current-time vertical line.
    if (drawCurrentTimeIndicator) {
        let fractionOfWidth = timeWithinDotDashPatternFraction + (1 / amplitudes.length);    // We draw the line *past* the current bar, not at its front.
        if (fractionOfWidth <= 1.0) {    // We don't draw the line at all for the wraparound case. It could only create visual confusion.
            var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            shape.setAttribute("x", sceneX + (fractionOfWidth * (OSCILLOSCOPE_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH)));
            shape.setAttribute("y", sceneY - (OSCILLOSCOPE_TIME_LINE_HEIGHT_EXTRA_FRAC * oscilloscopeMaxHeight));
            shape.setAttribute("width", .001 * WORLD_SVG_VIEWBOX_WIDTH);
            shape.setAttribute("height", (1 + (2 * OSCILLOSCOPE_TIME_LINE_HEIGHT_EXTRA_FRAC)) * oscilloscopeMaxHeight);
            shape.setAttribute("fill", OSCILLOSCOPE_TIME_LINE_COLOR);
            gameWorldImage.appendChild(shape);
        }
    }

    //
    if (normalizeAmplitudes) {
        var amplitudeScaleFactor = amplitudes.reduce(
            function(a, b) {
                return Math.max(a, ((b === undefined) ? -Infinity : b));
            },
            -Infinity);
        if (amplitudeScaleFactor <= 0)
            amplitudeScaleFactor = 1.0;
    } else {
        var amplitudeScaleFactor = 1.0;
    }

    // In the oscilloscope, the amplitude time series.
    for (var i = 0; i < amplitudes.length; i++) {
        let oscilloscopeBarWidth = OSCILLOSCOPE_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH / amplitudes.length;
        let oscilloscopeHeight = (amplitudes[i] === undefined) ? 0 : (Math.max(amplitudes[i] / amplitudeScaleFactor, OSCILLOSCOPE_MIN_HEIGHT) * oscilloscopeMaxHeight);

        let patternDuration = knickebein.dotDurationSecs + knickebein.dashDurationSecs;

        if (timeWithinDotDashPatternFraction === undefined) {
            var colorFadeFactor = 0.0;
        } else {
            let thisBarDistanceFromNow = timeWithinDotDashPatternFraction - (i / amplitudes.length);
            if (thisBarDistanceFromNow < 0)    // Handle wrap-around.
                thisBarDistanceFromNow = 1.0 + thisBarDistanceFromNow;
            var colorFadeFactor = thisBarDistanceFromNow * OSCILLOSCOPE_FADE;
        }

        let baseColorRgb = ((i / amplitudes.length) < (knickebein.dotDurationSecs / patternDuration))
            ? COLOR_OSCILLOSCOPE_BAR_FOR_LEFT_RGB
            : COLOR_OSCILLOSCOPE_BAR_FOR_RIGHT_RGB;

        var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shape.setAttribute("x", sceneX + (i * oscilloscopeBarWidth));
        shape.setAttribute("y", sceneY + ((oscilloscopeMaxHeight - oscilloscopeHeight) / 2));
        shape.setAttribute("width", oscilloscopeBarWidth);
        shape.setAttribute("height", oscilloscopeHeight);
        shape.setAttribute("fill", svgColorSpecFromRgbArray(baseColorRgb));
        shape.setAttribute("opacity", 1.0 - colorFadeFactor);
        gameWorldImage.appendChild(shape);
    }
}


function drawRadioField(gameWorldImage, timestampSecs, knickebein, secondaryKnickebein) {
    let dotDashPatternDurationSecs = knickebein.dotDurationSecs + knickebein.dashDurationSecs;
    let timeWithinDotDashPatternSecs = modulo(timestampSecs, dotDashPatternDurationSecs);
    let timeWithinDotDashPatternFraction = timeWithinDotDashPatternSecs / dotDashPatternDurationSecs;

    let isDot = (timeWithinDotDashPatternSecs < knickebein.dotDurationSecs);

    let RADIO_GRID_CELL_SCENE_WIDTH = WORLD_SVG_VIEWBOX_WIDTH / radioField_1.length;

    for (var x = 0; x < radioField_1.length; x++) {
        for (var y = 0; y < radioField_1[x].length; y++) {
            if ((x === knickebein.transmitterPosX) && (y === knickebein.transmitterPosY))
                continue;
            if ((x === secondaryKnickebein.transmitterPosX) && (y === secondaryKnickebein.transmitterPosY))
                continue;

            let sceneXForSpot = sceneXFromSimX(x);
            // 'y + 1' because SVG has a downward-pointing coordinate system, whereas our simulation has an upward coordinate system.
            let sceneYForSpot = sceneYFromSimY(y + 1);
            //XXX A fudge adjustment to get vertical centering. We should calculate this automatically.
            sceneYForSpot += .2 / radioField_1[x].length * WORLD_SVG_VIEWBOX_HEIGHT;

            let radioFieldSignalIndicatorCenteringSceneX = (RADIO_GRID_CELL_SCENE_WIDTH - (RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH)) / 2;
            let baseColorRgb = isDot ? COLOR_FOR_LEFT_RGB : COLOR_FOR_RIGHT_RGB;
            drawRadioFieldSignalIndicator(gameWorldImage, sceneXForSpot + radioFieldSignalIndicatorCenteringSceneX, sceneYForSpot, RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC, radioField_1[x][y], baseColorRgb, true);

            if (drawOscilloscopeGrid) {
                let oscilloscopeCenteringSceneX = (RADIO_GRID_CELL_SCENE_WIDTH - (OSCILLOSCOPE_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH)) / 2;
                let sceneYForOscilloscope = sceneYForSpot + (.015 * WORLD_SVG_VIEWBOX_HEIGHT);
                let oscilloscopeMaxHeight = .035 * WORLD_SVG_VIEWBOX_HEIGHT;

                // It's too visually "busy" (distracting) to draw the current-time line on every oscilloscope. Only do it in one or two places (corners).
                let drawCurrentTimeIndicator = ((x === 0) && (y === 3)) || ((x === (RADIO_FIELD_SIZE - 3 - 1)) && (y === (RADIO_FIELD_SIZE - 1)));
                drawOscilloscope(gameWorldImage, timeWithinDotDashPatternFraction, sceneXForSpot + oscilloscopeCenteringSceneX, sceneYForOscilloscope, oscilloscopeMaxHeight, radioFieldWaveform_1[x][y].amplitudes, knickebein, false, drawCurrentTimeIndicator, undefined);
            }
        }
    }
}


function drawDirectionField(gameWorldImage, knickebein, radioFieldWaveform) {
    for (var x = 0; x < radioField_1.length; x++) {
        for (var y = 0; y < radioField_1[x].length; y++) {
            if ((x === knickebein.transmitterPosX) && (y === knickebein.transmitterPosY))
                continue;

            let amplitudes = radioFieldWaveform[x][y].amplitudes;
            let headingAdjustmentRadians = Aircraft.pilotHeadingAdjustmentRadiansWithFallback(amplitudes);
            let newDirectionRadians = Aircraft.pilotNewDirectionRadians(knickebein, headingAdjustmentRadians);

            let sceneX = sceneXFromSimX(x + .5);
            let sceneY = sceneYFromSimY(y + .5);

            var shape = document.createElementNS("http://www.w3.org/2000/svg", "line");
            shape.setAttribute("x1", sceneX);
            shape.setAttribute("y1", sceneY);
            shape.setAttribute("x2", sceneX + (.25 * WORLD_SVG_VIEWBOX_WIDTH / RADIO_FIELD_SIZE));
            shape.setAttribute("y2", sceneY);
            shape.setAttribute("transform", 'rotate(' + degreesFromRadians(-newDirectionRadians) + ', ' + sceneX + ', ' + sceneY + ')');
            shape.setAttribute("stroke", COLOR_FOR_DIRECTION_FIELD);
            gameWorldImage.appendChild(shape);
        }
    }
}


function drawAircraft(gameWorldImage, aircraft) {
    let sceneX = sceneXFromSimX(aircraft.x);
    let sceneY = sceneYFromSimY(aircraft.y);

    // Bombardment.
    if (nearTarget(aircraft.mainKnickebeinRadioFieldWaveform, aircraft.secondaryKnickebein, aircraft.x, aircraft.y)) {
        var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shape.setAttribute("x", sceneXFromSimX(Math.floor(aircraft.x)));
        shape.setAttribute("y", sceneYFromSimY(Math.floor(aircraft.y + 1)));
        shape.setAttribute("width", 1 / RADIO_FIELD_SIZE * WORLD_SVG_VIEWBOX_WIDTH);
        shape.setAttribute("height", 1 / RADIO_FIELD_SIZE * WORLD_SVG_VIEWBOX_HEIGHT);
        shape.setAttribute("rx", '10px');
        shape.setAttribute("ry", '10px');
        shape.setAttribute("fill", BOMBARDMENT_COLOR);
        gameWorldImage.appendChild(shape);
    }

    // The aircraft itself.
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    shape.setAttribute("cx", sceneX);
    shape.setAttribute("cy", sceneY);
    shape.setAttribute("r", 0.02 * WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("fill", COLOR_FOR_AIRCRAFT);
    shape.setAttribute("stroke", 'black');
    shape.setAttribute("stroke-width", '7px');
    shape.setAttribute("clip-path", 'url(#worldBackgroundClip)');
    gameWorldImage.appendChild(shape);
}


function drawAircraftPilot(gameWorldImage, sceneX, sceneY) {
    let pilotWidth = .08 * WORLD_SVG_VIEWBOX_WIDTH;
    let pilotHeight = .08 * WORLD_SVG_VIEWBOX_HEIGHT;

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "image");
    shape.setAttribute("x", sceneX);
    shape.setAttribute("y", sceneY);
    shape.setAttribute("width", pilotWidth);
    shape.setAttribute("height", pilotHeight);
    shape.setAttribute("href", 'images/pilot-1.webp');
    gameWorldImage.appendChild(shape);
}


function drawAircraftHeadingCorrection(gameWorldImage, sceneX, sceneY, aircraft) {
    // Draw a yoke, with the rotation equal to the heading correction. That's not at all physically correct: an aircraft yoke controls bank (even worse: the first derivative of that, to an extent), not the aircraft heading. But it's intuitively understandable to anybody, and that's far more important here.

    if (aircraft.mostRecentHeadingAdjustmentRadians === undefined)
        return;

    let yokeWidth = .075 * SVG_VIEWBOX_WIDTH;
    let yokeHeight = .075 * SVG_VIEWBOX_HEIGHT;

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "image");
    shape.setAttribute("x", sceneX);
    shape.setAttribute("y", sceneY);
    shape.setAttribute("width", yokeWidth);
    shape.setAttribute("height", yokeHeight);
    shape.setAttribute("href", 'images/yoke.jpeg');
    shape.setAttribute("transform", 'rotate(' + degreesFromRadians(-aircraft.mostRecentHeadingAdjustmentRadians) + ', ' + (sceneX + (yokeWidth / 2)) + ', ' + (sceneY + (yokeHeight / 2)) + ')');
    gameWorldImage.appendChild(shape);
}


function drawProjectedTargets(gameWorldImage, radioFieldWaveform, secondaryKnickebein) {
    for (var x = 0; x < radioField_1.length; x++) {
        for (var y = 0; y < radioField_1[x].length; y++) {
            // The '+ .5' is to measure from the center of the radio grid cell, not one of the corners.
            if (nearTarget(radioFieldWaveform, secondaryKnickebein, x + .5, y + .5)) {
                let sceneX = sceneXFromSimX(x);
                let sceneY = sceneYFromSimY(y + 1);

                let width = .10 * WORLD_SVG_VIEWBOX_WIDTH;
                let height = .12 * WORLD_SVG_VIEWBOX_WIDTH;

                var shape = document.createElementNS("http://www.w3.org/2000/svg", "image");
                shape.setAttribute("x", sceneX + ((WORLD_SVG_VIEWBOX_WIDTH / radioField_1.length) / 2) - (width / 2));
                shape.setAttribute("y", sceneY + ((WORLD_SVG_VIEWBOX_HEIGHT / radioField_1[x].length) / 2) - (height / 2) - (.01 * WORLD_SVG_VIEWBOX_HEIGHT));
                shape.setAttribute("width", width);
                shape.setAttribute("height", height);
                shape.setAttribute("href", 'images/Big-Ben-Tower-Illustration.svg');
                shape.setAttribute("clip-path", 'url(#worldBackgroundClip)');
                gameWorldImage.appendChild(shape);
            }
        }
    }
}


function drawAircraftDrift(gameWorldImage, sceneX, sceneY) {
    let windWidth = .05 * SVG_VIEWBOX_WIDTH;
    let windHeight = .05 * SVG_VIEWBOX_HEIGHT;

    var shape = document.createElementNS("http://www.w3.org/2000/svg", "image");
    shape.setAttribute("x", sceneX);
    shape.setAttribute("y", sceneY);
    shape.setAttribute("width", windWidth);
    shape.setAttribute("height", windHeight);
    shape.setAttribute("href", 'images/wind-2.svg');
    shape.setAttribute("transform", 'rotate(' + degreesFromRadians(-aircraftDriftDirectionRadians) + ', ' + (sceneX + (windWidth / 2)) + ', ' + (sceneY + (windHeight / 2)) + ')');
    gameWorldImage.appendChild(shape);
}


function drawRadioFieldIndicatorForAircraftLocation(gameWorldImage, sceneX, sceneY) {
    let ASPIRIN_INDICATOR_COLOR_RGB = [0x00, 0x00, 0xff];
    let B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC = .07;

    let totalAmplitude = radioField_1[Math.floor(mof_1.x)][Math.floor(mof_1.y)];

    //
    let knickebeinAmplitude = totalAmplitude - aspirin_1.mostRecentTransmissionAmplitude;
    if (knickebeinActive)
        drawRadioFieldSignalIndicator(gameWorldImage, sceneX, sceneY - ((B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC / 4) * WORLD_SVG_VIEWBOX_HEIGHT), B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC, knickebeinAmplitude, KNICKEBEIN_COLOR_FOR_RADIO_INDICATOR_RGB, false);

    if (!document.getElementById('aspirin-dot-amplitude').disabled)
        drawRadioFieldSignalIndicator(gameWorldImage, sceneX, sceneY + ((B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC / 4) * WORLD_SVG_VIEWBOX_HEIGHT), B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC, aspirin_1.mostRecentTransmissionAmplitude, ASPIRIN_INDICATOR_COLOR_RGB, false);

    //
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "text");
    shape.setAttribute("x", sceneX + .075 * WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("y", sceneY + .005 * WORLD_SVG_VIEWBOX_HEIGHT);
    shape.setAttribute("stroke", 'black');
    shape.textContent = "+=";
    gameWorldImage.appendChild(shape);

    //
    let totalFieldSceneX = sceneX + (.105 * WORLD_SVG_VIEWBOX_WIDTH);

    // Background rectangle. To make the correspondence with the sine waves on the map more intuitive. And for known-good color contrast.
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("x", totalFieldSceneX);
    shape.setAttribute("y", sceneY - (B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_HEIGHT / 2));
    shape.setAttribute("width", B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("height", B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC * WORLD_SVG_VIEWBOX_WIDTH);
    shape.setAttribute("rx", '1%');
    shape.setAttribute("fill", WORLD_BACKGROUND_COLOR);
    gameWorldImage.appendChild(shape);

    //
    drawRadioFieldSignalIndicator(gameWorldImage, totalFieldSceneX, sceneY, B_RADIO_FIELD_SIGNAL_INDICATOR_WIDTH_VIEWFRAC, totalAmplitude, COLOR_FOR_LEFT_RGB, false);
}


function drawWorld(gameWorldImage, timestampSecs) {
    sineWaveSetup(gameWorldImage);

    //
    drawBackground(gameWorldImage);

    if (drawKnickebein_2)
        drawKnickebeinTransmitter(gameWorldImage, undefined, knickebein_2);

    if (drawKnickebein_1)
        drawKnickebeinTransmitter(gameWorldImage, timestampSecs - KNICKEBEIN_ACTIVE_DELAY_SECS, knickebein_1);

    if (drawDirectionFieldGrid)
        drawDirectionField(gameWorldImage, knickebein_1, radioFieldWaveform_1);

    let dotDashPatternDurationSecs = knickebein_1.dotDurationSecs + knickebein_1.dashDurationSecs;
    if (knickebeinActive && (timestampSecs >= (KNICKEBEIN_ACTIVE_DELAY_SECS + KNICKEBEIN_POWER_RAMP_SECS + dotDashPatternDurationSecs)))
        drawProjectedTargets(gameWorldImage, radioFieldWaveform_1, knickebein_2);

    drawRadioField(gameWorldImage, timestampSecs - KNICKEBEIN_ACTIVE_DELAY_SECS, knickebein_1, knickebein_2);

    if (knickebeinActive)
        drawAircraft(gameWorldImage, mof_1);

    //
    drawRadioFieldIndicatorForAircraftLocation(gameWorldImage, .17 * SVG_VIEWBOX_WIDTH, .045 * SVG_VIEWBOX_HEIGHT);

    if (knickebeinActive) {
        let sceneX = 0.4 * SVG_VIEWBOX_WIDTH;
        let sceneY = 0.009 * SVG_VIEWBOX_HEIGHT;

        let oscilloscopeMaxHeight = .035 / 2 * WORLD_SVG_VIEWBOX_HEIGHT;
        let sceneYForOscilloscope = sceneY + (.022 * WORLD_SVG_VIEWBOX_HEIGHT) + (oscilloscopeMaxHeight / 2);

        drawOscilloscope(gameWorldImage, knickebein_1.timeWithinDotDashPatternFraction, sceneX, sceneYForOscilloscope, oscilloscopeMaxHeight, radioFieldWaveform_1[Math.floor(mof_1.x)][Math.floor(mof_1.y)].amplitudes, mof_1.mainKnickebein, true, true, WORLD_BACKGROUND_COLOR);
        sceneX += 0.075 * SVG_VIEWBOX_WIDTH;
        drawAircraftPilot(gameWorldImage, sceneX, sceneY);
        sceneX += 0.08 * SVG_VIEWBOX_WIDTH;
        drawAircraftHeadingCorrection(gameWorldImage, sceneX, sceneY, mof_1);
    }

    drawAircraftDrift(gameWorldImage, .7 * SVG_VIEWBOX_WIDTH, .017 * SVG_VIEWBOX_HEIGHT);
}


function flipSvgPrepare(svg) {
    var emptySvg = svg.cloneNode(false);
    return emptySvg;
}

function flipSvgFinalize(svg, newSvg) {
    var parentOfSvg = svg.parentElement;
    parentOfSvg.removeChild(svg);
    parentOfSvg.appendChild(newSvg);
}


// Section: Audio.

function setMorseAudioVolume() {
    let radioAmplitude = radioField_1[Math.floor(mof_1.x)][Math.floor(mof_1.y)];
    let amplitudes = radioFieldWaveform_1[Math.floor(mof_1.x)][Math.floor(mof_1.y)].amplitudes;
    let maxRadioAmplitude = radioAmplitude;
    if (amplitudes[0] !== undefined)
        maxRadioAmplitude = Math.max(maxRadioAmplitude, amplitudes[0]);
    if (amplitudes[amplitudes.length - 1] !== undefined)
        maxRadioAmplitude = Math.max(maxRadioAmplitude, amplitudes[amplitudes.length - 1]);
    let radioAmplitudeWithoutAbsoluteReference = radioAmplitude / maxRadioAmplitude;

    if (Math.abs(audio_1.volume - radioAmplitudeWithoutAbsoluteReference) >= .01)
        audio_1.volume = radioAmplitudeWithoutAbsoluteReference;
}


// Section: Interactive callbacks.

function drawOscilloscopeGridCallback() {
    drawOscilloscopeGrid = !drawOscilloscopeGrid;
}


function drawDirectionFieldCallback() {
    drawDirectionFieldGrid = !drawDirectionFieldGrid;
}


function aspirinPowerCallback() {
    let control1 = document.getElementById('aspirin-dot-amplitude');
    let control2 = document.getElementById('aspirin-dash-amplitude');

    if (control1.disabled) {
        control1.disabled = false;
        control2.disabled = false;
    } else {
        control1.disabled = true;
        control2.disabled = true;
    }

    let control3 = document.getElementById('aspirin-transmit');
    control3.src = control1.disabled ? 'images/switch-off.png' : 'images/switch-on.png';

    document.getElementById('aspirin-transmit-div').style = control1.disabled ? '' : 'color: blue;';
}


function aircraftDriftModCallback() {
    console.log("Changing wind direction.");
    aircraftDriftDirectionRadians = normalizeAngleRadians(aircraftDriftDirectionRadians + Math.PI);
}


function audioModCallback() {
    console.log("Toggling audio enable/disable.");

    if ((audio_1.currentTime == 0) || audio_1.paused)
        audio_1.play();
    else
        audio_1.pause();
}


// Section: Simulation step.

function calcWorldTimeStep(timestampSecs) {
    //
    if (document.getElementById('aspirin-dot-amplitude').disabled) {
        aspirin_1.dotTransmission = 0.0;
        aspirin_1.dashTransmission = 0.0;
    } else {
        aspirin_1.dotTransmission = document.getElementById('aspirin-dot-amplitude').value / 100 * .5;
        aspirin_1.dashTransmission = document.getElementById('aspirin-dash-amplitude').value / 100 * .5;
    }

    //
    resetRadioField(radioField_1);

    //
    let dotDashPatternDurationSecs = knickebein_1.dotDurationSecs + knickebein_1.dashDurationSecs;
    drawKnickebein_1 = timestampSecs >= KNICKEBEIN_1_APPEAR_DELAY_SECS;
    drawKnickebein_2 = timestampSecs >= KNICKEBEIN_2_APPEAR_DELAY_SECS;
    knickebeinActive = timestampSecs >= KNICKEBEIN_ACTIVE_DELAY_SECS;
    knickebein_1.transmitterPowerFactor = knickebeinActive
        ? ((KNICKEBEIN_POWER_RAMP_SECS == 0)
           ? 1.0
           : Math.min(Math.max((timestampSecs - KNICKEBEIN_ACTIVE_DELAY_SECS) / KNICKEBEIN_POWER_RAMP_SECS, 0.0), 1.0))
        : 0.0;

    //
    knickebein_1.simulationStepCalculateRadioField(timestampSecs - KNICKEBEIN_ACTIVE_DELAY_SECS);
    aspirin_1.simulationStepCalculateRadioField(timestampSecs - KNICKEBEIN_ACTIVE_DELAY_SECS);
    updateRadioFieldWaveform(radioFieldWaveform_1, radioField_1, knickebein_1);

    //
    if (knickebeinActive) {
        mof_1.simulationStep(TIME_STEP_SECS);

        if ((Math.floor(mof_1.x) < 0) || (Math.floor(mof_1.x) >= RADIO_FIELD_SIZE) || (Math.floor(mof_1.y) < 0) || (Math.floor(mof_1.y) >= RADIO_FIELD_SIZE))
            initAircraft1Position();

        if (nearTarget(mof_1.mainKnickebeinRadioFieldWaveform, mof_1.secondaryKnickebein, mof_1.x, mof_1.y)) {
            mof_1.haveDroppedLoad = true;
        } else {
            if (mof_1.haveDroppedLoad)
                initAircraft1Position();    // Aircraft has finished its job. Create a new one.
        }
    }
}


function simulationTimeStep() {
    //
    let durationSinceStartMillisecs = window.performance.now() - startTimestampMillisecs;
    let durationSinceStartSecs = durationSinceStartMillisecs / 1000;

    //
    let mostRecentWorldUpdateDurationSinceStartSecs = nextWorldUpdateDurationSinceStartSecs;
    while (nextWorldUpdateDurationSinceStartSecs < durationSinceStartSecs) {
        calcWorldTimeStep(nextWorldUpdateDurationSinceStartSecs);

        mostRecentWorldUpdateDurationSinceStartSecs = nextWorldUpdateDurationSinceStartSecs;
        nextWorldUpdateDurationSinceStartSecs += TIME_STEP_SECS;
    }

    //
    setMorseAudioVolume();

    //
    let oldGameWorldImage = document.getElementById('game-world-image');
    let newGameWorldImage = flipSvgPrepare(oldGameWorldImage);

    drawWorld(newGameWorldImage, mostRecentWorldUpdateDurationSinceStartSecs);

    flipSvgFinalize(oldGameWorldImage, newGameWorldImage);
}


// Section: Main init.

var knickebeinActive;
var drawKnickebein_1;
var drawKnickebein_2;

var drawOscilloscopeGrid = false;
var drawDirectionFieldGrid = false;


var radioField_1 = createRadioField();


var knickebein_1 = new Knickebein();
knickebein_1.transmitterPosX = RADIO_FIELD_SIZE - 1;
knickebein_1.transmitterPosY = 0;
knickebein_1.beamDirectionAngleRadians = 0.75 * Math.PI;
knickebein_1.dotDurationSecs = 500 / 1000;
// The Morse convention is that the duration of a dah is 3 * the duration of a dit.
// In my experience, that makes the feeling a bit unpleasant. So, I choose a little less.
knickebein_1.dashDurationSecs = 2.5 * knickebein_1.dotDurationSecs;


var knickebein_2 = new Knickebein();
knickebein_2.transmitterPosX = .9 * RADIO_FIELD_SIZE;
knickebein_2.transmitterPosY = .7 * RADIO_FIELD_SIZE;
knickebein_2.beamDirectionAngleRadians = 0.96 * Math.PI;


//XXX It would be nicer to calculate this automatically.
// knickebein_1.dotDurationSecs + knickebein_1.dashDurationSecs = 3.5. Take the smallest integer that's a multiple of that.
let WAVEFORM_SIZE = 7;

var radioFieldWaveform_1 = createRadioFieldWaveform(WAVEFORM_SIZE);


var aspirin_1 = new AspirinTransmitter();
aspirin_1.mainKnickebein = knickebein_1;

// 0 means east, pi/2 means north, -pi/2 means south, pi means west, etc.
var aircraftDriftDirectionRadians = knickebein_1.beamDirectionAngleRadians - AIRCRAFT_DRIFT_DIRECTION_RELATIVE_TO_BEAM_RADIANS;


var mof_1_init_num = 0;

var mof_1 = new Aircraft();
initAircraft1Position();
mof_1.velocity = RADIO_FIELD_SIZE / 60;
mof_1.mainKnickebein = knickebein_1;
mof_1.mainKnickebeinRadioFieldWaveform = radioFieldWaveform_1;
mof_1.secondaryKnickebein = knickebein_2;


var audio_1 = new Audio('sounds/audiocheck.net_sin_1150Hz_-3dBFS_3s.wav');
audio_1.loop = true;


let dotDashPatternDurationSecs = knickebein_1.dotDurationSecs + knickebein_1.dashDurationSecs;
let TIME_STEP_SECS = Math.min(
    knickebein_1.dotDurationSecs,
    dotDashPatternDurationSecs / WAVEFORM_SIZE);

//XXX This nice-to-have is disabled for now because the CPU load of my older machines is a bit more than comfortable.
// Reduce aliasing artifacts. Let's just pick the Nyquist rate; not appropriate, but a reasonable first try.
//TIME_STEP_SECS = TIME_STEP_SECS / 2;

let startTimestampMillisecs = window.performance.now();
var nextWorldUpdateDurationSinceStartSecs = 0;


window.onload = function() {
    let control1 = document.getElementById('aspirin-dot-amplitude');
    control1.disabled = false;    // We'll toggle.
    aspirinPowerCallback();
}


let timer1 = setInterval(simulationTimeStep, TIME_STEP_SECS * 1000);    // 60 Hz would be 16.66 (ms) here.
