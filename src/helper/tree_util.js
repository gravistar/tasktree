/**
 * Library functions for handling Datastore.Records that have a tree structure.
 *
 * The Records are assumed to be laid out in the following fashion:
 *      parentIdField: parentId {String}
 *      childListField: children {Array[String]}
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
    var getParentIdSet = TreeUtil.getParentIdSet = function(records, parentIdField){
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var getParentId = function(record) {
            return record.get(parentIdField);
        };
        return _.filter(_.uniq(__.nonNull(_.map(records, getParentId))), function(id){
            return id !== NO_PARENT;
        });
    }

    /**
     *
     * @param records
     * @param parentTable
     * @param parentIdField
     * @returns {*}
     */
    var getParentSet = TreeUtil.getParentSet = function(records, parentTable, parentIdField) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var parentIdSet = getParentIdSet(records, parentIdField);
        return _.map(parentIdSet, function(parentId){
            return parentTable.get(parentId) });
    }

    /**
     * Returns all the root records in the table.
     * @param table
     * @param parentIdField
     * @param noParentId
     * @returns {Array[Datastore.Record]}
     */
    TreeUtil.allRootRecords = function(table, parentIdField, noParentId) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        if (typeof(noParentId) === "undefined") {
            noParentId = NO_PARENT;
        }
        var queryParam = {};
        queryParam[parentIdField] = noParentId;
        return table.query(queryParam);
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
     * @type {Function}
     */
    var liveRecords = TreeUtil.liveRecords = function(rcEvent, table) {
        var records = rcEvent.affectedRecordsForTable(table.getId());
        return _.filter(records, function(record){
            return !record.isDeleted();
        });
    }

    /**
     * Creates a new record from recordData in recordTable.  Then updates the parent record so it has a reference
     * to the newly created record.
     * @param toCreateData {Object}. Data for the record to be created.
     * @param recordTable {Datastore.Table}. Table to create record in.
     * @param parentTable {Datastore.Table}. Parent table.
     * @param childListField {String}. Name of the children field in parent record.
     * @param parentIdField {String|undefined}. Name of the parentId field in created record. Defaults to NO_PARENT.
     * @returns {Datastore.Record}. The created record.
     */
    TreeUtil.createTreeRecord = function(toCreateData, recordTable, parentTable, childListField, parentIdField) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var created = recordTable.insert(toCreateData);
        var parentId = created.get(parentIdField);
        if (parentId !== NO_PARENT) {
            var parent = parentTable.get(parentId);
            var children = parent.get(childListField).toArray();
            children.unshift(created.getId());
            parent.set(childListField, children);
        }
        return created;
    }

    /**
     * First updates parent record's child list to remove reference to record to be deleted.
     * Then deletes the record.
     * @param toDelete {Datastore.Record}. Record to delete.
     * @param parentTable {Datastore.Table}. Parent table.
     * @param childListField {String}. Name of the children field in parent record.
     * @param parentIdField {String|undefined}. Name of the parentId field in created record. Defaults to NO_PARENT.
     * @returns Datastore.Record. The deleted record.
     */
    TreeUtil.deleteTreeRecord = function(toDelete, parentTable, childListField, parentIdField) {
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        var parentId = toDelete.get(parentIdField);
        if (parentId !== NO_PARENT) {
            var parent = parentTable.get(parentId);
            var children = parent.get(childListField).toArray();
            parent.set(childListField, _.filter(children, function(childId){
                return toDelete.getId() !== childId;
            }));
        }
        return toDelete.deleteRecord();
    }

    /**
     * Updates a record, then calls an update callback on this record's parent.
     * @param toUpdate
     * @param updateData
     * @param parentTable
     * @param childListField
     * @param parentIdField
     */
    TreeUtil.updateTreeRecord = function(toUpdate, updateData, parentTable, updateParentCb, parentIdField){
        if (typeof(parentIdField) === "undefined") {
            parentIdField = PARENT_ID_FIELD;
        }
        toUpdate.update(updateData);
        var parentId = toUpdate.get(parentIdField);
        var parent = parentTable.get(parentId);
        updateParentCb(parent);
        return toUpdate;
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
            return !record.isDeleted() && record.get(parentIdField) === noParent;
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
        return getParentSet(records, parentTable, parentIdField);
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
            return !record.isDeleted() && record.get(parentIdField) !== noParent;
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
        }
    }

    /**
     *
     * @param table
     * @param callback
     * @returns {Function}
     */
    TreeUtil.rcOnRoots = function(table, callback) {
        return function(rcEvent) {
            var roots = rootRecords(rcEvent, table);
            _.each(roots, callback);
        }
    }


    /**
     *
     * @param table
     * @param callback
     * @returns {Function}
     */
    TreeUtil.rcOnChildren = function(table, callback) {
        return function(rcEvent) {
            var children = childRecords(rcEvent, table);
            _.each(children, callback);
        }
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
            var parents = affectedParents(rcEvent, table, parentTable);
            _.each(parents, callback);
        }
    }

    /**
     * Calls the callback on each of the records ancestors (excluding the record itself)
     * @param root
     * @param table
     * @param callback
     * @param parentIdField
     * @param topDown
     */
    var onAncestors = TreeUtil.onAncestors = function(root, table, callback, topDown) {
        var parentId, parent, ancestors = [];
        while (true) {
            parentId = root.get(PARENT_ID_FIELD);
            if (parentId === NO_PARENT) {
                break;
            }
            parent = table.get(parentId);
            ancestors.push(parent);
            root = parent;
        }
        if (topDown) {
            ancestors = ancestors.reverse();
        }
        _.each(ancestors, callback);
    }

    /**
     *
     * @param root
     * @param table
     * @param callback
     */
    TreeUtil.onAncestorsTopDown = function(root, table, callback) {
        onAncestors(root, table, callback, true);
    }

    /**
     *
     * @param root
     * @param table
     * @param callback
     */
    TreeUtil.onAncestorsBottomUp = function(root, table, callback) {
        onAncestors(root, table, callback, false);
    }

    /**
     * Calls the callback on each of the records rooted at root.
     * @param root {Datastore.Record}.
     * @param table {Datastore.Table}. Children must be in this table.
     * @param callback {Function}. Takes in {Datastore.Record} as its argument.
     * @param childListField {String}. Name of the field with child ids.
     * @param topDown {boolean}. True if topdown order. Otherwise, bottom up.
     */
    TreeUtil.onTree = function(root, table, callback, childListField, topDown) {
        var childIds = root.get(childListField).toArray();
        var children = _.map(childIds, function(childId){
            return table.get(childId);
        });
        if (topDown) {
            callback(root, children);
        }
        _.each(children, function(child){
            TreeUtil.onTree(child, table, callback, childListField, topDown);
        });

        if (!topDown) {
            callback(root, children);
        }
    }

    /**
     * Calls the callback on each of the records in the subtree rooted at root.
     * Does so in a bottom up order- children processed before parents.
     * @param root
     * @param table
     * @param callback
     * @param childListField
     * @returns {*}
     */
    TreeUtil.onTreeBottomUp = function(root, table, callback, childListField) {
       return TreeUtil.onTree(root, table, callback, childListField, false);
    }

    /**
     * Calls the callback on each of the records in the subtree rooted at root.
     * Does so in a top down order- parents processed before children.
     * @param root
     * @param table
     * @param callback
     * @param childListField
     * @returns {*}
     */
    TreeUtil.onTreeTopDown = function(root, table, callback, childListField) {
        return TreeUtil.onTree(root, table, callback, childListField, true);
    }

    return TreeUtil;
})();

