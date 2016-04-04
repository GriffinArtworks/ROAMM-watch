/**
 * Analysis Manager
 * @param rawData
 */

var STRENGTH = [];
var FREQUENCIES = [];
var ONE_EIGHTY_OVER_PI = 180 / Math.PI;
var dfIdx = -1;

//var P625 = [];

var ONE_EIGHTY_OVER_PI = 180 / Math.PI;
var POINTS_IN_WINDOW = 450;

/**
 * 
 * @param rawData {timestamp:Date, x:float, y:float, z:float}
 * @returns
 */
function processData(rawData) {
	
	//console.log(rawData);

    var vms = [], 
    strength = [],
    frequencies = [],
    dfIdx = -1,
    xs = [];

    for (var i = 0; i < rawData.length; i++) {
        xs.push(rawData[i].x);
    }

    console.log("Begin feature extraction process");

    // Compute vector magnitudes of all raw data
    for (var i = 0; i < rawData.length; ++i) {
        vms.push(getVectorMagnitude(rawData[i]));
    }

    // Convert vm's into complex array for processing
    //console.log("Converting to complex array");

    var data = new complex_array.ComplexArray(vms.length);
    data.map(function(value, i, n) {
        value.real = vms[i];
    });

    //console.log("Performing FFT");

    // Perform FFT
    var fftResult = data.FFT();

    var unscaledStrength = fftResult.magnitude();

    // Scale magnitudes
    unscaledStrength.forEach(function(item, i) {
        strength.push(item / Math.sqrt(unscaledStrength.length));
    });

    // Generate frequency vector
    var scale = 30.0 / strength.length;
    for (var i = 0; i < strength.length; i++) {
        frequencies[i] = i * scale;
    }

    // Eliminate upper half of the frequencies and strength
    frequencies = frequencies.splice(0, Math.ceil(frequencies.length / 2));
    strength = strength.splice(0, Math.ceil(strength.length / 2));

//    console.log("number of frequencies", frequencies[frequencies.length-1]);

    // Remove first element to eliminate DC
    strength.shift();
    frequencies.shift();
    
    //console.log(frequencies);

    return runAnalysis(xs, vms, strength, frequencies);
}

function runAnalysis(xs, vms, strength, frequencies) {
    var f1_avgVectorMagnitudes = average(vms);
    var f2_stdDevVectorMagnitudes = standardDeviation(vms);

    // Used for mangle and sdangle
    var angles = getAngles(xs, vms);
    var f3_mangle = average(angles);
    var f4_sdAngle = standardDeviation(angles);

    var f5_p625 = getP625(frequencies, strength);

    var f6_df = getDominantFrequency(frequencies, strength);

    var f7_fpdf = getFpdf(strength, DF_IDX);
    
    var output = new Features();
    
    output.mvm = f1_avgVectorMagnitudes;
    output.sdvm = f2_stdDevVectorMagnitudes;
    output.mangle = f3_mangle;
    output.sdangle = f4_sdAngle;
    output.p625 = f5_p625;
    output.df = f6_df;
    output.fpdf = f7_fpdf;
    output.largeWindow = false;
    output.timestamp = new Date();

    console.log(output);

    return output;
}

function averageOverLargeWindow(features){
	
	console.log("performing large window feature aggregation");
	
	var avgFeatures = new Features();
	var numItems = features.length;
	
	console.log(features);
	
	for(var i = 0; i < features.length; i++){
		console.log(features[i]);
		if(features[i].mvm){
			avgFeatures.mvm += features[i].mvm;
		}
		if(features[i].sdvm){
			avgFeatures.sdvm += features[i].sdvm;
		}
		if(features[i].mangle){
			avgFeatures.mangle += features[i].mangle;
		}
		if(features[i].sdangle){
			avgFeatures.sdangle += features[i].sdangle;
		}
		if(features[i].p625){
			avgFeatures.p625 += features[i].p625;
		}
		if(features[i].df){
			avgFeatures.df += features[i].df;
		}
		if(features[i].fpdf){
			avgFeatures.fpdf += features[i].fpdf;
		}
	}
	
	avgFeatures.mvm = avgFeatures.mvm/numItems;
	avgFeatures.sdvm = avgFeatures.sdvm/numItems;
	avgFeatures.mangle = avgFeatures.mangle/numItems;
	avgFeatures.sdangle = avgFeatures.sdangle/numItems;
	avgFeatures.p625 = avgFeatures.p625/numItems;
	avgFeatures.df = avgFeatures.df/numItems;
	avgFeatures.fpdf = avgFeatures.fpdf/numItems;
	avgFeatures.largeWindow = true;
	avgFeatures.timestamp = new Date();
	
	return avgFeatures;
}

function sum(arr) {
    return _.reduce(arr, function(sum, n) {
        return sum + n;
    }, 0);
}

function average(arr) {
    return sum(arr) / arr.length;
}

function standardDeviation(arr) {
    var avg = average(arr);

    var squareDiffs = _.map(arr, function(value) {
        var diff = value - avg;
        var sqrDiff = diff * diff;
        return sqrDiff;
    });

    var avgSquareDiff = average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}

function getAngles(xs, vms) {
    var angles = [];
    for (var i = 0; i < xs.length; i++) {
        angles.push((xs[i] / vms[i]) * ONE_EIGHTY_OVER_PI);
    }
    return angles;
}

function getP625(freqs, mags) {
    // TODO these should be computed only once

    var point6Hz = getClosestIndexLeft(freqs, 0.6);
    var twoPoint5Hz = getClosestIndexRight(freqs, 2.5);
    var fiveHz = getClosestIndexLeft(freqs, 5);

//    console.log(point6Hz, twoPoint5Hz, fiveHz);
//    console.log(freqs[point6Hz], freqs[twoPoint5Hz], freqs[fiveHz]);
//    console.log(freqs[point6Hz+1], freqs[twoPoint5Hz-1], freqs[fiveHz+1]);

    var numerator = sum(_.slice(mags, point6Hz, twoPoint5Hz - 1));
    var denominator = sum(mags);

//    console.log("numerator", numerator, "denominator", denominator);

//    P625.push({
//        numerator: numerator,
//        denominator: denominator,
//        point6_magnitude: mags[point6Hz],
//        twoPoint5_magnitude: mags[twoPoint5Hz],
//        five_magnitude: mags[fiveHz]
//    });

    return (numerator / denominator);
}

function getDominantFrequency(freqs, mags) {
    var highestIdx = 0;
    var max = -1;

    for (var i = 0; i < mags.length; i++) {
        if (mags[i] > max) {
            highestIdx = i;
            max = mags[i];
        }
    }

    DF_IDX = highestIdx;

    return freqs[highestIdx];
}

function getFpdf(mags, dfIdx) {
    var sumStrength = sum(mags);

    var numSum = mags[dfIdx];

    // left 2 points
    var i = dfIdx - 1;
    while (i >= 0 && dfIdx - i < 3) {
        numSum += mags[i--];
    }

    // right 2 points
    i = dfIdx + 1;
    while (i < mags.length && i - dfIdx < 3) {
        numSum += mags[i++];
    }

    return numSum / sumStrength;

}

function getClosestIndexLeft(arr, val) {
    var i = 0;
    while (arr[i] < val) {
        i++;
    }

    if(arr[i+1] === val){
      return i+1;
    }

    if (i === 0) {
        i++;
    }

    return i - 1;
}

function getClosestIndexRight(arr, val){
    var i = 0;
    while (arr[i] < val) {
        i++;
    }

    if(arr[i+1] === val){
      return i+1;
    }

    if (i === 0) {
        i++;
    }

    if(i === arr.length){
        i--;
    }

    return i;
}

function getVectorMagnitude(data) {
    return Math.sqrt(Math.pow(data.x, 2) + Math.pow(data.y, 2) + Math.pow(data.z, 2));
}