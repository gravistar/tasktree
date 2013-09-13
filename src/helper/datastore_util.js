/**
 * Utility functions for operating with datastore.
 *
 * Requires underscore and underscore utils.
 */

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
    function bulkGet(table, recordIds) {
        return __.nonNull(_.map(recordIds, function(recordId){
            return table.get(recordId);
        }));
    }

    /**
     * Gets the field value for a list of records.
     * @param records {Array[Datastore.Record]}. Records to map over.
     * @param field {String}. Field to get.
     * @returns {Array}. The field values for these records. Will be
     *      null for records that don't have the field.
     */
    function getFieldValues(records, field){
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
    function getFieldsWithId(record){
        var ret = record.getFields();
        ret.id = record.getId();
        return ret;
    }

    // build the actual object here
    ret.bulkGet = bulkGet;
    ret.getFieldValues = getFieldValues;
    ret.getFieldValuesWithId = getFieldsWithId;
    return ret;
})();
