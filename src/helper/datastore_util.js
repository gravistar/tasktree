/**
 * Utility functions for operating with datastore.
 *
 * Requires underscore and underscore utils.
 */
if (typeof require !== "undefined") {
    _ = require("underscore");
}
var DatastoreUtil = (function(){
    var ret = {};

    /**
     * Wipes all the records in a table.
     * @param table
     */
    ret.wipeTable = function(table){
        var allRecords = table.query({});
        _.each(allRecords, function(record){
            record.deleteRecord();
        });
    };

    /**
     * Fetches the records specified by recordIds from table.
     * @param table {Datastore.Table}
     * @param recordId {Array[String]}
     * @returns {Array} No nulls.
     */
    ret.bulkGet = function(table, recordIds) {
        return __.nonNull(_.map(recordIds, function(recordId){
            return table.get(recordId);
        }));
    }

    /**
     * A brute force range query. Right now inclusive...
     * @param table
     * @param field
     * @param lower
     * @param upper
     */
    ret.rangeQuery = function(table, field, lower, upper){
        var records = table.query({});
        if (lower !== null && typeof lower !== "undefined") {
            records = _.filter(records, function(record){
                return record.get(field) >= lower;
            });
        }
        if (typeof upper !== "undefined") {
            records = _.filter(records, function(record){
                return record.get(field) <= upper;
            });
        }
        return _.sortBy(records, function(record){
            return record.get(field);
        });
    }

    /**
     * Gets the field value for a list of records.
     * @param records {Array[Datastore.Record]}. Records to map over.
     * @param field {String}. Field to get.
     * @returns {Array}. The field values for these records. Will be
     *      null for records that don't have the field.
     */
    ret.getFieldValues = function(records, field){
        return _.map(records, function(record){
            return record.get(field);
        });
    }

    /**
     * Returns an object which has the fields of record plus the record's id as
     * the "id" field. Useful for ich templating.
     * @param record {Datastore.Record}. Record with data to extract.
     * @returns {Object}. Record data plus its id as "id" field.
     */
    ret.getFieldValuesWithId = function(record){
        var ret = record.getFields();
        ret.id = record.getId();
        return ret;
    }

    /**
     * A function which will wait a maximum number of times for the datastore to finish syncing.
     * @param datastore
     *      datastore to wait on
     * @param poll
     *      amt of time to wait between checking sync status (ms)
     * @param maxPoll
     *      maximum number of times to poll
     * @param callback
     *      should be an operation on the datastore.
     */
    ret.syncDatastore = (function(){
        // default values
        var defaultPoll = 1000, defaultMaxPolls = 10;

        var pollCount = 0;

        // Actual returned method here
        var waitForSyncHelper = function(datastore, callback, poll, maxPoll) {
            callback = typeof callback !== "undefined" ? callback : function(){ return; };
            poll = typeof poll !== "undefined" ? poll : defaultPoll;
            maxPoll = typeof maxPoll !== "undefined" ? maxPoll : defaultMaxPolls;
            if (datastore.getSyncStatus().uploading && pollCount < maxPoll) {
                console.log("datastore " + datastore.getId() + " uploading: " + datastore.getSyncStatus().uploading);
                pollCount += 1;
                setTimeout(waitForSyncHelper, poll, datastore, callback, poll, maxPoll);
            } else {
                console.log("datastore " + datastore.getId() + " uploading: " + datastore.getSyncStatus().uploading);
                callback(datastore);
            }
        };
        return waitForSyncHelper;
    }());

    return ret;
})();

if (typeof exports !== "undefined") {
    exports.DatastoreUtil = DatastoreUtil;
}
