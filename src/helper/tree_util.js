/**
 * Library functions for handling Datastore.Records that have a tree structure.
 * A pretty natural way to have a tree structure for these records is to have
 * each record have a "parentId" field.  Finding the children of a record just amounts
 * to a .query({parentId: id}).
 *
 * Requires Datastore.Util.
 */

var TreeUtil = (function(){
    var PARENT_ID_FIELD = "parentId", TreeUtil = {}, NO_PARENT = "NO PARENT";

    TreeUtil.NO_PARENT = NO_PARENT;
    TreeUtil.PARENT_ID_FIELD = PARENT_ID_FIELD;

    /**
     * Returns the set of ids of the parents from a given set of records.
     * @param records {Datastore.Record}.
     * @param parentIdField {String}. Name of the parent field.
     * @returns {Array[String]}. Record ids of the parents.
     */
    var parentIdSet = TreeUtil.parentIdSet = function (records, parentIdField){
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var getParentId = function(record) {
            return record.get(parentIdField);
        };
        return _.uniq(__.nonNull(_.map(records, getParentId)));
    }

    /**
     *
     * @param records
     * @param parentTable
     * @param parentIdField
     * @returns {*}
     */
    var parentSet = TreeUtil.parentSet = function (records, parentTable, parentIdField) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var parentIdSet = parentIdSet(records, parentIdField);
        return _.map(parentIdSet, function(parentId){
            return parentTable.get(parentId);
        });
    }


    /**
     *
     * @param rcEvent
     * @param table
     * @returns {*}
     */
    var deletedRecords = TreeUtil.deletedRecords = function(rcEvent, table) {
        var records = rcEvent.affectedRecordsForTable(table.getId());
        return _.filter(records, function(record){
            return record.isDeleted();
        });
    }

    /**
     *
     * @param rcEvent
     * @param table
     * @param parentIdField
     * @param noParent
     * @returns {*}
     */
    var rootRecords = TreeUtil.rootRecords = function(rcEvent, table, parentIdField, noParent) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        if (typeof(noParent) === "undefined") {
            noParent = NO_PARENT;
        }
        var records = rcEvent.affectedRecordsForTable(table.getId());
        return _.filter(records, function(record){
            return record.get(parentIdField) === noParent;
        });
    }

    /**
     *
     * @param rcEvent
     * @param table
     * @param parentTable
     * @param parentIdField
     */
    var affectedParents = TreeUtil.affectedParents = function(rcEvent, table, parentTable, parentIdField) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var records = rcEvent.affectedRecordsForTable(table.getId());
        return parentSet(records, parentTable, parentIdField);
    }

    /**
     *
     * @param rcEvent
     * @param table
     * @param parentIdField
     * @param noParent
     * @returns {*}
     */
    var childRecords = TreeUtil.childRecords = function(rcEvent, table, parentIdField, noParent) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        if (typeof(noParent) === "undefined") {
            noParent = NO_PARENT;
        }
        var records = rcEvent.affectedRecordsForTable(table.getId());
        return _.filter(records, function(record){
            return record.get(parentIdField) !== noParent;
        });
    }

    /**
     * Builds a RecordsChanged callback that's invoked on the deleted records.
     * @param table {Datastore.Table}. Table to get deleted records from.
     * @param callback {Function(Datastore.Record)}. Callback to invoke on each deleted record.
     * @returns {Function}
     */
    TreeUtil.rcOnDeleted = function(table, callback) {
        return function(rcEvent) {
            var deleted = deletedRecords(rcEvent, table);
            _.each(deleted, callback);

            /*function(record){
                $("#" + record.getId()).remove();
            });*/
        }
    }

    /**
     * Builds a RecordsChanged callback that's invoked on the root records.
     * @param table {Datastore.Table}. Table to get root records from.
     * @param renderFn {Function}. Function that tells how to render the record.
     * @param parentIdField
     * @param NO_PARENT
     * @returns {Function}
     */
    TreeUtil.rcOnRoots = function(table, callback) {
        return function(rcEvent) {
            var roots = rootRecords(rcEvent, table);
            _.each(roots, callback);

            /**
            _.each(roots, function(record){
                var $changedRecord = renderFn(record);
                $main.append($changedRecord);
                addListeners($changedRecord);
            })*/
        }
    }

    /**
     * Builds a RecordsChanged callback for records that are subnodes in the record hierarchy.
     * @param table
     * @param parentTable
     * @param parentRenderFn
     * @param addListeners
     */
    TreeUtil.rcOnChildren = function(table, callback) {
        return function(rcEvent) {
            var children = childRecords(rcEvent, table);
            _.each(children, callback);
        }

        /*
        var children = childRecords(rcEvent)
        var records = rcEvent.affectedRecordsForTable(table.getId());
        var children = _.filter(records, function(record){
            return record.get(PARENT_ID_FIELD) !== NO_PARENT;
        });
        var parentIdSet = parentIdSet(children, PARENT_ID_FIELD);
        var parents = _.map(parentIdSet, function(parentId){
            return parentTable.get(parentId);
        });
        _.each(parents, function(parent){
            var $parent = parentRenderFn(parent);
            $("#" + parent.getId()).replaceWith($parent);
            addListeners($parent);
        })
        */
    }

    /**
     *
     * @param table
     * @param parentTable
     * @param callback
     * @returns {Function}
     */
    TreeUtil.rcOnAffectedParents = function(table, parentTable, callback){
        return function(rcEvent) {
            var affectedParents = affectedParents(rcEvent, table, parentTable);
            _.each(affectedParents, callback);
        }
    }

    return TreeUtil;
})();

