/**
 * Created with JetBrains WebStorm.
 * User: david
 * Date: 9/17/13
 * Time: 7:29 PM
 *
 * A grab bag of misc. javascript helper functions
 */

var jsUtil = (function() {
    var jsUtil = {};

    /**
     * Converts a time period in ms to a human readable format
     * @param timeMs {long} The time period in ms.
     * @returns {string} Human readable format of this time period.
     */
    jsUtil.humanReadable = function(timeMs) {
        var duration = convertMsDuration(timeMs);
        return duration.days + " days, " +
            duration.hours + " hours, " + duration.minutes + " minutes";
    }

    jsUtil.humanReadableShort = function(timeMs){
        var duration = convertMsDuration(timeMs);
        return duration.days + ":" + duration.hours + ":" + duration.minutes;
    }

    /**
     * Converts a duration in ms to a human readable object
     * @param timeMs
     * @returns {{minutes: number, hours: number, days: number}}
     */
    var convertMsDuration = jsUtil.convertMsDuration = function(timeMs) {
        var days, hours, minutes, tmp = Math.floor((timeMs/1000)/60);
        minutes = tmp % 60;
        tmp = Math.floor(tmp / 60);
        hours = tmp % 24;
        days = Math.floor(tmp / 24);
        return {
            minutes : minutes,
            hours : hours,
            days : days
        };
    }

    /**
     * Rounds a date object to single day precision.
     * @param time {Date} The time to round.
     * @returns Date. the date rounded to its midnight time.
     */
    jsUtil.roundDay = function(time) {
        var tmp = new Date(time);
        tmp.setHours(0);
        tmp.setMinutes(0);
        tmp.setSeconds(0);
        tmp.setMilliseconds(0);
        return tmp;
    };

    return jsUtil;
})()
