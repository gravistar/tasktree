/**
 * Provides methods for creating tasks, which will be stored in the datastore.
 *
 * Important: completed tasks will have a completeTime field.  This field will be
 * missing for incomplete tasks.
 *
 * Other fields that I'm adding:
 *      archived: Boolean. True if task is archived, false if not.  Task
 *          must be completed to be archived.  When it gets marked as incomplete,
 *          it gets unarchived.
 *
 */
var TaskTree = (function() {
    var ret = {}, DEFAULT_WEIGHT = 100, CHILD_LIST_FIELD = "subtaskIds";

    ret.DEFAULT_WEIGHT = DEFAULT_WEIGHT;
    ret.CHILD_LIST_FIELD = CHILD_LIST_FIELD;

    /**
     * Builds a fresh config record.  Config record currently has focusedListId field and queue field.
     *  focusedListId keeps track of focusedList. Is null if all lists should be displayed.
     *  queue is a list of queued is. order of ids in the queue is the order that they will be rendered in,
     *      so order matters.
     * @returns {{queue: Array}}
     */
    ret.buildConfig = function(){
        var ret = {
            queue : [],
            focusedTab : "mainTab"
        };
        return ret;
    };

    /**
     * Builds a fresh task object with some defaults.
     * @param parentId {String}. Id of parent record. NO_PARENT if root.
     * @param desc {String}. Description of the task. All info here.
     * @param weight {double}. Weight of this task in computing parent task. N/A for roots.
     * @param expanded {boolean}. True if expanded in UI.
     * @param createTime {Date}. Date of creation.
     * @param subtaskIds {Array[String]}. Ids of
     * @param queued {boolean}. True if this task is queued in the todo queue. May remove this.
     * @param listId {String}.  Id of the list record that this task belongs to. null if it does not
     *      belong to any list.
     */
    ret.buildTask = function(parentId, desc, weight, expanded, queued, listId){
        var ret = {
            parentId: parentId,
            desc: desc,
            weight: DEFAULT_WEIGHT,
            expanded: expanded,
            createTime: new Date(),
            queued: queued
        };
        if (listId !== null) {
            ret.listId = listId;
        }
        ret[CHILD_LIST_FIELD] = [];
        return ret;
    };

    /**
     * Builds a fresh archive entry.
     * @param date. {Date}. The date this archive entry is for, up to single day precision.
     * @returns {{date: *, tasks: Array}}
     */
    ret.buildArchiveEntry = function(date){
        var ret = {
            date : date,
            tasks : []
        };
        return ret;
    }

    /**
     * Builds a new list record.
     * @param name. {String}. Name of the list.
     * @param createTime. {Date}. Date of creation.
     * @returns {{name: *, createTime: *, tasks: Array}}
     *     taskIds. all of the ids of tasks that belong to this list.
     */
    ret.buildList = function(name, createTime){
        var ret = {
            name : name,
            createTime : createTime,
            taskIds : []
        };
        return ret;
    }

    /**
     * Basically adding this completed field to make shit queryable
     * @param task
     * @param completeTime
     */
    ret.setCompleted = function(task, completeTime) {
        var completeParams = {};
        if (completeTime === null) {
            completeParams.completed = null;
        } else {
            completeParams.completed = true;
        }
        completeParams.completeTime = completeTime;
        task.update(completeParams);
    }

    /**
     * Returns true if the task is completed. So I don't have to put a bunch of
     * null checks everywhere.
     * @param task
     * @returns {boolean}
     */
    ret.completed = function(task) {
        return task.get("completeTime") !== null;
    };

    /**
     * Toggles whether the task should show its completed status.
     * @param task
     */
    ret.toggleShowCompleted = function(task){
        if (task.has("showCompleted")) {
            task.set("showCompleted", null);
        } else {
            task.set("showCompleted", true);
        }
    }

    /**
     * Toggles whether the task should show its duration.
     * @param task
     */
    ret.toggleShowDuration = function(task){
        if (task.has("showDuration")) {
            task.set("showDuration", null);
        } else {
            task.set("showDuration", true);
        }
    }

    /**
     * Toggles whether the record has been expanded or not.
     * @param record
     */
    ret.toggleExpanded = function(record){
        if (record.has("expanded")) {
            record.set("expanded", null);
        } else {
            record.set("expanded", true);
        }
    }

    /**
     * Toggles whether the task is archived or not.
     * @param task
     */
    ret.toggleArchived = function(task){
        if (task.has("archived")) {
            task.set("archived", null);
        } else {
            task.set("archived", true);
        }
    }

    // statically checked getters
    ret.showCompleted = function(task){
        return task.has("showCompleted");
    }

    ret.showDuration = function(task){
        return task.has("showDuration");
    }

    ret.archived = function(task){
        return task.has("archived");
    }

    /**
     * Applies to both archiveEntry and task.
     * @param record
     * @returns {*}
     */
    ret.expanded = function(record){
        return record.has("expanded");
    }

    return ret;
})();
