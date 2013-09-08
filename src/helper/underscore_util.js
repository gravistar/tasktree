/**
 *  Some convenience methods for underscore.
 */

var __ = (function(){
    var ret = {};

    /**
     * Filters out the null values from an array.
     * @param vals {Array}
     * @returns {Array}
     */
    function nonNull(vals) {
        return _.filter(vals, function(val){
            return val !== null;
        });
    }

    ret.nonNull = nonNull;
    return ret;
})();