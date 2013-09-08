/**
 * Provides methods for creating tasks, which will be stored in the datastore.
 *
 * Important: completed tasks will have a completeTime field.  This field will be
 * missing for incomplete tasks.
 */
var TaskTree = (function() {
    var ret = {}, DEFAULT_WEIGHT = 100;

    ret.DEFAULT_WEIGHT = DEFAULT_WEIGHT;

    /**
     * Builds a fresh task object with some defaults.
     * @param parentId {String}. Id of parent record. NO_PARENT if root.
     * @param desc {String}. Description of the task. All info here.
     * @param weight {double}. Weight of this task in computing parent task. N/A for roots.
     * @param expanded {boolean}. True if expanded in UI.
     * @param createTime {Date}. Date of creation.
     * @param queued {boolean}. True if this task is queued in the todo queue. May remove this.
     */
    ret.buildTask = function(parentId, desc, weight, expanded, queued){
        return {
            parentId: parentId,
            desc: desc,
            weight: DEFAULT_WEIGHT,
            expanded: expanded,
            createTime: new Date(),
            queued: queued
        }
    };

    /**
     * Returns true if the task is completed. So I don't have to put a bunch of
     * null checks everywhere.
     * @param task
     * @returns {boolean}
     */
    ret.completed = function(task) {
        return task.get("completeTime") !== null;
    };

    return ret;
})();
